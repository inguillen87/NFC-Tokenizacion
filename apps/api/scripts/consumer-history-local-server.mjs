import http from 'node:http';import {createHistoryFixture} from './consumer-history-fixture.mjs';import {consumerHistoryRequest} from '../src/lib/consumer-history.ts';
const f=await createHistoryFixture(16522),calls=[];let failed=false,expired=false;
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1:4752'),send=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
 if(u.pathname==='/qa-state')return send(200,{localOnly:true,calls});
 if(u.pathname==='/qa-mode'&&req.method==='POST'){failed=u.searchParams.get('failed')==='1';expired=u.searchParams.get('expired')==='1';return send(200,{localOnly:true});}
 if(u.pathname==='/qa-stop'&&req.method==='POST'){send(200,{localOnly:true});server.close();await f.close();return;}
 const token=String(req.headers.cookie||'').match(/(?:^|;\s*)history_qa=([^;]+)/)?.[1]||'',identity=expired?null:f.identity(token);
 if(u.pathname==='/consumer/session')return send(200,{ok:true,authenticated:Boolean(identity)});
 calls.push({path:u.pathname,query:Object.fromEntries(u.searchParams),method:req.method});
 if(u.pathname==='/consumer/taps/history'){
  if(failed)return send(503,{ok:false});const r=await consumerHistoryRequest(new Request(u,{method:req.method}),async()=>identity);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(await r.text());return;
 }
 if(!identity)return send(401,{ok:false});
 if(u.pathname==='/consumer/me')return send(200,{ok:true,consumer:{display_name:'Mi cuenta de prueba',status:'verified'},stats:{products:1,taps:237}});
 if(u.pathname==='/consumer/brands')return send(200,{ok:true,items:[]});
 return send(404,{ok:false});
});server.listen(4752,'127.0.0.1',()=>console.log('HISTORY_SQL_QA_READY_4752'));
