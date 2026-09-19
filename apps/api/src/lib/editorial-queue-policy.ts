import {createHash} from 'node:crypto';
export const EDITORIAL_QUEUE_PROTOCOL='nexid.editorial-queue.v1';
export const EDITORIAL_STATES=['draft','changes_requested','in_review','approved','published'] as const;
export type QueueState=typeof EDITORIAL_STATES[number];
export type QueueActor={id:string;edit:boolean;review:boolean;publish:boolean};
export type QueueFilters={state:string;view:'all'|'mine';q:string};
export type QueueCursor={v:1;scope:string;lastAt:string;lastId:string;page:number};
export class QueueError extends Error{constructor(public code:string,public status=400){super(code);}}
export const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function queueActorId(value:unknown){if(typeof value!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,179}$/.test(value))throw new QueueError('editorial_actor_required',403);return UUID.test(value)?value.toLowerCase():value;}
export function queueFilters(p:URLSearchParams):QueueFilters{
 for(const key of p.keys())if(!['tenant','state','view','q','cursor'].includes(key)||p.getAll(key).length!==1)throw new QueueError('editorial_queue_filter_invalid');
 const state=p.get('state')||'',view=p.get('view')||'all',q=(p.get('q')||'').trim();
 if(state&&!EDITORIAL_STATES.includes(state as QueueState)||!['all','mine'].includes(view)||q.length>100||/[\u0000-\u001f\u007f]/.test(q))throw new QueueError('editorial_queue_filter_invalid');
 return {state,view:view as 'all'|'mine',q};
}
export function queueScopeDigest(tenant:string,filters:QueueFilters,actor:QueueActor){return createHash('sha256').update(JSON.stringify([tenant,filters.state,filters.view,filters.q,actor.id,actor.edit,actor.review,actor.publish])).digest('hex');}
export function readQueueCursor(raw:string|null,scope:string):QueueCursor|null{
 if(!raw)return null;
 try{
  if(raw.length>1024||!/^[A-Za-z0-9_-]+$/.test(raw))throw Error();
  const bytes=Buffer.from(raw,'base64url');if(bytes.toString('base64url')!==raw)throw Error();const c=JSON.parse(bytes.toString('utf8'));
  if(c.v!==1||c.scope!==scope||!UUID.test(c.lastId)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(c.lastAt)||!Number.isFinite(Date.parse(c.lastAt))||new Date(c.lastAt).toISOString().slice(0,19)!==c.lastAt.slice(0,19)||!Number.isSafeInteger(c.page)||c.page<2||c.page>10000)throw Error();
  return {v:1,scope,lastAt:c.lastAt,lastId:c.lastId,page:c.page};
 }catch{throw new QueueError('editorial_queue_cursor_changed',409);}
}
export function queueNextStep(state:QueueState,participant:boolean,actor:QueueActor){
 if(state==='draft'||state==='changes_requested')return {code:actor.edit?'edit':'needs_editor',forActor:actor.edit};
 if(state==='in_review')return {code:participant?'needs_independent_review':actor.review?'review':'needs_reviewer',forActor:actor.review&&!participant};
 if(state==='approved')return {code:actor.publish?'publish':'needs_publisher',forActor:actor.publish};
 return {code:'published',forActor:false};
}
export function queueCursor(value:QueueCursor){return Buffer.from(JSON.stringify(value)).toString('base64url');}
