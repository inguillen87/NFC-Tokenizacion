import http from 'node:http';import {createIntakeFixture} from './epcis-intake-local-fixture.mjs';
import {queryEpcisEvents} from '../src/lib/epcis';
const f=await createIntakeFixture(15762),calls=[];let lose=false,failed=false;
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1:4371');const reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
 if(u.pathname==='/qa-state')return reply(200,{localOnly:true,calls,identities:f.identities,captures:(await f.query('SELECT count(*)::int n FROM epcis_capture_operations')).rows[0].n,events:(await f.query('SELECT count(*)::int n FROM epcis_events')).rows[0].n,unchanged:await f.unchanged()});
 if(u.pathname==='/qa-document')return reply(200,f.doc('file-aggregation','AggregationEvent'));
 if(u.pathname==='/qa-query')return reply(200,await queryEpcisEvents(f.tenant,{limit:20}));
 if(u.pathname==='/qa-lose'&&req.method==='POST'){lose=true;return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-fail'){failed=u.searchParams.get('on')==='1';return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-stop'&&req.method==='POST'){reply(200,{localOnly:true});server.close();await f.close();return;}
 const token=String(req.headers.authorization||'').replace('Bearer ','');const session=f.intakeSession(token);
 if(u.pathname==='/auth/session')return session?reply(200,{ok:true,session}):reply(401,{ok:false});
 calls.push({method:req.method,path:u.pathname});if(!session)return reply(401,{ok:false});if(failed)return reply(503,{ok:false,reason:'local_source_unavailable'});
 const match=/^\/admin\/batches\/([^/]+)\/epcis-intake(?:\/(preview|commit))?$/.exec(u.pathname);if(!match)return reply(404,{ok:false});
 try{let raw='';for await(const c of req)raw+=c;const action=match[2]||'read',r=await f.request(action,raw?JSON.parse(raw):null,token.replace('qa-intake-',''),u.searchParams.get('tenant')||'channels-qa',decodeURIComponent(match[1]));
 if(action==='commit'&&r.status===200&&lose){lose=false;return reply(503,{ok:false,reason:'local_response_lost_after_commit'});}
 res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
 }catch{reply(503,{ok:false,reason:'local_fixture_error'});}
});server.listen(4371,'127.0.0.1',()=>console.log('INTAKE_REAL_CAPTURE_QA_READY_4371'));
