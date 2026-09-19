import {handleProduction} from '../src/lib/gs1-production-http.ts';
// Loopback-only disposable PostgreSQL; no production data, accounts, keys or tag reads.
import http from 'node:http';import {mkdtemp,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {randomBytes} from 'node:crypto';
import {installEphemeralE2eSqlExecutor} from '../src/lib/db.ts';
import {readBatchChannels,registerBatchGs1,batchQrDestination,channelFailure} from '../src/lib/batch-channel-service.ts';
import {resolveActiveGs1Identity} from '../src/lib/gs1-digital-link-registry.ts';
import QRCode from 'qrcode';
export async function createProductionFixture(port=15698){
const tools=process.env.LOCAL_PG_TOOLS;if(!tools)throw new Error('Local tools required');
const {default:EmbeddedPostgres}=await import(pathToFileURL(join(tools,'embedded-postgres/dist/index.js')).href),{default:pg}=await import(pathToFileURL(join(tools,'pg/lib/index.js')).href);
const dir=await mkdtemp(join(tmpdir(),'nexid-channels-qa-')),password=randomBytes(24).toString('hex');
const cluster=new EmbeddedPostgres({databaseDir:join(dir,'pg'),user:'nexid_e2e',password,port,persistent:false,createPostgresUser:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
await cluster.initialise();await cluster.start();await cluster.createDatabase('nexid_e2e_gs1_production');
const pool=new pg.Pool({host:'127.0.0.1',port,user:'nexid_e2e',password,database:'nexid_e2e_gs1_production',max:8});
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
const undo=installEphemeralE2eSqlExecutor(async(parts,...values)=>{const sql=parts.reduce((s,p,i)=>s+p+(i<values.length?'$'+(i+1):''),'');return (await pool.query(sql,values)).rows;},{NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_DATABASE_URL:'postgres://nexid_e2e:local@127.0.0.1/nexid_e2e_gs1_production'});

await pool.query(await readFile(new URL('../db/migrations/20260919180000_0110_gs1_batch_import.sql',import.meta.url),'utf8'));
await pool.query("INSERT INTO tenants VALUES($1,'other-qa','active')",['10000000-0000-4000-8000-000000000002']);
function session(token){const who=String(token).replace('qa-production-','');if(!['editor','viewer','denied','global','foreign','operator'].includes(who))return null;return {id:'qa-'+who,userId:actor,email:'qa@example.invalid',label:'Cuenta de preparación QA',role:who==='global'?'super-admin':who==='operator'?'packaging-operator':'tenant-admin',tenantId:who==='global'?null:who==='foreign'?'10000000-0000-4000-8000-000000000002':tenant,tenantSlug:who==='global'?null:who==='foreign'?'other-qa':'channels-qa',permissions:who==='viewer'?['batches:read']:who==='global'?['*']:['batches:read','batch.product.configure'],deniedPermissions:who==='denied'?['gs1:write']:[],mfaVerified:true,isDemo:false,setupCompleted:true,expiresAt:new Date(Date.now()+3600000).toISOString(),rotatedCookieValue:null};}
async function request(action,input=null,who='editor',bid='GS1-LOCAL',requested='channels-qa',operationId=''){
 const url=new URL('http://127.0.0.1:4298/admin/batches/'+bid+'/production/'+action);if(requested)url.searchParams.set('tenant',requested);if(operationId)url.searchParams.set('operationId',operationId);
 return handleProduction(new Request(url,{method:action==='history'?'GET':'POST',headers:{authorization:'Bearer qa-production-'+who,'content-type':'application/json'},body:action==='history'?undefined:JSON.stringify(input)}),bid,action,async token=>session(token));
}
return {tenant,actor,query:(...args)=>pool.query(...args),session,request,close:async()=>{undo();await pool.end();await cluster.stop();}};
}
