-- Additive release: no rewriting/deleting existing shipments, seals or evidence.
-- Every call is a single transaction; receipt and domain writes commit together.
CREATE TABLE IF NOT EXISTS public.logistics_operation_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  actor_scope text NOT NULL CHECK (length(actor_scope) BETWEEN 1 AND 180),
  key_hash text NOT NULL CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  operation text NOT NULL CHECK (operation IN ('CREATE','APPLY','HANDOFF','VERIFY')),
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, actor_scope, key_hash)
);
REVOKE ALL ON public.logistics_operation_receipts FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.nexid_logistics_commit_v1(
  p_tenant uuid, p_actor text, p_key_hash text, p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  op text := p_payload->>'operation';
  request_hash text := encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
  old_receipt public.logistics_operation_receipts%ROWTYPE;
  s public.seal_inventory%ROWTYPE; sh public.shipments%ROWTYPE;
  assigned uuid; target_shipment uuid; carrier uuid; row_item jsonb;
  shipment_code text; q numeric; target_status text; aggregate_status text;
  old_status text; tamper text; verification_status text; issue text;
  evidence_id uuid; receipt_id uuid := gen_random_uuid(); result jsonb;
  ranks text[] := ARRAY['UNASSIGNED','ASSIGNED','SEALED','IN_TRANSIT','DELIVERED_CLOSED','DELIVERED_OPENED','QUARANTINED','VOIDED'];
BEGIN
  IF p_tenant IS NULL OR p_actor IS NULL OR length(p_actor) NOT BETWEEN 1 AND 180
     OR p_key_hash IS NULL OR p_key_hash !~ '^[a-f0-9]{64}$'
     OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
     OR op IS NULL OR op NOT IN ('CREATE','APPLY','HANDOFF','VERIFY') THEN
    RAISE EXCEPTION 'logistics_input_invalid';
  END IF;
  PERFORM set_config('lock_timeout','5s',true);
  PERFORM 1 FROM public.tenants WHERE id=p_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'logistics_tenant_not_found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('nexid:logistics:'||p_tenant::text||':'||p_actor||':'||p_key_hash,0));
  SELECT * INTO old_receipt FROM public.logistics_operation_receipts
    WHERE tenant_id=p_tenant AND actor_scope=p_actor AND key_hash=p_key_hash;
  IF FOUND THEN
    IF old_receipt.request_hash <> request_hash THEN RAISE EXCEPTION 'logistics_idempotency_conflict'; END IF;
    RETURN jsonb_build_object('ok',true,'replayed',true,'receiptId',old_receipt.id,'data',old_receipt.response);
  END IF;
  IF op='CREATE' THEN
    IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_payload->'items') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'logistics_items_invalid'; END IF;
    FOR row_item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
      IF jsonb_typeof(row_item) <> 'object' OR jsonb_typeof(row_item->'productName') IS DISTINCT FROM 'string'
         OR length(btrim(row_item->>'productName')) NOT BETWEEN 1 AND 180
         OR jsonb_typeof(row_item->'quantity') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'logistics_items_invalid'; END IF;
      q := (row_item->>'quantity')::numeric;
      IF q<>trunc(q) OR q NOT BETWEEN 1 AND 1000000 THEN RAISE EXCEPTION 'logistics_items_invalid'; END IF;
    END LOOP;
    IF nullif(p_payload->>'carrierCode','') IS NOT NULL THEN
      SELECT id INTO carrier FROM public.carrier_integrations WHERE tenant_id=p_tenant AND code=p_payload->>'carrierCode';
      IF NOT FOUND THEN RAISE EXCEPTION 'logistics_carrier_not_found'; END IF;
    END IF;
    shipment_code := coalesce(nullif(p_payload->>'shipmentCode',''),'SDL-'||to_char(current_timestamp AT TIME ZONE 'UTC','YYYYMMDD')||'-'||upper(substr(gen_random_uuid()::text,1,8)));
    IF length(shipment_code)>120 THEN RAISE EXCEPTION 'logistics_input_invalid'; END IF;
    INSERT INTO public.shipments(tenant_id,shipment_code,carrier_id,tracking_number,status,origin_address,destination_address)
      VALUES(p_tenant,shipment_code,carrier,nullif(p_payload->>'trackingNumber',''),'draft',nullif(p_payload->>'originAddress',''),nullif(p_payload->>'destinationAddress','')) RETURNING * INTO sh;
    INSERT INTO public.shipment_items(shipment_id,product_name,quantity)
      SELECT sh.id,btrim(item->>'productName'),(item->>'quantity')::integer FROM jsonb_array_elements(p_payload->'items') item;
    result := jsonb_build_object('id',sh.id,'tenantId',p_tenant,'shipmentCode',sh.shipment_code,'status',sh.status,'trackingNumber',sh.tracking_number,'itemCount',jsonb_array_length(p_payload->'items'));
  ELSE
    IF coalesce(p_payload->>'uidHex','') !~ '^[A-F0-9]{14}$' THEN RAISE EXCEPTION 'logistics_uid_invalid'; END IF;
    SELECT * INTO s FROM public.seal_inventory WHERE tenant_id=p_tenant AND uid_hex=p_payload->>'uidHex' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'logistics_seal_not_found'; END IF;
    IF s.status::text='VOIDED' THEN RAISE EXCEPTION 'logistics_seal_voided'; END IF;
    IF (SELECT count(*) FROM public.package_seals WHERE seal_id=s.id)>1 THEN RAISE EXCEPTION 'logistics_assignment_ambiguous'; END IF;
    SELECT shipment_id INTO assigned FROM public.package_seals WHERE seal_id=s.id LIMIT 1;
    target_shipment := coalesce(nullif(p_payload->>'shipmentId','')::uuid,assigned);
    IF target_shipment IS NULL THEN RAISE EXCEPTION 'logistics_shipment_required'; END IF;
    IF assigned IS NOT NULL AND assigned<>target_shipment THEN RAISE EXCEPTION 'logistics_seal_already_assigned'; END IF;
    IF op<>'APPLY' AND assigned IS NULL THEN RAISE EXCEPTION 'logistics_seal_unassigned'; END IF;
    SELECT * INTO sh FROM public.shipments WHERE id=target_shipment AND tenant_id=p_tenant FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'logistics_shipment_not_found'; END IF;
    IF sh.status='VOIDED' OR (assigned IS NULL AND sh.status IN ('DELIVERED_CLOSED','DELIVERED_OPENED','QUARANTINED')) THEN RAISE EXCEPTION 'logistics_shipment_terminal'; END IF;
    old_status := s.status::text;
    tamper := CASE upper(coalesce(p_payload->>'ttRaw','')) WHEN '4343' THEN 'closed' WHEN '4F4F' THEN 'opened' WHEN '4F43' THEN 'opened' WHEN '4949' THEN 'opened' ELSE 'unknown' END;
    target_status := CASE WHEN tamper='closed' THEN CASE op WHEN 'APPLY' THEN 'SEALED' WHEN 'HANDOFF' THEN 'IN_TRANSIT' ELSE 'DELIVERED_CLOSED' END WHEN op='VERIFY' AND tamper='opened' THEN 'DELIVERED_OPENED' ELSE 'QUARANTINED' END;
    IF array_position(ranks,old_status)>array_position(ranks,target_status) THEN target_status:=old_status; END IF;
    UPDATE public.seal_inventory SET status=target_status::public.seal_status,updated_at=now() WHERE id=s.id AND tenant_id=p_tenant;
    INSERT INTO public.package_seals(shipment_id,seal_id,status,applied_at)
      VALUES(sh.id,s.id,target_status::public.seal_status,now())
      ON CONFLICT(shipment_id,seal_id) DO UPDATE SET status=EXCLUDED.status,applied_at=coalesce(package_seals.applied_at,now());
    INSERT INTO public.custody_events(tenant_id,shipment_id,seal_id,event_type,location,scanned_by,notes)
      VALUES(p_tenant,sh.id,s.id,target_status,nullif(p_payload->>'location',''),nullif(p_payload->>'scannedBy',''),'Declared operator action '||op||'; reported TT='||coalesce(nullif(p_payload->>'ttRaw',''),'unknown')||'; receipt='||receipt_id::text) RETURNING id INTO evidence_id;
    -- All writers lock the shipment before recomputing its aggregate. One closed seal cannot hide another damaged seal.
    SELECT CASE
      WHEN bool_or(status::text IN ('QUARANTINED','VOIDED')) THEN 'QUARANTINED'
      WHEN bool_or(status::text='DELIVERED_OPENED') THEN 'DELIVERED_OPENED'
      ELSE ranks[min(array_position(ranks,status::text))]
    END INTO aggregate_status FROM public.package_seals WHERE shipment_id=sh.id;
    IF sh.status IN ('DELIVERED_OPENED','QUARANTINED') AND array_position(ranks,sh.status)>array_position(ranks,aggregate_status) THEN aggregate_status:=sh.status; END IF;
    UPDATE public.shipments SET status=aggregate_status,updated_at=now() WHERE id=sh.id AND tenant_id=p_tenant;
    IF op='VERIFY' THEN
      verification_status := CASE target_status WHEN 'DELIVERED_CLOSED' THEN 'verified' WHEN 'DELIVERED_OPENED' THEN 'tampered' ELSE 'review_required' END;
      INSERT INTO public.recipient_verifications(tenant_id,shipment_id,recipient_name,verification_method,status,verified_at)
        VALUES(p_tenant,sh.id,nullif(p_payload->>'recipientName',''),coalesce(nullif(p_payload->>'verificationMethod',''),'OPERATOR_DECLARATION'),verification_status,now());
      IF target_status IN ('DELIVERED_OPENED','QUARANTINED') THEN
        issue := CASE target_status WHEN 'DELIVERED_OPENED' THEN 'tamper_reported' ELSE 'seal_review_required' END;
        INSERT INTO public.delivery_claims(tenant_id,shipment_id,issue_type,description,status)
          SELECT p_tenant,sh.id,issue,'Recipient declaration requires review; operation receipt '||receipt_id::text,'open'
          WHERE NOT EXISTS(SELECT 1 FROM public.delivery_claims WHERE tenant_id=p_tenant AND shipment_id=sh.id AND issue_type=issue AND status='open');
      END IF;
    END IF;
    result := jsonb_build_object('sealId',s.id,'previousStatus',old_status,'newStatus',target_status,'shipmentId',sh.id,'shipmentStatus',aggregate_status,'tamperState',tamper,'custodyEventId',evidence_id,'evidenceKind','operator_declared');
  END IF;
  INSERT INTO public.logistics_operation_receipts(id,tenant_id,actor_scope,key_hash,request_hash,operation,response)
    VALUES(receipt_id,p_tenant,p_actor,p_key_hash,request_hash,op,result);
  RETURN jsonb_build_object('ok',true,'replayed',false,'receiptId',receipt_id,'data',result);
END;
$fn$;
REVOKE ALL ON FUNCTION public.nexid_logistics_commit_v1(uuid,text,text,jsonb) FROM PUBLIC;
COMMENT ON FUNCTION public.nexid_logistics_commit_v1(uuid,text,text,jsonb) IS 'Transactional logistics mutation + durable idempotent receipt. Backend tenant and actor authorization required. No cryptographic NFC verification is performed here.';
