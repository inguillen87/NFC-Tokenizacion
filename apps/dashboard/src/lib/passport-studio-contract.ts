/** Public editorial DTO only. This file is browser-safe and grants no server authority. */
export const STUDIO_CONTRACT = "nexid.passport-studio.v1";
export type StudioScope = { tenantId: string; batchId: string; bid: string; tenantLabel: string };
export type StudioDocument = {
  schemaVersion: "nexid.passport-editorial.v1";
  template: "general" | "agro";
  locale: "es-AR" | "en" | "pt-BR";
  identity: { product_name: string|null; public_lot_label: string|null; sku: string|null; winery: string|null; region: string|null; image_url: string|null };
  agro_product_profile: null | Record<string, unknown>;
};
export type StudioAction = "save" | "submit" | "request_changes" | "approve" | "publish" | "reopen";
export type StudioDraft = { id: string; revision: number; state: "draft"|"in_review"|"changes_requested"|"approved"|"published"; contentDigest: string; createdBy: string; lastEditorId: string; submittedBy: string|null; document: StudioDocument };
export type StudioHistory = { id: string; version: number; action: string; at: string; actorLabel: string; note?: string; document: StudioDocument };
export type StudioSnapshot = { contract: typeof STUDIO_CONTRACT; scope: StudioScope; actorId: string; capabilities: { edit: boolean; review: boolean; publish: boolean }; observedAt: string; published: { version: number; contentDigest: string; document: StudioDocument }|null; draft: StudioDraft; history: StudioHistory[] };
export type StudioCommand = { action: StudioAction; operationId: string; draftId: string; expectedRevision: number; expectedContentDigest: string; scope: Pick<StudioScope,"tenantId"|"batchId">; document?: StudioDocument; note?: string };
export type StudioIssue = { field: string; label: string; severity: "error"|"warning"; message: string };
export type StudioField = { path:string; label:string; group:"identity"|"agro"|"documents"; kind?:"url"|"date"|"multiline"|"list"; max:number };
export const STUDIO_FIELDS: readonly StudioField[] = [
 {path:"identity.product_name",label:"Nombre del producto",group:"identity",max:160},
 {path:"identity.winery",label:"Marca o fabricante",group:"identity",max:160},
 {path:"identity.public_lot_label",label:"Lote comercial visible",group:"identity",max:160},
 {path:"identity.sku",label:"SKU / referencia",group:"identity",max:120},
 {path:"identity.region",label:"Origen declarado",group:"identity",max:180},
 {path:"identity.image_url",label:"Imagen del producto",group:"identity",kind:"url",max:2048},
 ...Object.entries({crop:["Cultivo",120],seedVariety:["Variedad de semilla",160],productFamily:["Familia de producto",160],activeIngredient:["Ingrediente activo declarado",240],formulation:["Formulación",160],registrationNumber:["Registro declarado",160],gtin:["GTIN",14],distributor:["Distribuidor",200],authorizedChannel:["Canal autorizado",200]}).map(([key,[label,max]])=>({path:`agro_product_profile.${key}`,label:String(label),max:Number(max),group:"agro" as const})),
 {path:"agro_product_profile.productionDate",label:"Fecha de producción",group:"agro",kind:"date",max:10},
 {path:"agro_product_profile.expirationDate",label:"Fecha de vencimiento",group:"agro",kind:"date",max:10},
 {path:"agro_product_profile.technicalSheetUrl",label:"Ficha técnica",group:"documents",kind:"url",max:2048},
 {path:"agro_product_profile.safetySheetUrl",label:"Ficha de seguridad",group:"documents",kind:"url",max:2048},
 {path:"agro_product_profile.ppe.summary",label:"Protección personal · texto del fabricante",group:"documents",kind:"multiline",max:600},
 {path:"agro_product_profile.ppe.items",label:"Indicaciones de protección · una por línea",group:"documents",kind:"list",max:2172},
 {path:"agro_product_profile.stewardship.summary",label:"Uso responsable · texto del fabricante",group:"documents",kind:"multiline",max:1000},
 {path:"agro_product_profile.stewardship.items",label:"Indicaciones de uso responsable · una por línea",group:"documents",kind:"list",max:2172},
 ...Object.entries({cropwiseUrl:"Información complementaria",trainingUrl:"Capacitación",loyaltyUrl:"Programa de beneficios",recallStatusUrl:"Avisos del producto"}).map(([key,label])=>({path:`agro_product_profile.${key}`,label,group:"documents" as const,kind:"url" as const,max:2048})),
 {path:"agro_product_profile.support.label",label:"Nombre del canal de soporte",group:"documents",max:160},
 {path:"agro_product_profile.support.url",label:"Sitio de soporte",group:"documents",kind:"url",max:2048},
 {path:"agro_product_profile.support.email",label:"Correo de soporte",group:"documents",max:254},
 {path:"agro_product_profile.support.phone",label:"Teléfono de soporte",group:"documents",max:40},
];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const ACTOR=/^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,179}$/;
function object(v:unknown,allowed?:readonly string[]):Record<string,unknown>{
 if(!v||typeof v!=="object"||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw new Error("studio_object_invalid");
 for(const key of Reflect.ownKeys(v)){const d=Object.getOwnPropertyDescriptor(v,key);if(typeof key!=="string"||!d||!("value" in d)|| (allowed&&!allowed.includes(key)))throw new Error("studio_field_not_allowed");}
 return v as Record<string,unknown>;
}
function string(v:unknown,max:number){if(typeof v!=="string"||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))throw new Error("studio_string_invalid");return v;}
function time(v:unknown){const s=string(v,32);if(!/(?:Z|[+-]\d{2}:\d{2})$/.test(s)||!Number.isFinite(Date.parse(s)))throw new Error("studio_time_invalid");return s;}
function id(v:unknown){const s=string(v,36);if(!UUID.test(s))throw new Error("studio_id_invalid");return s.toLowerCase();}
function hash(v:unknown){const s=string(v,64);if(!HASH.test(s))throw new Error("studio_digest_invalid");return s;}
function actor(v:unknown){const s=string(v,180);if(!ACTOR.test(s))throw new Error("studio_actor_invalid");return UUID.test(s)?s.toLowerCase():s;}
function count(v:unknown,min=0){if(typeof v!=="number"||!Number.isSafeInteger(v)||v<min)throw new Error("studio_revision_invalid");return v;}
export function readStudioDocument(raw:unknown):StudioDocument {
 const d=object(raw,["schemaVersion","template","locale","identity","agro_product_profile"]);
 if(d.schemaVersion!=="nexid.passport-editorial.v1"||!['general','agro'].includes(String(d.template))||!['es-AR','en','pt-BR'].includes(String(d.locale)))throw new Error("studio_document_invalid");
 const identity=object(d.identity,["product_name","public_lot_label","sku","winery","region","image_url"]);
 for(const f of STUDIO_FIELDS.filter(f=>f.group==='identity')){const key=f.path.split('.')[1];if(identity[key]!==null)string(identity[key],f.max);}
 if(d.template==='general'&&d.agro_product_profile!==null)throw new Error("studio_template_mismatch");
 if(d.template==='agro'){
  const a=object(d.agro_product_profile,["schemaVersion","productName","brand","sku","gtin","crop","seedVariety","productFamily","activeIngredient","formulation","registrationNumber","batchLot","productionDate","expirationDate","distributor","authorizedChannel","technicalSheetUrl","safetySheetUrl","ppe","stewardship","cropwiseUrl","trainingUrl","loyaltyUrl","recallStatusUrl","support"]);
  if(a.schemaVersion!=="agro-dpp-v1")throw new Error("studio_document_invalid");
  for(const key of ['ppe','stewardship']){const g=object(a[key],["summary","items"]);if(g.summary!==null)string(g.summary,key==='ppe'?600:1000);if(!Array.isArray(g.items)||g.items.length>12)throw new Error("studio_list_invalid");for(const v of g.items)string(v,180);}
  object(a.support,["label","url","email","phone"]);
  for(const f of STUDIO_FIELDS.filter(f=>f.group!=='identity'&&f.kind!=='list')){const v=getField(d as unknown as StudioDocument,f.path);if(v!==null)string(v,f.max);}
  for(const key of ['productName','brand','sku','batchLot'])if(a[key]!==null)string(a[key],160);
 }
 if(new TextEncoder().encode(JSON.stringify(d)).byteLength>65536)throw new Error("studio_document_too_large");
 return structuredClone(d) as unknown as StudioDocument;
}
export function parseStudioSnapshot(raw:unknown,expected:Pick<StudioScope,'tenantId'|'batchId'>):StudioSnapshot{
 const s=object(raw,['contract','scope','actorId','capabilities','observedAt','published','draft','history']);
 if(s.contract!==STUDIO_CONTRACT)throw new Error('studio_contract_invalid');
 const scope=object(s.scope,['tenantId','batchId','bid','tenantLabel']);
 if(id(scope.tenantId)!==id(expected.tenantId)||id(scope.batchId)!==id(expected.batchId))throw new Error('studio_scope_mismatch');
 string(scope.bid,160);string(scope.tenantLabel,180);actor(s.actorId);time(s.observedAt);
 const caps=object(s.capabilities,['edit','review','publish']);for(const key of ['edit','review','publish'])if(typeof caps[key]!=='boolean')throw new Error('studio_permissions_invalid');
 const d=object(s.draft,['id','revision','state','contentDigest','createdBy','lastEditorId','submittedBy','document']);
 id(d.id);count(d.revision,1);hash(d.contentDigest);actor(d.createdBy);actor(d.lastEditorId);if(d.submittedBy!==null)actor(d.submittedBy);
 if(!['draft','in_review','changes_requested','approved','published'].includes(String(d.state)))throw new Error('studio_state_invalid');
 readStudioDocument(d.document);
 if(s.published!==null){const p=object(s.published,['version','contentDigest','document']);count(p.version,0);hash(p.contentDigest);readStudioDocument(p.document);}
 if(!Array.isArray(s.history)||s.history.length>20)throw new Error('studio_history_invalid');
 for(const rawEntry of s.history){const h=object(rawEntry,['id','version','action','at','actorLabel','note','document']);id(h.id);count(h.version,1);time(h.at);string(h.actorLabel,180);if(h.note!==undefined)string(h.note,800);if(!['save','submit','approve','request_changes','publish','restore'].includes(String(h.action)))throw new Error('studio_history_invalid');readStudioDocument(h.document);}
 const result=structuredClone(s) as unknown as StudioSnapshot;
 result.scope.tenantId=id(scope.tenantId);result.scope.batchId=id(scope.batchId);result.actorId=actor(s.actorId);
 result.draft.id=id(d.id);result.draft.createdBy=actor(d.createdBy);result.draft.lastEditorId=actor(d.lastEditorId);result.draft.submittedBy=d.submittedBy===null?null:actor(d.submittedBy);
 return result;
}
export function getField(doc:StudioDocument,path:string):unknown{return path.split('.').reduce<unknown>((o,k)=>o&&typeof o==='object'?(o as Record<string,unknown>)[k]:undefined,doc);}
export function updateField(doc:StudioDocument,path:string,input:string):StudioDocument{
 const f=STUDIO_FIELDS.find(f=>f.path===path);if(!f||(!doc.agro_product_profile&&f.group!=='identity'))throw new Error('studio_field_not_editable');
 const next=structuredClone(doc);const keys=path.split('.');let parent=next as unknown as Record<string,unknown>;for(const key of keys.slice(0,-1))parent=parent[key] as Record<string,unknown>;
 parent[keys.at(-1)!]=f.kind==='list'?input.split('\n').map(s=>s.trim()).filter(Boolean):input||null;
 // Identity stays single-source in the UI: mirror only existing public aliases.
 if(next.agro_product_profile){const alias:Record<string,string>={'identity.product_name':'productName','identity.winery':'brand','identity.sku':'sku','identity.public_lot_label':'batchLot'};if(alias[path])next.agro_product_profile[alias[path]]=input||null;}
 return next;
}
function display(v:unknown){return Array.isArray(v)?v.join('\n'):v==null?'':String(v);}
export function documentDiff(before:StudioDocument|null,after:StudioDocument){return STUDIO_FIELDS.filter(f=>after.agro_product_profile||f.group==='identity').flatMap(f=>{const previous=before?display(getField(before,f.path)):'';const next=display(getField(after,f.path));return previous===next?[]:[{field:f.path,label:f.label,before:previous,after:next}];});}
export function documentChanged(a:StudioDocument,b:StudioDocument){return JSON.stringify(a)!==JSON.stringify(b);}
export function reviewIssues(doc:StudioDocument):StudioIssue[]{
 const out:StudioIssue[]=[];const issue=(f:StudioField,severity:'error'|'warning',message:string)=>out.push({field:f.path,label:f.label,severity,message});
 for(const f of STUDIO_FIELDS.filter(f=>doc.agro_product_profile||f.group==='identity')){
  const value=getField(doc,f.path);const s=display(value);
  if(f.path==='identity.product_name'&&!s.trim())issue(f,'error','Ingresá el nombre del producto.');
  if(f.kind==='list'){if(!Array.isArray(value)||value.length>12||value.some(v=>typeof v!=='string'||v.length>180))issue(f,'error','Hasta 12 indicaciones, de 180 caracteres cada una.');}
  else if(s.length>f.max)issue(f,'error',`Máximo ${f.max} caracteres.`);
  if(f.kind==='url'&&s){try{const u=new URL(s);if(u.protocol!=='https:'||u.username||u.password)throw new Error();}catch{issue(f,'error','Usá una URL HTTPS sin usuario ni contraseña.');}}
  if(f.kind==='date'&&s){const date=new Date(`${s}T00:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==s)issue(f,'error','Revisá la fecha.');}
 }
 const a=doc.agro_product_profile;
 if(a){
 for(const [pub,ag] of [['product_name','productName'],['winery','brand'],['sku','sku'],['public_lot_label','batchLot']]){if(a[ag]&&a[ag]!==doc.identity[pub as keyof StudioDocument['identity']])out.push({field:`identity.${pub}`,label:'Identidad del producto',severity:'error',message:'Los datos compartidos y los datos agro deben coincidir.'});}
 const support=a.support as Record<string,unknown>;
 if(support.email&& !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(support.email)))out.push({field:'agro_product_profile.support.email',label:'Correo de soporte',severity:'error',message:'Revisá el correo.'});
 if(support.phone&& !/^\+?[0-9(). -]{7,40}$/.test(String(support.phone)))out.push({field:'agro_product_profile.support.phone',label:'Teléfono de soporte',severity:'error',message:'Revisá el teléfono.'});
 if(a.gtin&&!/^\d{1,14}$/.test(String(a.gtin)))out.push({field:'agro_product_profile.gtin',label:'GTIN',severity:'error',message:'Usá hasta 14 dígitos; el identificador no se valida externamente.'});
 if(!['crop','seedVariety','productFamily','activeIngredient','formulation'].some(k=>typeof a[k]==='string'&&String(a[k]).trim()))out.push({field:'agro_product_profile.crop',label:'Identidad agro',severity:'error',message:'Describí al menos el cultivo, variedad o familia de producto.'});
 if(a.productionDate&&a.expirationDate&&String(a.expirationDate)<String(a.productionDate))out.push({field:'agro_product_profile.expirationDate',label:'Vencimiento',severity:'error',message:'Debe ser posterior a la fecha de producción.'});
 for(const key of ['technicalSheetUrl','safetySheetUrl'])if(!a[key]){const f=STUDIO_FIELDS.find(f=>f.path===`agro_product_profile.${key}`)!;issue(f,'warning','Documento no vinculado. No equivale a evaluación normativa.');}
 }
 return out;
}
export function canStudioAction(snapshot:StudioSnapshot,action:StudioAction,dirty:boolean):boolean{
 const {state,createdBy,lastEditorId,submittedBy}=snapshot.draft,c=snapshot.capabilities;
 if(action==='save')return c.edit&&['draft','changes_requested'].includes(state)&&dirty;
 if(dirty)return false;
 if(action==='submit')return c.edit&&['draft','changes_requested'].includes(state);
 if(action==='request_changes')return c.review&&state==='in_review';
 if(action==='approve')return c.review&&state==='in_review'&&![createdBy,lastEditorId,submittedBy].includes(snapshot.actorId);
 if(action==='reopen')return c.edit&&['approved','published'].includes(state);
 return action==='publish'&&c.publish&&state==='approved';
}
export const studioStateLabel:Record<StudioDraft['state'],string>={draft:'Borrador',in_review:'En revisión',changes_requested:'Cambios solicitados',approved:'Aprobado',published:'Publicado'};
