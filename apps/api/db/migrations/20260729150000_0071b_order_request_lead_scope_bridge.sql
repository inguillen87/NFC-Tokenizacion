-- Bridge a historical production ledger gap before 0072. The canonical 0015
-- migration added order_requests.lead_id, but some long-lived environments
-- reached the 006x line without that column. This bridge is deliberately
-- expand-only: it restores the nullable identity and its referential boundary,
-- but does not infer historical lead relationships from contact data.

DO $$
DECLARE
  v_lead_id_attnum smallint;
  v_leads_id_attnum smallint;
  v_orphan_count bigint;
  v_named_constraint_exists boolean;
  v_named_constraint_is_canonical boolean;
BEGIN
  IF to_regclass('public.order_requests') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42P01',
      MESSAGE = 'order_request_lead_scope_bridge_order_requests_missing';
  END IF;

  IF to_regclass('public.leads') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42P01',
      MESSAGE = 'order_request_lead_scope_bridge_leads_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute attribute
    WHERE attribute.attrelid = 'public.leads'::regclass
      AND attribute.attname = 'id'
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND attribute.atttypid = 'uuid'::regtype
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42804',
      MESSAGE = 'order_request_lead_scope_bridge_leads_id_not_uuid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute attribute
    WHERE attribute.attrelid = 'public.order_requests'::regclass
      AND attribute.attname = 'lead_id'
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  ) THEN
    ALTER TABLE public.order_requests
      ADD COLUMN lead_id uuid;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_attribute attribute
    WHERE attribute.attrelid = 'public.order_requests'::regclass
      AND attribute.attname = 'lead_id'
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND attribute.atttypid = 'uuid'::regtype
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42804',
      MESSAGE = 'order_request_lead_scope_bridge_lead_id_not_uuid';
  END IF;

  SELECT attribute.attnum
    INTO v_lead_id_attnum
  FROM pg_attribute attribute
  WHERE attribute.attrelid = 'public.order_requests'::regclass
    AND attribute.attname = 'lead_id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  SELECT attribute.attnum
    INTO v_leads_id_attnum
  FROM pg_attribute attribute
  WHERE attribute.attrelid = 'public.leads'::regclass
    AND attribute.attname = 'id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  SELECT count(*)
    INTO v_orphan_count
  FROM public.order_requests request
  LEFT JOIN public.leads lead ON lead.id = request.lead_id
  WHERE request.lead_id IS NOT NULL
    AND lead.id IS NULL;

  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'order_request_lead_scope_bridge_orphaned_lead_ids',
      DETAIL = format('orphan_count=%s', v_orphan_count);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    WHERE constraint_record.conrelid = 'public.order_requests'::regclass
      AND constraint_record.conname = 'order_requests_lead_id_fkey'
  ) INTO v_named_constraint_exists;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    WHERE constraint_record.conrelid = 'public.order_requests'::regclass
      AND constraint_record.conname = 'order_requests_lead_id_fkey'
      AND constraint_record.contype = 'f'
      AND constraint_record.confrelid = 'public.leads'::regclass
      AND constraint_record.conkey = ARRAY[v_lead_id_attnum]::smallint[]
      AND constraint_record.confkey = ARRAY[v_leads_id_attnum]::smallint[]
      AND constraint_record.confdeltype = 'n'
  ) INTO v_named_constraint_is_canonical;

  IF v_named_constraint_exists AND NOT v_named_constraint_is_canonical THEN
    RAISE EXCEPTION USING
      ERRCODE = '42809',
      MESSAGE = 'order_request_lead_scope_bridge_constraint_conflict';
  END IF;

  IF NOT v_named_constraint_exists THEN
    ALTER TABLE public.order_requests
      ADD CONSTRAINT order_requests_lead_id_fkey
      FOREIGN KEY (lead_id)
      REFERENCES public.leads(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.order_requests
  VALIDATE CONSTRAINT order_requests_lead_id_fkey;

CREATE INDEX IF NOT EXISTS idx_order_requests_lead_id
  ON public.order_requests (lead_id)
  WHERE lead_id IS NOT NULL;
