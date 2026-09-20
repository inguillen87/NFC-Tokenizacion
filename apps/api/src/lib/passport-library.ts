import {sql} from './db';
import {parseEditorialDocument,editorialContentDigest} from './passport-editorial-policy';
import {checkAdminWithPermission,checkAdminPermission,getAdminPrincipal,getAdminTenantAccess,type AdminSessionResolver} from './auth';
export const LIBRARY_PROTOCOL='nexid.passport-library.v1';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/;
export class LibraryError extends Error{constructor(public code:string,public status=400){super(code);}}
export type LibraryQuery={q:string;sourceId:string;version:number|null;digest:string};
export function libraryQuery(p:URLSearchParams):LibraryQuery{
 for(const key of p.keys())if(!['tenant','q','sourceId','version','digest'].includes(key)||p.getAll(key).length!==1)throw new LibraryError('library_query_invalid');
 const q=(p.get('q')||'').trim(),sourceId=p.get('sourceId')||'',v=p.get('version'),digest=p.get('digest')||'';
 if(q.length>120||/[\u0000-\u001f\u007f]/.test(q))throw new LibraryError('library_search_invalid');
 if(sourceId){if(!UUID.test(sourceId)||!v||!/^[1-9][0-9]{0,8}$/.test(v)||!HASH.test(digest)||q)throw new LibraryError('library_reference_invalid');}
 else if(v||digest)throw new LibraryError('library_reference_invalid');
 return {q,sourceId,version:v?Number(v):null,digest};
}
function string(v:unknown,max:number){if(typeof v!=='string'||v.length>max||/[\u0000-\u001f\u007f]/.test(v))throw new LibraryError('library_source_invalid',503);return v;}
export async function readPublishedLibrary(tenant:string,bid:string,query:LibraryQuery){
 if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(bid)||tenant&&!/^[a-z0-9][a-z0-9._-]{0,119}$/.test(tenant))throw new LibraryError('library_scope_invalid');
 const term='%'+query.q.replace(/[!%_]/g,x=>'!'+x)+'%';
 const rows=await sql`
 WITH targets AS MATERIALIZED (
  SELECT b.id,b.tenant_id,b.bid,t.slug tenant,h.draft,h.published
  FROM batches b JOIN tenants t ON t.id=b.tenant_id LEFT JOIN passport_editorial_heads h ON h.batch_id=b.id AND h.tenant_id=b.tenant_id
  WHERE b.bid=${bid} AND (${tenant}='' OR t.slug=${tenant}) ORDER BY b.id LIMIT 2
 ), target AS MATERIALIZED (SELECT * FROM targets WHERE (SELECT count(*) FROM targets)=1),
 candidates AS MATERIALIZED (
  SELECT b.id::text,b.bid,h.published_version version,h.published->>'contentDigest' digest,h.published#>>'{document,identity,product_name}' product,
   h.published#>>'{document,template}' template,h.published#>>'{document,locale}' locale,h.published,p.created_at published_at
  FROM target t JOIN passport_editorial_heads h ON h.tenant_id=t.tenant_id JOIN batches b ON b.id=h.batch_id AND b.tenant_id=h.tenant_id
  JOIN LATERAL (SELECT ph.created_at FROM passport_editorial_history ph WHERE ph.batch_id=b.id AND ph.tenant_id=t.tenant_id AND ph.action='publish' AND ph.content_digest=h.published->>'contentDigest' ORDER BY ph.revision DESC LIMIT 1) p ON true
  WHERE b.id<>t.id AND b.editorial_managed AND h.published_version>0 AND b.status='active'
    AND h.published#>>'{document,template}'=t.draft#>>'{document,template}' AND h.published#>>'{document,locale}'=t.draft#>>'{document,locale}'
    AND (${query.sourceId}='' OR b.id=${query.sourceId||null}::uuid)
    AND (${query.q}='' OR b.bid ILIKE ${term} ESCAPE '!' OR coalesce(h.published#>>'{document,identity,product_name}','') ILIKE ${term} ESCAPE '!')
  ORDER BY p.created_at DESC,b.id LIMIT 21
 )
 SELECT (SELECT count(*)::int FROM targets) scope_count,
  (SELECT jsonb_build_object('tenant',t.tenant,'tenantId',t.tenant_id,'batchId',t.id,'bid',t.bid,'draftId',t.draft->>'id','revision',t.draft->'revision','contentDigest',t.draft->>'contentDigest','template',t.draft#>>'{document,template}','locale',t.draft#>>'{document,locale}','state',t.draft->>'state','scopeValid',coalesce(t.draft#>>'{scope,tenantId}'=t.tenant_id::text AND t.draft#>>'{scope,batchId}'=t.id::text,false)) FROM target t) target,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'bid',c.bid,'product',c.product,'version',c.version,'digest',c.digest,'template',c.template,'locale',c.locale,'publishedAt',c.published_at,'storedVersion',c.published->'version','document',CASE WHEN ${query.sourceId}<>'' THEN c.published->'document' ELSE NULL END) ORDER BY c.published_at DESC,c.id),'[]'::jsonb) FROM candidates c) items,
  statement_timestamp() observed_at`;
 const r=rows[0];if(!r||r.scope_count===0)throw new LibraryError('library_target_not_found',404);if(r.scope_count!==1)throw new LibraryError('library_target_ambiguous',409);
 const t=r.target;if(!t.draftId)throw new LibraryError('library_studio_required',409);
 if(!t.scopeValid||!UUID.test(t.draftId)||!HASH.test(t.contentDigest)||!Number.isSafeInteger(t.revision)||t.revision<1)throw new LibraryError('library_target_invalid',503);
 if(!['draft','changes_requested'].includes(t.state))throw new LibraryError('library_target_not_editable',409);
 const {scopeValid,state,...scope}=t;
 const items=r.items.map((x:any)=>{
  if(!UUID.test(x.id)||!Number.isSafeInteger(x.version)||x.version<1||x.version!==x.storedVersion||!HASH.test(x.digest))throw new LibraryError('library_source_invalid',503);
  const item={id:x.id,bid:string(x.bid,160),product:string(x.product||x.bid,160),version:x.version,digest:x.digest,template:x.template,locale:x.locale,publishedAt:new Date(x.publishedAt).toISOString()};
  if(!query.sourceId)return item;
  if(x.id!==query.sourceId||x.version!==query.version||x.digest!==query.digest)throw new LibraryError('library_source_changed',409);
  const document=parseEditorialDocument(x.document);if(editorialContentDigest(document)!==item.digest||document.template!==t.template||document.locale!==t.locale)throw new LibraryError('library_source_invalid',503);
  return {...item,document};
 });
 if(query.sourceId&&items.length!==1)throw new LibraryError('library_source_unavailable',409);
 const result={ok:true,protocol:LIBRARY_PROTOCOL,readOnly:true,source:'database',scope,observedAt:new Date(r.observed_at).toISOString(),q:query.q,items:items.slice(0,20),hasMore:items.length>20};
 if(Buffer.byteLength(JSON.stringify(result),'utf8')>131072)throw new LibraryError('library_response_limit',503);
 return result;
}
export async function publishedLibraryRequest(req:Request,bid:string,resolver?:AdminSessionResolver){
 const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
 try{
  if(req.method!=='GET')return Response.json({ok:false,reason:'method_not_allowed'},{status:405,headers});
  const denied=await checkAdminWithPermission(req,'batch.product.configure',resolver);if(denied)return denied;
  const read=checkAdminPermission(req,'batches:read');if(read)return read;
  const principal=getAdminPrincipal(req),p=new URL(req.url).searchParams,requested=p.get('tenant');
  if(principal.tenantSlug&&requested&&principal.tenantSlug!==requested)throw new LibraryError('library_tenant_forbidden',403);
  const query=libraryQuery(p),scope=getAdminTenantAccess(req,requested);
  return Response.json(await readPublishedLibrary(scope.effectiveTenantSlug,bid,query),{headers});
 }catch(e){const x=e instanceof LibraryError?e:new LibraryError('library_source_unavailable',503);return Response.json({ok:false,reason:x.code},{status:x.status,headers});}
}
