import {createHash} from 'node:crypto';
import QRCode from 'qrcode';
import {sql} from './db';
import {readChannelBase,gs1Path,ChannelError} from './batch-channel-service';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export class ProductionError extends Error{constructor(public code:string,public status=400){super(code);}}
export type ProductionRow={gtin:string;lot:string;serial:string};
export function productionRows(raw:unknown):ProductionRow[]{
 if(!Array.isArray(raw)||raw.length<1||raw.length>100)throw new ProductionError('gs1_import_rows_invalid',413);
 return raw.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).length!==3||Object.keys(row).some(k=>!['gtin','lot','serial'].includes(k)))throw new ProductionError('gs1_import_row_shape_invalid');
  for(const key of ['gtin','lot','serial'])if(typeof row[key]!=='string'||row[key].length>160||/[\u0000-\u001F\u007F]/.test(row[key]))throw new ProductionError('gs1_import_row_shape_invalid');
  return {gtin:row.gtin,lot:row.lot,serial:row.serial};
 });
}
function body(raw:unknown,allowed:string[]){if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!allowed.includes(k)))throw new ProductionError('gs1_import_command_invalid');return raw as Record<string,unknown>;}
export async function previewProduction(tenant:string,bid:string,raw:unknown){
 const input=body(raw,['rows']),rows=productionRows(input.rows),scope=await readChannelBase(tenant,bid);
 const data=await sql`SELECT public.nexid_gs1_import_plan_v1(b.tenant_id,b.id,${JSON.stringify(rows)}::jsonb) AS value FROM public.batches b JOIN public.tenants t ON t.id=b.tenant_id WHERE b.id=${scope.scope.batchId}::uuid AND t.slug=${scope.scope.tenant}`;
 if(!data[0]?.value)throw new ProductionError('gs1_import_scope_not_found',404);
 return data[0].value;
}
export async function commitProduction(tenant:string,bid:string,actor:string,raw:unknown){
 const input=body(raw,['rows','operationId','expectedPlanDigest','reason']),rows=productionRows(input.rows);
 if(typeof input.operationId!=='string'||!UUID.test(input.operationId)||typeof input.expectedPlanDigest!=='string'||!/^[a-f0-9]{64}$/.test(input.expectedPlanDigest)||typeof input.reason!=='string'||input.reason.trim().length<3||input.reason.length>1000)throw new ProductionError('gs1_import_command_invalid');
 const scope=await readChannelBase(tenant,bid);
 const result=await sql`SELECT public.nexid_gs1_import_commit_v1(b.tenant_id,b.id,${actor}::uuid,${input.operationId}::uuid,${JSON.stringify(rows)}::jsonb,${input.expectedPlanDigest},${input.reason}) AS value FROM public.batches b JOIN public.tenants t ON t.id=b.tenant_id WHERE b.id=${scope.scope.batchId}::uuid AND t.slug=${scope.scope.tenant}`;
 if(!result[0]?.value)throw new ProductionError('gs1_import_scope_not_found',404);
 return result[0].value;
}
export async function productionHistory(tenant:string,bid:string,operationId?:string){
 const scope=await readChannelBase(tenant,bid);
 if(operationId&&!UUID.test(operationId))throw new ProductionError('gs1_import_command_invalid');
 const rows=await sql`SELECT o.operation_id::text,o.created_at,o.result FROM public.gs1_batch_import_operations o JOIN public.batches b ON b.id=o.batch_id AND b.tenant_id=o.tenant_id WHERE b.id=${scope.scope.batchId}::uuid AND (${operationId||''}='' OR o.operation_id=${operationId||null}::uuid) ORDER BY o.created_at DESC,o.operation_id LIMIT 10`;
 if(operationId&&rows.length!==1)throw new ProductionError('gs1_import_receipt_not_found',404);
 return {protocol:'nexid.gs1-import-history.v1',source:'database',scope:scope.scope,receipts:rows.map(r=>operationId?r.result:{operationId:r.operation_id,recordedAt:r.created_at,counts:(r.result as any).counts}),limitedTo:10};
}
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const csvCell=(v:unknown)=>'"'+String(v??'').replace(/^[=+\-@]/,"'$&").replaceAll('"','""')+'"';
export async function printProduction(tenant:string,bid:string,raw:unknown){
 const input=body(raw,['identityIds','copies']),base=await readChannelBase(tenant,bid);
 if(!base.publicReady)throw new ProductionError('gs1_print_channel_not_ready',409);
 let items:Array<{identityId:string|null;gtin:string;lot:string;serial:string;url:string;svg?:string}>=[];
 if(base.carrier.mode==='qr'){
  if(input.identityIds!==undefined||!Number.isSafeInteger(input.copies)||Number(input.copies)<1||Number(input.copies)>100||!base.publicUrl)throw new ProductionError('gs1_print_selection_invalid');
  items=Array.from({length:Number(input.copies)},()=>({identityId:null,gtin:'',lot:base.scope.bid,serial:'',url:base.publicUrl!}));
 }else if(base.carrier.mode==='gs1'){
  const ids=input.identityIds;
  if(input.copies!==undefined||!Array.isArray(ids)||ids.length<1||ids.length>100||new Set(ids).size!==ids.length||ids.some(v=>typeof v!=='string'||!UUID.test(v)))throw new ProductionError('gs1_print_selection_invalid');
  const found=await sql`WITH wanted AS(SELECT value::uuid AS id,ordinality FROM jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb) WITH ORDINALITY)
   SELECT i.id::text,i.gtin,i.lot,i.serial,i.status,e.status AS prefix_status,
    (tag.id IS NULL AND i.tag_id IS NULL OR tag.status='active' AND COALESCE(tag.lifecycle_state,'active')='active') AS unit_ready,
    (i.gtin LIKE e.canonical_gtin_prefix||'%') AS prefix_matches
   FROM wanted w JOIN public.gs1_digital_link_identities i ON i.id=w.id
   JOIN public.gs1_gtin_prefix_entitlements e ON e.id=i.entitlement_id AND e.tenant_id=i.tenant_id
   JOIN public.batches b ON b.id=i.batch_id AND b.tenant_id=i.tenant_id
   JOIN public.tenants tenant ON tenant.id=b.tenant_id
   LEFT JOIN public.tags tag ON tag.id=i.tag_id AND tag.batch_id=i.batch_id
   WHERE b.id=${base.scope.batchId}::uuid AND b.status='active' AND tenant.status='active' AND COALESCE(NULLIF(b.carrier_profile_code,''),b.sdm_config->>'carrier_profile_code')='gs1_digital_link'
    AND EXISTS(SELECT 1 FROM public.tenant_carrier_policies p JOIN public.carrier_profiles c ON c.code=p.carrier_profile_code WHERE p.tenant_id=b.tenant_id AND p.carrier_profile_code='gs1_digital_link' AND p.enabled=true) ORDER BY w.ordinality`;
  if(found.length!==ids.length||found.some(r=>r.status!=='active'||r.prefix_status!=='active'||r.unit_ready!==true||r.prefix_matches!==true))throw new ProductionError('gs1_print_selection_unavailable',409);
  items=found.map(r=>({identityId:String(r.id),gtin:String(r.gtin),lot:String(r.lot),serial:String(r.serial),url:'https://nexid.lat'+gs1Path({gtin:String(r.gtin),lot:String(r.lot),serial:String(r.serial)})}));
 }else throw new ProductionError('gs1_print_profile_mismatch',409);
 const qrCache=new Map<string,string>();
 for(const item of items){if(!qrCache.has(item.url))qrCache.set(item.url,await QRCode.toString(item.url,{type:'svg',errorCorrectionLevel:'M',margin:4}));item.svg=qrCache.get(item.url)!;}
 const observedAt=new Date().toISOString(),mode=base.carrier.mode;
 const manifest={protocol:'nexid.label-pack.v1',source:'database',scope:base.scope,product:base.product,carrier:base.carrier.code,observedAt,labels:items.map(({svg,...item},index)=>({position:index+1,...item})),sameDestination:mode==='qr',physicalVerification:false};
 const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; base-uri \'none\'; form-action \'none\'"><title>Etiquetas · '+escape(base.product||bid)+'</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#183b4b;margin:18px;background:white}header{border-bottom:2px solid #087683;margin-bottom:16px;padding-bottom:12px}h1{font-size:20px;margin:8px 0}header p{font-size:12px;line-height:1.6}.labels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6mm}.label{border:1px dashed #94b5bd;border-radius:6px;padding:5mm;break-inside:avoid;display:flex;flex-direction:column;align-items:center;min-width:0;text-align:center}.label svg{display:block;width:38mm;height:38mm;max-width:100%;background:#fff}.label h2{font-size:12px;margin:0 0 3mm;overflow-wrap:anywhere}.label p{font-size:10px;line-height:1.5;margin:2mm 0 0;overflow-wrap:anywhere}.label .url{font-size:7px;color:#45616c;word-break:break-all}.number{font-size:9px;align-self:flex-end}@media print{body{margin:0}header{font-size:10px}.label{color:#000;border-color:#888}}</style></head><body><header><strong>nexID · Plancha de etiquetas</strong><h1>'+escape(base.product||bid)+'</h1><p>Empresa: '+escape(base.scope.tenant)+' · Lote: '+escape(bid)+' · '+items.length+' etiquetas · '+escape(observedAt)+'</p><p>'+(mode==='qr'?'QR de lote: todas las copias llevan el mismo enlace; no son identificadores únicos de unidad.':'Identidades GS1 registradas. Los códigos informativos no verifican NFC ni estado del precinto.')+' Imprimir una muestra al 100% y comprobar tamaño, contraste y lectura sobre el soporte real antes de fabricar. No constituye aprobación de QA.</p></header><main class="labels">'+items.map((item,index)=>'<article class="label"><span class="number">'+(index+1)+'</span><h2>'+escape(base.product||bid)+'</h2>'+item.svg+(item.gtin?'<p>GTIN '+escape(item.gtin)+'</p>':'')+'<p>'+escape(item.lot?('Lote '+item.lot):'')+(item.serial?' · Serie '+escape(item.serial):'')+'</p><p class="url">'+escape(item.url)+'</p></article>').join('')+'</main></body></html>';
 const csv='position,gtin,lot,serial,url\r\n'+manifest.labels.map(r=>[r.position,r.gtin,r.lot,r.serial,r.url].map(csvCell).join(',')).join('\r\n')+'\r\n';
 return {ok:true,manifest,html,csv,htmlSha256:createHash('sha256').update(html).digest('hex'),previewSvg:items[0].svg};
}
export function productionFailure(error:unknown){
 if(error instanceof ProductionError||error instanceof ChannelError)return {reason:error.code,status:error.status};
 if(error instanceof SyntaxError)return {reason:'gs1_import_invalid_json',status:400};
 const message=error instanceof Error?error.message:'';
 for(const reason of ['gs1_import_plan_changed','gs1_import_operation_conflict','gs1_import_not_ready','gs1_import_profile_mismatch','gs1_import_scope_not_found','gs1_import_rows_invalid','gs1_import_row_shape_invalid','gs1_import_command_invalid','gs1_import_product_label_invalid'])if(message.includes(reason))return {reason,status:reason==='gs1_import_scope_not_found'?404:reason.includes('invalid')?400:409};
 if(/uq_gs1_identity_public_path|duplicate key|lock timeout|deadlock/i.test(message))return {reason:'gs1_import_state_changed',status:409};
 return {reason:'gs1_production_unavailable',status:503};
}
