// LOCAL disposable PostgreSQL only. No DATABASE_URL, production data or Neon project used.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
const tools=process.env.LOCAL_PG_TOOLS;assert.ok(tools,'LOCAL_PG_TOOLS is a local package directory');
const {default:EmbeddedPostgres}=await import(pathToFileURL(join(tools,'embedded-postgres/dist/index.js')).href);
const {default:pg}=await import(pathToFileURL(join(tools,'pg/lib/index.js')).href);
const directory=await mkdtemp(join(tmpdir(),'nexid-logistics-qa-'));
const password=randomBytes(24).toString('hex'),port=15439;
const cluster=new EmbeddedPostgres({databaseDir:join(directory,'pg'),user:'nexid_e2e',password,port,persistent:false,createPostgresUser:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
let pool;const results=[];
const T1='10000000-0000-4000-8000-000000000001',T2='10000000-0000-4000-8000-000000000002';
const actor='test:operator';const hash=v=>createHash('sha256').update(v).digest('hex');
const payload=(name='Fixture item')=>({operation:'CREATE',shipmentCode:'',carrierCode:'',trackingNumber:'',originAddress:'Local QA',destinationAddress:'Local QA destination',items:[{productName:name,quantity:2},{productName:'Fixture second item',quantity:3}]});
async function call(data,key=randomUUID(),tenant=T1,who=actor){const r=await pool.query('SELECT public.nexid_logistics_commit_v1($1::uuid,$2,$3,$4::jsonb) AS result',[tenant,who,hash(key),JSON.stringify(data)]);return r.rows[0].result;}
async function count(table){return Number((await pool.query(`SELECT count(*) AS n FROM public.${table}`)).rows[0].n);}
async function check(name,fn){await fn();results.push({name,pass:true});console.log('PASS',name);}
async function seal(uid,tenant=T1){return (await pool.query('INSERT INTO seal_inventory(tenant_id,uid_hex) VALUES($1,$2) RETURNING id',[tenant,uid])).rows[0].id;}
const scan=(uid,id,operation='APPLY',ttRaw='4343')=>({operation,uidHex:uid,shipmentId:id,ttRaw,location:'QA declaration',scannedBy:'QA operator',recipientName:'QA recipient',verificationMethod:'LOCAL_TEST_ONLY'});
try{
  await cluster.initialise();await cluster.start();await cluster.createDatabase('nexid_e2e_logistics');
  pool=new pg.Pool({host:'127.0.0.1',port,user:'nexid_e2e',password,database:'nexid_e2e_logistics',max:12});
  assert.equal((await pool.query('SELECT current_database() d')).rows[0].d,'nexid_e2e_logistics');
  await pool.query('CREATE TABLE tenants(id uuid PRIMARY KEY,slug text,name text); CREATE TABLE batches(id uuid PRIMARY KEY);');
  const schema=await readFile(new URL('../src/lib/secure-delivery-schema.ts',import.meta.url),'utf8');
  for(const match of schema.matchAll(/sql\/\*sql\*\/`([\s\S]*?)`/g))await pool.query(match[1].replaceAll('uuid_generate_v4()','gen_random_uuid()'));
  await pool.query('INSERT INTO tenants VALUES($1,$2,$3),($4,$5,$6)',[T1,'qa-one','QA One',T2,'qa-two','QA Two']);
  const migration=await readFile(new URL('../db/migrations/20260918050000_0103_logistics_atomic_operations.sql',import.meta.url),'utf8');
  await pool.query(migration);
  const engine=(await pool.query('SELECT version() AS version')).rows[0].version;
  await check('migration is additive and safe to rerun locally',async()=>{await pool.query(migration);assert.equal(await count('shipments'),0);});
  let baseline;
  await check('shipment and its two item rows commit together',async()=>{baseline=await call(payload(),'create-base');assert.equal(baseline.ok,true);assert.equal(baseline.data.itemCount,2);assert.equal(await count('shipments'),1);assert.equal(await count('shipment_items'),2);});
  await check('same identity returns the original receipt',async()=>{const r=await call(payload(),'create-base');assert.equal(r.replayed,true);assert.equal(r.receiptId,baseline.receiptId);assert.deepEqual(r.data,baseline.data);assert.equal(await count('shipments'),1);});
  await check('identity reused with different data is rejected',async()=>{await assert.rejects(()=>call(payload('changed'),'create-base'),/logistics_idempotency_conflict/);});
  await check('invalid item rejects all writes and the receipt',async()=>{const n=await count('shipments'),r=await count('logistics_operation_receipts');await assert.rejects(()=>call({...payload(),items:[{productName:'bad',quantity:0}]}),/logistics_items_invalid/);assert.equal(await count('shipments'),n);assert.equal(await count('logistics_operation_receipts'),r);});
  await pool.query("CREATE FUNCTION qa_fail_item() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.product_name='QA_ROLLBACK' THEN RAISE EXCEPTION 'injected_item_failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER qa_fail_item BEFORE INSERT ON shipment_items FOR EACH ROW EXECUTE FUNCTION qa_fail_item();");
  await check('failure after shipment insert rolls back shipment, items and receipt',async()=>{const n=await count('shipments'),r=await count('logistics_operation_receipts');await assert.rejects(()=>call(payload('QA_ROLLBACK')),/injected_item_failure/);assert.equal(await count('shipments'),n);assert.equal(await count('logistics_operation_receipts'),r);});
  await check('eight parallel retries create one shipment',async()=>{const n=await count('shipments');const r=await Promise.all(Array.from({length:8},()=>call(payload(),'race-create')));assert.equal(new Set(r.map(x=>x.receiptId)).size,1);assert.equal(r.filter(x=>x.replayed).length,7);assert.equal(await count('shipments'),n+1);});
  await check('same key is isolated by tenant and actor',async()=>{const a=await call(payload(),'tenant-key',T1),b=await call(payload(),'tenant-key',T2),c=await call(payload(),'tenant-key',T1,'test:second');assert.notEqual(a.receiptId,b.receiptId);assert.notEqual(a.receiptId,c.receiptId);});
  const sh1=(await call(payload(),'scan-shipment')).data.id,sh2=(await call(payload(),'scan-shipment-2')).data.id,foreign=(await call(payload(),'foreign-shipment',T2)).data.id;
  const uid='04000000000001',sealId=await seal(uid);
  await check('foreign shipment cannot alter the seal first',async()=>{await assert.rejects(()=>call(scan(uid,foreign)),/logistics_shipment_not_found/);assert.equal((await pool.query('SELECT status FROM seal_inventory WHERE id=$1',[sealId])).rows[0].status,'UNASSIGNED');});
  await check('handoff cannot silently assign an unassigned seal',async()=>{await assert.rejects(()=>call(scan(uid,sh1,'HANDOFF')),/logistics_seal_unassigned/);});
  let assigned;
  await check('parallel assignments cannot bind the same seal to two shipments',async()=>{const r=await Promise.allSettled([call(scan(uid,sh1)),call(scan(uid,sh2))]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assigned=r.find(x=>x.status==='fulfilled').value.data.shipmentId;assert.equal((await pool.query('SELECT count(*) n FROM package_seals WHERE seal_id=$1',[sealId])).rows[0].n,'1');});
  await check('eight repeated scan requests produce one custody event',async()=>{const n=await count('custody_events');const r=await Promise.all(Array.from({length:8},()=>call(scan(uid,assigned,'HANDOFF'),'race-scan')));assert.equal(new Set(r.map(x=>x.data.custodyEventId)).size,1);assert.equal(await count('custody_events'),n+1);});
  await pool.query("CREATE FUNCTION qa_fail_verification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.recipient_name='QA_ROLLBACK' THEN RAISE EXCEPTION 'injected_verification_failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER qa_fail_verification BEFORE INSERT ON recipient_verifications FOR EACH ROW EXECUTE FUNCTION qa_fail_verification();");
  await check('verification failure rolls back seal, custody and receipt',async()=>{const n=await count('custody_events'),r=await count('logistics_operation_receipts');await assert.rejects(()=>call({...scan(uid,assigned,'VERIFY'),recipientName:'QA_ROLLBACK'}),/injected_verification_failure/);assert.equal((await pool.query('SELECT status FROM seal_inventory WHERE id=$1',[sealId])).rows[0].status,'IN_TRANSIT');assert.equal(await count('custody_events'),n);assert.equal(await count('logistics_operation_receipts'),r);});
  await check('concurrent verification retries write one recipient verification',async()=>{const n=await count('recipient_verifications');await Promise.all(Array.from({length:6},()=>call(scan(uid,assigned,'VERIFY'),'verify-race')));assert.equal(await count('recipient_verifications'),n+1);});
  const multi=(await call(payload(),'multi-seal')).data.id;await seal('04000000000002');await seal('04000000000003');
  await call(scan('04000000000002',multi));await call(scan('04000000000003',multi));
  await check('delivery requires all linked seals to reach delivered status',async()=>{await call(scan('04000000000002',multi,'VERIFY'));assert.equal((await pool.query('SELECT status FROM shipments WHERE id=$1',[multi])).rows[0].status,'SEALED');});
  await check('closed second seal cannot hide reported tamper on another',async()=>{await Promise.all([call(scan('04000000000002',multi,'VERIFY','4F4F')),call(scan('04000000000003',multi,'VERIFY','4343'))]);assert.equal((await pool.query('SELECT status FROM shipments WHERE id=$1',[multi])).rows[0].status,'DELIVERED_OPENED');});
  await check('parallel repeated risk checks do not duplicate the open claim',async()=>{await Promise.all([call(scan('04000000000002',multi,'VERIFY','4F4F')),call(scan('04000000000003',multi,'VERIFY','4F4F'))]);assert.equal((await pool.query("SELECT count(*) n FROM delivery_claims WHERE shipment_id=$1 AND issue_type='tamper_reported' AND status='open'",[multi])).rows[0].n,'1');});
  await check('unknown TT does not become closed',async()=>{const id=(await call(payload(),'unknown-state')).data.id;await seal('04000000000004');const r=await call(scan('04000000000004',id,'APPLY',''));assert.equal(r.data.newStatus,'QUARANTINED');assert.equal(r.data.tamperState,'unknown');});
  await check('later handoff never regresses terminal seal state',async()=>{const r=await call(scan(uid,assigned,'HANDOFF','4343'));assert.equal(r.data.newStatus,'DELIVERED_CLOSED');});
  await check('function is not executable by the public role',async()=>{await pool.query('CREATE ROLE qa_no_access');assert.equal((await pool.query("SELECT has_function_privilege('qa_no_access','public.nexid_logistics_commit_v1(uuid,text,text,jsonb)','EXECUTE') ok")).rows[0].ok,false);});
  await check('the actual listing query counts item quantities without join multiplication',async()=>{
    const route=await readFile(new URL('../src/app/admin/logistics/shipments/route.ts',import.meta.url),'utf8');
    const raw=route.match(/return sql`([\s\S]*?)`/)[1];const values=[];
    const expressions={'tenantSlugOrId':'qa-one','isId':false,'isId?tenantSlugOrId:null':null,'tenantSlugOrId.toLowerCase()':'qa-one'};
    const query=raw.replace(/\$\{([^}]+)\}/g,(_,expression)=>{assert.ok(Object.hasOwn(expressions,expression));values.push(expressions[expression]);return '$'+values.length;});
    const rows=(await pool.query(query,values)).rows;const row=rows.find(r=>r.id===multi);
    assert.equal(row.item_quantity,5);assert.equal(row.item_count,2);assert.equal(row.seal_count,2);
    assert.ok(rows.every(r=>r.tenant_slug==='qa-one'));
  });
  const report={localOnly:true,engine,checks:results,failed:0,concurrentConnections:12,productionDataUsed:false,migrationSha256:hash(migration)};
  if(process.env.QA_OUTPUT)await writeFile(process.env.QA_OUTPUT,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{if(pool)await pool.end();await cluster.stop().catch(()=>{});}
