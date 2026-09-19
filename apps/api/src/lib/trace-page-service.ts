import {sql} from './db';
import {TRACE_PROTOCOL,TRACE_LIMITS,TraceabilityError,traceWindow,projectTraceEvent,traceText,traceTimestamp} from './batch-traceability-projection';
import {TRACE_PAGE_PROTOCOL,TRACE_PAGE_SIZE,traceQuery,readTraceCursor,traceCursor,type TracePosition} from './trace-page-policy';
export async function readTracePage(input:{tenant:string;bid:string;from?:unknown;to?:unknown;source?:unknown;type?:unknown;gtin?:unknown;lot?:unknown;serial?:unknown;exact?:unknown;cursor?:unknown;canLogistics:boolean}){
 if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(input.bid)||input.tenant&&!/^[a-z0-9][a-z0-9._-]{0,119}$/.test(input.tenant))throw new TraceabilityError('trace_scope_invalid');
 const window=traceWindow(input.from,input.to),query=traceQuery(input);
 if(query.source==='custody'&&!input.canLogistics)throw new TraceabilityError('trace_logistics_forbidden',403);
 const cursor=readTraceCursor(input.cursor,{...input,window,query});
 const lastAt=cursor?.last?.at||null,lastRank=cursor?.last?.kind==='epcis'?1:0,lastId=cursor?.last?.id||null;
 // Keyset over one combined chronological stream. Every page is one statement snapshot.
 // cutoff is a record-time boundary, NOT a repeatable-read snapshot across different requests.
 const results=await sql`
 WITH scopes AS MATERIALIZED (
   SELECT b.id,b.tenant_id,b.bid,b.status::text AS status,t.slug AS tenant,t.name AS tenant_name,
     b.carrier_profile_code,COALESCE(b.sdm_config->>'product_name',b.sdm_config#>>'{sun,product,name}') AS product
   FROM batches b JOIN tenants t ON t.id=b.tenant_id
   WHERE b.bid=${input.bid} AND (${input.tenant}='' OR t.slug=${input.tenant}) LIMIT 2
 ), target AS MATERIALIZED (SELECT * FROM scopes WHERE (SELECT count(*) FROM scopes)=1),
 boundary AS MATERIALIZED (SELECT COALESCE(${cursor?.cutoff||null}::timestamptz,statement_timestamp()) AS cutoff),
 epcis_candidates AS MATERIALIZED (
   SELECT e.id,e.event_time AS sort_time,1 AS rank,'epcis'::text AS kind
   FROM epcis_events e JOIN target b ON b.tenant_id=e.tenant_id CROSS JOIN boundary z
   WHERE ${query.source!=='custody'} AND e.event_time>=${window.start}::timestamptz AND e.event_time<${window.endExclusive}::timestamptz
     AND e.record_time<=z.cutoff
     AND (${query.type}='' OR e.event_type=${query.type} OR (${query.type}='relationships' AND e.event_type IN ('AggregationEvent','AssociationEvent','TransformationEvent')))
     AND EXISTS(SELECT 1 FROM epcis_event_identifiers l JOIN gs1_digital_link_identities i ON i.id=l.gs1_identity_id AND i.tenant_id=l.tenant_id
       WHERE l.epcis_event_id=e.id AND l.tenant_id=b.tenant_id AND i.batch_id=b.id
       AND (${query.gtin}='' OR i.gtin=${query.gtin})
       AND ((NOT ${query.exact} AND ${query.lot}='') OR i.lot=${query.lot})
       AND ((NOT ${query.exact} AND ${query.serial}='') OR i.serial=${query.serial}))
     AND (${lastAt}::timestamptz IS NULL OR (e.event_time,1,e.id)<(${lastAt}::timestamptz,${lastRank}::int,${lastId}::uuid))
   ORDER BY e.event_time DESC,e.id DESC LIMIT 51
 ), custody_candidates AS MATERIALIZED (
   SELECT c.id,c.created_at AS sort_time,0 AS rank,'custody'::text AS kind
   FROM custody_events c JOIN target b ON b.tenant_id=c.tenant_id
   JOIN seal_inventory si ON si.id=c.seal_id AND si.tenant_id=b.tenant_id AND si.batch_id=b.id CROSS JOIN boundary z
   WHERE ${input.canLogistics&&query.source!=='epcis'} AND c.created_at>=${window.start}::timestamptz AND c.created_at<${window.endExclusive}::timestamptz AND c.created_at<=z.cutoff
     AND (${lastAt}::timestamptz IS NULL OR (c.created_at,0,c.id)<(${lastAt}::timestamptz,${lastRank}::int,${lastId}::uuid))
   ORDER BY c.created_at DESC,c.id DESC LIMIT 51
 ), candidates AS MATERIALIZED (
   SELECT * FROM (SELECT * FROM epcis_candidates UNION ALL SELECT * FROM custody_candidates) x ORDER BY sort_time DESC,rank DESC,id DESC LIMIT 51
 ), page_rows AS MATERIALIZED (SELECT * FROM candidates ORDER BY sort_time DESC,rank DESC,id DESC LIMIT 50),
 event_rows AS (
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
   FROM page_rows p JOIN epcis_events e ON p.kind='epcis' AND e.id=p.id JOIN target b ON b.tenant_id=e.tenant_id
 ), custody_rows AS (
   SELECT c.id::text,c.event_type,c.created_at,s.id::text AS shipment_id,s.shipment_code
   FROM page_rows p JOIN custody_events c ON p.kind='custody' AND c.id=p.id JOIN target b ON b.tenant_id=c.tenant_id
   LEFT JOIN shipments s ON s.id=c.shipment_id AND s.tenant_id=b.tenant_id
 ), selected_shipments AS MATERIALIZED (
   SELECT s.id::text,s.shipment_code,s.status,s.created_at,s.updated_at FROM shipments s JOIN target b ON b.tenant_id=s.tenant_id
   WHERE ${input.canLogistics} AND EXISTS(SELECT 1 FROM package_seals ps JOIN seal_inventory si ON si.id=ps.seal_id WHERE ps.shipment_id=s.id AND si.tenant_id=b.tenant_id AND si.batch_id=b.id)
   ORDER BY s.updated_at DESC,s.id DESC LIMIT 21
 )
 SELECT (SELECT count(*)::int FROM scopes) AS scope_count,(SELECT to_jsonb(b) FROM target b) AS batch,
   (SELECT coalesce(jsonb_agg(e ORDER BY e.event_time DESC,e.id DESC),'[]'::jsonb) FROM event_rows e) AS events,
   (SELECT coalesce(jsonb_agg(c ORDER BY c.created_at DESC,c.id DESC),'[]'::jsonb) FROM custody_rows c) AS custody,
   (SELECT coalesce(jsonb_agg(s ORDER BY s.updated_at DESC,s.id DESC),'[]'::jsonb) FROM (SELECT * FROM selected_shipments ORDER BY updated_at DESC,id DESC LIMIT 20) s) AS shipments,
   (SELECT count(*)>20 FROM selected_shipments) AS more_shipments,
   (SELECT count(*)>50 FROM candidates) AS more,
   (SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id::text,'kind',p.kind,'at',to_char(p.sort_time AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) ORDER BY p.sort_time DESC,p.rank DESC,p.id DESC),'[]'::jsonb) FROM page_rows p) AS positions,
   (SELECT to_char(cutoff AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') FROM boundary) AS cutoff,
   statement_timestamp() AS observed_at
 `;
 const s=results[0];if(!s||s.scope_count===0)throw new TraceabilityError('trace_batch_not_found',404);
 if(s.scope_count!==1||!s.batch)throw new TraceabilityError('trace_batch_ambiguous',409);
 const b=s.batch;if(cursor&&(cursor.batchId!==String(b.id)||cursor.tenant!==b.tenant))throw new TraceabilityError('trace_cursor_mismatch',409);
 const events=s.events.map((e:Record<string,any>)=>projectTraceEvent(e,String(b.id)));
 const custody=s.custody.map((c:Record<string,any>)=>({id:String(c.id),kind:'custody',type:traceText(c.event_type,60)||'not_reported',recordedAt:traceTimestamp(c.created_at),shipmentId:c.shipment_id||null,shipmentCode:traceText(c.shipment_code),basis:'recorded_custody_workflow'}));
 const shipments=s.shipments.map((x:Record<string,any>)=>({id:String(x.id),code:traceText(x.shipment_code)||'Referencia no informada',status:traceText(x.status,60)||'not_reported',createdAt:traceTimestamp(x.created_at),updatedAt:traceTimestamp(x.updated_at),basis:'current_workflow_record'}));
 const positions=s.positions as TracePosition[],page=cursor?.page||1,hasNext=s.more===true;
 const currentCursor=traceCursor({v:1,tenant:b.tenant,bid:b.bid,batchId:String(b.id),from:window.from,to:window.to,query,logistics:input.canLogistics,cutoff:s.cutoff,last:cursor?.last||null,page});
 const next=hasNext&&positions.length?traceCursor({v:1,tenant:b.tenant,bid:b.bid,batchId:String(b.id),from:window.from,to:window.to,query,logistics:input.canLogistics,cutoff:s.cutoff,last:positions[positions.length-1],page:page+1}):null;
 const trace={ok:true,protocol:TRACE_PROTOCOL,source:'database',observedAt:traceTimestamp(s.observed_at),scope:{tenant:b.tenant,tenantName:traceText(b.tenant_name)||b.tenant,bid:b.bid,batchId:String(b.id)},product:{name:traceText(b.product,240)||b.bid,carrier:traceText(b.carrier_profile_code,80),status:traceText(b.status,80)},window,events,custody,shipments,hasMore:{events:false,custody:false,shipments:s.more_shipments===true},logisticsAccess:input.canLogistics?'allowed':'restricted',limits:TRACE_LIMITS,readOnly:true,relationshipMode:'historical_events_not_current_containment'};
 return {ok:true,protocol:TRACE_PAGE_PROTOCOL,trace,query,navigation:{page,pageSize:TRACE_PAGE_SIZE,currentCursor,returned:positions.length,hasNext,nextCursor:next,cutoff:s.cutoff,positions,consistency:'record_time_boundary_not_repeatable_snapshot',shipmentsBasis:'current_batch_records'}};
}
