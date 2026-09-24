import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {SUPPLIER_RUNTIME_PROFILE,SUPPLIER_RUNTIME_ROLE_RE,SUPPLIER_RUNTIME_TABLES,SUPPLIER_RUNTIME_LOCK_COLUMNS,SUPPLIER_RUNTIME_FUNCTION_NAMES,assertSupplierRuntimeProfile} from './supplier-runtime-profile.mjs';
import {readEnterpriseEphemeralE2eConfig} from './enterprise-ephemeral-e2e-safety.mjs';
const quote = name => { if(!/^[a-z][a-z0-9_]*$/.test(name))throw Error('supplier_runtime_identifier_invalid');return '"'+name+'"'; };
const OS_KEYS=/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|CI)$/i;
const PROCESS_FIXTURE_KEYS=['KMS_MASTER_KEY_HEX','NFC_ENVELOPE_KEK_VERSION','WEBHOOK_SIGNING_MASTER_KEY_HEX','RATE_LIMIT_KEY_PEPPER','SDK_IDEMPOTENCY_MASTER_KEY_HEX','SDK_IDEMPOTENCY_MASTER_KEY_ID'];
export async function runSupplierRuntimeAcceptance({client,config,context}) {
  assertSupplierRuntimeProfile();
  const verified=readEnterpriseEphemeralE2eConfig(process.env);
  assert.equal(verified.databaseUrl,config.databaseUrl);
  const identity=(await client.query("SELECT current_database() db,current_user::text actor,current_setting('neon.endpoint_id',true) endpoint,current_setting('server_version_num')::int version")).rows[0];
  assert.equal(identity.db,config.databaseName);assert.equal(identity.actor,'nexid_e2e');assert.ok(!identity.endpoint);assert.equal(identity.version,config.expectedServerVersionNumber);
  const ledger=(await client.query('SELECT id FROM public.schema_migrations ORDER BY id')).rows.map(r=>r.id);
  assert.ok(ledger.includes('20260924163000_0121_support_ticket_status_type_compatibility.sql'),'Complete migrated supplier schema is required before role acceptance');
  const roleName='nexid_e2e_supplier_'+randomBytes(8).toString('hex'),role=quote(roleName),password=randomBytes(32).toString('hex');
  assert.ok(SUPPLIER_RUNTIME_ROLE_RE.test(roleName));
  const url=new URL(config.databaseUrl);url.username=roleName;url.password=password;
  let created=false,child=null,report=null;
  const tables=[],functions=[],sequences=[];
  try {
    // Dedicated local fixture only: remove inherited public CREATE/TEMP. A fresh
    // login is used, not SET ROLE from an owner session that can RESET ROLE.
    await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
    await client.query('REVOKE TEMPORARY ON DATABASE '+quote(config.databaseName)+' FROM PUBLIC');
    await client.query('CREATE ROLE '+role+" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '"+password+"' VALID UNTIL '"+new Date(Date.now()+3600000).toISOString()+"'");created=true;
    await client.query('GRANT CONNECT ON DATABASE '+quote(config.databaseName)+' TO '+role);
    await client.query('GRANT USAGE ON SCHEMA public TO '+role);
    for(const [name,privileges] of Object.entries(SUPPLIER_RUNTIME_TABLES)) {
      const exists=(await client.query('SELECT to_regclass($1) IS NOT NULL ok',['public.'+name])).rows[0].ok;assert.ok(exists,'Missing manifest table '+name);
      await client.query('GRANT '+privileges.join(',')+' ON TABLE public.'+quote(name)+' TO '+role);tables.push({name,privileges});
    }
    for(const [name,columns] of Object.entries(SUPPLIER_RUNTIME_LOCK_COLUMNS)) await client.query('GRANT UPDATE('+columns.map(quote).join(',')+') ON TABLE public.'+quote(name)+' TO '+role);
    for(const name of SUPPLIER_RUNTIME_FUNCTION_NAMES) {
      const found=(await client.query("SELECT p.oid::regprocedure::text signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=$1 AND p.prokind='f'",[name])).rows;
      assert.equal(found.length,1,'Missing or ambiguous manifest function '+name);
      const signature=found[0].signature;
      assert.ok(/^(?:public\.)?nexid_[a-z0-9_]+\([a-z0-9_., ]*\)$/.test(signature),'Unexpected function signature');
      await client.query('GRANT EXECUTE ON FUNCTION '+signature+' TO '+role);functions.push(signature);
    }
    // Sequence ownership is resolved only for explicitly INSERT-enabled tables.
    // No UPDATE/setval or all-sequence blanket grant; USAGE permits currval.
    const serials=(await client.query("SELECT DISTINCT sequence.oid::regclass::text name FROM pg_class sequence JOIN pg_depend d ON d.objid=sequence.oid JOIN pg_class t ON t.oid=d.refobjid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE sequence.relkind='S' AND n.nspname='public' AND d.deptype IN('a','i') AND t.relname=ANY($1::text[])",[tables.filter(t=>t.privileges.includes('INSERT')).map(t=>t.name)])).rows;
    for(const s of serials){assert.ok(/^(?:public\.)?[a-z][a-z0-9_]*$/.test(s.name));await client.query('GRANT USAGE ON SEQUENCE '+s.name+' TO '+role);sequences.push(s.name);}
    const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>OS_KEYS.test(k)));
    Object.assign(env,{NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_EXPECTED_POSTGRES_VERSION:config.expectedPostgresVersion,NEXT_TELEMETRY_DISABLED:'1'});
    for(const k of PROCESS_FIXTURE_KEYS)if(process.env[k])env[k]=process.env[k];
    const worker=fileURLToPath(new URL('../supplier-runtime-worker.mjs',import.meta.url));
    const guard=fileURLToPath(new URL('../../../../scripts/qa/s7-loopback-only.cjs',import.meta.url));
    const payload={runtimeUrl:url.toString(),expectedDatabase:config.databaseName,expectedServerVersion:config.expectedServerVersionNumber,context:{...context,baseBatchId:'E2E-SUPPLIER-ROLE-001'},ledger,roleName};
    const outcome=await new Promise((resolve,reject)=>{
      child=spawn(process.execPath,['--require',guard,'--import','tsx',worker],{env,cwd:fileURLToPath(new URL('../../',import.meta.url)),stdio:['pipe','pipe','pipe']});
      let stdout='',bytes=0,failure=null,forceKill=null;
      // Do not release the role while a failed/overlong worker can still hold
      // connections. Resolve or reject only after close, including both pipes.
      const stop=reason=>{
        if(failure)return;
        failure=new Error(reason);
        child.kill();
        forceKill=setTimeout(()=>child.kill('SIGKILL'),2000);
      };
      const timer=setTimeout(()=>stop('supplier_runtime_worker_timeout'),180000);
      const collect=stream=>chunk=>{
        bytes+=chunk.length;
        if(bytes>1024*1024){stop('supplier_runtime_output_too_large');return;}
        if(stream==='stdout'&&!failure)stdout+=chunk;
        // stderr is counted but never printed, persisted or returned.
      };
      child.stdout.on('data',collect('stdout'));child.stderr.on('data',collect('stderr'));
      child.on('error',()=>{failure ||= new Error('supplier_runtime_worker_start_failed');});
      child.on('close',code=>{
        clearTimeout(timer);if(forceKill)clearTimeout(forceKill);
        if(failure){reject(failure);return;}
        const lines=stdout.split(/\r?\n/).filter(line=>line.startsWith('{"harness":"supplier_runtime_worker_v1"'));
        if(lines.length!==1){reject(Error('supplier_runtime_worker_invalid_report'));return;}
        let body;try{body=JSON.parse(lines[0]);}catch{reject(Error('supplier_runtime_worker_invalid_report'));return;}
        resolve({code,body});
      });
      child.stdin.on('error',()=>stop('supplier_runtime_worker_input_failed'));
      child.stdin.end(JSON.stringify(payload));
    });
    if(outcome.code!==0||outcome.body.ok!==true)throw Error('supplier_runtime_failed:'+JSON.stringify({reason:outcome.body.reason,sql:outcome.body.last_sql_failure}));
    report={...outcome.body,profile:SUPPLIER_RUNTIME_PROFILE,grants:{tables,functions,sequences,lockColumns:SUPPLIER_RUNTIME_LOCK_COLUMNS},production_role_modified:false};
    return report;
  } finally {
    if(child&&child.exitCode===null&&child.signalCode===null)child.kill();
    if(created){
      // Only our fresh nonowner login in the verified ephemeral database.
      await client.query('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM '+role);
      await client.query('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM '+role);
      await client.query('REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM '+role);
      for(const [name,columns] of Object.entries(SUPPLIER_RUNTIME_LOCK_COLUMNS))await client.query('REVOKE UPDATE('+columns.map(quote).join(',')+') ON TABLE public.'+quote(name)+' FROM '+role);
      await client.query('REVOKE ALL ON SCHEMA public FROM '+role);await client.query('REVOKE ALL ON DATABASE '+quote(config.databaseName)+' FROM '+role);await client.query('DROP ROLE '+role);
      assert.equal((await client.query('SELECT count(*)::int count FROM pg_roles WHERE rolname=$1',[roleName])).rows[0].count,0);
      if(report)report.cleanup={runtime_connections_closed:true,temporary_role_dropped:true,production_role_modified:false};
    }
  }
}
