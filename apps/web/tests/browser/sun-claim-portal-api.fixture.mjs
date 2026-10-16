// Owned loopback upstream for sun-claim-portal.browser.mjs only.
// API/session/passport data and all signing material are synthetic; no persistence.
import http from 'node:http';
import {createHmac,randomBytes} from 'node:crypto';
if(process.argv[2]!=='--local-qa')throw Error('Explicit local QA required');
const port=Number(process.env.QA_API_PORT||4389),runId=process.env.QA_RUN_ID||'';
if(!Number.isInteger(port)||port<1024||port>65535||!/^[a-f0-9-]{36}$/i.test(runId))throw Error('Bound loopback port and QA_RUN_ID required');
for(const name of ['DATABASE_URL','POSTGRES_URL','SUN_HANDOFF_SECRET','META_CONSUMER_OTP_ACCESS_TOKEN','TWILIO_AUTH_TOKEN','OPENAI_API_KEY','RESEND_API_KEY'])if(process.env[name])throw Error('Credential environment forbidden');
const key=randomBytes(32),issued=new Map(),calls=[],forbidden=[];let nextId=910000;
const states=new Set(['closed','opened','manual','denied','blocked','snapshot','qr','no-support','missing-fresh']);
const sign=body=>createHmac('sha256',key).update(body).digest('base64url');
function issue(state,ttl=300){
 const eventId=String(++nextId),now=Math.floor(Date.now()/1000),exp=now+ttl;
 const payload={purpose:'sun_fresh_handoff',eventId,bid:'QA-ONLY',uid:'EVENT-'+eventId,diagnosticId:Number(eventId),traceId:'qa-claim-portal',iat:now,exp};
 const body=Buffer.from(JSON.stringify(payload)).toString('base64url'),token=body+'.'+sign(body);
 issued.set(eventId,{state,token,exp});return{eventId,token,expiresAt:exp*1000,state};
}
function valid(token,id){try{const[body,signature]=String(token).split('.'),p=JSON.parse(Buffer.from(body,'base64url'));return signature===sign(body)&&p.eventId===id&&p.exp>Date.now()/1000;}catch{return false;}}
function support(id){const body=Buffer.from(JSON.stringify({purpose:'support-report-qa-only',eventId:id,exp:Math.floor(Date.now()/1000)+900})).toString('base64url');return body+'.'+sign(body);}
function contract(url){
 const eventId=/^\/sun\/snapshot\/(\d+)$/.exec(url.pathname)?.[1]||'910001',entry=issued.get(eventId);
 const state=url.searchParams.get('qr')==='1'?'qr':entry?.state||'snapshot';
 const qr=state==='qr',opened=state==='opened',manual=state==='manual',snapshot=state==='snapshot';
 const fresh=!qr&&!snapshot&&valid(url.searchParams.get('fresh')||'',eventId),allowed=fresh&&!['denied','blocked','manual'].includes(state);
 const code=qr?'IDENTIFIED':manual?'MANUAL_OPENED':opened?'VALID_OPENED':'VALID_CLOSED';
 return{ok:true,verdict:qr?'identified':'valid',status:{code,productState:manual?'VALID_MANUAL_OPENED':qr?'NOT_REGISTERED':code,tone:'good',tamperSupported:!qr,tamperStatus:qr?'UNKNOWN':opened||manual?'OPENED':'CLOSED',carrierProfileCode:qr?'qr_basic':'ntag424_dna_tt'},
 identity:{bid:'QA-ONLY',tenantSlug:'qa-brand',eventId,uid:'EVENT-'+eventId,tagStatus:'active',readCounter:1},
 product:{name:'Producto sintético de QA',winery:'Marca de ensayo local',vertical:'wine',region:'Origen de ensayo'},
 supportReport:state==='no-support'||qr?null:{token:support(eventId),eventId,expiresAt:new Date(Date.now()+900000).toISOString()},
 snapshot:{mode:fresh?'fresh_handoff':'historical',requiresFreshTap:!fresh},tapSecurity:{actionability:fresh?'fresh_handoff':'read_only',freshTap:fresh,snapshot:!fresh},
 tag_tamper:{available:!qr,status:qr?'not_available':opened||manual?'opened':'closed',raw:opened?'4F4F':'4343'},
 technical:{tt:{raw:opened?'4F4F':'4343',source:manual?'manual_override':'enc_decrypted',length:2}},
 ...(manual?{manualTamperOverride:{active:true,tamperStatus:'opened'}}:{}),
 allowedActions:allowed?['claim','save','join','provenance']:state==='blocked'?['claim','provenance']:['provenance'],blockedActions:allowed?[]:['claim','warranty','tokenization','rewards'],
 cta:{claimOwnership:allowed,registerWarranty:false,tokenize:false,provenance:true},
 engagement:{configuration:{version:'nexid.tenant-actions.v1',status:'published',allowedActions:[],tenantSlug:'qa-brand',catalogAvailable:false,program:null,trivia:null}},
 provenance:{origin:'Origen declarado sintético',timelineSummary:[]},tapContext:{utcTime:'2026-10-16T01:00:00.000Z',timezone:'UTC'}};
}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:'+port),method=req.method||'';
 const reply=(status,payload)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(payload));};
 let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>8192)return reply(413,{ok:false,error:'qa_body_too_large'});}
 let body={};try{if(text)body=JSON.parse(text);}catch{return reply(400,{ok:false,error:'qa_invalid_json'});}
 if(url.pathname==='/qa-state'&&method==='GET')return reply(200,{protocol:'nexid.sun-claim-portal-fixture.v1',runId,calls,forbidden,synthetic:true});
 if(url.pathname==='/qa-issue'&&method==='GET'){
  const state=url.searchParams.get('state')||'closed',ttl=Number(url.searchParams.get('ttl')||300);
  if(!states.has(state)||!Number.isInteger(ttl)||ttl<1||ttl>300)return reply(400,{ok:false});return reply(200,issue(state,ttl));
 }
 const row={method,path:url.pathname};calls.push(row);
 if(method==='POST'&&url.pathname==='/public/cta/experience-event')return reply(200,{ok:true,qaOnly:true});
 if(!['GET','HEAD'].includes(method)){forbidden.push(row);return reply(500,{ok:false,error:'qa_business_write_forbidden'});}
 if(url.pathname==='/sun')return reply(200,contract(url));
 if(/^\/sun\/snapshot\/\d+$/.test(url.pathname))return reply(200,{ok:true,contract:contract(url)});
 if(url.pathname==='/public/product-notices/v2')return reply(200,{ok:true,protocol:'nexid.product-notices.v2',scope:{tenant:'qa-brand',bid:'QA-ONLY'},observedAt:new Date().toISOString(),notices:[],total:0,hasMore:false,doesNotDetermineNfcAuthenticity:true,closureDoesNotReleaseProduct:true,liftingNoticeDoesNotReleaseProduct:true});
 if(url.pathname==='/consumer/session')return reply(200,{ok:true,authenticated:String(req.headers.cookie||'').includes('consumer_qa=local')});
 if(['/consumer/me','/consumer/products','/consumer/taps','/consumer/brands'].includes(url.pathname)){
  if(!String(req.headers.cookie||'').includes('consumer_qa=local'))return reply(401,{ok:false,error:'unauthorized'});
  return reply(200,url.pathname==='/consumer/me'?{ok:true,consumer:{id:'10000000-0000-4000-8000-000000000001',display_name:'Cuenta sintética QA',status:'verified'},stats:{products:0,taps:0}}:{ok:true,items:[]});
 }
 forbidden.push(row);return reply(404,{ok:false,error:'qa_unknown_path'});
});
server.listen(port,'127.0.0.1',()=>process.stdout.write(JSON.stringify({ready:true,protocol:'nexid.sun-claim-portal-fixture.v1',runId,port,synthetic:true})+'\n'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
