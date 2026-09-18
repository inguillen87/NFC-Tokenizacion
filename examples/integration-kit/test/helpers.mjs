import http from 'node:http';
import {randomUUID,createHmac,randomBytes} from 'node:crypto';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
export const TENANT='company-local';
export const TENANT_ID='10000000-0000-4000-8000-000000000001';
export const BID='LOT-LOCAL-001';
export const CSV='external_id,bid,occurred_at,facility\nLOCAL-RECEIPT-1,LOT-LOCAL-001,2026-09-18T12:00:00Z,WAREHOUSE-1\n';
export function temporary(){return mkdtempSync(join(tmpdir(),'nexid-kit-test-'));}
export async function apiFixture(t){
  const dir=temporary(),db=new DatabaseSync(join(dir,'server.sqlite'));
  db.exec('CREATE TABLE receipts(k TEXT PRIMARY KEY,body TEXT,event_id TEXT);');
  const mode={lost:false,wrongTenant:false,posts:0,gets:0,reconciles:0,processing:false,invalidReceipt:false,redirect:false};
  const server=http.createServer(async(req,res)=>{
    const reply=(status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
    if(req.headers['x-nexid-tenant-slug']!==TENANT||!String(req.headers['x-nexid-api-key']).startsWith('local-test-'))return reply(403,{ok:false});
    if(mode.redirect){res.writeHead(302,{location:'http://127.0.0.1:1/do-not-follow'});return res.end();}
    const key=req.headers['idempotency-key'];
    if(req.url==='/api/v1/sdk/products/'+BID){mode.gets++;return reply(200,{ok:true,tenant:{slug:mode.wrongTenant?'other-tenant':TENANT},batch:{bid:BID},product:{},carrier:{},tags:[],stats:{}});}
    if(req.url.startsWith('/api/v1/sdk/idempotency/status')){
      if(req.method==='POST')mode.reconciles++;else mode.gets++;
      const r=db.prepare('SELECT * FROM receipts WHERE k=?').get(key||'');
      if(!r)return reply(404,{ok:false,reason:'idempotency_operation_not_found'});
      return reply(200,{ok:true,operation:'reportEvent',route:'/api/v1/sdk/events',state:mode.processing?'processing':'completed',operationCommitted:mode.processing?null:true,resourceId:mode.processing?null:r.event_id});
    }
    if(req.url!=='/api/v1/sdk/events'||req.method!=='POST')return reply(404,{ok:false});
    mode.posts++;let raw='';for await(const chunk of req)raw+=chunk;
    const previous=db.prepare('SELECT * FROM receipts WHERE k=?').get(key);
    if(previous&&previous.body!==raw)return reply(409,{ok:false,reason:'idempotency_key_payload_mismatch'});
    if(!previous)db.prepare('INSERT INTO receipts VALUES(?,?,?)').run(key,raw,randomUUID());
    const row=db.prepare('SELECT * FROM receipts WHERE k=?').get(key),body=JSON.parse(raw);
    if(mode.lost){mode.lost=false;return req.socket.destroy();}
    return reply(201,{ok:true,eventId:mode.invalidReceipt?'invalid':row.event_id,eventType:body.eventType,bid:body.bid,tenant:{slug:mode.wrongTenant?'other-tenant':TENANT}});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>server.close(r));db.close();});
  return {origin:'http://127.0.0.1:'+server.address().port,db,mode,dir};
}
export function sign(event,options={}){
  const secret=options.secret||randomBytes(32).toString('hex'),keyId=options.keyId||'endpoint-local',deliveryId=options.deliveryId||randomUUID(),timestamp=String(options.timestamp||Math.floor(Date.now()/1000));
  const rawBody=Buffer.from(JSON.stringify(event)),id=event.id;
  const prefix=['v2',timestamp,Buffer.byteLength(keyId),keyId,Buffer.byteLength(deliveryId),deliveryId,Buffer.byteLength(id),id,rawBody.length,''].join('.');
  return {secret,keyId,rawBody,headers:{'content-type':'application/json','x-nexid-signature-version':'v2','x-nexid-timestamp':timestamp,'x-nexid-key-id':keyId,'x-nexid-delivery-id':deliveryId,'x-nexid-event-id':id,'x-nexid-signature':'v2='+createHmac('sha256',secret).update(prefix).update(rawBody).digest('hex')}};
}
export function event(){return {schemaVersion:'1.0',id:'evt_'+randomBytes(32).toString('hex'),type:'sdk.external_event',createdAt:new Date().toISOString(),data:{tenant_id:TENANT_ID,event_id:randomUUID(),batch_id:randomUUID(),event_type:'shipment.received',auth_status:'NOT_CRYPTOGRAPHICALLY_AUTHENTICATED'}};}
