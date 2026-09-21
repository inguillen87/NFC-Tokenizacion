import {mkdtemp} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';import {randomBytes} from 'node:crypto';
import {installEphemeralE2eSqlExecutor} from '../src/lib/db.ts';import {consumerHistoryRequest} from '../src/lib/consumer-history.ts';
export async function createHistoryFixture(port=16521){
 const tools=process.env.LOCAL_PG_TOOLS;if(!tools)throw Error('Explicit local PostgreSQL tools required');
 const {default:EmbeddedPostgres}=await import(pathToFileURL(join(tools,'embedded-postgres/dist/index.js')).href),{default:pg}=await import(pathToFileURL(join(tools,'pg/lib/index.js')).href);
 const dir=await mkdtemp(join(tmpdir(),'nexid-consumer-history-')),password=randomBytes(24).toString('hex'),cluster=new EmbeddedPostgres({databaseDir:join(dir,'pg'),user:'nexid_e2e',password,port,persistent:false,createPostgresUser:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
 let pool,undo;const user='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',empty='10000000-0000-4000-8000-000000000003',a='20000000-0000-4000-8000-000000000001',b='20000000-0000-4000-8000-000000000002';
 try{await cluster.initialise();await cluster.start();await cluster.createDatabase('nexid_e2e_history');pool=new pg.Pool({host:'127.0.0.1',port,user:'nexid_e2e',password,database:'nexid_e2e_history',max:6});const query=(s,p=[])=>pool.query(s,p);
 await query(`CREATE TABLE consumers(id uuid PRIMARY KEY,status text);CREATE TABLE tenants(id uuid PRIMARY KEY,slug text,name text);
 CREATE TABLE consumer_tap_history(id bigserial PRIMARY KEY,consumer_id uuid REFERENCES consumers(id),tenant_id uuid REFERENCES tenants(id),tap_event_id bigint NOT NULL,product_passport_id text,tag_id uuid,verdict text,risk_level text,city text,country text,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(consumer_id,tap_event_id));CREATE INDEX idx_consumer_tap_history_consumer ON consumer_tap_history(consumer_id,created_at DESC);
 CREATE TABLE consumer_products(id uuid PRIMARY KEY,consumer_id uuid,tenant_id uuid,product_name text,brand_name text,first_tap_event_id bigint,latest_tap_event_id bigint,uid_hex text);`);
 await query("INSERT INTO consumers VALUES($1,'verified'),($2,'verified'),($3,'verified')",[user,other,empty]);await query("INSERT INTO tenants VALUES($1,'wine-qa','Bodega de prueba'),($2,'agro-qa','Agro de prueba')",[a,b]);
 await query(`INSERT INTO consumer_tap_history(consumer_id,tenant_id,tap_event_id,verdict,risk_level,city,country,created_at)
 SELECT $1,CASE WHEN n%2=0 THEN $2::uuid ELSE $3::uuid END,9007199254740992+n,CASE WHEN n%4=0 THEN 'VALID_CLOSED' WHEN n%4=1 THEN 'VALID_OPENED' WHEN n%4=2 THEN 'QR_VIEW' ELSE 'REPLAY_SUSPECT' END,'low',NULL,NULL,'2026-09-01T12:00:00Z'::timestamptz+(n/3)*interval '1 microsecond' FROM generate_series(1,237) n`,[user,a,b]);
 await query("INSERT INTO consumer_tap_history(consumer_id,tenant_id,tap_event_id,verdict,city,created_at) VALUES($1,$2,9007199254740993,'VALID_CLOSED','OTHER_PERSON_LOCATION','2026-09-01T12:00:00Z')",[other,b]);
 await query("INSERT INTO consumer_products VALUES(gen_random_uuid(),$1,$2,'Producto asociado QA','Marca QA',9007199254741229,9007199254741229,'PRIVATE_UID'),(gen_random_uuid(),$3,$2,'OTHER_PERSON_PRODUCT','OTHER_PERSON_BRAND',9007199254741229,9007199254741229,'PRIVATE_UID')",[user,b,other]);
 let reads=0;undo=installEphemeralE2eSqlExecutor(async(parts,...v)=>{reads++;let s='';for(let i=0;i<parts.length;i++)s+=parts[i]+(i<v.length?'$'+(i+1):'');return(await query(s,v)).rows;},{NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_DATABASE_URL:'postgres://nexid_e2e:qa@127.0.0.1/nexid_e2e_history'});
 function identity(token){return token==='user'?{id:user,status:'verified'}:token==='other'?{id:other,status:'verified'}:token==='empty'?{id:empty,status:'verified'}:null;}
 const request=(q={},token='user',method='GET')=>consumerHistoryRequest(new Request('http://127.0.0.1:4652/consumer/taps/history?'+new URLSearchParams(q),{method}),async()=>identity(token));
 return {query,request,identity,user,other,empty,a,b,reads:()=>reads,close:async()=>{undo?.();await pool?.end();await cluster.stop();}};
 }catch(e){undo?.();await pool?.end();await cluster.stop().catch(()=>{});throw e;}
}
