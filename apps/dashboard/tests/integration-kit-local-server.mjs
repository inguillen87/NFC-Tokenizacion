// Only synthetic authorization fixtures. The dashboard serves the actual release artifact.
import http from 'node:http';
const calls=[];let unavailable=false;
const server=http.createServer((req,res)=>{
 const reply=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
 if(req.url==='/qa-state')return reply(200,{calls,localOnly:true});
 if(req.url==='/qa-mode?unavailable=1'){unavailable=true;return reply(200,{ok:true});}
 if(req.url==='/qa-mode?unavailable=0'){unavailable=false;return reply(200,{ok:true});}
 if(req.url==='/qa-stop'){reply(200,{ok:true});return server.close();}
 calls.push({method:req.method,path:req.url});
 if(unavailable)return reply(503,{ok:false});
 const token=String(req.headers.authorization||'').replace('Bearer local-kit-','');
 if(req.url==='/auth/session'&&['admin','viewer','forged-viewer'].includes(token))return reply(200,{ok:true,session:{id:'local-kit-'+token,userId:'local-kit-'+token,role:token==='admin'?'tenant-admin':'viewer',label:'Cuenta QA local',tenantId:'10000000-0000-4000-8000-000000000001',tenantSlug:'company-local',isDemo:false,permissions:token==='viewer'?[]:['api_keys.read','api_keys.manage'],deniedPermissions:[],mfaVerified:true,setupCompleted:true}});
 return reply(401,{ok:false});
});server.listen(4212,'127.0.0.1',()=>console.log('S5_LOCAL_SESSION_FIXTURE_4212'));
