import http from 'node:http';import {createTraceFixture} from './batch-traceability-local-fixture.mjs';import {handleBatchTraceability} from '../src/lib/batch-traceability-http.ts';
const f=await createTraceFixture(15716),calls=[];let failed=false;
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://127.0.0.1:4315');const reply=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
 if(url.pathname==='/qa-state')return reply(200,{calls,localOnly:true});
 if(url.pathname==='/qa-mode'&&req.method==='POST'){failed=url.searchParams.get('fail')==='1';return reply(200,{ok:true,localOnly:true});}
 if(url.pathname==='/qa-stop'&&req.method==='POST'){reply(200,{ok:true,localOnly:true});server.close();await f.close();return;}
 const session=f.session(String(req.headers.authorization||'').replace('Bearer ',''));
 if(url.pathname==='/auth/session')return reply(session?200:401,session?{ok:true,session}:{ok:false});
 const route=/^\/admin\/batches\/([^/]+)\/traceability$/.exec(url.pathname);if(!route)return reply(404,{ok:false});
 calls.push({method:req.method,path:url.pathname,tenant:url.searchParams.get('tenant')});if(failed)return reply(503,{ok:false});
 const r=await handleBatchTraceability(new Request(url,{method:req.method,headers:{authorization:String(req.headers.authorization||'')}}),route[1],async token=>f.session(token));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(await r.text());
});server.listen(4315,'127.0.0.1',()=>console.log('TRACEABILITY_QA_READY_4315'));
