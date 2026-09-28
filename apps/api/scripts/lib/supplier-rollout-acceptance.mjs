import assert from 'node:assert/strict';

export const SUPPLIER_ROLLOUT_SWITCHES = Object.freeze([
 ['cancellation','SUPPLIER_REQUEST_CANCELLATION_ENABLED','supplier_request_cancellation_disabled','temporarily_disabled'],
 ['quotation','SUPPLIER_REQUEST_QUOTES_ENABLED','supplier_quotes_disabled','read_only'],
 ['supplier-binding','SUPPLIER_REQUEST_SUPPLIER_BINDINGS_ENABLED','supplier_binding_disabled','read_only'],
 ['delivery-ack','SUPPLIER_DELIVERY_ACK_ENABLED','supplier_delivery_ack_disabled','read_only'],
].map(Object.freeze));

/** Changes only test-process values. Never calls a configuration provider. */
export async function withSupplierWriteSwitches(value, run, env=process.env) {
 assert.equal(env.NODE_ENV,'test'); assert.equal(env.VERCEL_ENV,'test');
 assert.ok(value==='true'||value==='false'); assert.equal(typeof run,'function');
 const previous=SUPPLIER_ROLLOUT_SWITCHES.map(([,key])=>[key,Object.hasOwn(env,key),env[key]]);
 try { for(const [,key] of SUPPLIER_ROLLOUT_SWITCHES)env[key]=value; return await run(); }
 finally { for(const [key,present,old] of previous){if(present)env[key]=old;else delete env[key];} }
}

export async function verifySupplierClosedRollout({client,call,check,path,query,availablePath,adminHeaders,prepared}) {
 assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.VERCEL_ENV,'test');
 const requestId=path.split('/').at(-1);assert.match(requestId,/^[a-f0-9-]{36}$/);
 const recorded=async()=>(await client.query(`SELECT to_jsonb(r) AS request,
  (SELECT count(*) FROM supplier_request_operations WHERE request_id=r.id) AS operations,
  (SELECT count(*) FROM supplier_request_quote_events WHERE request_id=r.id) AS quotations,
  (SELECT count(*) FROM supplier_request_binding_events WHERE request_id=r.id) AS bindings,
  (SELECT count(*) FROM supplier_delivery_ack_events WHERE request_id=r.id) AS acknowledgements
  FROM supplier_requests r WHERE r.id=$1`,[requestId])).rows;
 const before=await recorded();assert.equal(before.length,1);
 await withSupplierWriteSwitches('false',async()=>{
  const availability=await call('all four disabled switches reported by real service status',availablePath,{headers:adminHeaders});
  for(const [resource,,reason,state] of SUPPLIER_ROLLOUT_SWITCHES){
   const serviceId=resource.replaceAll('-','_');
   check(availability.services.find(s=>s.id===serviceId)?.state===state,'closed rollout metadata for '+serviceId);
   await call('anonymous denied before disabled '+resource,path+'/'+resource+query,{method:'POST',headers:{},body:{},status:401});
   const rejected=await call('disabled '+resource+' rejects a new write',path+'/'+resource+query,{method:'POST',body:{},status:503});
   check(rejected.reason===reason,'disabled '+resource+' reports the switch, not malformed input or a false success');
   if(resource==='cancellation')await call('closed cancellation cannot start its workflow',path+'/'+resource+query,{status:503});
   else if(resource==='quotation'||prepared){
    const history=await call('closed '+resource+' retains authorized history',path+'/'+resource+query,{headers:adminHeaders});
    check(history.writes_enabled===false,'closed '+resource+' response cannot authorize a write');
   }
  }
  if(prepared)for(const [resource,key] of SUPPLIER_ROLLOUT_SWITCHES){
   process.env[key]='true';
   try {
    const partial=await call('independent rollout switch for '+resource,availablePath,{headers:adminHeaders});
    for(const [peer,,,state] of SUPPLIER_ROLLOUT_SWITCHES)check(partial.services.find(s=>s.id===peer.replaceAll('-','_'))?.state===(peer===resource?'workflow_available':state),'enabling '+resource+' preserves the switch boundary for '+peer);
   }finally{process.env[key]='false';}
  }
 });
 assert.deepEqual(await recorded(),before);check(true,'switch probes preserve the exact request and its persisted event counts');
}
