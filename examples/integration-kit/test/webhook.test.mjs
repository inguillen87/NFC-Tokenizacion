import assert from 'node:assert/strict';import test from 'node:test';
import {join} from 'node:path';
import {Ledger} from '../src/ledger.mjs';import {acceptWebhook,webhookServer} from '../src/webhook.mjs';
import {API_ORIGIN} from '../src/receipts.mjs';import {TENANT,TENANT_ID,sign,event,temporary} from './helpers.mjs';
const binding={tenant:TENANT,tenantId:TENANT_ID,connector:'erp-main',origin:API_ORIGIN};
test('signed v2 webhook deduplicates durably across restart and delivery IDs',()=>{
 const path=join(temporary(),'inbox.sqlite');let ledger=new Ledger(path,binding);const value=event(),first=sign(value),config={ledger,tenantId:TENANT_ID,...first};assert.equal(acceptWebhook(config).body.duplicate,false);ledger.close();
 ledger=new Ledger(path,binding);const second=sign(value,{secret:first.secret,keyId:first.keyId});assert.equal(acceptWebhook({...config,ledger,...second}).body.duplicate,true);assert.equal(ledger.db.prepare('SELECT count(*) n FROM notifications').get().n,1);ledger.close();
});
test('tampering, wrong tenant, stale timestamps, key ID and legacy signature cannot reach the inbox',()=>{
 const ledger=new Ledger(':memory:',binding),value=event(),s=sign(value),config={ledger,tenantId:TENANT_ID,...s};
 assert.equal(acceptWebhook({...config,rawBody:Buffer.from(s.rawBody.toString().replace('shipment.received','shipment.released'))}).status,401);
 assert.equal(acceptWebhook({...config,headers:{...s.headers,'x-nexid-key-id':'foreign'}}).status,401);
 assert.equal(acceptWebhook({...config,headers:{...s.headers,'x-nexid-signature-version':'v1'}}).status,401);
 assert.equal(acceptWebhook({...config,...sign(value,{secret:s.secret,keyId:s.keyId,timestamp:Math.floor(Date.now()/1000)-1000})}).status,401);
 const wrong={...value,data:{...value.data,tenant_id:'10000000-0000-4000-8000-000000000002'}};assert.equal(acceptWebhook({...config,...sign(wrong,{secret:s.secret,keyId:s.keyId})}).status,403);assert.equal(ledger.summary().inbox,0);ledger.close();
});
test('changed signed content for the same event conflicts instead of overwriting evidence',()=>{
 const ledger=new Ledger(':memory:',binding),value=event(),s=sign(value),config={ledger,tenantId:TENANT_ID,...s};assert.equal(acceptWebhook(config).status,200);
 const changed={...value,data:{...value.data,event_type:'shipment.other'}};assert.equal(acceptWebhook({...config,...sign(changed,{secret:s.secret,keyId:s.keyId})}).status,409);ledger.close();
});
test('inbox insertion and local projection rollback together after an injected failure',()=>{
 const ledger=new Ledger(':memory:',binding),s=sign(event());ledger.db.exec("CREATE TRIGGER injected_failure BEFORE INSERT ON notifications BEGIN SELECT RAISE(ABORT,'local_test_failure'); END");assert.equal(acceptWebhook({ledger,tenantId:TENANT_ID,...s}).status,503);assert.equal(ledger.summary().inbox,0);ledger.close();
});
test('real HTTP receiver rejects oversized input and commits concurrent duplicate deliveries once',async t=>{
 const ledger=new Ledger(':memory:',binding),s=sign(event());const server=webhookServer({ledger,tenantId:TENANT_ID,...s});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));ledger.close();});
 const url='http://127.0.0.1:'+server.address().port+'/webhooks/nexid';const responses=await Promise.all(Array.from({length:5},()=>fetch(url,{method:'POST',headers:s.headers,body:s.rawBody}).then(r=>r.json())));assert.equal(responses.filter(r=>!r.duplicate).length,1);assert.equal(ledger.summary().inbox,1);
 const tooLarge=await fetch(url,{method:'POST',headers:s.headers,body:Buffer.alloc(262145)});assert.equal(tooLarge.status,413);
});
