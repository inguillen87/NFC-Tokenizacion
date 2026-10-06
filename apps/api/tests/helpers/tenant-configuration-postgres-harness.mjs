import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {parseConfigurationWrite,readConfiguration,writeConfiguration} from '../../src/lib/tenant-loyalty-configuration.ts';
export async function runConfigurationPostgresQa(openClient){
  assert.equal(typeof openClient,'function','An explicit QA connection factory is required');
  const clients=[];let bootstrapped=false;const report={accepted:false,checks:[],productionSql:0,cleanup:{schemaDropped:false,connectionsClosed:false}};
  const schema='nexid_e2e_config_'+randomUUID().replaceAll('-',''),s='"'+schema+'"';const checks=[];
  const check=(name,fn)=>Promise.resolve().then(fn).then(()=>checks.push({name,passed:true}));
  const tenant={id:randomUUID(),slug:'configuration-qa'},other={id:randomUUID(),slug:'other-qa'},actor=randomUUID();
  const queryFor=client=>{let pending=Promise.resolve();return (strings,...values)=>{const text=strings.reduce((r,p,i)=>r+(i?'$'+i:'')+p,'');assert.doesNotMatch(text,/\bpublic\s*\./i);const next=pending.then(async()=> (await client.query(text,values)).rows);pending=next.catch(()=>{});return next}};
  let admin,one,two;
  try{
    const identities=[];
    for(let i=0;i<3;i++){
      const client=await openClient();assert(!clients.includes(client),'Concurrency requires independent clients');clients.push(client);
      const {rows:[identity]}=await client.query('SELECT current_database() AS database, pg_backend_pid() AS backend_pid');
      assert.match(identity.database,/^(?:nexid_e2e[a-z0-9_]*|codex_qa_[a-z0-9_]+)$/,'Refusing a database outside ephemeral QA');
      assert(identities.every(row=>row.database===identity.database),'QA clients must use the same database');
      assert(identities.every(row=>row.backend_pid!==identity.backend_pid),'Concurrency requires separate PostgreSQL backends');identities.push(identity);
    }
    [admin,one,two]=clients;bootstrapped=true;
    await admin.query(`CREATE SCHEMA ${s};SET search_path TO ${s};
      CREATE TYPE loyalty_program_status AS ENUM('draft','active','paused','archived');
      CREATE TABLE tenants(id uuid PRIMARY KEY,slug text);
      CREATE TABLE actors(id uuid PRIMARY KEY);
      CREATE TABLE tenant_sun_profiles(tenant_id uuid PRIMARY KEY REFERENCES tenants(id),metadata jsonb NOT NULL DEFAULT '{}',updated_at timestamptz NOT NULL DEFAULT clock_timestamp());
      CREATE TABLE loyalty_programs(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),name text NOT NULL,vertical text,status loyalty_program_status,mode text,points_name text,start_at timestamptz,end_at timestamptz,rules_json jsonb NOT NULL DEFAULT '{}',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT clock_timestamp());
      CREATE TABLE loyalty_quizzes(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),program_id uuid REFERENCES loyalty_programs(id),code text,title text,description text,vertical text,product_filter_json jsonb DEFAULT '{}',questions_json jsonb DEFAULT '[]',points_per_correct integer,completion_bonus integer,pass_threshold integer,status text,starts_at timestamptz,ends_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT clock_timestamp(),UNIQUE(program_id,code));
      CREATE TABLE audit_logs(actor_id uuid REFERENCES actors(id),tenant_id uuid,action text,resource_type text,resource_id text,after_hash text);`);
    for(const c of [one,two])await c.query(`SET search_path TO ${s}`);
    await admin.query('INSERT INTO tenants VALUES($1,$2),($3,$4)',[tenant.id,tenant.slug,other.id,other.slug]);await admin.query('INSERT INTO actors VALUES($1)',[actor]);
    await admin.query('INSERT INTO tenant_sun_profiles(tenant_id,metadata) VALUES($1,\'{"retain":"yes"}\')', [tenant.id]);
    const q1=queryFor(one),q2=queryFor(two),write=(data,q=q1,a=actor,t=tenant)=>writeConfiguration(t,a,parseConfigurationWrite(data),q);
    const program={kind:'program',action:'save_draft',id:randomUUID(),expectedRevision:null,operationId:randomUUID(),name:'Club QA',vertical:'wine',pointsName:'Puntos QA',pointsPerValidTap:0,cooldownSeconds:0,startAt:'2026-01-01T00:00:00Z',endAt:null};
    let created;
    await check('create explicit draft and preserve zero',async()=>{created=await write(program);assert.equal(created.resource.status,'draft');assert.equal(created.resource.pointsPerValidTap,0)});
    await check('create retry recovers receipt without a second audit',async()=>{const r=await write(program);assert.equal(r.idempotentReplay,true);assert.equal((await admin.query('SELECT count(*)::integer AS n FROM audit_logs')).rows[0].n,1)});
    await check('operation id cannot be reused for changed content',async()=>{await assert.rejects(write({...program,name:'Other'}),/configuration_idempotency_conflict/)});
    let published;
    await check('publish existing stable draft',async()=>{published=await write({...program,action:'publish',expectedRevision:created.resource.revision,operationId:randomUUID()});assert.equal(published.resource.status,'active')});
    await check('active contents require withdrawal first',async()=>{await assert.rejects(write({...program,expectedRevision:published.resource.revision,operationId:randomUUID(),name:'Edit'}),/configuration_active_edit/)});
    await check('wrong tenant cannot mutate stable id',async()=>{await assert.rejects(write({...program,action:'withdraw',expectedRevision:published.resource.revision,operationId:randomUUID()},q1,actor,other),/configuration_revision_conflict/)});
    const p2={...program,id:randomUUID(),operationId:randomUUID(),name:'Conflicting'};let c2;
    await check('overlapping active program publication is rejected',async()=>{c2=await write(p2);await assert.rejects(write({...p2,action:'publish',expectedRevision:c2.resource.revision,operationId:randomUUID()}),/configuration_active_conflict/)});
    let withdrawn;
    await check('withdraw preserves identity, audit and timestamp precision',async()=>{
      await admin.query(`UPDATE ${s}.loyalty_programs SET start_at=date_trunc('milliseconds',start_at)+interval '0.000456 seconds' WHERE id=$1`,[program.id]);
      const before=(await admin.query(`SELECT start_at::text FROM ${s}.loyalty_programs WHERE id=$1`,[program.id])).rows[0].start_at;
      withdrawn=await write({...program,action:'withdraw',expectedRevision:published.resource.revision,operationId:randomUUID()});assert.equal(withdrawn.resource.id,program.id);assert.equal(withdrawn.resource.status,'paused');
      const after=(await admin.query(`SELECT start_at::text FROM ${s}.loyalty_programs WHERE id=$1`,[program.id])).rows[0].start_at;assert.equal(after,before);
    });
    await check('concurrent publishers permit exactly one overlapping program',async()=>{
      const results=await Promise.allSettled([write({...program,action:'publish',expectedRevision:withdrawn.resource.revision,operationId:randomUUID()},q1),write({...p2,action:'publish',expectedRevision:c2.resource.revision,operationId:randomUUID()},q2)]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await admin.query("SELECT count(*)::integer AS n FROM loyalty_programs WHERE status='active'")).rows[0].n,1)
    });
    const current=(await readConfiguration(tenant,q1)).programs.find(p=>p.status==='active');
    const quiz={kind:'quiz',action:'save_draft',id:randomUUID(),expectedRevision:null,operationId:randomUUID(),programId:current.id,title:'Historia QA',description:'',vertical:'wine',startsAt:'2026-01-01T00:00:00Z',endsAt:null,questions:[{id:'q1',prompt:'Origen',options:['A','B'],correctIndex:0}],pointsPerCorrect:0,completionBonus:0,passThreshold:0};let qc,qp;
    await check('managed quiz draft and publication preserve zero scoring',async()=>{qc=await write(quiz);qp=await write({...quiz,action:'publish',expectedRevision:qc.resource.revision,operationId:randomUUID()});assert.equal(qp.resource.managed,true);assert.equal(qp.resource.pointsPerCorrect,0)});
    await check('quiz active contents cannot move to another program',async()=>{await assert.rejects(write({...quiz,programId:p2.id===current.id?program.id:p2.id,expectedRevision:qp.resource.revision,operationId:randomUUID()}),/configuration_active_edit/)});
    await check('quiz overlap is rejected',async()=>{const next={...quiz,id:randomUUID(),operationId:randomUUID()};const d=await write(next);await assert.rejects(write({...next,action:'publish',expectedRevision:d.resource.revision,operationId:randomUUID()}),/configuration_active_conflict/)});
    await check('paused quiz cannot move programs',async()=>{const paused=await write({...quiz,action:'withdraw',expectedRevision:qp.resource.revision,operationId:randomUUID()});await assert.rejects(write({...quiz,programId:p2.id===current.id?program.id:p2.id,expectedRevision:paused.resource.revision,operationId:randomUUID()}),/configuration_active_conflict/)});
    await check('concurrent overlapping quiz publications permit exactly one',async()=>{
      const rows=(await readConfiguration(tenant,q1)).quizzes.filter(q=>q.programId===current.id);
      const results=await Promise.allSettled(rows.map((q,i)=>write({...quiz,id:q.id,action:'publish',expectedRevision:q.revision,operationId:randomUUID()},i===0?q1:q2)));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await admin.query("SELECT count(*)::integer AS n FROM loyalty_quizzes WHERE status='active'")).rows[0].n,1)
    });
    let profile=(await readConfiguration(tenant,q1)).profile;
    const settings={kind:'profile',action:'publish',expectedRevision:profile.revision,operationId:randomUUID(),allowedActions:['sommelier']};
    await check('explicit published actions preserve unrelated metadata',async()=>{profile=(await write(settings)).resource;assert.deepEqual(profile.allowedActions,['sommelier']);assert.equal((await admin.query('SELECT metadata FROM tenant_sun_profiles')).rows[0].metadata.retain,'yes')});
    await check('stale revision never overwrites profile',async()=>{await assert.rejects(write({...settings,action:'withdraw',operationId:randomUUID()}),/configuration_revision_conflict/)});
    await check('audit failure rolls back withdrawal atomically',async()=>{await assert.rejects(write({...settings,action:'withdraw',expectedRevision:profile.revision,operationId:randomUUID()},q1,randomUUID()));assert.equal((await readConfiguration(tenant,q1)).profile.status,'published')});
    await check('profile concurrent withdrawals one winner and one conflict',async()=>{const results=await Promise.allSettled([write({...settings,action:'withdraw',expectedRevision:profile.revision,operationId:randomUUID()},q1),write({...settings,action:'withdraw',expectedRevision:profile.revision,operationId:randomUUID()},q2)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1)});
    Object.assign(report,{accepted:true,checks,schema});return report;
  }finally{
    try{if(bootstrapped){await admin.query(`DROP SCHEMA IF EXISTS ${s} CASCADE`);report.cleanup.schemaDropped=true}}
    finally{await Promise.all(clients.map(c=>c.end()));report.cleanup.connectionsClosed=true}
  }
}
