import {randomUUID} from 'node:crypto';

export async function verifyQuotationCorrections({call,check,path,query,issued,adminHeaders}) {
 const proposal=Object.fromEntries(['currency','net_minor','tax_minor','shipping_minor','valid_until','conditions'].map(key=>[key,issued.current[key]]));
 const decision=(snapshot,action)=>({action,expected_revision:snapshot.revision,expected_request_revision:snapshot.request.revision,expected_review_revision:snapshot.request.review_summary.revision,offer:null,reason:'Isolated acceptance: '+action});
 const first=decision(issued,'reject'),rejectKey=randomUUID();
 const rejected=await call('company rejects quote version one',path+'/quotation'+query,{method:'POST',headers:adminHeaders,body:first,key:rejectKey});
 const replay=await call('rejected quote retry preserves its receipt',path+'/quotation'+query,{method:'POST',headers:adminHeaders,body:first,key:rejectKey});
 check(replay.idempotent_replay&&replay.receipt.revision===rejected.receipt.revision,'rejection is not duplicated');
 const second=await call('new quote version after rejection',path+'/quotation'+query,{method:'POST',body:{...decision(rejected,'issue'),offer:proposal}});
 const withdrawBody=decision(second,'withdraw'),withdrawKey=randomUUID();
 const withdrawn=await call('NexID withdraws quote version two',path+'/quotation'+query,{method:'POST',body:withdrawBody,key:withdrawKey});
 const retried=await call('withdrawn quote retry preserves its receipt',path+'/quotation'+query,{method:'POST',body:withdrawBody,key:withdrawKey});
 check(retried.idempotent_replay&&retried.receipt.revision===withdrawn.receipt.revision,'quote withdrawal is not duplicated');
 const third=await call('replacement quote version three',path+'/quotation'+query,{method:'POST',body:{...decision(withdrawn,'issue'),offer:proposal}});
 await call('stale buyer acceptance cannot select an obsolete quote',path+'/quotation'+query,{method:'POST',headers:adminHeaders,body:decision(issued,'accept'),status:409});
 check(third.current.quote_version===3&&third.history.length===5&&third.current.state==='offered','quote history retains rejected and withdrawn versions');
 return third;
}

export async function verifyBindingCorrections({call,check,path,query,assigned,bindBody}) {
 const body={action:'withdraw',expected_revision:assigned.revision,expected_request_revision:bindBody.expected_request_revision,order_id:bindBody.order_id,supplier:null,spec:null,reason:'Isolated supplier assignment correction.'},key=randomUUID();
 const withdrawn=await call('supplier binding withdrawn before dispatch',path+'/supplier-binding'+query,{method:'POST',body,key});
 const replay=await call('binding withdrawal retry preserves receipt',path+'/supplier-binding'+query,{method:'POST',body,key});
 check(replay.idempotent_replay&&replay.receipt.revision===withdrawn.receipt.revision,'binding withdrawal is not duplicated');
 check(withdrawn.binding_status==='withdrawn','withdrawn binding is not presented as current');
 const restored=await call('supplier rebound to the approved specification',path+'/supplier-binding'+query,{method:'POST',body:{...bindBody,expected_revision:withdrawn.revision}});
 await call('stale binding change cannot overwrite the new assignment',path+'/supplier-binding'+query,{method:'POST',body:bindBody,status:409});
 check(restored.binding_status==='current'&&restored.history.length===3,'binding history preserves assign withdraw and reassignment');return restored;
}

export async function verifyAckCorrections({call,check,path,query,ackBody,saved}) {
 const mismatch='sha256:'+('1'.repeat(64)===ackBody.artifact_hash.slice(7)?'2':'1').repeat(64);
 const issue={...ackBody,action:'issue',expected_revision:saved.revision,reported_hash:mismatch,reason:'Synthetic documentary mismatch, no external contact.'};
 const noted=await call('documentary discrepancy recorded without claiming receipt',path+'/delivery-ack'+query,{method:'POST',body:issue});
 check(noted.current.action==='issue'&&noted.current.reported_hash!==noted.current.artifact_hash,'mismatch remains an incident, not verified receipt');
 const withdraw={...ackBody,action:'withdraw',expected_revision:noted.revision,reported_hash:null,reason:'Withdraw only the latest synthetic documentary declaration.'},key=randomUUID();
 const withdrawn=await call('latest documentary declaration withdrawn',path+'/delivery-ack'+query,{method:'POST',body:withdraw,key});
 const replay=await call('documentary withdrawal retry preserves its receipt',path+'/delivery-ack'+query,{method:'POST',body:withdraw,key});
 check(replay.idempotent_replay&&replay.receipt.event_id===withdrawn.receipt.event_id,'documentary withdrawal has a stable event receipt');
 const corrected=await call('corrected documentary declaration appended',path+'/delivery-ack'+query,{method:'POST',body:{...ackBody,expected_revision:withdrawn.revision,reason:'Corrected synthetic NexID declaration; not authenticated supplier evidence.'}});
 check(corrected.history.length===4&&corrected.current.action==='received','documentary correction appends, never erases, the incident and withdrawal');
 check(corrected.history.every(event=>event.source==='nexid_manual_record'&&['supplier_authenticated','download_verified','decryption_verified','physical_received'].every(k=>event[k]===false)),'every documentary version preserves its manual and nonphysical provenance');
 await call('stale documentary update cannot replace the correction',path+'/delivery-ack'+query,{method:'POST',body:issue,status:409});
 return corrected;
}
