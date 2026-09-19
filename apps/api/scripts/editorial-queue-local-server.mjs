import {readStudio,studioReadView,mutateStudio} from '../src/lib/passport-editorial-service.ts';
import http from 'node:http';import {createEditorialQueueFixture} from './editorial-queue-local-fixture.mjs';import {editorialQueueRequest} from '../src/lib/editorial-queue-http.ts';
const f=await createEditorialQueueFixture(16032),calls=[];let unavailable=false,revoked=false;
const session=token=>{const s=f.session(token);return s&&revoked?{...s,permissions:['batches:read'],deniedPermissions:['batch.product.configure','batch.product.review','batch.product.publish']}:s;};
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1:4532'),reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
 try{
 if(u.pathname==='/qa-state')return reply(200,{localOnly:true,calls,heads:Number((await f.query('SELECT count(*) n FROM passport_editorial_heads')).rows[0].n),history:Number((await f.query('SELECT count(*) n FROM passport_editorial_history')).rows[0].n)});
 if(u.pathname==='/qa-mode'&&req.method==='POST'){unavailable=u.searchParams.get('unavailable')==='1';revoked=u.searchParams.get('revoked')==='1';return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-approve'&&req.method==='POST'){await f.apply('REVIEW-OTHER','approve',f.actors.reviewer);return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-stop'&&req.method==='POST'){reply(200,{localOnly:true});server.close();await f.close();return;}
 const token=String(req.headers.authorization||'').replace('Bearer ','');
 if(u.pathname==='/auth/session'){const s=session(token);return reply(s?200:401,s?{ok:true,session:s}:{ok:false});}
 calls.push({path:u.pathname,method:req.method});if(unavailable)return reply(503,{ok:false});
 const path=u.pathname.split('/').filter(Boolean);
 if(path[0]==='admin'&&path[1]==='batches'&&path[3]==='passport-editorial'){
  const current=session(token);if(!current)return reply(401,{ok:false});const tenant=current.tenantSlug||u.searchParams.get('tenant')||'';
  const permissions=current.permissions,all=permissions.includes('*');const actor={actorId:current.userId,label:current.label,canEdit:all||permissions.includes('batch.product.configure'),canReview:all||permissions.includes('batch.product.review'),canPublish:all||permissions.includes('batch.product.publish')};
  if(req.method==='GET')return reply(200,studioReadView(await readStudio(tenant,decodeURIComponent(path[2])),actor));
  if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>98304)return reply(413,{ok:false});}return reply(200,await mutateStudio(tenant,decodeURIComponent(path[2]),actor,JSON.parse(raw),path[4]));}
 }

 if(u.pathname==='/admin/passport-editorial/queue'){const r=await editorialQueueRequest(new Request(u,{method:req.method,headers:{authorization:'Bearer '+token}}),async token=>session(token));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(await r.text());return;}
 reply(404,{ok:false});
 }catch(e){console.error('LOCAL_QUEUE_FAILURE',e.message);reply(503,{ok:false});}
});server.listen(4532,'127.0.0.1',()=>console.log('EDITORIAL_QUEUE_REAL_PG_READY_4532'));
