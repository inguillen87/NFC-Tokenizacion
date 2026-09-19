// Loopback-only synthetic session/data fixture; actual read handlers and PostgreSQL projections.
import http from 'node:http';
import {createTracePageFixture} from './trace-page-local-fixture.mjs';
import {handleTracePage} from '../src/lib/trace-page-http.ts';
const f=await createTracePageFixture(15786),calls=[];let unavailable=false,revoked=false;
const session=token=>{const s=f.session(token);return s&&revoked?{...s,permissions:s.permissions.filter(x=>x!=='logistics:read'),deniedPermissions:[...s.deniedPermissions,'logistics:read']}:s;};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1:4386'),send=(status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
 if(u.pathname==='/qa-state')return send(200,{localOnly:true,calls});
 if(u.pathname==='/qa-mode'&&req.method==='POST'){unavailable=u.searchParams.get('unavailable')==='1';revoked=u.searchParams.get('revoked')==='1';return send(200,{localOnly:true});}
 if(u.pathname==='/qa-stop'&&req.method==='POST'){send(200,{localOnly:true});server.close();await f.close();return;}
 const token=String(req.headers.authorization||'').replace('Bearer ','');
 if(u.pathname==='/auth/session'){const s=session(token);return send(s?200:401,s?{ok:true,session:s}:{ok:false});}
 const parts=u.pathname.split('/').filter(Boolean);const m=parts.length===5&&parts[0]==='admin'&&parts[1]==='batches'&&parts[3]==='traceability'&&parts[4]==='page';
 if(m&&req.method==='GET'){
  calls.push({path:u.pathname,query:Object.fromEntries(u.searchParams),method:req.method});
  if(unavailable)return send(503,{ok:false,reason:'local_source_unavailable'});
  const response=await handleTracePage(new Request(u,{headers:{authorization:req.headers.authorization||''}}),decodeURIComponent(parts[2]),async token=>session(token));
  const body=await response.text();res.writeHead(response.status,Object.fromEntries(response.headers));res.end(body);return;
 }
 send(404,{ok:false,reason:'local_read_only_fixture'});
});server.listen(4386,'127.0.0.1',()=>console.log('TRACE_PAGE_LOCAL_PG_READY_4386'));
