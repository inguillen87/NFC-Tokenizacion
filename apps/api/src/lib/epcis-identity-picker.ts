import {sql} from './db';
import {IntakeError,UUID} from './epcis-intake-policy';
import type {intakeScope} from './epcis-intake-service';
export const IDENTITY_PICKER_PROTOCOL='nexid.epcis-identities.v1';
export type IdentityLookup={area:'batch'|'company';term:string;after:string|null};
type Scope=Awaited<ReturnType<typeof intakeScope>>;
export function identityLookup(search:URLSearchParams,scope:Scope):IdentityLookup{
 const allowed=['tenant','area','term','cursor'];
 if([...search.keys()].some(k=>!allowed.includes(k))||allowed.some(k=>search.getAll(k).length>1))throw new IntakeError('intake_identity_query_invalid');
 const area=search.get('area')||'batch',rawTerm=search.get('term')||'',term=rawTerm.trim();
 if(!['batch','company'].includes(area)||rawTerm.length>80||/[\u0000-\u001f\u007f]/.test(rawTerm))throw new IntakeError('intake_identity_query_invalid');
 if(area==='company'&&term.length<2)throw new IntakeError('intake_company_search_required');
 const encoded=search.get('cursor');let after:string|null=null;
 if(encoded){
  if(encoded.length>800||!/^[-_A-Za-z0-9]+$/.test(encoded))throw new IntakeError('intake_identity_cursor_invalid');
  try{const bytes=Buffer.from(encoded,'base64url');if(bytes.toString('base64url')!==encoded)throw Error();const c=JSON.parse(bytes.toString());if(c.v!==1||c.tenant!==scope.tenant||c.batchId!==scope.batchId||c.area!==area||c.term!==term||!UUID.test(c.after))throw Error();after=c.after;}
  catch{throw new IntakeError('intake_identity_cursor_mismatch',409);}
 }
 return {area:area as IdentityLookup['area'],term,after};
}
export async function lookupIntakeIdentities(scope:Scope,query:IdentityLookup){
 const rows=await sql`
 SELECT i.id::text,i.batch_id::text AS "batchId",b.bid,i.gtin,i.lot,i.serial,
   left(coalesce(b.sdm_config->>'product_name',b.sdm_config#>>'{sun,product,name}',b.bid),240) AS product
 FROM gs1_digital_link_identities i
 JOIN batches b ON b.id=i.batch_id AND b.tenant_id=i.tenant_id
 JOIN tenants t ON t.id=i.tenant_id AND t.status='active'
 JOIN gs1_gtin_prefix_entitlements e ON e.id=i.entitlement_id AND e.tenant_id=i.tenant_id AND e.status='active' AND i.gtin LIKE e.canonical_gtin_prefix||'%'
 WHERE i.tenant_id=${scope.tenantId}::uuid AND i.status='active' AND i.serial<>'' AND b.status='active'
   AND (${query.area}='company' OR i.batch_id=${scope.batchId}::uuid)
   AND (${query.term}='' OR position(lower(${query.term}) IN lower(concat_ws(' ',b.bid,i.gtin,i.lot,i.serial)))>0)
   AND (${query.after}::uuid IS NULL OR i.id>${query.after}::uuid)
 ORDER BY i.id ASC LIMIT 51`;
 const items=rows.slice(0,50).map(r=>({id:r.id,batchId:r.batchId,bid:r.bid,gtin:r.gtin,lot:r.lot,serial:r.serial,product:r.product}));
 const hasMore=rows.length>50;
 const nextCursor=hasMore?Buffer.from(JSON.stringify({v:1,tenant:scope.tenant,batchId:scope.batchId,area:query.area,term:query.term,after:items.at(-1)!.id})).toString('base64url'):null;
 return {ok:true,protocol:IDENTITY_PICKER_PROTOCOL,source:'database',scope,query:{area:query.area,term:query.term},items,hasMore,nextCursor,limit:50,observedAt:new Date().toISOString(),selectionIsNotValidation:true};
}
