import type {RecallActor, RecallRecord} from './recall-workspace';

export type ReconciliationFilter = 'all' | 'acknowledgement' | 'quantities' | 'complete';
export type ReconciliationRow = {
  id:string; recipient:string; assigneeId:string; assigneeLabel:string;
  assigned:number; returned:number; held:number; pending:number;
  acknowledgedAt:string|null; ackReference:string|null; accountReference:string|null;
  status:Exclude<ReconciliationFilter,'all'>;
};
const count=(v:unknown,max=10000000):number=>{
  if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>max)throw Error('La fuente contiene cantidades sin confirmar.');
  return v;
};
const optionalText=(v:unknown,max:number):string|null=>{
  if(v==null)return null;
  if(typeof v!=='string'||v.length>max)throw Error('La referencia guardada no tiene un formato válido.');
  return v;
};
export function reconciliationRows(record:RecallRecord,members:{id:string;label:string}[]):ReconciliationRow[]{
  const labels=new Map(members.map(m=>[m.id,m.label]));
  return record.document.destinations.map(d=>{
    const p=record.progress[d.id]||{},assigned=count(d.units),returned=count(p.returnedUnits??0),held=count(p.heldUnits??0);
    if(!assigned||returned+held>assigned)throw Error('Las cantidades del destino no coinciden con su objetivo.');
    const acknowledgedAt=optionalText(p.acknowledgedAt,48);
    if(acknowledgedAt&&(!/(Z|[+-]\d{2}:\d{2})$/.test(acknowledgedAt)||!Number.isFinite(Date.parse(acknowledgedAt))))throw Error('Fecha del acuse sin confirmar.');
    const pending=assigned-returned-held;
    return {id:d.id,recipient:d.recipient,assigneeId:d.assigneeId,assigneeLabel:labels.get(d.assigneeId)||'Responsable registrado · '+d.assigneeId,assigned,returned,held,pending,acknowledgedAt,ackReference:optionalText(p.ackEvidence,400),accountReference:optionalText(p.accountEvidence,400),status:!acknowledgedAt?'acknowledgement':pending?'quantities':'complete'};
  });
}
export function filterReconciliation(rows:ReconciliationRow[],state:ReconciliationFilter,assignee:string,search:string){
  if(!['all','acknowledgement','quantities','complete'].includes(state)||search.length>160)throw Error('Filtro de conciliación inválido.');
  const q=search.trim().toLocaleLowerCase('es');
  return rows.filter(r=>(state==='all'||r.status===state)&&(!assignee||r.assigneeId===assignee)&&(!q||[r.recipient,r.assigneeLabel,r.ackReference,r.accountReference].some(v=>v?.toLocaleLowerCase('es').includes(q))));
}
export function closureReadiness(record:RecallRecord,actor:RecallActor){
  const rows=reconciliationRows(record,[]),missingAcknowledgements=rows.filter(r=>!r.acknowledgedAt).length,pendingUnits=rows.reduce((n,r)=>n+r.pending,0);
  const ready=rows.length>0&&missingAcknowledgements===0&&pendingUnits===0;
  return {ready,missingAcknowledgements,pendingUnits,completeDestinations:rows.filter(r=>r.status==='complete').length,totalDestinations:rows.length,
    canRequest:ready&&record.state==='active'&&actor.canRead&&actor.canWrite,
    canApprove:ready&&record.state==='closing'&&actor.canRead&&actor.canWrite&&actor.canPublish&&Boolean(record.close_requested_by)&&record.close_requested_by!==actor.id,
    independentRequired:record.state==='closing'&&record.close_requested_by===actor.id,
  };
}
export type QuantityPreview = {ok:false;message:string}|{ok:true;returned:number;held:number;pending:number;returnedDelta:number;heldDelta:number;decreases:boolean};
export function previewRecallQuantities(record:RecallRecord,destinationId:string,returned:string,held:string):QuantityPreview{
  const row=reconciliationRows(record,[]).find(r=>r.id===destinationId);
  if(!row)return {ok:false,message:'El destino no pertenece al caso seleccionado.'};
  if(!/^(0|[1-9]\d{0,7})$/.test(returned)||!/^(0|[1-9]\d{0,7})$/.test(held))return {ok:false,message:'Ingresá ambos totales enteros; vacío no equivale a cero.'};
  const r=Number(returned),h=Number(held);
  if(r>10000000||h>10000000||r+h>row.assigned)return {ok:false,message:`La suma no puede superar las ${row.assigned} ${record.document.unitLabel} asignadas.`};
  return {ok:true,returned:r,held:h,pending:row.assigned-r-h,returnedDelta:r-row.returned,heldDelta:h-row.held,decreases:r<row.returned||h<row.held};
}

/** Identical text for SSR and browser, independent of ICU day-period spacing or host timezone. */
export function formatRecallDate(value:string|null):string{
  if(!value)return '—';
  const instant=new Date(value);
  if(!Number.isFinite(instant.getTime()))return 'Fecha sin confirmar';
  const iso=instant.toISOString();
  return `${iso.slice(8,10)}/${iso.slice(5,7)}/${iso.slice(0,4)} · ${iso.slice(11,16)} UTC`;
}
