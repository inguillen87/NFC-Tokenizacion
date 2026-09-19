import http from 'node:http';import {createProductionFixture} from './gs1-production-local-fixture.mjs';import {readBatchChannels} from '../src/lib/batch-channel-service.ts';import {resolveActiveGs1Identity} from '../src/lib/gs1-digital-link-registry.ts';
if(process.argv[2]!=='--local-qa')throw Error('Explicit local QA mode required');
const f=await createProductionFixture(15699),calls=[];let lost=false,unavailable=false;
const snapshot=async()=>(await f.query('SELECT bid,carrier_profile_code,sdm_config FROM batches ORDER BY bid')).rows;
const before=JSON.stringify(await snapshot());
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1:4299'),reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};try{
 if(u.pathname==='/qa-state')return reply(200,{calls,localOnly:true,counts:(await f.query('SELECT (SELECT count(*)::int FROM gs1_digital_link_identities) identities,(SELECT count(*)::int FROM gs1_batch_import_operations) operations')).rows[0],originalConfigUnchanged:before===JSON.stringify(await snapshot())});
 if(u.pathname==='/qa-lose-next'&&req.method==='POST'){lost=true;return reply(200,{ok:true,localOnly:true});}
 if(u.pathname==='/qa-mode'&&req.method==='POST'){unavailable=u.searchParams.get('unavailable')==='1';return reply(200,{ok:true,localOnly:true});}
 if(u.pathname==='/qa-stop'&&req.method==='POST'){reply(200,{ok:true,localOnly:true});server.close();await f.close();return;}
 if(u.pathname==='/public/gs1/resolve'){const resolved=await resolveActiveGs1Identity({gtin:u.searchParams.get('gtin')||'',lot:u.searchParams.get('lot')||'',serial:u.searchParams.get('serial')||''});return reply(resolved?200:404,resolved?{ok:true,registry:resolved}:{ok:false});}
 const token=String(req.headers.authorization||'').replace('Bearer ','');const who=token.replace('qa-production-',''),session=f.session(token);if(!session)return reply(401,{ok:false});
 if(u.pathname==='/auth/session')return reply(200,{ok:true,session});
 calls.push({path:u.pathname,method:req.method,who});if(unavailable)return reply(503,{ok:false,reason:'gs1_production_unavailable'});
 const ch=/^\/admin\/batches\/([^/]+)\/channels$/.exec(u.pathname);if(ch&&req.method==='GET')return reply(200,{ok:true,...await readBatchChannels(session.tenantSlug||u.searchParams.get('tenant')||'',ch[1]),canRegister:who==='editor'||who==='global'});
 const match=/^\/admin\/batches\/([^/]+)\/production\/([^/]+)$/.exec(u.pathname);if(!match)return reply(404,{ok:false});
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>98304)return reply(413,{ok:false});}
 const response=await f.request(match[2],req.method==='POST'?JSON.parse(raw):null,who,match[1],u.searchParams.get('tenant')||'',u.searchParams.get('operationId')||'');const value=await response.json().catch(()=>({ok:false}));
 if(match[2]==='commit'&&response.status===200&&lost){lost=false;return reply(503,{ok:false,reason:'local_lost_response_after_commit'});}
 return reply(response.status,value);
 }catch(e){console.log('GS1_QA_ERROR',String(e));return reply(503,{ok:false});}
});server.listen(4299,'127.0.0.1',()=>console.log('GS1_PRODUCTION_LOCAL_QA_READY_4299'));
