import http from 'node:http';import {createRecallFixture} from './recall-local-fixture.mjs';import {handleRecall} from '../src/lib/recall-http.ts';import {publicRecallNotices} from '../src/lib/recall-service.ts';import {recallFailure} from '../src/lib/recall-policy.ts';
const f=await createRecallFixture(Number(process.env.QA_PG_PORT||15452));const calls=[];let loseNext=false;
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1:4220');const reply=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
 if(u.pathname==='/sun')return reply(200,{ok:true,verdict:'IDENTIFIED_UNVERIFIED',identity:{bid:'LOT-RECALL-QA',tenantSlug:'recall-qa',tenantId:'10000000-0000-4000-8000-000000000001',carrier:'qr_basic',trust_level:'VISIBLE_IDENTITY',authentication_level:'NOT_CRYPTOGRAPHICALLY_AUTHENTICATED'},tenant:{slug:'recall-qa',name:'Empresa de pruebas local'},product:{name:'Producto piloto local',winery:'Empresa QA',region:'Ubicación declarada'},tag_tamper:{available:false,status:'unknown'},cta:{},warnings:[]});
 if(u.pathname==='/qa-state')return reply(200,{calls,caseCount:(await f.query('SELECT count(*)::int n FROM product_recall_cases')).rows[0].n,operationCount:(await f.query('SELECT count(*)::int n FROM product_recall_operations')).rows[0].n});
 if(u.pathname==='/qa-lose-next'&&req.method==='POST'){loseNext=true;return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-stop'&&req.method==='POST'){reply(200,{ok:true});server.close();await f.close();return;}
 if(u.pathname==='/public/product-notices'){calls.push({method:'GET',path:u.pathname});try{return reply(200,await publicRecallNotices(u.searchParams.get('tenant')||'',u.searchParams.get('bid')||''));}catch(e){const err=recallFailure(e);return reply(err.status,{ok:false,reason:err.reason});}}
 const token=String(req.headers.authorization||'').replace('Bearer ','');const s=f.session(token);
 if(u.pathname==='/auth/session')return reply(s?200:401,s?{ok:true,session:s}:{ok:false});
 const m=/^\/admin\/batches\/([^/]+)\/recalls(?:\/([^/]+))?$/.exec(u.pathname);if(!m)return reply(404,{ok:false});
 calls.push({method:req.method,path:u.pathname,who:s?.label||'unauthenticated'});
 let body='';for await(const chunk of req){body+=chunk;if(body.length>65536)return reply(413,{ok:false});}
 const request=new Request(u,{method:req.method,headers:{...req.headers},body:body||undefined});
 const r=await handleRecall(request,m[1],req.method==='POST'?m[2]:undefined,req.method==='POST'?undefined:m[2],async token=>f.session(token));
 if(req.method==='POST'&&r.ok&&loseNext){loseNext=false;return reply(503,{ok:false,reason:'local_response_lost_after_commit'});}
 res.writeHead(r.status,Object.fromEntries(r.headers));res.end(await r.text());
});server.listen(4220,'127.0.0.1',()=>console.log('S6_RECALL_ACTUAL_HANDLERS_LOCAL_4220'));
