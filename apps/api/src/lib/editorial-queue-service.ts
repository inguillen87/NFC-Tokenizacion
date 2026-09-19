import {sql} from './db';
import {EDITORIAL_QUEUE_PROTOCOL,EDITORIAL_STATES,QueueError,queueActorId,queueScopeDigest,queueCursor,readQueueCursor,queueNextStep,UUID,type QueueActor,type QueueFilters,type QueueState} from './editorial-queue-policy';
function text(v:unknown,max=180):string|null{if(v==null)return null;if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))throw new QueueError('editorial_queue_source_invalid',503);return v;}
export async function readEditorialQueue(tenant:string,f:QueueFilters,rawCursor:string|null,authority:QueueActor){
 if(tenant&&!/^[a-z0-9][a-z0-9._-]{0,119}$/.test(tenant))throw new QueueError('editorial_queue_scope_invalid');
 const actor={...authority,id:queueActorId(authority.id)},scopeDigest=queueScopeDigest(tenant,f,actor),cursor=readQueueCursor(rawCursor,scopeDigest);
 const term='%'+f.q.replace(/[!%_]/g,x=>'!'+x)+'%';
 const rows=await sql`
 WITH base AS MATERIALIZED (
  SELECT b.id,b.tenant_id,b.bid,t.slug tenant,t.name tenant_name,b.editorial_managed,h.updated_at,h.published_version,
   h.draft->>'state' state,h.draft->>'revision' revision,h.draft#>>'{document,identity,product_name}' product,
   h.draft#>>'{document,template}' template,h.draft#>>'{document,locale}' locale,
   coalesce(${actor.id}=ANY(ARRAY[h.draft->>'createdBy',h.draft->>'lastEditorId',h.draft->>'submittedBy']),false) participant,
   coalesce(h.draft#>>'{scope,tenantId}'=t.id::text AND h.draft#>>'{scope,batchId}'=b.id::text AND h.draft#>>'{document,schemaVersion}'='nexid.passport-editorial.v1',false) coherent,
   CASE WHEN h.draft->>'state'='approved' THEN coalesce(h.draft#>>'{approval,contentDigest}'=h.draft->>'contentDigest',false) ELSE true END approval_coherent
  FROM passport_editorial_heads h JOIN batches b ON b.id=h.batch_id AND b.tenant_id=h.tenant_id JOIN tenants t ON t.id=h.tenant_id
  WHERE (${tenant}='' OR t.slug=${tenant})
 ), classified AS MATERIALIZED (
  SELECT b.*,CASE WHEN state IN ('draft','changes_requested') THEN ${actor.edit}
    WHEN state='in_review' THEN ${actor.review} AND NOT participant
    WHEN state='approved' THEN ${actor.publish} ELSE false END for_actor
  FROM base b
 ), matching AS MATERIALIZED (
  SELECT * FROM classified WHERE (${f.state}='' OR state=${f.state}) AND (${f.view}='all' OR for_actor)
    AND (${f.q}='' OR bid ILIKE ${term} ESCAPE '!' OR coalesce(product,'') ILIKE ${term} ESCAPE '!' OR tenant ILIKE ${term} ESCAPE '!' OR tenant_name ILIKE ${term} ESCAPE '!')
 ), candidates AS MATERIALIZED (
  SELECT * FROM matching WHERE (${cursor?.lastAt||null}::timestamptz IS NULL OR (updated_at,id)>(${cursor?.lastAt||null}::timestamptz,${cursor?.lastId||null}::uuid))
  ORDER BY updated_at ASC,id ASC LIMIT 26
 ), listed AS (
  SELECT c.*,to_char(c.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') position,
   (SELECT jsonb_build_object('actorLabel',left(h.actor_label,180),'note',left(h.note,800),'action',h.action,'at',h.created_at)
    FROM passport_editorial_history h WHERE h.batch_id=c.id AND h.tenant_id=c.tenant_id
      AND h.revision::text=c.revision LIMIT 1) last_change
  FROM (SELECT * FROM candidates ORDER BY updated_at ASC,id ASC LIMIT 25) c
 )
 SELECT now() observed_at,(SELECT count(*)::int FROM base) total,
  (SELECT coalesce(jsonb_object_agg(state,n),'{}'::jsonb) FROM (SELECT state,count(*)::int n FROM classified GROUP BY state) x) counts,
  (SELECT count(*)::int FROM classified WHERE for_actor) for_actor,
  (SELECT count(*)::int FROM matching) matched,
  (SELECT count(*)>25 FROM candidates) has_more,
  (SELECT count(*)::int FROM base WHERE NOT coherent OR NOT editorial_managed OR NOT approval_coherent OR state NOT IN ('draft','changes_requested','in_review','approved','published') OR state IS NULL) invalid,
  (SELECT coalesce(jsonb_agg(l ORDER BY l.updated_at ASC,l.id ASC),'[]'::jsonb) FROM listed l) items`;
 const r=rows[0];if(!r||r.invalid)throw new QueueError('editorial_queue_source_invalid',503);
 const items=r.items.map((x:any)=>{
  if(!UUID.test(x.id)||!EDITORIAL_STATES.includes(x.state)||!/^\d+$/.test(x.revision)||!Number.isSafeInteger(Number(x.revision))||Number(x.revision)<1||!['agro','general'].includes(x.template)||!['es-AR','en','pt-BR'].includes(x.locale))throw new QueueError('editorial_queue_source_invalid',503);
  const last=x.last_change;return {id:x.id,bid:text(x.bid,160)!,tenant:text(x.tenant,120)!,tenantName:text(x.tenant_name,240)||x.tenant,product:text(x.product,160),state:x.state as QueueState,revision:Number(x.revision),publishedVersion:Number(x.published_version),template:x.template,locale:x.locale,updatedAt:new Date(x.updated_at).toISOString(),lastChange:last?{actorLabel:text(last.actorLabel,180)||'Usuario autorizado',note:last.action==='request_changes'?text(last.note,800):null,action:last.action,at:new Date(last.at).toISOString()}:null,...queueNextStep(x.state,x.participant,actor)};
 });
 const tail=r.items.at(-1),page=cursor?.page||1;
 const result={ok:true,protocol:EDITORIAL_QUEUE_PROTOCOL,source:'database',observedAt:new Date(r.observed_at).toISOString(),scope:{tenant,mode:tenant?'tenant':'global'},filters:f,
  summary:{total:r.total,byState:Object.fromEntries(EDITORIAL_STATES.map(s=>[s,Number(r.counts[s]||0)])),forActor:r.for_actor,basis:'enrolled_passports_in_scope'},matched:r.matched,items,
  navigation:{page,pageSize:25,hasNext:r.has_more,nextCursor:r.has_more&&tail?queueCursor({v:1,scope:scopeDigest,lastId:tail.id,lastAt:tail.position,page:page+1}):null,order:'oldest_update_first',consistency:'live_queue_rechecked_on_each_request'},readOnly:true};
 if(Buffer.byteLength(JSON.stringify(result),'utf8')>131072)throw new QueueError('editorial_queue_response_limit',503);
 return result;
}
