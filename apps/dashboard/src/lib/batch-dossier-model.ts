/** Approved view projection. Never send raw SDM config, keys or arbitrary unit metadata to the dossier client. */
export type DossierTab = "overview" | "product" | "units" | "readings" | "operations";
export const DOSSIER_TABS = ["overview", "product", "units", "readings", "operations"] as const;
export type DossierAccess = { configure:boolean; import:boolean; lifecycle:boolean; revoke:boolean; events:boolean; map:boolean; supplier:boolean; tags:boolean; demo:boolean };
export type DossierUnit = { uidMasked:string; status:string; serial:string; lot:string; pallet:string; container:string; caseRef:string; override:boolean|null; updatedAt:string|null; sensorFields:number };
export type DossierManifest = { type:string; status:string; rows:number|null; inserted:number|null; rejected:number|null; duplicates:number|null; createdAt:string|null };
export type BatchDossier = {
  bid:string; tenant:string; name:string; sku:string; brand:string; publicLot:string; region:string;
  status:string; carrier:string; createdAt:string|null; checkedAt:string;
  imported:number|null; active:number|null; expected:number|null; pending:number|null;
  overrides:number|null; metadataUnits:number|null; sensorUnits:number|null;
  hasMetaKey:boolean|null; hasFileKey:boolean|null; countIssue:boolean;
  units:DossierUnit[]; manifests:DossierManifest[];
};
export function dossierRecord(value:unknown):Record<string,unknown> { return value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : {}; }
export function dossierText(value:unknown,max=180):string { return typeof value==="string" ? value.replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max) : typeof value==="number" && Number.isFinite(value) ? String(value) : ""; }
export function dossierCount(value:unknown):number|null { return typeof value==="number" && Number.isSafeInteger(value) && value>=0 ? value : null; }
export function dossierTime(value:unknown):string|null { return typeof value==="string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
export function dossierMaskedUid(value:unknown):string { const s=typeof value==="string"?value.replace(/[^a-f0-9]/gi,"").toUpperCase():""; return s.length>8 ? `${s.slice(0,4)}…${s.slice(-4)}` : s.length>=4 ? `${s.slice(0,4)}…` : "No informado"; }
function flag(value:unknown):boolean|null { return typeof value==="boolean"?value:null; }
export function buildBatchDossier(raw:unknown,expectedBid:string,expectedTenant:string,checkedAt:string):BatchDossier|null {
  const b=dossierRecord(raw),p=dossierRecord(b.product_identity),c=dossierRecord(b.sdm_config),u=dossierRecord(b.unit_metadata);
  const bid=dossierText(b.bid,160),tenant=dossierText(b.tenant_slug,120).toLowerCase();
  if(!bid || bid!==expectedBid || !tenant || (expectedTenant && tenant!==expectedTenant))return null;
  const imported=dossierCount(b.imported_tags),active=dossierCount(b.active_tags);
  const countIssue=imported!==null && active!==null && active>imported;
  const units=(Array.isArray(u.samples)?u.samples:[]).slice(0,12).map(item=>{
    const row=dossierRecord(item),meta=dossierRecord(row.unit_metadata),iot=dossierRecord(row.iot);
    return {uidMasked:dossierMaskedUid(row.uid_hex),status:dossierText(row.status,60),serial:dossierText(row.serial),lot:dossierText(row.lot),pallet:dossierText(meta.pallet_id || meta.pallet),container:dossierText(meta.container_id || meta.container),caseRef:dossierText(meta.case_id || meta.box_id),override:flag(row.product_override),updatedAt:dossierTime(row.updated_at),sensorFields:Object.keys(iot).length};
  });
  const manifests=(Array.isArray(b.manifests)?b.manifests:[]).slice(0,5).map(item=>{const row=dossierRecord(item);return {type:dossierText(row.manifest_type,60),status:dossierText(row.import_status,60),rows:dossierCount(row.row_count),inserted:dossierCount(row.inserted_count),rejected:dossierCount(row.rejected_count),duplicates:dossierCount(row.duplicate_count),createdAt:dossierTime(row.created_at)};});
  return {bid,tenant,name:dossierText(p.product_name || b.product_name),sku:dossierText(p.sku || b.sku),brand:dossierText(p.winery || b.winery),publicLot:dossierText(c.public_lot_label ?? c.lot ?? c.batch_lot ?? c.lot_number,160),region:dossierText(p.region || b.region),status:dossierText(b.status,60),carrier:dossierText(b.carrier_label || b.carrier_profile_code),createdAt:dossierTime(b.created_at),checkedAt,imported,active,expected:dossierCount(b.requested_quantity),pending:countIssue || imported===null || active===null ? null : imported-active,overrides:dossierCount(u.unit_product_overrides),metadataUnits:dossierCount(u.unit_metadata_rows),sensorUnits:dossierCount(u.iot_metadata_rows),hasMetaKey:flag(b.has_meta_key),hasFileKey:flag(b.has_file_key),countIssue,units,manifests};
}
export function batchStateLabel(state:string):string {
  return ({draft:"Borrador",production_registered:"Registrado para producción",provisioned:"Provisionado",active:"Activo",inactive:"Inactivo",revoked:"Revocado",paused:"Pausado",blocked:"Bloqueado",archived:"Archivado",pending:"Pendiente"} as Record<string,string>)[state] || (state?`Estado declarado: ${state}`:"Estado sin informar");
}
export function dossierTabFromHash(hash:string):DossierTab|null {
  const value=hash.replace(/^#/,"");
  if(value.startsWith("dossier-")){const key=value.slice(8);return DOSSIER_TABS.includes(key as DossierTab)?key as DossierTab:null;}
  if(["roll-product","roll-product-summary"].includes(value))return "product";
  if(value==="roll-manifest")return "units";
  if(value==="roll-physical-check")return "operations";
  return null;
}
export function nextDossierTab(current:DossierTab,key:string):DossierTab|null {
  const index=DOSSIER_TABS.indexOf(current);
  if(key==="Home")return DOSSIER_TABS[0];
  if(key==="End")return DOSSIER_TABS[DOSSIER_TABS.length-1];
  if(key==="ArrowRight")return DOSSIER_TABS[(index+1)%DOSSIER_TABS.length];
  if(key==="ArrowLeft")return DOSSIER_TABS[(index+DOSSIER_TABS.length-1)%DOSSIER_TABS.length];
  return null;
}
export function dossierTasks(model:BatchDossier,access:DossierAccess) {
  return [
    {title:"Ficha del producto",detail:model.name?"Identidad básica registrada; no equivale a aprobación editorial.":"Falta el nombre del producto compartido por el lote.",state:model.name?"Registrada":"Por completar",tab:"product" as DossierTab,action:access.configure?"Revisar y editar":"Consultar ficha"},
    {title:"Unidades recibidas",detail:model.imported===null?"La fuente no informó un conteo verificable.":`${model.imported.toLocaleString("es-AR")} unidades registradas. Importar no activa el rollo.`,state:model.imported===null?"Sin confirmar":model.imported>0?"Con registros":"Sin unidades",tab:"units" as DossierTab,action:access.import?"Recepción y manifiestos":"Consultar unidades"},
    {title:"Lecturas y ubicación",detail:"Se consultan solo al pedirlas. Una lectura no prueba por sí sola custodia, compra o QA.",state:"A demanda",tab:"readings" as DossierTab,action:access.events&&!access.demo?"Consultar lecturas":"Ver requisitos"},
    {title:"Calidad y activación",detail:"El estado activo no certifica que el protocolo físico esté aprobado. Conserva sus controles y permisos.",state:"Revisar evidencia",tab:"operations" as DossierTab,action:"Abrir operación"},
  ];
}
