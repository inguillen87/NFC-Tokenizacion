// Loopback-only disposable PostgreSQL; no production data, accounts, keys or tag reads.
import http from 'node:http';import {mkdtemp,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {randomBytes} from 'node:crypto';
import {installEphemeralE2eSqlExecutor} from '../src/lib/db.ts';
import {readBatchChannels,registerBatchGs1,batchQrDestination,channelFailure} from '../src/lib/batch-channel-service.ts';
import {resolveActiveGs1Identity} from '../src/lib/gs1-digital-link-registry.ts';
import QRCode from 'qrcode';
const tools=process.env.LOCAL_PG_TOOLS;if(!tools)throw new Error('Local tools required');
const {default:EmbeddedPostgres}=await import(pathToFileURL(join(tools,'embedded-postgres/dist/index.js')).href),{default:pg}=await import(pathToFileURL(join(tools,'pg/lib/index.js')).href);
const dir=await mkdtemp(join(tmpdir(),'nexid-channels-qa-')),password=randomBytes(24).toString('hex');
const cluster=new EmbeddedPostgres({databaseDir:join(dir,'pg'),user:'nexid_e2e',password,port:15448,persistent:false,createPostgresUser:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
await cluster.initialise();await cluster.start();await cluster.createDatabase('nexid_e2e_channels');
const pool=new pg.Pool({host:'127.0.0.1',port:15448,user:'nexid_e2e',password,database:'nexid_e2e_channels',max:8});
const tenant='10000000-0000-4000-8000-000000000001',actor='20000000-0000-4000-8000-000000000001';
await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";CREATE TABLE users(id uuid PRIMARY KEY);CREATE TABLE tenants(id uuid PRIMARY KEY,slug text,status text);CREATE TABLE batches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bid text,tenant_id uuid REFERENCES tenants(id),status text,carrier_profile_code text,sdm_config jsonb);CREATE TABLE tags(id uuid PRIMARY KEY,batch_id uuid REFERENCES batches(id),uid_hex text,status text,lifecycle_state text);CREATE TABLE carrier_profiles(code text PRIMARY KEY);CREATE TABLE tenant_carrier_policies(tenant_id uuid,carrier_profile_code text,enabled boolean);`);
await pool.query('INSERT INTO users VALUES($1);',[actor]);await pool.query("INSERT INTO tenants VALUES($1,'channels-qa','active')",[tenant]);
const migration=await readFile(new URL('../db/migrations/20260729110500_0069_gs1_epcis_foundation.sql',import.meta.url),'utf8');await pool.query(migration.slice(0,migration.indexOf('CREATE TABLE IF NOT EXISTS epcis_capture_operations')));
for(const [bid,code] of [['TT-LOCAL','ntag424_dna_tt'],['QR-LOCAL','qr_basic'],['GS1-LOCAL','gs1_digital_link']]){
 await pool.query('INSERT INTO carrier_profiles VALUES($1)',[code]);await pool.query('INSERT INTO tenant_carrier_policies VALUES($1,$2,true)',[tenant,code]);
 const cfg={product_name:'Producto '+bid,ttstatus_enabled:code==='ntag424_dna_tt',ttstatus_source:'enc_decrypted',ttstatus_length:2,ttstatus_closed_values:['4343'],ttstatus_opened_values:['4F4F','4F43'],ttstatus_invalid_values:['4949'],ttstatus_plain_or_encrypted:'encrypted',meta_key_identifier:'SYNTHETIC_TECHNICAL_SENTINEL',counter:73};
 await pool.query("INSERT INTO batches(bid,tenant_id,status,carrier_profile_code,sdm_config) VALUES($1,$2,'active',$3,$4)",[bid,tenant,code,JSON.stringify(cfg)]);
}
await pool.query("INSERT INTO gs1_gtin_prefix_entitlements(tenant_id,canonical_gtin_prefix,verification_method,evidence_reference,created_by_user_id) VALUES($1,'0950600','pilot_contract_review','Local synthetic authorization',$2)",[tenant,actor]);
const undo=installEphemeralE2eSqlExecutor(async(parts,...values)=>{const sql=parts.reduce((s,p,i)=>s+p+(i<values.length?'$'+(i+1):''),'');return (await pool.query(sql,values)).rows;},{NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_DATABASE_URL:'postgres://nexid_e2e:local@127.0.0.1/nexid_e2e_channels'});
const calls=[];let lost=false;
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost:4198');const reply=(status,b)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(b));};
 if(u.pathname==='/qa-state')return reply(200,{calls,identities:(await pool.query('SELECT count(*)::int n FROM gs1_digital_link_identities')).rows[0].n,batches:(await pool.query('SELECT bid,carrier_profile_code,sdm_config FROM batches ORDER BY bid')).rows});
 if(u.pathname==='/qa-lose-next'&&req.method==='POST'){lost=true;return reply(200,{localOnly:true});}
 if(u.pathname==='/qa-stop'&&req.method==='POST'){reply(200,{localOnly:true});server.close();undo();await pool.end();await cluster.stop();return;}
 if(u.pathname==='/public/gs1/resolve'){try{const r=await resolveActiveGs1Identity({gtin:u.searchParams.get('gtin')||'',lot:u.searchParams.get('lot')||'',serial:u.searchParams.get('serial')||''});return reply(r?200:404,r?{ok:true,registry:r}:{ok:false});}catch(e){return reply(400,{ok:false});}}
 const role=String(req.headers.authorization||'').replace('Bearer local-channels-','');if(!['editor','viewer'].includes(role))return reply(401,{ok:false});
 if(u.pathname==='/auth/session')return reply(200,{ok:true,session:{id:actor,userId:actor,role:'tenant-admin',label:'Cuenta local '+role,tenantId:tenant,tenantSlug:'channels-qa',isDemo:false,permissions:role==='editor'?['batches:read','batch.product.configure']:['batches:read'],deniedPermissions:[],mfaVerified:true,setupCompleted:true}});
 const m=/^\/admin\/batches\/([^/]+)\/channels(\/qr)?$/.exec(u.pathname);if(!m)return reply(404,{ok:false});calls.push({role,path:u.pathname,method:req.method});
 if(u.searchParams.has('tenant')&&u.searchParams.get('tenant')!=='channels-qa')return reply(403,{ok:false});
 try{if(req.method==='GET'){if(m[2]){const target=await batchQrDestination('channels-qa',m[1],u.searchParams.get('identity')||'');return reply(200,{ok:true,...target,svg:await QRCode.toString(target.url,{type:'svg',margin:4,errorCorrectionLevel:'M'})});}return reply(200,{ok:true,...await readBatchChannels('channels-qa',m[1]),canRegister:role==='editor'});}
 if(req.method==='POST'){if(role!=='editor')return reply(403,{ok:false});let body='';for await(const c of req)body+=c;const result=await registerBatchGs1('channels-qa',m[1],actor,JSON.parse(body));if(lost){lost=false;return reply(503,{ok:false,reason:'local_lost_response'});}return reply(200,{...result,channels:{ok:true,...await readBatchChannels('channels-qa',m[1]),canRegister:true}});}return reply(405,{ok:false});
 }catch(e){console.log('LOCAL_CHANNEL_ERROR',String(e));const f=channelFailure(e);return reply(f.status,{ok:false,reason:f.reason});}
});server.listen(4198,'127.0.0.1',()=>console.log('CHANNELS_LOCAL_READY_4198'));
