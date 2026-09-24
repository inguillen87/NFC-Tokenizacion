export const SUPPLIER_BINDING_PROTOCOL = "nexid.supplier-binding.v1";
export const BINDING_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const BINDING_HASH = /^sha256:[0-9a-f]{64}$/;
export class BindingContractError extends Error { constructor() { super("supplier_binding_contract_invalid"); } }
const fail = (): never => { throw new BindingContractError(); };
const obj = (v: unknown): Record<string, any> => v && typeof v === "object" && !Array.isArray(v) ? v : fail();
function keys(v: Record<string, unknown>, names: string[]) { if (Object.keys(v).length !== names.length || names.some(k => !Object.hasOwn(v,k))) fail(); }
function integer(v: unknown, min = 0): number { return Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= 2147483646 ? Number(v) : fail(); }
function uuid(v: unknown): string { return typeof v === "string" && BINDING_UUID.test(v) ? v.toLowerCase() : fail(); }
function text(v: unknown, max: number, multiline = false): string { return typeof v === "string" && v.length <= max && v.trim() && !(multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(v) ? v.trim() : fail(); }
function stamp(v: unknown): string { if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(v) || !Number.isFinite(Date.parse(v))) return fail(); return new Date(v).toISOString(); }
export type SupplierBindingVendor = { reference: string; name: string; confirmation_ref: string };
export type SupplierBindingSpec = { revision: number; hash: string; decision_id: string };
export type SupplierBindingCommand = { action: "assign" | "withdraw"; expected_revision: number; expected_request_revision: number; order_id: string; supplier: SupplierBindingVendor | null; spec: SupplierBindingSpec | null; reason: string };
export type SupplierBindingEvent = { id: string; revision: number; request_revision: number; order_id: string; action: "assign" | "withdraw"; supplier: SupplierBindingVendor; spec: SupplierBindingSpec; reason: string; actor_id: string; created_at: string };
function vendor(v: unknown): SupplierBindingVendor { const r = obj(v); keys(r,["reference","name","confirmation_ref"]); const reference = text(r.reference,128); if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(reference)) return fail(); return { reference, name: text(r.name,200), confirmation_ref: text(r.confirmation_ref,240) }; }
function specRef(v: unknown): SupplierBindingSpec { const r = obj(v); keys(r,["revision","hash","decision_id"]); if (typeof r.hash !== "string" || !BINDING_HASH.test(r.hash)) return fail(); return { revision: integer(r.revision,1), hash:r.hash, decision_id:uuid(r.decision_id) }; }
export function parseBindingCommand(v: unknown): SupplierBindingCommand {
 const r = obj(v); keys(r,["action","expected_revision","expected_request_revision","order_id","supplier","spec","reason"]);
 if (r.action !== "assign" && r.action !== "withdraw" || r.expected_revision === 2147483646) return fail();
 if (r.action === "withdraw" && (r.supplier !== null || r.spec !== null)) return fail();
 return { action:r.action, expected_revision:integer(r.expected_revision), expected_request_revision:integer(r.expected_request_revision,1), order_id:uuid(r.order_id), supplier:r.action === "assign" ? vendor(r.supplier) : null, spec:r.action === "assign" ? specRef(r.spec) : null, reason:text(r.reason,1000,true) };
}
export function parseBindingEvent(v: unknown): SupplierBindingEvent { const r=obj(v); if (!['assign','withdraw'].includes(r.action)) return fail(); return { id:uuid(r.id), revision:integer(r.revision,1), request_revision:integer(r.request_revision,1), order_id:uuid(r.order_id), action:r.action, supplier:vendor(r.supplier), spec:specRef(r.spec), reason:text(r.reason,1000,true), actor_id:uuid(r.actor_id), created_at:stamp(r.created_at) }; }
export type SupplierBindingState = {
 request_id:string; request_revision:number; order:{id:string;status:string;pack_purpose:'trial_integration'|'production'};
 specification:{status:string;revision:number;hash:string|null;decision_id:string|null;ready:boolean};
 count:number; truncated:boolean; revision:number; current:SupplierBindingEvent|null; history:SupplierBindingEvent[]; next_before_revision:number|null;
 binding_status:'none'|'current'|'stale'|'withdrawn'; dispatch_receipt:{id:string;binding_event_id:string|null;created_at:string}|null; as_of:string;
};
export function parseBindingState(value: unknown, expected: {id:string;orderId:string}, before:number|null=null): SupplierBindingState {
 const r=obj(value), o=obj(r.order), s=obj(r.specification), id=uuid(r.request_id), requestRevision=integer(r.request_revision,1), orderId=uuid(o.id), revision=integer(r.revision);
 if (id!==expected.id || orderId!==expected.orderId || !['production','trial_integration'].includes(o.pack_purpose) || typeof s.ready!=='boolean') return fail();
 const sr=integer(s.revision), sh=s.hash===null?null:typeof s.hash==='string'&&BINDING_HASH.test(s.hash)?s.hash:fail(), sd=s.decision_id===null?null:uuid(s.decision_id), ss=text(s.status,60);
 if (s.ready && (ss!=='approved'||!sr||!sh||!sd)) return fail();
 const current=r.current===null?null:parseBindingEvent(r.current);
 if ((revision===0)!==(current===null) || current && (current.revision!==revision||current.order_id!==orderId||current.request_revision!==requestRevision)) return fail();
 if (!Array.isArray(r.history)||r.history.length>50||r.count!==r.history.length||typeof r.truncated!=='boolean') return fail();
 const history=r.history.map(parseBindingEvent);const ids=new Set<string>();
 for(let i=0;i<history.length;i++){const e=history[i];if(ids.has(e.id)||e.order_id!==orderId||e.request_revision!==requestRevision||e.revision>revision||(before!==null&&e.revision>=before)||(i>0&&e.revision!==history[i-1].revision+1))return fail();ids.add(e.id);}
 if (before===null&&revision>0&&(!history.length||JSON.stringify(history.at(-1))!==JSON.stringify(current)))return fail();
 const next=r.next_before_revision===null?null:integer(r.next_before_revision,1);
 if (r.truncated!==(next!==null)||(next!==null&&(next!==history[0]?.revision||next<=1))||(history.length&&history[0].revision>1&&!r.truncated))return fail();
 const status=!current?'none':current.action==='withdraw'?'withdrawn':s.ready&&current.spec.revision===sr&&current.spec.hash===sh&&current.spec.decision_id===sd?'current':'stale';
 let dispatch:SupplierBindingState['dispatch_receipt']=null;
 if(r.dispatch_receipt!==null){const d=obj(r.dispatch_receipt);dispatch={id:uuid(d.id),binding_event_id:d.binding_event_id===null?null:uuid(d.binding_event_id),created_at:stamp(d.created_at)};if(dispatch.binding_event_id&&dispatch.binding_event_id!==current?.id)return fail();}
 return { request_id:id, request_revision:requestRevision, order:{id:orderId,status:text(o.status,80),pack_purpose:o.pack_purpose}, specification:{status:ss,revision:sr,hash:sh,decision_id:sd,ready:s.ready}, revision,current,history,count:history.length,truncated:next!==null,next_before_revision:next,binding_status:status,dispatch_receipt:dispatch,as_of:stamp(r.as_of) };
}
