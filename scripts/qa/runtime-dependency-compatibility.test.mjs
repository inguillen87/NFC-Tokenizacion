// Explicit local regression for patched runtime dependencies. No real SMTP/WhatsApp recipient is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {createServer as tlsServer} from 'node:tls';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as tcpServer} from 'node:net';
import {createServer as httpServer} from 'node:http';
import nodemailer from 'nodemailer';
import axios from 'axios';
import RequestClient from 'twilio/lib/base/RequestClient.js';
import * as grpc from '@grpc/grpc-js';
import {resolveConsumerOtpProvider} from '../../apps/api/src/lib/consumer-auth-provider.ts';
assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.VERCEL_ENV,'test');
for(const name of ['DATABASE_URL','POSTGRES_URL','SMTP_PASSWORD','TWILIO_AUTH_TOKEN','HTTP_PROXY','HTTPS_PROXY'])assert.ok(!process.env[name],name+' must not enter the local acceptance process');
const root=new URL('../../',import.meta.url);
async function close(server,sockets){for(const socket of sockets)socket.destroy();await new Promise(done=>server.close(done));if(server.qaIpv6)await new Promise(done=>server.qaIpv6.close(done));}
async function localHttp(){const calls=[],sockets=new Set();const server=httpServer(async(req,res)=>{
 const body=[];for await(const part of req)body.push(part);calls.push({url:req.url,method:req.method,headers:req.headers,body:Buffer.concat(body).toString()});
 if(req.url==='/redirect'){res.writeHead(302,{location:'/target'});return res.end();}
 if(req.url==='/slow')return;
 const status=req.url==='/throttle'?429:200;res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({ok:status===200,echo:calls.at(-1).body}));
 });server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});await new Promise(done=>server.listen(0,'127.0.0.1',done));return{server,sockets,calls,url:'http://127.0.0.1:'+server.address().port};}
async function localSmtp(rejectAuth=false,tlsOptions){const messages=[],commands=[],sockets=new Set();const serve=tlsOptions?(fn)=>tlsServer(tlsOptions,fn):tcpServer;const onSocket=socket=>{
 sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.write('220 local-qa ESMTP\r\n');let buffer='',message=[],inData=false;
 socket.on('data',part=>{buffer+=part.toString();for(;;){const n=buffer.indexOf('\r\n');if(n<0)return;const line=buffer.slice(0,n);buffer=buffer.slice(n+2);
 if(inData){if(line!=='.'){message.push(line);continue;}messages.push(message.join('\r\n'));message=[];inData=false;socket.write('250 2.0.0 accepted locally\r\n');continue;}
 const verb=line.split(' ')[0];commands.push(verb);if(verb==='EHLO'||verb==='HELO')socket.write('250-local-qa\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n');else if(verb==='AUTH')socket.write(rejectAuth?'535 5.7.8 synthetic rejection\r\n':'235 2.7.0 local test only\r\n');else if(verb==='DATA'){inData=true;socket.write('354 end with dot\r\n');}else if(verb==='QUIT'){socket.end('221 bye\r\n');}else socket.write('250 ok\r\n');
 }});socket.on('error',()=>{});
 };const server=serve(onSocket);server.on('tlsClientError',()=>{});await new Promise(done=>server.listen(0,'127.0.0.1',done));if(tlsOptions){server.qaIpv6=serve(onSocket);server.qaIpv6.on('tlsClientError',()=>{});await new Promise((done,reject)=>{server.qaIpv6.once('error',reject);server.qaIpv6.listen(server.address().port,'::1',done);});}return{server,sockets,messages,commands,port:server.address().port};}
async function withEnv(patch,fn){const before=Object.fromEntries(Object.keys(patch).map(k=>[k,process.env[k]]));try{Object.assign(process.env,patch);return await fn();}finally{for(const[k,v]of Object.entries(before))if(v===undefined)delete process.env[k];else process.env[k]=v;}}
test('installed packages match the repaired lock entries and compatible parent ranges',async()=>{
 const lock=JSON.parse(await readFile(new URL('package-lock.json',root),'utf8'));
 for(const[name,version]of [['nodemailer','10.0.13'],['axios','1.20.0'],['@grpc/grpc-js','1.14.5']]){const installed=JSON.parse(await readFile(new URL('node_modules/'+name+'/package.json',root),'utf8'));assert.equal(installed.version,version);assert.equal(lock.packages['node_modules/'+name].version,version);assert.notEqual(lock.packages['node_modules/'+name].dev,true);}
 const manifest=JSON.parse(await readFile(new URL('apps/api/package.json',root),'utf8'));assert.equal(manifest.dependencies.nodemailer,'10.0.13');assert.equal(lock.packages['node_modules/twilio'].dependencies.axios,'^1.13.5');assert.equal(lock.packages['node_modules/google-gax'].dependencies['@grpc/grpc-js'],'^1.12.6');
});
test('real OTP provider authenticates to local SMTP and retains multipart content',{timeout:10000},async()=>{
 const s=await localSmtp();try{await withEnv({CONSUMER_AUTH_MODE:'smtp',SMTP_HOST:'127.0.0.1',SMTP_PORT:String(s.port),SMTP_SECURE:'false',SMTP_USER:'sender@example.invalid',SMTP_PASSWORD:'disposable-local-qa',SMTP_FROM_EMAIL:'NexID QA <sender@example.invalid>',CONSUMER_PORTAL_URL:'https://example.invalid'},async()=>{
  const result=await resolveConsumerOtpProvider().sendOtp({contact:'recipient@example.invalid',code:'123456',ttlMinutes:7});assert.equal(result.ok,true);assert.equal(s.messages.length,1);assert.ok(s.commands.includes('AUTH'));assert.match(s.messages[0],/multipart\/alternative/i);assert.match(s.messages[0],/recipient@example.invalid/);assert.match(s.messages[0],/123456/);
 });}finally{await close(s.server,s.sockets);}
});
test('SMTP authentication rejection never reports delivery success',{timeout:10000},async()=>{
 const s=await localSmtp(true);try{await withEnv({CONSUMER_AUTH_MODE:'smtp',SMTP_HOST:'127.0.0.1',SMTP_PORT:String(s.port),SMTP_SECURE:'false',SMTP_USER:'sender@example.invalid',SMTP_PASSWORD:'disposable-local-qa'},async()=>{await assert.rejects(resolveConsumerOtpProvider().sendOtp({contact:'recipient@example.invalid',code:'123456',ttlMinutes:7}),/smtp_delivery_failed/);assert.equal(s.messages.length,0);});}finally{await close(s.server,s.sockets);}
});
test('invalid OTP recipient is rejected before any SMTP connection',{timeout:10000},async()=>{
 const s=await localSmtp();try{await withEnv({CONSUMER_AUTH_MODE:'smtp',SMTP_HOST:'127.0.0.1',SMTP_PORT:String(s.port)},async()=>{await assert.rejects(resolveConsumerOtpProvider().sendOtp({contact:'not-an-email',code:'123456',ttlMinutes:7}),/email_contact_required/);assert.equal(s.commands.length,0);});}finally{await close(s.server,s.sockets);}
});
test('Nodemailer retains Unicode headers, recipients and a buffer attachment without network',{timeout:5000},async()=>{
 const transport=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix',disableFileAccess:true,disableUrlAccess:true});const r=await transport.sendMail({from:'NexID QA <from@example.invalid>',to:[{name:'Revisión técnica',address:'to@example.invalid'}],subject:'Confirmación de pasaporte',text:'Sólo prueba local',attachments:[{filename:'evidencia.txt',content:Buffer.from('LOCAL_ONLY')}]});assert.deepEqual(r.envelope.to,['to@example.invalid']);assert.match(r.message.toString(),/evidencia.txt/);assert.match(r.message.toString(),/multipart\/mixed/);
});
for(const source of ['path','href'])test('mail content cannot resolve disabled '+source,{timeout:5000},async()=>{const t=nodemailer.createTransport({streamTransport:true,buffer:true,disableFileAccess:true,disableUrlAccess:true});const part=source==='path'?{path:'C:/not-a-customer-file/blocked.txt'}:{href:'http://127.0.0.1:1/blocked'};await assert.rejects(t.sendMail({from:'from@example.invalid',to:'to@example.invalid',text:'QA',attachments:[part]}),source==='path'?/File access rejected/:/Url access rejected/i);});
for(const adapter of ['http','fetch'])test('Axios '+adapter+' obeys an explicit zero-redirect policy',{timeout:5000},async()=>{
 const h=await localHttp();try{const r=await axios.get(h.url+'/redirect',{adapter,maxRedirects:0,proxy:false,validateStatus:()=>true});assert.equal(r.status,302);assert.equal(h.calls.length,1);assert.equal(h.calls[0].url,'/redirect');}finally{await close(h.server,h.sockets);}
});
test('Twilio real request client preserves form encoding and Basic authentication over loopback',{timeout:5000},async()=>{
 const h=await localHttp();const c=new RequestClient({autoRetry:false,keepAlive:false,timeout:1000});try{const r=await c.request({method:'POST',uri:h.url+'/messages',username:'local-qa',password:'not-a-provider-token',headers:{'Content-Type':'application/x-www-form-urlencoded'},data:{To:'recipient-local-only',Body:'Confirmación & trazabilidad'},allowRedirects:false});assert.equal(r.statusCode,200);assert.equal(h.calls.length,1);assert.equal(h.calls[0].headers.authorization,'Basic '+Buffer.from('local-qa:not-a-provider-token').toString('base64'));assert.equal(new URLSearchParams(h.calls[0].body).get('Body'),'Confirmación & trazabilidad');}finally{c.axios.defaults.httpsAgent.destroy();await close(h.server,h.sockets);}
});
test('Twilio does not follow redirects or silently retry throttling when disabled',{timeout:5000},async()=>{
 const h=await localHttp();const c=new RequestClient({autoRetry:false,keepAlive:false,timeout:1000});try{for(const[path,status]of [['/redirect',302],['/throttle',429]]){const before=h.calls.length;const r=await c.request({method:'GET',uri:h.url+path,headers:{},allowRedirects:false});assert.equal(r.statusCode,status);assert.equal(h.calls.length,before+1);}}finally{c.axios.defaults.httpsAgent.destroy();await close(h.server,h.sockets);}
});
test('Axios request cancellation settles a pending local HTTP read',{timeout:5000},async()=>{const h=await localHttp();try{const c=new AbortController();const request=axios.get(h.url+'/slow',{signal:c.signal,proxy:false,timeout:1000});c.abort();await assert.rejects(request,e=>axios.isCancel(e));}finally{await close(h.server,h.sockets);}});
test('Axios data URI rejection remains a rejected Promise',{timeout:5000},async()=>{await assert.rejects(axios.get('data:invalid/',{proxy:false,timeout:1000}));});
test('gRPC unary requests, explicit errors and deadlines still work on loopback',{timeout:10000},async()=>{
 const encode=v=>Buffer.from(JSON.stringify(v)),decode=b=>JSON.parse(b.toString());const method={path:'/qa.Local/Echo',requestStream:false,responseStream:false,requestSerialize:encode,requestDeserialize:decode,responseSerialize:encode,responseDeserialize:decode};
 const server=new grpc.Server();server.addService({echo:method},{echo(call,done){if(call.request.mode==='slow')return;if(call.request.mode==='reject')return done({code:grpc.status.INVALID_ARGUMENT,details:'Synthetic bad input'});done(null,{echo:call.request.text});}});
 const port=await new Promise((done,reject)=>server.bindAsync('127.0.0.1:0',grpc.ServerCredentials.createInsecure(),(e,p)=>e?reject(e):done(p)));
 const Client=grpc.makeGenericClientConstructor({echo:method},'Local'),client=new Client('127.0.0.1:'+port,grpc.credentials.createInsecure());const invoke=(data,ms=2000)=>new Promise((done,reject)=>client.echo(data,{deadline:new Date(Date.now()+ms)},(e,r)=>e?reject(e):done(r)));
 try{assert.deepEqual(await invoke({text:'Pasaporte QA'}),{echo:'Pasaporte QA'});await assert.rejects(invoke({mode:'reject'}),e=>e.code===grpc.status.INVALID_ARGUMENT);await assert.rejects(invoke({mode:'slow'},50),e=>e.code===grpc.status.DEADLINE_EXCEEDED);}finally{client.close();server.forceShutdown();}
});
test('SMTPS rejects a second transport with a different TLS identity before authentication',{timeout:15000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'nexid-dependency-tls-'));let s;
 try{
  const keyPath=join(directory,'local.key'),certPath=join(directory,'local.crt');const openssl=process.platform==='win32'?'C:/Program Files/Git/usr/bin/openssl.exe':'openssl';
  const generated=spawnSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=mail-a.invalid','-addext','subjectAltName=DNS:mail-a.invalid','-keyout',keyPath,'-out',certPath],{encoding:'utf8',timeout:5000,windowsHide:true});assert.equal(generated.status,0,'ephemeral certificate generation');
  const cert=await readFile(certPath);s=await localSmtp(false,{cert,key:await readFile(keyPath)});
  const transport=name=>nodemailer.createTransport({host:'localhost',port:s.port,secure:true,auth:{user:'local-test',pass:'local-only'},connectionTimeout:3000,greetingTimeout:3000,tls:{servername:name,ca:cert,rejectUnauthorized:true}});
  const first=transport('mail-a.invalid');assert.equal(await first.verify(),true);first.close();const before=s.commands.filter(c=>c==='AUTH').length;
  const second=transport('mail-b.invalid');await assert.rejects(second.verify(),/not match|altname|certificate/i);second.close();assert.equal(s.commands.filter(c=>c==='AUTH').length,before);assert.equal(s.messages.length,0);
 }finally{if(s)await close(s.server,s.sockets);await rm(directory,{recursive:true,force:true});}
});
