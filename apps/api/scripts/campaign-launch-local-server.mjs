import http from 'node:http';import {createLaunchFixture,DRAFT} from './campaign-launch-local-fixture.mjs';
const f=await createLaunchFixture(Number(process.env.QA_PG_PORT||15462));const port=Number(process.env.QA_HTTP_PORT||4295);let loseNext=false;const calls=[];
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1:'+port);const reply=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
 if(u.pathname==='/qa-state')return reply(200,{calls,plans:(await f.query('SELECT count(*)::int n FROM campaign_launch_plans')).rows[0].n,operations:(await f.query('SELECT count(*)::int n FROM campaign_launch_operations')).rows[0].n});
 if(u.pathname==='/qa-lose-next'&&req.method==='POST'){loseNext=true;return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-stop'&&req.method==='POST'){reply(200,{ok:true});server.close();await f.close();return;}
 const token=String(req.headers.authorization||'').replace('Bearer ','');const s=f.session(token);if(u.pathname==='/auth/session')return reply(s?200:401,s?{ok:true,session:s}:{ok:false});
 if(!u.pathname.startsWith('/admin/campaigns/launch'))return reply(404,{ok:false});calls.push({method:req.method,path:u.pathname});
 let body='';for await(const c of req){body+=c;if(body.length>8192)return reply(413,{ok:false});}
 const r=await f.request(u.pathname+u.search,token.replace('qa-launch-',''),body?JSON.parse(body):undefined);
 if(req.method==='POST'&&r.ok&&loseNext){loseNext=false;return reply(503,{ok:false,reason:'local_lost_response'});}res.writeHead(r.status,Object.fromEntries(r.headers));res.end(await r.text());
});server.listen(port,'127.0.0.1',()=>console.log('CAMPAIGN_LOCAL_READY_'+port));
