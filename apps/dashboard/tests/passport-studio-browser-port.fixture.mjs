// QA adapter ONLY. No API endpoint is created or contacted. Replies are synthetic and volatile.
if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=b[6]&15|64;b[8]=b[8]&63|128;const s=Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;};
const qaSetup=window.qaSetup||{};document.documentElement.dataset.theme=qaSetup.theme||'light';
document.querySelector('#theme').onclick=()=>document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';
let fixtureState=studioFixture(qaSetup.role||'editor');const calls=[],receipts=new Map();
window.qa={calls,mode:'ready',snapshot:()=>structuredClone(fixtureState)};
async function mockFetch(endpoint,init){
 const cmd=JSON.parse(init.body);calls.push(structuredClone(cmd));const respond=(data,status=200)=>Promise.resolve(new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}}));
 const prev=receipts.get(cmd.operationId);if(prev){if(prev.body!==init.body)return respond({ok:false},409);return respond({...prev.reply,receipt:{...prev.reply.receipt,replayed:true}});}
 if(window.qa.mode==='conflict')return respond({ok:false},409);if(window.qa.mode==='denied')return respond({ok:false},403);
 if(cmd.expectedRevision!==fixtureState.draft.revision||cmd.expectedContentDigest!==fixtureState.draft.contentDigest||cmd.scope.tenantId!==fixtureState.scope.tenantId||cmd.scope.batchId!==fixtureState.scope.batchId)return respond({ok:false},409);
 if(!SContract.canStudioAction(fixtureState,cmd.action,cmd.action==='save'))return respond({ok:false},403);
 const next=structuredClone(fixtureState);next.draft.revision++;if(cmd.document)next.draft.document=structuredClone(cmd.document);
 next.draft.contentDigest=String(next.draft.revision).padStart(64,'c');
 next.draft.state={save:'draft',submit:'in_review',approve:'approved',request_changes:'changes_requested',publish:'published'}[cmd.action];
 if(cmd.action==='submit')next.draft.submittedBy=next.actorId;if(cmd.action==='save')next.draft.lastEditorId=next.actorId;
 if(cmd.action==='publish')next.published={version:next.published.version+1,contentDigest:next.draft.contentDigest,document:structuredClone(next.draft.document)};
 const reply={ok:true,snapshot:next,receipt:{id:`60000000-0000-4000-8000-${String(receipts.size+1).padStart(12,'0')}`,operationId:cmd.operationId,action:cmd.action,committed:true,replayed:false}};
 fixtureState=next;receipts.set(cmd.operationId,{body:init.body,reply});
 if(window.qa.mode==='lost'){window.qa.mode='ready';return respond({ok:false},503);}
 if(window.qa.mode==='foreign'){const f=structuredClone(reply);f.snapshot.scope.tenantId='90000000-0000-4000-8000-000000000001';return respond(f);}
 return respond(reply);
}
window.studioTest=SView.mountPassportStudio(document.querySelector('#app'),{initial:fixtureState,send:STransport.studioHTTPTransport('/api/admin/qa-editorial/command',fixtureState.actorId,mockFetch)});
