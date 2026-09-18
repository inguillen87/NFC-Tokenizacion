import { randomUUID } from "node:crypto";
import { sql } from "./db";
import { parseEditorialDocument,createEditorialDraft,transitionEditorialDraft,completeEditorialPublication,reopenEditorialDraft,editorialContentDigest,type EditorialDraft,type EditorialDocument,EditorialPolicyError } from "./passport-editorial-policy";
import { normalizeAgroProductProfile,hasConfiguredAgroProfile } from "./agro-product-profile";
import { resolvePublicLotLabel } from "./public-lot-label";
export const STUDIO_PROTOCOL="nexid.passport-studio.v1";
export type StudioActor={actorId:string;label:string;canEdit:boolean;canReview:boolean;canPublish:boolean};
export class StudioError extends Error{constructor(public code:string,public status=409){super(code);this.name="StudioError";}}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const plain=(v:unknown):Record<string,any>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,any>:{};
export function sourceEditorialDocument(raw:unknown,template:"general"|"agro",locale:"es-AR"|"en"|"pt-BR"):EditorialDocument{
  const c=plain(raw),sun=plain(c.sun),p=plain(sun.product),o=plain(sun.origin);
  const profile=normalizeAgroProductProfile({batchConfig:c});
  if(template==="general"&&hasConfiguredAgroProfile(profile))throw new StudioError("editorial_template_mismatch",422);
  const first=(...v:unknown[])=>v.find(x=>typeof x==="string"&&x.trim())||null;
  const identity={product_name:first(c.product_name,p.name,profile.productName),public_lot_label:resolvePublicLotLabel(c),sku:first(c.sku,p.sku,profile.sku),winery:first(c.winery,p.producer,profile.brand),region:first(c.region,o.region),image_url:first(c.image_url,p.imageUrl)};
  const agro=template==="agro"?{...profile,productName:identity.product_name,brand:identity.winery,sku:identity.sku,batchLot:identity.public_lot_label}:null;
  return parseEditorialDocument({schemaVersion:"nexid.passport-editorial.v1",template,locale,identity,agro_product_profile:agro});
}
export async function readStudio(tenantSlug:string,bid:string){
  const rows=await sql`SELECT b.id,b.tenant_id,b.bid,t.slug,t.name,b.editorial_managed,
    CASE WHEN h.batch_id IS NULL THEN b.sdm_config ELSE NULL END AS seed_config,
    public.nexid_editorial_public_digest_v1(b.sdm_config) AS live_digest,
    h.draft,h.published,h.published_version,
    (SELECT coalesce(jsonb_agg(x ORDER BY x.revision DESC),'[]'::jsonb) FROM (SELECT id,revision,action,actor_label,note,document,created_at FROM public.passport_editorial_history WHERE batch_id=b.id AND tenant_id=b.tenant_id ORDER BY revision DESC LIMIT 10) x) AS history
    FROM public.batches b JOIN public.tenants t ON t.id=b.tenant_id LEFT JOIN public.passport_editorial_heads h ON h.batch_id=b.id AND h.tenant_id=b.tenant_id
    WHERE b.bid=${bid} AND (${tenantSlug}='' OR t.slug=${tenantSlug}) ORDER BY b.id LIMIT 2`;
  if(rows.length!==1)throw new StudioError(rows.length?"editorial_duplicate_bid":"editorial_batch_not_found",rows.length?409:404);
  return rows[0] as Record<string,any>;
}
function normalizedActor(id:string){if(!/^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,179}$/.test(id))throw new StudioError("editorial_actor_required",403);return UUID.test(id)?id.toLowerCase():id;}
export function studioSnapshot(row:Record<string,any>,actor:StudioActor,state?:any,history?:any[]){
  const current=state?.draft||row.draft;if(!current)throw new StudioError("editorial_not_started");
  const draft=current as EditorialDraft,document=parseEditorialDocument(draft.document);
  if(draft.scope.tenantId!==row.tenant_id||draft.scope.batchId!==row.id||editorialContentDigest(document)!==draft.contentDigest)throw new StudioError("editorial_integrity_mismatch",503);
  const sourceHistory=history||row.history||[];
  const snapshot={contract:STUDIO_PROTOCOL,scope:{tenantId:String(row.tenant_id),batchId:String(row.id),bid:String(row.bid),tenantLabel:String(row.name||row.slug).slice(0,180)},
    actorId:normalizedActor(actor.actorId),capabilities:{edit:actor.canEdit,review:actor.canReview,publish:actor.canPublish},observedAt:new Date().toISOString(),
    published:state?.published??row.published??null,
    draft:{id:draft.id,revision:draft.revision,state:draft.state,contentDigest:draft.contentDigest,createdBy:draft.createdBy,lastEditorId:draft.lastEditorId,submittedBy:draft.submittedBy,document},
    history:sourceHistory.filter((h:any)=>Number(h.revision)<=draft.revision).slice(0,10).map((h:any)=>({id:String(h.id),version:Number(h.revision),action:h.action==='start'?'save':h.action==='reopen'?'restore':h.action,at:new Date(h.created_at).toISOString(),actorLabel:String(h.actor_label||"Usuario autorizado").slice(0,180),note:String(h.note||"").slice(0,800),document:parseEditorialDocument(h.document)}))};
  if(snapshot.published){snapshot.published={version:Number(snapshot.published.version),contentDigest:String(snapshot.published.contentDigest),document:parseEditorialDocument(snapshot.published.document)};}
  while(Buffer.byteLength(JSON.stringify(snapshot),"utf8")>230000&&snapshot.history.length)snapshot.history.pop();
  return snapshot;
}
export function studioReadView(row:Record<string,any>,actor:StudioActor){
  if(row.draft)return {ok:true,snapshot:studioSnapshot(row,actor)};
  const template=hasConfiguredAgroProfile(normalizeAgroProductProfile({batchConfig:row.seed_config}))?"agro":"general";
  return {ok:true,enrollment:{contract:STUDIO_PROTOCOL,scope:{tenantId:String(row.tenant_id),batchId:String(row.id),bid:String(row.bid),tenantLabel:String(row.name||row.slug).slice(0,180)},actorId:normalizedActor(actor.actorId),capabilities:{edit:actor.canEdit,review:actor.canReview,publish:actor.canPublish},currentPublicDigest:row.live_digest,template,locale:"es-AR",document:sourceEditorialDocument(row.seed_config,template,"es-AR")}};
}
export function validateStudioCommand(raw:unknown,expectedAction?:string){
  const c=plain(raw);if(raw!==c)throw new StudioError("editorial_command_invalid",400);
  const allowed=['action','operationId','draftId','expectedRevision','expectedContentDigest','scope','document','note','template','locale','expectedPublicDigest'];
  if(Object.keys(c).some(k=>!allowed.includes(k)))throw new StudioError("editorial_field_not_allowed",400);
  if(!['start','save','submit','request_changes','approve','publish','reopen'].includes(c.action)||(expectedAction&&c.action!==expectedAction))throw new StudioError("editorial_action_invalid",400);
  if(typeof c.operationId!=="string"||!UUID.test(c.operationId))throw new StudioError("editorial_request_id_required",400);
  if(c.note!==undefined&&(typeof c.note!=="string"||c.note.length>800))throw new StudioError("editorial_note_invalid",400);
  if(c.action==='request_changes'&&(!c.note||c.note.trim().length<3))throw new StudioError("editorial_note_required",422);
  const scope=plain(c.scope);if(Object.keys(scope).some(k=>!['tenantId','batchId'].includes(k))||!UUID.test(String(scope.tenantId))||!UUID.test(String(scope.batchId)))throw new StudioError("editorial_scope_forbidden",403);
  if(c.action!=='start'&&(!UUID.test(String(c.draftId))||!Number.isSafeInteger(c.expectedRevision)||c.expectedRevision<1||! /^[a-f0-9]{64}$/.test(String(c.expectedContentDigest))))throw new StudioError("editorial_revision_invalid",400);
  if(c.action==='start'&&(!['general','agro'].includes(c.template)||!['es-AR','en','pt-BR'].includes(c.locale)||!/^[a-f0-9]{64}$/.test(String(c.expectedPublicDigest))))throw new StudioError("editorial_command_invalid",400);
  if(c.action==='save')c.document=parseEditorialDocument(c.document);
  else if(c.document!==undefined)throw new StudioError("editorial_content_not_allowed",400);
  return {...c,operationId:c.operationId.toLowerCase(),scope:{tenantId:scope.tenantId.toLowerCase(),batchId:scope.batchId.toLowerCase()}} as Record<string,any>;
}
export async function mutateStudio(tenantSlug:string,bid:string,actor:StudioActor,raw:unknown,expectedAction?:string){
  const cmd=validateStudioCommand(raw,expectedAction),editing=['start','save','submit','reopen'].includes(cmd.action);
  if(editing?!actor.canEdit:cmd.action==='publish'?!actor.canPublish:!actor.canReview)throw new StudioError("editorial_action_forbidden",403);
  actor={...actor,actorId:normalizedActor(actor.actorId)};
  const row=await readStudio(tenantSlug,bid),scope={tenantId:String(row.tenant_id),batchId:String(row.id)};
  if(cmd.scope.tenantId!==scope.tenantId||cmd.scope.batchId!==scope.batchId)throw new StudioError("editorial_scope_forbidden",403);
  // Durable replay is checked before applying transitions to a newer head.
  const receipts=await sql`SELECT id,action,result,request_hash=encode(sha256(convert_to(${JSON.stringify(cmd)}::jsonb::text,'UTF8')),'hex') AS same_command FROM public.passport_editorial_receipts WHERE tenant_id=${scope.tenantId}::uuid AND batch_id=${scope.batchId}::uuid AND actor_id=${actor.actorId} AND operation_id=${cmd.operationId}::uuid`;
  if(receipts[0]){if(!receipts[0].same_command)throw new StudioError("editorial_idempotency_conflict");return {ok:true,snapshot:studioSnapshot(row,actor,receipts[0].result),receipt:{id:receipts[0].id,operationId:cmd.operationId,action:cmd.action,committed:true,replayed:true}};}
  const at=new Date().toISOString();let next:EditorialDraft;let commitCommand={...cmd};
  if(cmd.action==='start'){
    if(row.draft||row.editorial_managed)throw new StudioError("editorial_already_managed");
    if(cmd.expectedPublicDigest!==row.live_digest)throw new StudioError("editorial_published_content_changed");
    const document=sourceEditorialDocument(row.seed_config,cmd.template,cmd.locale);
    next=createEditorialDraft({id:randomUUID(),scope,authority:actor,document,basePublishedDigest:row.live_digest,at});
    commitCommand={...cmd,expectedRevision:0,baselineDocument:document};
  }else{
    const current=row.draft as EditorialDraft|null;if(!current)throw new StudioError("editorial_not_started");
    if(current.id!==cmd.draftId)throw new StudioError("editorial_revision_conflict");
    if(cmd.action==='publish')next=completeEditorialPublication(current,{scope,canPublish:actor.canPublish,expectedRevision:cmd.expectedRevision,expectedContentDigest:cmd.expectedContentDigest,currentPublishedDigest:row.live_digest,at});
    else if(cmd.action==='reopen')next=reopenEditorialDraft(current,{scope,authority:actor,expectedRevision:cmd.expectedRevision,expectedContentDigest:cmd.expectedContentDigest,currentPublishedDigest:row.live_digest,at});
    else next=transitionEditorialDraft(current,{action:cmd.action==='save'?'edit':cmd.action,scope,authority:actor,expectedRevision:cmd.expectedRevision,expectedContentDigest:cmd.expectedContentDigest,at,document:cmd.document});
  }
  // The canonical request hash must not depend on a changing display label or newly read baseline.
  const rows=await sql`SELECT public.nexid_editorial_commit_v1(${scope.tenantId}::uuid,${scope.batchId}::uuid,${actor.actorId},${cmd.operationId}::uuid,${JSON.stringify({...commitCommand,request:cmd,actorLabel:actor.label.slice(0,180)})}::jsonb,${JSON.stringify(next)}::jsonb) AS operation`;
  const operation=rows[0]?.operation;if(!operation?.receipt?.committed||!operation.result)throw new StudioError("editorial_receipt_invalid",503);
  return {ok:true,snapshot:studioSnapshot(row,actor,operation.result,operation.history),receipt:operation.receipt};
}
export function studioFailure(error:unknown){
  const e=error as any;const code=e?.code==='P0001'?e.message:e instanceof StudioError||e instanceof EditorialPolicyError?e.code:null;
  if(typeof code==='string'&&/^editorial_[a-z_]+$/.test(code))return {reason:code,status:e.status||(/forbidden|independent_review/.test(code)?403:/conflict|changed|managed|started|approval_required|transition_invalid/.test(code)?409:422)};
  if(['42P01','42703','42883'].includes(e?.code))return {reason:"editorial_migration_required",status:503};
  if(error instanceof SyntaxError)return {reason:"editorial_json_invalid",status:400};
  if(e?.name==='RequestBodyTooLargeError')return {reason:"editorial_body_too_large",status:413};
  return {reason:"editorial_unavailable",status:503};
}
