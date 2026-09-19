import {sql} from './db';
import {TRACE_PROTOCOL,TraceError,traceEvent,traceRelations,UUID,type TraceFilters} from './batch-trace-policy';
async function scopeFor(tenant:string,bid:string){
 if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(bid))throw new TraceError('trace_bid_invalid');
 const rows=await sql`SELECT b.id::text batch_id,t.id::text tenant_id,b.bid,t.slug tenant,coalesce(b.sdm_config->>'product_name',b.sdm_config#>>'{sun,product,name}','') product,b.carrier_profile_code carrier
 FROM batches b JOIN tenants t ON t.id=b.tenant_id WHERE b.bid=${bid} AND (${tenant}='' OR t.slug=${tenant}) ORDER BY b.id LIMIT 2`;
 if(rows.length!==1)throw new TraceError(rows.length?'trace_batch_ambiguous':'trace_batch_not_found',rows.length?409:404);
 const r=rows[0];return {tenant:r.tenant,tenantId:r.tenant_id,batchId:r.batch_id,bid:r.bid,product:r.product,carrier:r.carrier||null};
}
export async function readBatchTrace(tenant:string,bid:string,f:TraceFilters){
 const scope=await scopeFor(tenant,bid);
 const rows=await sql`WITH target AS MATERIALIZED (SELECT id,tenant_id FROM batches WHERE id=${scope.batchId}::uuid AND tenant_id=${scope.tenantId}::uuid),
 selected_identity AS (SELECT i.id FROM gs1_digital_link_identities i,target b WHERE i.batch_id=b.id AND i.tenant_id=b.tenant_id AND i.id=${f.identityId||null}::uuid),
 event_page AS MATERIALIZED (
 SELECT e.id::text,e.client_event_id,e.event_type,e.event_time,e.record_time,e.event_time_zone_offset,e.action,e.biz_step,e.disposition,e.read_point,e.biz_location,
 (e.event_json->'errorDeclaration' IS NOT NULL AND e.event_json->'errorDeclaration'<>'null'::jsonb) has_error,
 (SELECT count(*)::int FROM epcis_event_identifiers links WHERE links.epcis_event_id=e.id AND links.tenant_id=e.tenant_id) linked_count
 FROM epcis_events e,target b WHERE e.tenant_id=b.tenant_id AND e.event_time>=${f.from+'T00:00:00Z'}::timestamptz AND e.event_time<${f.to+'T00:00:00Z'}::timestamptz
 AND (${f.eventType}='' OR e.event_type=${f.eventType})
 AND EXISTS(SELECT 1 FROM epcis_event_identifiers l JOIN gs1_digital_link_identities i ON i.id=l.gs1_identity_id AND i.tenant_id=l.tenant_id WHERE l.epcis_event_id=e.id AND l.tenant_id=b.tenant_id AND i.batch_id=b.id AND (${f.identityId}='' OR i.id=${f.identityId||null}::uuid))
 ORDER BY e.event_time DESC,e.id DESC LIMIT 51),
 identity_page AS (SELECT i.id::text,i.gtin,i.lot,i.serial,i.status FROM gs1_digital_link_identities i,target b WHERE i.batch_id=b.id AND i.tenant_id=b.tenant_id ORDER BY i.gtin,i.lot,i.serial,i.id LIMIT 101),
 shipment_page AS (
 SELECT s.id::text,s.shipment_code,s.status::text,s.created_at,s.updated_at,
 (SELECT count(*)::int FROM package_seals p JOIN seal_inventory seal ON seal.id=p.seal_id WHERE p.shipment_id=s.id AND seal.tenant_id=b.tenant_id AND seal.batch_id=b.id) linked_seals
 FROM shipments s,target b WHERE s.tenant_id=b.tenant_id AND EXISTS(SELECT 1 FROM package_seals p JOIN seal_inventory seal ON seal.id=p.seal_id WHERE p.shipment_id=s.id AND seal.tenant_id=b.tenant_id AND seal.batch_id=b.id)
 ORDER BY s.created_at DESC,s.id DESC LIMIT 11)
 SELECT now() observed_at,EXISTS(SELECT 1 FROM target) scope_exists,EXISTS(SELECT 1 FROM selected_identity) identity_exists,
 coalesce((SELECT jsonb_agg(e ORDER BY e.event_time DESC,e.id DESC) FROM event_page e),'[]'::jsonb) events,
 coalesce((SELECT jsonb_agg(i ORDER BY i.gtin,i.lot,i.serial,i.id) FROM identity_page i),'[]'::jsonb) identities,
 coalesce((SELECT jsonb_agg(s ORDER BY s.created_at DESC,s.id DESC) FROM shipment_page s),'[]'::jsonb) shipments`;
 const row=rows[0];
 if(!row || !row.scope_exists) throw new TraceError('trace_scope_changed',409);
 if(f.identityId && !row.identity_exists) throw new TraceError('trace_identity_not_in_batch',404);
 return {
  ok:true, protocol:TRACE_PROTOCOL, source:'database', readOnly:true,
  observedAt:new Date(row.observed_at).toISOString(), scope, filters:f,
  events:row.events.slice(0,50).map(traceEvent), hasMoreEvents:row.events.length>50,
  identities:row.identities.slice(0,100), hasMoreIdentities:row.identities.length>100,
  shipments:row.shipments.slice(0,10), hasMoreShipments:row.shipments.length>10,
 };
}
export async function readTraceDetail(tenant:string,bid:string,eventId:string,f:TraceFilters){
 if(!UUID.test(eventId)) throw new TraceError('trace_event_id_invalid');
 const scope=await scopeFor(tenant,bid);
 const rows=await sql`SELECT e.id::text,e.client_event_id,e.event_type,e.event_time,e.record_time,e.event_time_zone_offset,e.action,e.biz_step,e.disposition,e.read_point,e.biz_location,
 e.document_id::text,d.capture_operation_id::text capture_id,now() observed_at,
 (e.event_json->'errorDeclaration' IS NOT NULL AND e.event_json->'errorDeclaration'<>'null'::jsonb) has_error,
 jsonb_build_object('parentID',e.event_json->'parentID','epcList',e.event_json->'epcList','childEPCs',e.event_json->'childEPCs','inputEPCList',e.event_json->'inputEPCList','outputEPCList',e.event_json->'outputEPCList','quantityList',e.event_json->'quantityList','childQuantityList',e.event_json->'childQuantityList','inputQuantityList',e.event_json->'inputQuantityList','outputQuantityList',e.event_json->'outputQuantityList') fields,
 (SELECT count(*)::int FROM epcis_event_identifiers l WHERE l.epcis_event_id=e.id AND l.tenant_id=e.tenant_id) linked_count,
 coalesce((SELECT jsonb_agg(i ORDER BY i.gtin,i.lot,i.serial) FROM (
 SELECT g.id::text,g.batch_id::text,b.bid,g.gtin,g.lot,g.serial,g.status
 FROM epcis_event_identifiers l JOIN gs1_digital_link_identities g ON g.id=l.gs1_identity_id AND g.tenant_id=l.tenant_id JOIN batches b ON b.id=g.batch_id AND b.tenant_id=g.tenant_id
 WHERE l.epcis_event_id=e.id AND l.tenant_id=e.tenant_id ORDER BY g.gtin,g.lot,g.serial LIMIT 101) i),'[]'::jsonb) identifiers
 FROM epcis_events e JOIN epcis_documents d ON d.id=e.document_id AND d.tenant_id=e.tenant_id
 WHERE e.id=${eventId}::uuid AND e.tenant_id=${scope.tenantId}::uuid
 AND e.event_time>=${f.from+'T00:00:00Z'}::timestamptz AND e.event_time<${f.to+'T00:00:00Z'}::timestamptz
 AND (${f.eventType}='' OR e.event_type=${f.eventType})
 AND EXISTS(SELECT 1 FROM epcis_event_identifiers l JOIN gs1_digital_link_identities g ON g.id=l.gs1_identity_id AND g.tenant_id=l.tenant_id WHERE l.epcis_event_id=e.id AND l.tenant_id=e.tenant_id AND g.batch_id=${scope.batchId}::uuid AND (${f.identityId}='' OR g.id=${f.identityId||null}::uuid)) LIMIT 1`;
 const row=rows[0];
 if(!row) throw new TraceError('trace_event_not_in_scope',404);
 return {ok:true,protocol:TRACE_PROTOCOL,source:'database',readOnly:true,
 observedAt:new Date(row.observed_at).toISOString(),scope,filters:f,event:traceEvent(row),
 documentId:row.document_id,captureId:row.capture_id,...traceRelations(row.fields,row.identifiers)};
}
