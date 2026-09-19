import http from 'node:http';
import {createTraceFixture} from './batch-trace-local-fixture.mjs';
import {handleBatchTrace} from '../src/lib/batch-trace-http.ts';
const f=await createTraceFixture(15722),calls=[];let unavailable=false;
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1:4311');
 const reply=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
 if(u.pathname==='/qa-state')return reply(200,{calls,eventIds:f.eventIds,ids:f.ids,unchanged:await f.unchanged(),localOnly:true});
 if(u.pathname==='/qa-mode'){unavailable=u.searchParams.get('state')==='unavailable';return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-stop'&&req.method==='POST'){reply(200,{localOnly:true});server.close();await f.close();return;}
 const token=String(req.headers.authorization||'').replace('Bearer ','');
 if(u.pathname==='/auth/session'){const session=f.traceSession(token);return session?reply(200,{ok:true,session}):reply(401,{ok:false});}
 calls.push({path:u.pathname,method:req.method});
 if(unavailable)return reply(503,{ok:false});
 const match=/^\/admin\/batches\/([^/]+)\/traceability(?:\/events\/([^/]+))?$/.exec(u.pathname);
 if(!match)return reply(404,{ok:false});
 try{
  const response=await handleBatchTrace(new Request(u,{headers:{authorization:'Bearer '+token},method:req.method}),decodeURIComponent(match[1]),match[2],async token=>f.traceSession(token));
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{reply(503,{ok:false});}
});
server.listen(4311,'127.0.0.1',()=>console.log('TRACE_QA_READY_4311'));
