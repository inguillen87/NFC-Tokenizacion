import assert from 'node:assert/strict';
import pg from 'pg';
import {verifySupplierRuntimeEffectiveAcl} from './lib/supplier-runtime-acl.mjs';
import {parseSupplierRuntimeWorkerInput} from './lib/supplier-runtime-safety.mjs';
import {supplierChainRoutes,runSupplierChainAcceptance} from './lib/supplier-chain-acceptance.mjs';
import {startEnterpriseEphemeralHttpHarness} from './lib/enterprise-ephemeral-http.mjs';
import {SUPPLIER_RUNTIME_ROLE_RE,SUPPLIER_RUNTIME_TABLES,SUPPLIER_RUNTIME_DENY_FUNCTIONS} from './lib/supplier-runtime-profile.mjs';
let pool,httpHarness,uninstall,lastSqlFailure=null;
const evidence={harness:'supplier_runtime_worker_v1',ok:false,application_identity:null,denied:[],query_count:0,query_policy:'shared_migration_managed_db_policy',external_effects:false};
async function main(){
  assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.VERCEL_ENV,'test');assert.equal(process.env.DATABASE_URL,undefined);
  let text='';for await(const chunk of process.stdin){text+=chunk;if(Buffer.byteLength(text)>128*1024)throw Error('supplier_runtime_input_too_large');}
  const input=JSON.parse(text),target=parseSupplierRuntimeWorkerInput(input,process.env),url=new URL(target.url);
  assert.ok(['postgres:','postgresql:'].includes(url.protocol)&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&!url.search&&!url.hash);
  assert.ok(SUPPLIER_RUNTIME_ROLE_RE.test(url.username));assert.equal(url.username,input.roleName);assert.equal(decodeURIComponent(url.pathname.slice(1)),input.expectedDatabase);assert.match(input.expectedDatabase,/^nexid_e2e(?:_[a-z0-9_-]+)?$/);assert.match(url.password,/^[a-f0-9]{64}$/);
  pool=new pg.Pool({connectionString:url.toString(),connectionTimeoutMillis:5000,statement_timeout:10000,query_timeout:11000,max:4});
  const identity=(await pool.query("SELECT current_database() db,current_user::text actor,session_user::text login,current_setting('neon.endpoint_id',true) endpoint,current_setting('server_version_num')::int version,p.rolsuper,p.rolcreaterole,p.rolcreatedb,p.rolinherit,p.rolreplication,p.rolbypassrls,has_schema_privilege(current_user,'public','CREATE') can_create,has_database_privilege(current_user,current_database(),'TEMPORARY') can_temp FROM pg_roles p WHERE p.rolname=current_user")).rows[0];
  assert.equal(identity.actor,input.roleName);assert.equal(identity.login,input.roleName);assert.equal(identity.db,input.expectedDatabase);assert.equal(identity.version,input.expectedServerVersion);assert.ok(!identity.endpoint);
  for(const k of ['rolsuper','rolcreaterole','rolcreatedb','rolinherit','rolreplication','rolbypassrls','can_create','can_temp'])assert.equal(identity[k],false,k);
  assert.equal((await pool.query('SELECT count(*)::int count FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)')).rows[0].count,0);
  const ownership=(await pool.query("SELECT (SELECT count(*)::int FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) relations,(SELECT count(*)::int FROM pg_namespace WHERE nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) schemas,(SELECT count(*)::int FROM pg_proc WHERE proowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) routines")).rows[0];
  assert.deepEqual(ownership,{relations:0,schemas:0,routines:0});evidence.owned_database_objects=ownership;
  evidence.effective_acl=await verifySupplierRuntimeEffectiveAcl(pool);
  evidence.application_identity={database:identity.db,current_user_is_fresh_runtime:true,session_user_is_same_runtime:true,owner_session_available:false,superuser:false,bypass_rls:false,create_schema:false,create_temp:false,role_memberships:0};
  const ledger=(await pool.query('SELECT id FROM public.schema_migrations ORDER BY id')).rows.map(r=>r.id);assert.deepEqual(ledger,input.ledger);evidence.migrations_verified=ledger.length;
  async function denied(name,sql){try{await pool.query(sql);}catch(e){assert.equal(e.code,'42501',name);evidence.denied.push(name);return;}throw Error('Unexpected runtime privilege '+name);}
  await denied('SET ROLE migration owner','SET ROLE nexid_e2e');
  await denied('CREATE public table','CREATE TABLE public.qa_supplier_runtime_forbidden(id int)');
  await denied('CREATE temporary table','CREATE TEMP TABLE qa_supplier_runtime_forbidden(id int)');
  await denied('change carrier reference catalog','UPDATE public.carrier_profiles SET code=code WHERE false');
  await denied('change ledger provider settings','UPDATE public.ledger_providers SET code=code WHERE false');
  await denied('seed SUN tenant profiles','INSERT INTO public.tenant_sun_profiles(tenant_id) SELECT id FROM public.tenants WHERE false');
  await denied('tamper encrypted artifact payload','UPDATE public.vault_artifacts SET encrypted_payload_base64=encrypted_payload_base64 WHERE false');
  await denied('change artifact metadata','UPDATE public.vault_artifacts SET metadata_json=metadata_json WHERE false');
  await denied('rewrite migration ledger','UPDATE public.schema_migrations SET id=id WHERE false');
  await denied('disable audit trigger','ALTER TABLE public.audit_logs DISABLE TRIGGER ALL');
  for(const table of ['audit_logs','supplier_manufacturing_state_transitions','evidence_events','supplier_request_operations','supplier_request_review_events','supplier_request_quote_events','supplier_request_binding_events','supplier_order_lifecycle_receipts','supplier_delivery_ack_events','support_ticket_workflow_operations']){
    await denied('UPDATE append-only '+table,'UPDATE public.'+table+' SET id=id WHERE false');
    await denied('DELETE append-only '+table,'DELETE FROM public.'+table+' WHERE false');
    await denied('TRUNCATE '+table,'TRUNCATE public.'+table);
  }
  const leaks=(await pool.query("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=ANY($1::text[]) AND has_function_privilege(current_user,p.oid,'EXECUTE')",[SUPPLIER_RUNTIME_DENY_FUNCTIONS])).rows;
  assert.deepEqual(leaks,[]);evidence.internal_function_boundary=true;
  async function referenceCatalogDigest() {
    return (await pool.query(`SELECT
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.code)::text,'[]')) FROM public.ledger_providers p) ledger,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.code)::text,'[]')) FROM public.carrier_profiles p) carriers,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.tenant_id)::text,'[]')) FROM public.tenant_sun_profiles p) sun`)).rows[0];
  }
  const catalogBefore=await referenceCatalogDigest();
  const {installEphemeralE2eSqlExecutor}=await import('../src/lib/db.ts');
  const validationUrl=new URL(url);validationUrl.username='nexid_e2e';validationUrl.password='unusable-validation-placeholder';
  const query=async(strings,...values)=>{
    const structural=strings.join('?');
    // The shared db.ts policy filters compatibility DDL before this executor.
    // Reaching this boundary with DDL is a regression, never a permission to add.
    if(/^\s*(CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|DO)\b/i.test(structural))throw Error('supplier_runtime_ddl_reached_database');
    let statement=strings[0];for(let i=0;i<values.length;i++)statement+='$'+(i+1)+strings[i+1];evidence.query_count++;
    try{return(await pool.query(statement,values)).rows;}catch(e){
      const named=String(e.message).match(/permission denied for (?:table|sequence|function|schema) ([a-z][a-z0-9_]*)/i);
      lastSqlFailure={code:/^[A-Z0-9]{5}$/.test(e.code||'')?e.code:'unknown',object:named?.[1]||null};throw e;
    }
  };
  uninstall=installEphemeralE2eSqlExecutor(query,{...process.env,NEXID_E2E_DATABASE_URL:validationUrl.toString()},{migrationManaged:true});
  const root=await import('../src/app/admin/supplier-orders/route.ts');
  const packaging=await import('../src/app/admin/supplier-orders/[orderId]/packaging/route.ts');
  httpHarness=await startEnterpriseEphemeralHttpHarness({env:{...process.env,NEXID_E2E_DATABASE_URL:validationUrl.toString()},routes:[...(await supplierChainRoutes()),
    {method:'POST',match:u=>u.pathname==='/admin/supplier-orders',handle:root.POST},
    ...['GET','POST'].map(method=>({method,match:u=>{const m=/^\/admin\/supplier-orders\/([a-f0-9-]{36})\/packaging$/i.exec(u.pathname);return m?{orderId:m[1]}:null;},handle:(req,p)=>packaging[method](req,{params:Promise.resolve(p)})})),
  ]});
  evidence.supplier_chain=await runSupplierChainAcceptance({...input.context,client:pool,httpHarness,databaseRole:'isolated_restricted_login'});
  assert.deepEqual(await referenceCatalogDigest(),catalogBefore,'Runtime must not rewrite catalog or tenant-profile records');
  evidence.reference_catalogs_unchanged=true;
  evidence.ok=true;
}
try{await main();}catch(error){evidence.reason=String(error.message||'runtime_acceptance_failed').replace(/postgres(?:ql)?:\/\/[^\s"']+/gi,'[redacted_database_url]').slice(0,400);evidence.last_sql_failure=lastSqlFailure;}
finally{if(httpHarness)await httpHarness.close();uninstall?.();await pool?.end();console.log(JSON.stringify(evidence));process.exitCode=evidence.ok?0:1;}
