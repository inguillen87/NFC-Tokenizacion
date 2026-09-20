import http from 'node:http';import {readStudio,studioReadView,mutateStudio,studioFailure} from '../src/lib/passport-editorial-service.ts';
import {createLibraryFixture} from './passport-library-fixture.mjs';import {publishedLibraryRequest} from '../src/lib/passport-library.ts';
const f=await createLibraryFixture(16372);let lost=false,unavailable=false,reads=0,writes=0;const calls=[];
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1:4732'),reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
 if(u.pathname==='/qa-state'){const target=await readStudio('queue-qa','AGRO-TARGET');return reply(200,{reads,writes,calls,target:{draft:target.draft,published:target.published,history:target.history},product:(await f.query("SELECT sdm_config FROM batches WHERE bid='AGRO-TARGET'")).rows[0].sdm_config});}
 if(u.pathname==='/qa-source-republish'&&req.method==='POST'){await f.apply('AGRO-SOURCE','reopen');const row=await readStudio('queue-qa','AGRO-SOURCE'),doc=structuredClone(row.draft.document);doc.identity.product_name='Nombre publicado actualizado';doc.agro_product_profile.productName=doc.identity.product_name;doc.agro_product_profile.technicalSheetUrl='https://example.invalid/revision-2.pdf';await f.apply('AGRO-SOURCE','save',f.actors.editor,{document:doc});await f.publish('AGRO-SOURCE');return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-target-change'&&req.method==='POST'){const row=await readStudio('queue-qa','AGRO-TARGET'),doc=structuredClone(row.draft.document);doc.identity.region='Cambio externo de revisión';await f.apply('AGRO-TARGET','save',f.actors.other,{document:doc});return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-mode'){lost=u.searchParams.get('lost')==='1';unavailable=u.searchParams.get('unavailable')==='1';return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-stop'&&req.method==='POST'){reply(200,{localOnly:true});server.close();await f.close();return;}
 const token=String(req.headers.authorization||'').replace('Bearer ',''),session=f.session(token);if(!session)return reply(401,{ok:false});
 if(u.pathname==='/auth/session')return reply(200,{ok:true,session});
 const parts=u.pathname.split('/').filter(Boolean);if(parts[0]!=='admin'||parts[1]!=='batches')return reply(404,{ok:false});
 const bid=decodeURIComponent(parts[2]);
 if(parts[3]==='passport-library'&&req.method==='GET'){reads++;if(unavailable)return reply(503,{ok:false});const response=await publishedLibraryRequest(new Request(u,{headers:{authorization:'Bearer '+token}}),bid,async t=>f.session(t));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;}
 if(parts[3]==='passport-editorial'){
  const role=token.replace('queue-',''),authority=f.actors[role]||{actorId:session.userId,label:session.label,canEdit:false,canReview:false,canPublish:false};
  try{if(req.method==='GET')return reply(200,studioReadView(await readStudio(session.tenantSlug||u.searchParams.get('tenant')||'',bid),authority));
   if(req.method==='POST'){let body='';for await(const c of req)body+=c;if(body.length>98304)return reply(413,{ok:false});const command=JSON.parse(body);const result=await mutateStudio(session.tenantSlug||u.searchParams.get('tenant')||'',bid,authority,command,parts[4]);writes++;calls.push({role,action:command.action,operationId:command.operationId,note:command.note||null});if(lost){lost=false;return reply(503,{ok:false});}return reply(200,result);}
  }catch(e){const x=studioFailure(e);return reply(x.status,{ok:false,...x});}
 }
 reply(404,{ok:false});
});server.listen(4732,'127.0.0.1',()=>console.log('LOCAL_LIBRARY_PG_READY_4732'));
