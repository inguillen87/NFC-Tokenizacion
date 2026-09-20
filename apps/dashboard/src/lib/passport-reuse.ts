import {STUDIO_FIELDS,readStudioDocument,getField,updateField,type StudioDocument,type StudioSnapshot} from './passport-studio-contract';
export type PublishedChoice={id:string;bid:string;product:string;version:number;digest:string;template:StudioDocument['template'];locale:StudioDocument['locale'];publishedAt:string;document?:StudioDocument};
export type PublishedLibrary={ok:true;protocol:'nexid.passport-library.v1';source:'database';readOnly:true;scope:{tenant:string;tenantId:string;batchId:string;bid:string;draftId:string;revision:number;contentDigest:string;template:StudioDocument['template'];locale:StudioDocument['locale']};observedAt:string;q:string;items:PublishedChoice[];hasMore:boolean};
const forbidden=new Set(['identity.public_lot_label','identity.sku','agro_product_profile.gtin','agro_product_profile.productionDate','agro_product_profile.expirationDate','agro_product_profile.distributor','agro_product_profile.authorizedChannel','agro_product_profile.recallStatusUrl','agro_product_profile.loyaltyUrl']);
export const REUSE_FIELDS=STUDIO_FIELDS.filter(f=>!forbidden.has(f.path));
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/;
const check=(v:unknown)=>{if(!v)throw Error('No se confirmó una fuente publicada compatible con esta revisión.');};
export const reuseValue=(v:unknown)=>Array.isArray(v)?v.join('\n'):v==null?'':String(v);
export function parsePublishedLibrary(raw:unknown,target:StudioSnapshot,query:string,chosen?:PublishedChoice):PublishedLibrary{
 const r=raw as PublishedLibrary,s=r?.scope;check(r?.ok===true&&r.protocol==='nexid.passport-library.v1'&&r.source==='database'&&r.readOnly===true&&s);
 check(s.tenantId===target.scope.tenantId&&s.batchId===target.scope.batchId&&s.bid===target.scope.bid&&s.draftId===target.draft.id&&s.revision===target.draft.revision&&s.contentDigest===target.draft.contentDigest&&s.template===target.draft.document.template&&s.locale===target.draft.document.locale);
 check(typeof s.tenant==='string'&&/^[a-z0-9][a-z0-9._-]{0,119}$/.test(s.tenant));check(typeof r.observedAt==='string'&&Number.isFinite(Date.parse(r.observedAt))&&r.q===query&&typeof r.hasMore==='boolean'&&Array.isArray(r.items)&&r.items.length<=20);
 const seen=new Set<string>();for(const i of r.items){check(i&&UUID.test(i.id)&&i.id!==s.batchId&&!seen.has(i.id));seen.add(i.id);check(typeof i.bid==='string'&&i.bid.length<=160&&typeof i.product==='string'&&i.product.length<=160&&Number.isSafeInteger(i.version)&&i.version>0&&HASH.test(i.digest)&&i.template===s.template&&i.locale===s.locale&&typeof i.publishedAt==='string'&&Number.isFinite(Date.parse(i.publishedAt)));
  if(chosen){check(i.id===chosen.id&&i.version===chosen.version&&i.digest===chosen.digest&&i.document);const doc=readStudioDocument(i.document);check(doc.template===s.template&&doc.locale===s.locale);i.document=doc;}else check(i.document===undefined);
 }
 if(chosen)check(r.items.length===1&&!r.hasMore);return structuredClone(r);
}
export function reusableFields(current:StudioDocument,published:StudioDocument){
 const source=readStudioDocument(published);check(source.template===current.template&&source.locale===current.locale);
 return REUSE_FIELDS.filter(f=>(f.group==='identity'||current.agro_product_profile)&&reuseValue(getField(source,f.path)).trim()!==''&&reuseValue(getField(current,f.path))!==reuseValue(getField(source,f.path))).map(f=>({...f,before:reuseValue(getField(current,f.path)),after:reuseValue(getField(source,f.path))}));
}
export function preparePublishedReuse(current:StudioDocument,published:StudioDocument,paths:string[]):StudioDocument{
 const source=readStudioDocument(published),target=readStudioDocument(current);check(source.template===target.template&&source.locale===target.locale);
 check(Array.isArray(paths)&&paths.length>0&&paths.length<=REUSE_FIELDS.length&&new Set(paths).size===paths.length);
 const allowed=new Set(reusableFields(target,source).map(f=>f.path));let result=structuredClone(target);
 for(const path of paths){check(allowed.has(path));result=updateField(result,path,reuseValue(getField(source,path)));}
 return readStudioDocument(result);
}
export function reuseReference(choice:PublishedChoice,count:number){return `Última reutilización declarada por el editor: lote ID ${choice.id}, publicación v${choice.version}, SHA-256 ${choice.digest}, ${count} campos. No transfiere la aprobación al lote destino.`;}
