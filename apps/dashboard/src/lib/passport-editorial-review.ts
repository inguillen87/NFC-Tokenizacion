/** Read-only presentation contract. Server authorization and publication are separate. */
export const EDITORIAL_REVIEW_SCHEMA = "nexid.passport-review.v1";
export type EditorialGroup = "identity" | "agro" | "documents" | "guidance" | "support";
export type ReviewField = { path: string; label: string; group: EditorialGroup; kind?: "url" | "list"; max: number };
export const REVIEW_FIELDS: readonly ReviewField[] = [
  {path:"identity.product_name",label:"Producto",group:"identity",max:160},
  {path:"identity.public_lot_label",label:"Lote comercial",group:"identity",max:160},
  {path:"identity.sku",label:"SKU / referencia",group:"identity",max:120},
  {path:"identity.winery",label:"Marca / fabricante",group:"identity",max:160},
  {path:"identity.region",label:"Región declarada",group:"identity",max:180},
  {path:"identity.image_url",label:"Imagen del producto",group:"documents",kind:"url",max:2048},
  ...Object.entries({productName:["Nombre agro",160],brand:["Marca agro",160],sku:["SKU agro",120],gtin:["GTIN",14],crop:["Cultivo",120],seedVariety:["Variedad",160],productFamily:["Familia de producto",160],activeIngredient:["Ingrediente activo",240],formulation:["Formulación",160],registrationNumber:["Registro declarado",160],batchLot:["Lote agro",160],productionDate:["Fecha de producción",10],expirationDate:["Vencimiento",10],distributor:["Distribuidor",200],authorizedChannel:["Canal autorizado",200]}).map(([key,[label,max]])=>({path:`agro_product_profile.${key}`,label:String(label),max:Number(max),group:"agro" as const})),
  ...Object.entries({technicalSheetUrl:"Ficha técnica",safetySheetUrl:"Ficha de seguridad",cropwiseUrl:"Plataforma agronómica",trainingUrl:"Capacitación",loyaltyUrl:"Programa de beneficios",recallStatusUrl:"Avisos / retiros"}).map(([key,label])=>({path:`agro_product_profile.${key}`,label,group:"documents" as const,kind:"url" as const,max:2048})),
  {path:"agro_product_profile.ppe.summary",label:"Protección personal · resumen",group:"guidance",max:600},
  {path:"agro_product_profile.ppe.items",label:"Protección personal · elementos",group:"guidance",kind:"list",max:180},
  {path:"agro_product_profile.stewardship.summary",label:"Uso responsable · resumen",group:"guidance",max:1000},
  {path:"agro_product_profile.stewardship.items",label:"Uso responsable · indicaciones",group:"guidance",kind:"list",max:180},
  {path:"agro_product_profile.support.label",label:"Contacto de soporte",group:"support",max:160},
  {path:"agro_product_profile.support.url",label:"Sitio de soporte",group:"support",kind:"url",max:2048},
  {path:"agro_product_profile.support.email",label:"Correo de soporte",group:"support",max:254},
  {path:"agro_product_profile.support.phone",label:"Teléfono de soporte",group:"support",max:40},
];
export const REVIEW_GROUPS: Readonly<Record<EditorialGroup,string>> = {identity:"Identidad del producto",agro:"Perfil agro",documents:"Documentos y enlaces",guidance:"Seguridad y uso declarado",support:"Soporte"};
export type EditorialValue = string | string[] | null;
export type EditorialReviewSnapshot = {schemaVersion:"nexid.passport-editorial.v1";template:"general"|"agro";locale:"es-AR"|"en"|"pt-BR";values:Record<string,EditorialValue>};
export type EditorialChange = ReviewField & {before:EditorialValue;after:EditorialValue;state:"added"|"removed"|"changed"|"same"};
export type EditorialReview = {schemaVersion:typeof EDITORIAL_REVIEW_SCHEMA;tenantId:string;batchId:string;batchLabel:string;revision:number;status:"draft"|"in_review"|"changes_requested"|"approved";observedAt:string;published:EditorialReviewSnapshot|null;candidate:EditorialReviewSnapshot;changes:EditorialChange[];metadataChanges:string[];canExport:boolean};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export class EditorialReviewError extends Error { readonly code:string; constructor(code:string){super(code);this.name="EditorialReviewError";this.code=code;} }
function fail(code:string):never {throw new EditorialReviewError(code);}
function object(value:unknown,allowed:readonly string[]):Record<string,unknown>{
  if(!value||typeof value!=="object"||Array.isArray(value))return fail("review_object_invalid");
  if(Object.getPrototypeOf(value)!==Object.prototype && Object.getPrototypeOf(value)!==null)return fail("review_object_invalid");
  for(const key of Reflect.ownKeys(value)){
    if(typeof key!=="string"||!allowed.includes(key))return fail("review_field_not_allowed");
    const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!("value" in d)||!d.enumerable)return fail("review_object_invalid");
  }
  return value as Record<string,unknown>;
}
function readText(value:unknown,max:number):string|null{
  if(value===null||value===undefined||value==="")return null;
  if(typeof value!=="string"||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))return fail("review_text_invalid");
  return value.trim()||null;
}
function snapshot(raw:unknown):EditorialReviewSnapshot {
  const doc=object(raw,["schemaVersion","template","locale","identity","agro_product_profile"]);
  if(doc.schemaVersion!=="nexid.passport-editorial.v1"||!["general","agro"].includes(String(doc.template))||!["es-AR","en","pt-BR"].includes(String(doc.locale)))return fail("review_schema_invalid");
  const identity=object(doc.identity,REVIEW_FIELDS.filter(f=>f.path.startsWith("identity.")).map(f=>f.path.split(".")[1]));
  let agro:Record<string,unknown>={};
  if(doc.template==="agro"){
    agro=object(doc.agro_product_profile,["schemaVersion",...new Set(REVIEW_FIELDS.filter(f=>f.path.startsWith("agro_product_profile.")).map(f=>f.path.split(".")[1]))]);
    if(agro.schemaVersion!==undefined&&agro.schemaVersion!=="agro-dpp-v1")return fail("review_schema_invalid");
    for(const key of ["ppe","stewardship"]){if(agro[key]!==undefined)object(agro[key],["summary","items"]);}
    if(agro.support!==undefined)object(agro.support,["label","url","email","phone"]);
  }else if(doc.agro_product_profile!==undefined&&doc.agro_product_profile!==null)return fail("review_template_mismatch");
  const projected={identity,agro_product_profile:agro} as Record<string,unknown>,values:Record<string,EditorialValue>={};
  for(const field of REVIEW_FIELDS){
    let value:unknown=projected;
    for(const key of field.path.split("."))value=value&&typeof value==="object"?(value as Record<string,unknown>)[key]:undefined;
    if(field.kind==="list"){
      if(value===undefined||value===null){values[field.path]=[];continue;}
      if(!Array.isArray(value)||value.length>12)return fail("review_list_invalid");
      const list:string[]=[];
      for(let index=0;index<value.length;index++){if(!Object.hasOwn(value,index))return fail("review_list_invalid");const item=readText(value[index],field.max);if(!item)return fail("review_list_invalid");list.push(item);}
      values[field.path]=list;
    }else{
      const text=readText(value,field.max);
      if(text&&field.kind==="url"){
        let url:URL;try{url=new URL(text);}catch{return fail("review_url_invalid");}
        if(url.protocol!=="https:"||url.username||url.password)return fail("review_url_invalid");
        // Preserve the supplied URL exactly. The viewer must not hide a link change.
      }
      values[field.path]=text;
    }
  }
  return {schemaVersion:"nexid.passport-editorial.v1",template:doc.template as "general"|"agro",locale:doc.locale as "es-AR"|"en"|"pt-BR",values};
}
function equal(a:EditorialValue,b:EditorialValue):boolean{return JSON.stringify(a)===JSON.stringify(b);}
const empty=(v:EditorialValue)=>v===null||(Array.isArray(v)&&v.length===0);
/** Expected scope and read/export authority must be resolved by the server, never accepted from document JSON. */
export function buildEditorialReview(raw:unknown,authority:{tenantId:string;batchId:string;canRead:boolean;canExport:boolean}):EditorialReview{
  if(authority.canRead!==true)return fail("review_read_forbidden");
  if(!UUID.test(authority.tenantId)||!UUID.test(authority.batchId))return fail("review_scope_invalid");
  const r=object(raw,["schemaVersion","tenantId","batchId","batchLabel","revision","status","observedAt","published","candidate"]);
  if(r.schemaVersion!==EDITORIAL_REVIEW_SCHEMA)return fail("review_schema_invalid");
  if(typeof r.tenantId!=="string"||typeof r.batchId!=="string"||r.tenantId.toLowerCase()!==authority.tenantId.toLowerCase()||r.batchId.toLowerCase()!==authority.batchId.toLowerCase())return fail("review_scope_forbidden");
  if(!Number.isSafeInteger(r.revision)||Number(r.revision)<1||!["draft","in_review","changes_requested","approved"].includes(String(r.status)))return fail("review_version_invalid");
  if(typeof r.observedAt!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(r.observedAt)||!Number.isFinite(Date.parse(r.observedAt)))return fail("review_time_invalid");
  const at=new Date(r.observedAt).toISOString();if(at.replace(".000Z","Z")!==r.observedAt.replace(".000Z","Z"))return fail("review_time_invalid");
  const published=r.published===null?null:snapshot(r.published),candidate=snapshot(r.candidate);
  const changes=REVIEW_FIELDS.map(field=>{const before=published?.values[field.path]??(field.kind==="list"?[]:null),after=candidate.values[field.path];return {...field,before,after,state:equal(before,after)?"same":empty(before)?"added":empty(after)?"removed":"changed"} as EditorialChange;});
  const metadataChanges:string[]=[];
  if(published&&published.template!==candidate.template)metadataChanges.push("Cambió la plantilla del documento.");
  if(published&&published.locale!==candidate.locale)metadataChanges.push("Cambió el idioma del documento.");
  return {schemaVersion:EDITORIAL_REVIEW_SCHEMA,tenantId:authority.tenantId.toLowerCase(),batchId:authority.batchId.toLowerCase(),batchLabel:readText(r.batchLabel,160)||"Lote sin etiqueta comercial",revision:Number(r.revision),status:r.status as EditorialReview["status"],observedAt:at,published,candidate,changes,metadataChanges,canExport:authority.canExport===true};
}
export function visibleEditorialChanges(model:EditorialReview,input:{query?:string;onlyChanged?:boolean;group?:EditorialGroup|"all"}):EditorialChange[]{
  const query=(input.query||"").trim().toLocaleLowerCase().slice(0,120);
  return model.changes.filter(row=>(!input.onlyChanged||row.state!=="same")&&(!input.group||input.group==="all"||row.group===input.group)&&(!query||[row.label,...(Array.isArray(row.before)?row.before:[row.before]),...(Array.isArray(row.after)?row.after:[row.after])].filter(Boolean).join(" ").toLocaleLowerCase().includes(query)));
}
export function editorialChangeCounts(model:EditorialReview){
  return model.changes.reduce((counts,row)=>{counts[row.state]++;return counts;},{added:0,removed:0,changed:0,same:0});
}
export function editorialComparisonReport(model:EditorialReview){
  if(!model.canExport)return fail("review_export_forbidden");
  const fields=model.changes.filter(row=>row.state!=="same").map(({path,label,state,before,after})=>({path,label,state,before:structuredClone(before),after:structuredClone(after)}));
  // Product and public support details only; no users, keys, UIDs, private event or tenant identifiers.
  return {schemaVersion:"nexid.editorial-comparison-report.v1",kind:"editorial_comparison_only",applied:false,proofOfApproval:false,batchLabel:model.batchLabel,revision:model.revision,sourceStatus:model.status,observedAt:model.observedAt,candidateTemplate:model.candidate.template,candidateLocale:model.candidate.locale,metadataChanges:[...model.metadataChanges],fields};
}
