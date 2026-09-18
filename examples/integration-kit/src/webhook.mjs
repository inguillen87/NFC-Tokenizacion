import http from 'node:http';
import {verifyAndParseNexIdWebhook} from '@product/nexid-server-sdk';
import {ConnectorError,hash} from './receipts.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function acceptWebhook({ledger,secret,keyId,tenantId,rawBody,headers,now}) {
  if(!UUID.test(tenantId)||ledger.binding.tenantId!==tenantId)throw new ConnectorError('webhook_tenant_configuration_required');
  if(Buffer.byteLength(String(secret||''))<32||typeof keyId!=='string'||keyId.length<1)throw new ConnectorError('webhook_secret_and_key_id_required');
  // The reference receiver deliberately does not silently downgrade to legacy signature v1.
  if(headers['x-nexid-signature-version']!=='v2'||headers['x-nexid-key-id']!==keyId)return {status:401,body:{ok:false,reason:'webhook_signature_rejected'}};
  const parsed=verifyAndParseNexIdWebhook({secret,rawBody,headers,now,maxBodyBytes:262144,expectedEventTypes:['sdk.external_event']});
  if(!parsed.ok||parsed.contractVersion!=='1.0')return {status:401,body:{ok:false,reason:'webhook_verification_failed'}};
  if(parsed.event.data.tenant_id!==tenantId)return {status:403,body:{ok:false,reason:'webhook_tenant_mismatch'}};
  for(const key of ['event_id','batch_id'])if(parsed.event.data[key]!=null&&!UUID.test(parsed.event.data[key]))return {status:422,body:{ok:false,reason:'webhook_projection_invalid'}};
  try {
    // The signed raw payload is not stored: only its digest, ID and bounded reference projection.
    const receipt=ledger.receive(parsed.event,hash(rawBody));
    return {status:200,body:{ok:true,received:true,eventId:parsed.event.id,duplicate:receipt.duplicate}};
  }catch(e){return {status:e.code==='webhook_event_content_conflict'?409:503,body:{ok:false,reason:e.code==='webhook_event_content_conflict'?'webhook_event_content_conflict':'local_inbox_unavailable'}};}
}
export function webhookServer(config){
  if(Buffer.byteLength(String(config.secret||''))<32||!config.keyId||!UUID.test(config.tenantId)||config.ledger.binding.tenantId!==config.tenantId)throw new ConnectorError('webhook_configuration_invalid');
  const server=http.createServer(async(req,res)=>{
    const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','connection':'close'});res.end(JSON.stringify(body));};
    if(req.url==='/health'&&req.method==='GET')return send(200,{ok:true,service:'nexid-reference-receiver'});
    if(req.url!=='/webhooks/nexid'||req.method!=='POST')return send(404,{ok:false});
    for(const name of ['x-nexid-signature-version','x-nexid-key-id','x-nexid-timestamp','x-nexid-delivery-id','x-nexid-event-id','x-nexid-signature']){
      const occurrences=req.rawHeaders.filter((v,i)=>i%2===0&&v.toLowerCase()===name).length;
      if(occurrences!==1)return send(401,{ok:false,reason:'signature_header_invalid'});
    }
    if(req.headers['content-encoding']||!String(req.headers['content-type']||'').startsWith('application/json'))return send(415,{ok:false});
    if(Number(req.headers['content-length'])>262144)return send(413,{ok:false});
    try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>262144)return send(413,{ok:false});chunks.push(chunk);}
      const result=acceptWebhook({...config,rawBody:Buffer.concat(chunks),headers:req.headers});send(result.status,result.body);
    }catch{if(!res.headersSent)send(503,{ok:false,reason:'receiver_unavailable'});}
  });
  server.requestTimeout=10000;server.headersTimeout=10000;server.maxHeadersCount=32;server.maxConnections=16;
  return server;
}
