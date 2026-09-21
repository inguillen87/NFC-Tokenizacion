import {
  parseRecallRecord as parseRecord,
  parseRecallDetail as parseDetail,
  recallReceipt as parseReceipt,
  type RecallRecord, type RecallDetail, type RecallScope,
} from './recall-workspace';

function progress(record:RecallRecord){
  for(const p of Object.values(record.progress)){
    if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Progreso de destino sin confirmar.');
    for(const value of [p.returnedUnits,p.heldUnits])
      if(value!=null&&(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>10000000))throw Error('Cantidad del destino sin confirmar.');
    for(const value of [p.ackEvidence,p.accountEvidence])
      if(value!=null&&(typeof value!=='string'||value.length>400))throw Error('Referencia de evidencia sin confirmar.');
    for(const value of [p.acknowledgedAt,p.accountedAt])
      if(value!=null&&(typeof value!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value))))throw Error('Fecha de evidencia sin confirmar.');
  }
  return record;
}
export function parseRecallRecord(raw:unknown,scope:RecallScope):RecallRecord{
  return progress(parseRecord(raw,scope));
}
export function parseRecallDetail(raw:unknown,bid:string,tenant:string):RecallDetail{
  const a=(raw as Partial<RecallDetail>|null)?.actor;
  if(!a||a.canRead!==true||[a.canRead,a.canWrite,a.canPublish,a.canExport].some(x=>typeof x!=='boolean')||typeof a.label!=='string'||a.label.length>180||typeof a.id!=='string'||!/^[0-9a-f-]{36}$/i.test(a.id))throw Error('Autoridad de la consulta sin confirmar.');
  const result=parseDetail(raw,bid,tenant);progress(result.case);return result;
}
export function recallReceipt(raw:unknown,body:unknown,bid:string,tenant:string):RecallRecord{
  return progress(parseReceipt(raw,body,bid,tenant));
}
