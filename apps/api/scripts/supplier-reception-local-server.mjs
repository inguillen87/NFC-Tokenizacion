// Disposable loopback-only database and synthetic principals; actual reception policy/read service.
import assert from 'node:assert/strict';import http from 'node:http';import {mkdtemp} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';import {randomBytes} from 'node:crypto';
import {installEphemeralE2eSqlExecutor} from '../src/lib/db.ts';
import {canReadReception,receptionTenant} from '../src/lib/supplier-reception-policy.ts';
import {readSupplierReception} from '../src/lib/supplier-reception-read.ts';
const tools=process.env.LOCAL_PG_TOOLS;assert.ok(tools);
const {default:EmbeddedPostgres}=await import(pathToFileURL(join(tools,'embedded-postgres/dist/index.js')).href);
const {default:pg}=await import(pathToFileURL(join(tools,'pg/lib/index.js')).href);
const dir=await mkdtemp(join(tmpdir(),'nexid-reception-pg-')),password=randomBytes(24).toString('hex'),port=15442;
const cluster=new EmbeddedPostgres({databaseDir:join(dir,'pg'),user:'nexid_e2e',password,port,persistent:false,createPostgresUser:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
await cluster.initialise();await cluster.start();await cluster.createDatabase('nexid_e2e_reception');
const pool=new pg.Pool({host:'127.0.0.1',port,user:'nexid_e2e',password,database:'nexid_e2e_reception',max:8});
assert.equal((await pool.query('SELECT current_database() name')).rows[0].name,'nexid_e2e_reception');
const T='10000000-0000-4000-8000-000000000001',B='20000000-0000-4000-8000-000000000001',O='30000000-0000-4000-8000-000000000001';
await pool.query(`CREATE TABLE tenants(id uuid PRIMARY KEY,slug text,name text,type text,status text);
CREATE TABLE batches(id uuid PRIMARY KEY,tenant_id uuid,bid text,status text,carrier_profile_code text,qa_status text,qa_acceptance_scope text,supplier_order_id uuid,editorial_managed boolean,created_at timestamptz DEFAULT now());
CREATE TABLE tags(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),batch_id uuid,status text,last_seen_at timestamptz);
CREATE TABLE supplier_orders(id uuid PRIMARY KEY,tenant_id uuid,customer_slug text,order_name text,order_code text,carrier_profile_code text,chip_model text,total_quantity int,sub_batch_size int,status text,packaging_governance_status text,packaging_spec_revision int,pack_purpose text,created_at timestamptz DEFAULT now());
CREATE TABLE supplier_sub_batches(id uuid PRIMARY KEY,supplier_order_id uuid,tenant_id uuid,batch_id uuid,bid text,sequence_index int,expected_quantity int,manifest_count int,manifest_status text,qa_status text,qa_acceptance_scope text,manufacturing_state text,status text,active_count int,activated_at timestamptz,key_export_count int,key_exported_at timestamptz);
CREATE TABLE supplier_pack_purpose_decisions(id uuid PRIMARY KEY,tenant_id uuid,supplier_order_id uuid,to_purpose text,created_at timestamptz);
CREATE TABLE enterprise_role_profiles(code text,display_name text,tenant_bound boolean,human_session_allowed boolean,active boolean,default_permissions jsonb);`);
await pool.query('INSERT INTO tenants VALUES($1,$2,$3,$4,$5)',[T,'demo-client-qa','Bodega QA local','winery','active']);
await pool.query('INSERT INTO tenants VALUES($1,$2,$3,$4,$5)',['10000000-0000-4000-8000-000000000002','other-tenant-qa','Otra empresa QA','company','active']);
await pool.query('INSERT INTO batches(id,tenant_id,bid,status,carrier_profile_code,qa_status,editorial_managed) VALUES($1,$2,$3,$4,$5,$6,false)',[B,T,'PILOT-LOCAL','active','ntag424_dna_tt','pending']);
await pool.query("INSERT INTO tags(batch_id,status,last_seen_at) SELECT $1,CASE WHEN n<=10 THEN 'active' ELSE 'inactive' END,now() FROM generate_series(1,20) n",[B]);
await pool.query('INSERT INTO supplier_orders VALUES($1,$2,$3,$4,$5,$6,$7,100,100,$8,$9,1,$10,now())',[O,T,'demo-client-qa','Pedido de fábrica QA','FACTORY-QA-01','ntag424_dna_tt','NTAG424 DNA TT','ordered','draft','production']);
await pool.query('INSERT INTO supplier_sub_batches VALUES($1,$2,$3,$4,$5,1,100,0,$6,$7,NULL,$8,$9,0,NULL,0,NULL)',['40000000-0000-4000-8000-000000000001',O,T,B,'ROLL-LOCAL','pending','pending','planned','draft']);
const profiles={'super-admin':['users:manage'],'tenant-owner':['supplier_order.create','manifest.import','qa.approve','qa.plan.approve','batch.activate','batch.product.configure','users:manage'],'tenant-admin':['supplier_order.create','manifest.import','qa.approve','qa.plan.approve','batch.activate','batch.product.configure','users:manage'],'operations-manager':['supplier_order.create','manifest.import','qa.approve','batch.activate'],'packaging-operator':['manifest.import'],'marketing-manager':['batch.product.configure'],'viewer':['supplier_orders:read']};
for(const [role,permissions] of Object.entries(profiles))await pool.query('INSERT INTO enterprise_role_profiles VALUES($1,$2,$3,true,true,$4)',[role.replaceAll('-','_'),role,role!=='super-admin',JSON.stringify(permissions)]);
const undo=installEphemeralE2eSqlExecutor(async(strings,...values)=>{const query=strings.reduce((s,part,i)=>s+part+(i<values.length?'$'+(i+1):''),'');return (await pool.query(query,values)).rows;},{NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_DATABASE_URL:'postgres://nexid_e2e:local@127.0.0.1/nexid_e2e_reception'});
const calls=[];let unavailable=false;
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:4193');const reply=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
 if(url.pathname==='/qa-state')return reply(200,{calls,localOnly:true,unavailable});
 if(url.pathname==='/qa-mode'&&req.method==='POST'){unavailable=url.searchParams.get('mode')==='unavailable';return reply(200,{localOnly:true});}
 const role=String(req.headers.authorization||'').replace('Bearer qa-reception-','');if(!profiles[role])return reply(401,{ok:false});
 const principal={role,scope:role==='super-admin'?'super_admin':role==='packaging-operator'||role==='operations-manager'?'tenant_operator':'tenant_admin',tenantId:role==='super-admin'?null:T,tenantSlug:role==='super-admin'?null:'demo-client-qa',permissions:profiles[role],deniedPermissions:[]};
 if(url.pathname==='/auth/session')return reply(200,{ok:true,session:{id:'qa-'+role,userId:'qa-'+role,email:'qa@example.invalid',label:'Cuenta QA '+role,...principal,mfaVerified:true,setupCompleted:true,isDemo:false}});
 calls.push({path:url.pathname,method:req.method,role});
 if(url.pathname==='/admin/supplier-reception'&&req.method==='GET'){
  if(unavailable)return reply(503,{ok:false});if(!canReadReception(principal))return reply(403,{ok:false});
  try{const tenant=receptionTenant(principal,url.searchParams.get('tenant'));return reply(200,await readSupplierReception(principal,tenant,'Cuenta QA '+role));}catch(error){console.log('LOCAL_READ_ERROR',String(error));return reply(403,{ok:false});}
 }
 reply(405,{ok:false,reason:'local_fixture_is_read_only'});
});
server.listen(4193,'127.0.0.1',()=>console.log('RECEPTION_LOCAL_REAL_PG_READY_4193'));
let stopping=false;async function stop(){if(stopping)return;stopping=true;server.close();undo();await pool.end();await cluster.stop();process.exit(0);}process.on('SIGINT',stop);process.on('SIGTERM',stop);
