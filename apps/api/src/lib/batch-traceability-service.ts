import {sql} from './db';
import {TRACE_PROTOCOL,TRACE_LIMITS,TraceabilityError,traceWindow,projectTraceEvent,traceText,traceTimestamp} from './batch-traceability-projection';
export async function readBatchTraceability(input:{tenant:string;bid:string;from?:unknown;to?:unknown;canLogistics:boolean}){
  if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(input.bid)||input.tenant&&!/^[a-z0-9][a-z0-9._-]{0,119}$/.test(input.tenant))throw new TraceabilityError('trace_scope_invalid');
  const window=traceWindow(input.from,input.to);
  // One statement snapshot. No ensureSchema, mutation, metric write or per-event SQL request.
  const rows=await sql`
    WITH scopes AS MATERIALIZED (
      SELECT b.id,b.tenant_id,b.bid,b.status::text AS status,t.slug AS tenant,t.name AS tenant_name,
        b.carrier_profile_code,COALESCE(b.sdm_config->>'product_name',b.sdm_config#>>'{sun,product,name}') AS product
      FROM batches b JOIN tenants t ON t.id=b.tenant_id
      WHERE b.bid=${input.bid} AND (${input.tenant}='' OR t.slug=${input.tenant}) LIMIT 2
    ), target AS MATERIALIZED (
      SELECT * FROM scopes WHERE (SELECT count(*) FROM scopes)=1
    ), selected_events AS MATERIALIZED (
      SELECT e.* FROM epcis_events e JOIN target b ON b.tenant_id=e.tenant_id
      WHERE e.event_time>=${window.start}::timestamptz AND e.event_time<${window.endExclusive}::timestamptz
        AND EXISTS(SELECT 1 FROM epcis_event_identifiers l JOIN gs1_digital_link_identities i ON i.id=l.gs1_identity_id AND i.tenant_id=l.tenant_id
          WHERE l.epcis_event_id=e.id AND l.tenant_id=b.tenant_id AND i.batch_id=b.id)
      ORDER BY e.event_time DESC,e.id DESC LIMIT 51
    ), event_rows AS (
      SELECT e.id::text,e.event_type,e.event_time,e.record_time,e.action,e.biz_step,e.disposition,e.read_point,e.biz_location,
        (e.event_json ? 'errorDeclaration') AS correction_declared,
        jsonb_build_object('parentID',e.event_json->'parentID','epcList',e.event_json->'epcList','childEPCs',e.event_json->'childEPCs',
          'inputEPCList',e.event_json->'inputEPCList','outputEPCList',e.event_json->'outputEPCList',
          'quantityList',e.event_json->'quantityList','childQuantityList',e.event_json->'childQuantityList',
          'inputQuantityList',e.event_json->'inputQuantityList','outputQuantityList',e.event_json->'outputQuantityList') AS projection,
        (SELECT coalesce(jsonb_agg(x ORDER BY x.id),'[]'::jsonb) FROM (
          SELECT i.id::text,i.gtin,i.lot,i.serial,i.batch_id::text,b.bid
          FROM epcis_event_identifiers l JOIN gs1_digital_link_identities i ON i.id=l.gs1_identity_id AND i.tenant_id=l.tenant_id
          JOIN batches b ON b.id=i.batch_id AND b.tenant_id=i.tenant_id
          WHERE l.epcis_event_id=e.id AND l.tenant_id=e.tenant_id ORDER BY i.id LIMIT 100
        ) x) AS identifiers
      FROM (SELECT * FROM selected_events ORDER BY event_time DESC,id DESC LIMIT 50) e
    ), selected_shipments AS MATERIALIZED (
      SELECT s.id::text,s.shipment_code,s.status,s.created_at,s.updated_at
      FROM shipments s JOIN target b ON b.tenant_id=s.tenant_id
      WHERE ${input.canLogistics} AND EXISTS (
        SELECT 1 FROM package_seals ps JOIN seal_inventory si ON si.id=ps.seal_id
        WHERE ps.shipment_id=s.id AND si.tenant_id=b.tenant_id AND si.batch_id=b.id)
      ORDER BY s.updated_at DESC,s.id DESC LIMIT 21
    ), selected_custody AS MATERIALIZED (
      SELECT c.id::text,c.event_type,c.created_at,s.id::text AS shipment_id,s.shipment_code
      FROM custody_events c JOIN target b ON b.tenant_id=c.tenant_id
      JOIN seal_inventory si ON si.id=c.seal_id AND si.tenant_id=b.tenant_id AND si.batch_id=b.id
      LEFT JOIN shipments s ON s.id=c.shipment_id AND s.tenant_id=b.tenant_id
      WHERE ${input.canLogistics} AND c.created_at>=${window.start}::timestamptz AND c.created_at<${window.endExclusive}::timestamptz
      ORDER BY c.created_at DESC,c.id DESC LIMIT 51
    )
    SELECT (SELECT count(*)::int FROM scopes) AS scope_count,(SELECT to_jsonb(b) FROM target b) AS batch,
      (SELECT coalesce(jsonb_agg(e ORDER BY e.event_time DESC,e.id DESC),'[]'::jsonb) FROM event_rows e) AS events,
      (SELECT count(*)>50 FROM selected_events) AS more_events,
      (SELECT coalesce(jsonb_agg(s ORDER BY s.updated_at DESC,s.id DESC),'[]'::jsonb) FROM (SELECT * FROM selected_shipments ORDER BY updated_at DESC,id DESC LIMIT 20) s) AS shipments,
      (SELECT count(*)>20 FROM selected_shipments) AS more_shipments,
      (SELECT coalesce(jsonb_agg(c ORDER BY c.created_at DESC,c.id DESC),'[]'::jsonb) FROM (SELECT * FROM selected_custody ORDER BY created_at DESC,id DESC LIMIT 50) c) AS custody,
      (SELECT count(*)>50 FROM selected_custody) AS more_custody,
      statement_timestamp() AS observed_at
  `;
  const source=rows[0];
  if(!source||source.scope_count===0)throw new TraceabilityError('trace_batch_not_found',404);
  if(source.scope_count!==1||!source.batch)throw new TraceabilityError('trace_batch_ambiguous',409);
  const b=source.batch;
  const events=source.events.map((e:Record<string,any>)=>projectTraceEvent(e,String(b.id)));
  const shipments=source.shipments.map((s:Record<string,any>)=>({id:String(s.id),code:traceText(s.shipment_code)||'Referencia no informada',status:traceText(s.status,60)||'not_reported',createdAt:traceTimestamp(s.created_at),updatedAt:traceTimestamp(s.updated_at),basis:'current_workflow_record'}));
  const custody=source.custody.map((c:Record<string,any>)=>({id:String(c.id),kind:'custody',type:traceText(c.event_type,60)||'not_reported',recordedAt:traceTimestamp(c.created_at),shipmentId:c.shipment_id||null,shipmentCode:traceText(c.shipment_code),basis:'recorded_custody_workflow'}));
  return {ok:true,protocol:TRACE_PROTOCOL,source:'database',observedAt:traceTimestamp(source.observed_at),scope:{tenant:b.tenant,tenantName:traceText(b.tenant_name)||b.tenant,bid:b.bid,batchId:String(b.id)},product:{name:traceText(b.product,240)||b.bid,carrier:traceText(b.carrier_profile_code,80),status:traceText(b.status,80)},window,events,custody,shipments,hasMore:{events:source.more_events===true,custody:source.more_custody===true,shipments:source.more_shipments===true},logisticsAccess:input.canLogistics?'allowed':'restricted',limits:TRACE_LIMITS,readOnly:true,relationshipMode:'historical_events_not_current_containment'};
}
