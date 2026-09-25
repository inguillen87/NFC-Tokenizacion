/** Presentation of already-authorized records only. Never grants write authority. */
export type InboxRecord={id:string;tenant_slug:string;title:string;construction_id:string;status:string;revision:number;updated_at:string;submitted_at:string|null;review_summary?:{state:string;updated_at:string|null};cancelled_at?:string;quotation_state?:string|null};
export const INBOX_STATES={draft:'Borrador de la empresa',pending:'Revisión de NexID pendiente',needs_information:'Esperando respuesta de la empresa',answered:'Respuesta recibida · revisión de NexID',provisioned:'Pedido técnico preparado',cancelled:'Solicitud cancelada',unknown:'Revisión sin confirmar'} as const;
export type InboxState=keyof typeof INBOX_STATES;
export type InboxGroup='all'|'draft'|'company'|'nexid';
export type InboxSort='source'|'recent'|'oldest'|'review';
export type InboxFilter='all'|InboxState;
export function inboxState(row:InboxRecord):InboxState{
 if(row.status==='draft'||row.status==='provisioned'||row.status==='cancelled')return row.status;
 if(row.status!=='submitted')return 'unknown';
 const s=row.review_summary?.state;return s==='pending'||s==='needs_information'||s==='answered'?s:'unknown';
}
export function inboxActivity(row:InboxRecord):string|null{
 const dates=[row.updated_at,row.review_summary?.updated_at,row.submitted_at,row.cancelled_at].filter((v):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v)));
 if(!dates.length)return null;return new Date(Math.max(...dates.map(Date.parse))).toISOString();
}
export function inboxActivityLabel(row:InboxRecord):string{
 const value=inboxActivity(row);return value?value.slice(0,10)+' · '+value.slice(11,16)+' UTC':'Fecha sin confirmar';
}
const fold=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLocaleLowerCase('es');
const matchesGroup=(state:InboxState,group:InboxGroup)=>group==='all'||group==='draft'&&state==='draft'||group==='company'&&state==='needs_information'||group==='nexid'&&(state==='pending'||state==='answered');
export function buildRequestInbox<T extends InboxRecord>(items:readonly T[],query='',filter:InboxFilter='all',group:InboxGroup='all',sort:InboxSort='source',isNexid=false){
 const terms=fold(query.trim()).split(/\s+/).filter(Boolean),counts={all:items.length,draft:0,company:0,nexid:0};
 const rows=items.map((row,index)=>{const state=inboxState(row);if(state==='draft')counts.draft++;if(state==='needs_information')counts.company++;if(state==='pending'||state==='answered')counts.nexid++;
 return{row,index,state,at:Date.parse(inboxActivity(row)||'')};});
 const priority=(s:InboxState)=>s==='unknown'?0:isNexid?(s==='answered'?1:s==='pending'?2:s==='needs_information'?3:s==='draft'?4:5):(s==='needs_information'?1:s==='draft'?2:s==='answered'?3:s==='pending'?4:5);
 const visible=rows.filter(({row,state})=>matchesGroup(state,group)&&(filter==='all'||filter===state)&&terms.every(term=>fold([row.title,row.tenant_slug,row.id,row.construction_id].join(' ')).includes(term))).sort((a,b)=>{
 if(sort==='source')return a.index-b.index;
 const p=sort==='review'?priority(a.state)-priority(b.state):0;if(p)return p;
 const av=Number.isFinite(a.at),bv=Number.isFinite(b.at);if(av!==bv)return av?-1:1;
 return(av&&bv?(sort==='oldest'||sort==='review'?a.at-b.at:b.at-a.at):0)||a.row.id.localeCompare(b.row.id)||a.index-b.index;
 }).map(x=>x.row);
 return{counts,visible};
}
export function inboxNextStep(row:InboxRecord,isNexid:boolean):string{
 switch(inboxState(row)){
 case'draft':return 'Completar y guardar el borrador; enviar requiere revisión y confirmación.';
 case'needs_information':return isNexid?'Hay una aclaración pendiente de la empresa.':'Abrir el expediente y responder la aclaración de NexID.';
 case'pending':return row.quotation_state==='offered'?'Hay una cotización disponible; consultar el expediente.':isNexid?'Revisar los datos enviados y pedir una aclaración si hace falta.':'La solicitud está enviada; la revisión corresponde a NexID.';
 case'answered':return isNexid?'Revisar la respuesta de la empresa antes de continuar.':'Respuesta recibida; queda la revisión de NexID.';
 case'provisioned':return 'Consultar el pedido vinculado. No confirma fabricación ni entrega.';
 case'cancelled':return 'Consultar el motivo y el historial. No habilita una nueva preparación.';
 case'unknown':return 'Abrir el expediente para confirmar el estado antes de actuar.';
 }
}
