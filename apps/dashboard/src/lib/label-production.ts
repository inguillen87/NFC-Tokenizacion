import {validGtin,safeChannelUrl} from './batch-channels';
export type ImportRow={gtin:string;lot:string;serial:string};
export type RowState='ready'|'already_registered'|'created'|'gtin_invalid'|'lot_invalid'|'serial_invalid'|'duplicate_identity'|'prefix_required'|'identity_conflict';
export type RowResult=ImportRow&{row:number;state:RowState;identityId:string|null};
export type ImportPlan={protocol:'nexid.gs1-import.v1';source:'database';scope:{tenant:string;bid:string;batchId:string};product:string;planDigest:string;rows:RowResult[];counts:{new:number;existing:number;blocked:number};channelReady:boolean;canCommit:boolean;observedAt:string};
export type ImportReceipt=Omit<ImportPlan,'protocol'|'channelReady'|'canCommit'|'observedAt'>&{protocol:'nexid.gs1-import-receipt.v1';operationId:string;committed:true;replayed:boolean;recordedAt:string};
export const rowLabels:Record<RowState,string>={ready:'Lista para registrar',already_registered:'Ya registrada · sin duplicar',created:'Registrada',gtin_invalid:'GTIN o dígito de control inválido',lot_invalid:'Lote GS1 inválido',serial_invalid:'Serie inválida',duplicate_identity:'Identidad repetida en el archivo',prefix_required:'Falta autorización del prefijo',identity_conflict:'Identidad ocupada o no compatible'};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function parseLabelCsv(input:string):ImportRow[]{
 if(new TextEncoder().encode(input).byteLength>65536)throw Error('El CSV supera 64 KiB. Dividilo en archivos de hasta 100 filas.');
 const text=input.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');const table:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;
 const fieldEnd=()=>{row.push(field.trim());field='';closed=false;};const rowEnd=()=>{fieldEnd();if(row.some(x=>x!==''))table.push(row);row=[];if(table.length>101)throw Error('Máximo 100 identidades por archivo.');};
 for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"'){quoted=false;closed=true;}else field+=ch;continue;}
  if(ch===',')fieldEnd();else if(ch==='\n')rowEnd();else if(ch==='"'&&field===''&&!closed)quoted=true;else{if(closed||ch==='"'||ch==='\r')throw Error('Formato CSV inválido: revisá comillas y separadores.');field+=ch;}}
 if(quoted)throw Error('Hay una celda con comillas sin cerrar.');if(field!==''||row.length||closed)rowEnd();
 if(JSON.stringify(table.shift())!==JSON.stringify(['gtin','lot','serial']))throw Error('La cabecera debe ser exactamente: gtin,lot,serial');
 if(!table.length)throw Error('Agregá al menos una identidad debajo de la cabecera.');
 return table.map((r,index)=>{if(r.length!==3||r.some(v=>v.length>160||/[\u0000-\u001F\u007F]/.test(v)))throw Error('Revisá las tres columnas de la fila '+(index+2)+'.');return {gtin:r[0],lot:r[1],serial:r[2]};});
}
export function localLabelRows(rows:ImportRow[]):RowResult[]{
 const key=(r:ImportRow)=>JSON.stringify([r.gtin,r.lot,r.serial]);const counts=new Map<string,number>();for(const r of rows)counts.set(key(r),(counts.get(key(r))||0)+1);
 const qualifier=(v:string)=>v===''||v.length<=20&&/^[!-~]+$/.test(v)&&!/[\/\\?#%]/.test(v);
 return rows.map((r,index)=>({...r,row:index+2,identityId:null,state:!validGtin(r.gtin)?'gtin_invalid':!qualifier(r.lot)?'lot_invalid':!qualifier(r.serial)?'serial_invalid':counts.get(key(r))!>1?'duplicate_identity':'ready'}));
}
export async function boundedProductionJson(response:Response,limit=2097152):Promise<any>{
 if(!response.body)throw Error('Respuesta vacía.');const reader=response.body.getReader();let count=0;const chunks:Uint8Array[]=[];
 try{while(true){const r=await reader.read();if(r.done)break;count+=r.value.byteLength;if(count>limit)throw Error('Respuesta demasiado grande.');chunks.push(r.value);}const bytes=new Uint8Array(count);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));}
 finally{try{await reader.cancel();}catch{}reader.releaseLock();}
}
function matchesScope(value:any,scope:{tenant:string;bid:string;batchId:string}){if(value?.source!=='database'||value?.scope?.tenant!==scope.tenant||value.scope.bid!==scope.bid||value.scope.batchId!==scope.batchId)throw Error('La respuesta no corresponde a esta empresa y lote.');}
export function parseImportResult(value:any,scope:{tenant:string;bid:string;batchId:string},expected?:ImportRow[]):ImportPlan|ImportReceipt{
 matchesScope(value,scope);if(!['nexid.gs1-import.v1','nexid.gs1-import-receipt.v1'].includes(value.protocol)||!/^[a-f0-9]{64}$/.test(value.planDigest)||typeof value.product!=='string'||!Array.isArray(value.rows)||value.rows.length<1||value.rows.length>100)throw Error('No se pudo comprobar el resultado.');
 const receipt=value.protocol==='nexid.gs1-import-receipt.v1';
 if(receipt&&(value.committed!==true||typeof value.replayed!=='boolean'||!UUID.test(value.operationId)))throw Error('No se confirmó el comprobante de importación.');
 if(!receipt&&(typeof value.canCommit!=='boolean'||typeof value.channelReady!=='boolean'))throw Error('No se confirmó la preparación.');
 if(!Number.isFinite(Date.parse(receipt?value.recordedAt:value.observedAt)))throw Error('Fecha de resultado no válida.');
 for(const [index,r] of value.rows.entries()){if(r.row!==index+2||typeof r.gtin!=='string'||typeof r.lot!=='string'||typeof r.serial!=='string'||!Object.hasOwn(rowLabels,r.state)||(r.identityId!==null&&!UUID.test(r.identityId)))throw Error('Fila de resultado inválida.');if(receipt&&!['created','already_registered'].includes(r.state))throw Error('Comprobante incompleto.');if(['created','already_registered'].includes(r.state)&&!UUID.test(r.identityId))throw Error('Identidad guardada no confirmada.');}
 if(expected&&(expected.length!==value.rows.length||expected.some((r,i)=>['gtin','lot','serial'].some(k=>r[k as keyof ImportRow]!==value.rows[i][k]))))throw Error('El resultado no corresponde al archivo preparado.');
 const count=(states:string[])=>value.rows.filter((r:RowResult)=>states.includes(r.state)).length;
 if(value.counts?.new!==count(receipt?['created']:['ready'])||value.counts.existing!==count(['already_registered'])||value.counts.blocked!==value.rows.length-value.counts.new-value.counts.existing)throw Error('Los totales no corresponden a las filas.');
 if(!receipt&&value.canCommit!==(value.channelReady&&value.counts.blocked===0))throw Error('Estado de preparación contradictorio.');
 return value;
}
export function parseLabelPack(value:any,scope:{tenant:string;bid:string;batchId:string},selection:{identityIds?:string[];copies?:number}){
 const manifest=value?.manifest;matchesScope(manifest,scope);
 if(value.ok!==true||manifest.protocol!=='nexid.label-pack.v1'||manifest.physicalVerification!==false||!Array.isArray(manifest.labels)||typeof value.html!=='string'||value.html.length>1800000||!value.html.startsWith('<!doctype html>')||typeof value.csv!=='string'||!/^[a-f0-9]{64}$/.test(value.htmlSha256)||typeof value.previewSvg!=='string'||value.previewSvg.length>150000||!value.previewSvg.startsWith('<svg'))throw Error('No se confirmó el paquete de impresión.');
 const expected=selection.identityIds?.length||selection.copies;if(!expected||manifest.labels.length!==expected||expected>100)throw Error('Cantidad de etiquetas no confirmada.');
 for(const [index,l] of manifest.labels.entries()){safeChannelUrl(l.url);if(l.position!==index+1)throw Error('Orden de impresión inválido.');if(selection.identityIds){if(l.identityId!==selection.identityIds[index]||manifest.carrier!=='gs1_digital_link'||manifest.sameDestination!==false||typeof l.gtin!=='string'||!validGtin(l.gtin)||typeof l.lot!=='string'||typeof l.serial!=='string'||new URL(l.url).pathname!==`/01/${l.gtin}${l.lot?`/10/${encodeURIComponent(l.lot)}`:''}${l.serial?`/21/${encodeURIComponent(l.serial)}`:''}`)throw Error('Identidad de impresión ajena.');}else{const url=new URL(l.url);if(l.identityId!==null||manifest.sameDestination!==true||url.searchParams.get('tenant')!==scope.tenant||url.searchParams.get('bid')!==scope.bid||url.searchParams.get('carrier')!=='qr_basic')throw Error('QR no asociado al lote.');}}
 return value as {manifest:any;html:string;csv:string;htmlSha256:string;previewSvg:string};
}
export const productionMessages:Record<string,string>={gs1_import_plan_changed:'El lote, sus permisos o el registro cambiaron. Volvé a validar antes de confirmar.',gs1_import_state_changed:'Hubo un cambio concurrente. No se guardó una importación parcial; volvé a validar.',gs1_import_operation_conflict:'Ese intento corresponde a otro contenido. No se sobrescribió.',gs1_import_not_ready:'La preparación contiene bloqueos. No se importó ninguna fila.',gs1_print_channel_not_ready:'El canal o el lote ya no están habilitados para imprimir.',gs1_print_selection_unavailable:'Alguna identidad está suspendida, retirada o sin autorización. No se generó la plancha.',channel_write_forbidden:'Tu cuenta no tiene permiso para registrar estas identidades.',gs1_production_unavailable:'No se confirmó la respuesta del servicio. Conservamos el intento para reconciliarlo.'};
