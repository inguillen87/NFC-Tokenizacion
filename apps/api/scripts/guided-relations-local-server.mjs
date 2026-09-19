import http from 'node:http';
import {createRelationFixture} from './guided-relations-local-fixture.mjs';
import {queryEpcisEvents} from '../src/lib/epcis';
const f=await createRelationFixture(15822),calls=[];let lose=false,failed=false;
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1:4422'),reply=(status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
 if(u.pathname==='/qa-state')return reply(200,{localOnly:true,calls,unit:f.unit,unit2:f.unit2,box:f.box,pallet:f.pallet,captures:Number((await f.query('SELECT count(*) n FROM epcis_capture_operations')).rows[0].n),unchanged:await f.unchanged()});
 if(u.pathname==='/qa-query')return reply(200,await queryEpcisEvents(f.tenant,{limit:50}));
 if(u.pathname==='/qa-lose'&&req.method==='POST'){lose=true;return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-mode'&&req.method==='POST'){failed=u.searchParams.get('fail')==='1';return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-stop'&&req.method==='POST'){reply(200,{localOnly:true});server.close();await f.close();return;}
 const token=String(req.headers.authorization||'').replace('Bearer ',''),who=token.replace('qa-intake-',''),session=f.intakeSession(token);
 if(u.pathname==='/auth/session')return session?reply(200,{ok:true,session}):reply(401,{ok:false});
 if(!session)return reply(401,{ok:false});calls.push({path:u.pathname,method:req.method,query:Object.fromEntries(u.searchParams)});
 if(failed)return reply(503,{ok:false,reason:'local_source_unavailable'});
 const parts=u.pathname.split('/').filter(Boolean);if(parts[0]!=='admin'||parts[1]!=='batches'||parts[3]!=='epcis-intake'||parts.length>5)return reply(404,{ok:false});
 try{
  const action=parts[4]||'read',bid=decodeURIComponent(parts[2]);let body='';for await(const c of req)body+=c;
  const response=action==='identities'?await f.search(Object.fromEntries(u.searchParams),who,bid,req.method):await f.request(action,body?JSON.parse(body):null,who,u.searchParams.get('tenant')||'channels-qa',bid);
  if(action==='commit'&&response.ok&&lose){lose=false;return reply(503,{ok:false,reason:'local_response_lost_after_commit'});}
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.log('RELATION_LOCAL_ERROR',String(error));reply(503,{ok:false,reason:'local_fixture_error'});}
});server.listen(4422,'127.0.0.1',()=>console.log('GUIDED_RELATIONS_REAL_PG_READY_4422'));
