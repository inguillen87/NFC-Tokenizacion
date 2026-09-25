import {DEFAULT_REQUIRED_SCHEMA_MIGRATIONS,sql,type SqlExecutor} from './db';
import {CARRIER_PROFILES} from './carrier-profiles';
export const RUNTIME_READINESS_PROTOCOL='nexid.runtime-readiness.v1';
const M={
 support:'20260922100000_0112_support_ticket_workflow.sql',requests:'20260923120000_0113_supplier_requests.sql',reviews:'20260923150000_0114_supplier_request_reviews.sql',
 operator:'20260923180000_0115_supplier_operator_role_enum.sql',assignment:'20260923180100_0116_supplier_request_assignments.sql',
 cancellation:'20260924010000_0117_supplier_request_cancellation.sql',quotes:'20260924050000_0118_supplier_request_quotes.sql',binding:'20260924110000_0119_supplier_request_binding.sql',ack:'20260924150000_0120_supplier_delivery_ack.sql',ticketTypes:'20260924163000_0121_support_ticket_status_type_compatibility.sql',
} as const;
export const RUNTIME_REQUIREMENTS=Object.freeze([
 {id:'support',migrations:[M.support],functions:['public.nexid_read_support_ticket_workflow_v1(uuid,uuid,text,bigint)']},
 {id:'requests',migrations:[M.requests,M.reviews],functions:['public.nexid_mutate_supplier_request_v1(jsonb)','public.nexid_mutate_supplier_request_review_v1(jsonb)']},
 {id:'assignments',migrations:[M.operator,M.assignment],functions:['public.nexid_supplier_requests_assigned_v1(uuid,uuid,integer)','public.nexid_mutate_supplier_request_assignment_v1(jsonb)']},
 {id:'cancellation',migrations:[M.cancellation],functions:['public.nexid_cancel_supplier_request_v1(jsonb)']},
 {id:'quotations',migrations:[M.cancellation,M.quotes],functions:['public.nexid_mutate_supplier_quote_v1(jsonb)','public.nexid_supplier_quote_read_v1(uuid,uuid,uuid,uuid,integer)']},
 {id:'supplier_binding',migrations:[M.quotes,M.binding],functions:['public.nexid_mutate_supplier_binding_v1(jsonb)','public.nexid_supplier_binding_read_v1(uuid,uuid,uuid,uuid,integer)']},
 {id:'documentary_ack',migrations:[M.binding,M.ack],functions:['public.nexid_mutate_supplier_delivery_ack_v1(jsonb)','public.nexid_supplier_delivery_ack_read_v1(uuid,uuid,uuid,uuid,integer)']},
 {id:'ticket_type_compatibility',migrations:[M.ticketTypes],functions:['public.nexid_transition_support_ticket_v1(uuid,uuid,text,uuid,text,text,text,text,uuid)']},
].map(r=>Object.freeze({...r,migrations:Object.freeze(r.migrations),functions:Object.freeze(r.functions)})));
export const RUNTIME_FUNCTIONS=Object.freeze([...new Set(RUNTIME_REQUIREMENTS.flatMap(r=>r.functions))]);
export const RUNTIME_LEDGER_IDS=Object.freeze([...new Set(RUNTIME_REQUIREMENTS.flatMap(r=>r.migrations))]);
export const RUNTIME_FLAG_KEYS=Object.freeze({cancellation:'SUPPLIER_REQUEST_CANCELLATION_ENABLED',quotations:'SUPPLIER_REQUEST_QUOTES_ENABLED',supplier_binding:'SUPPLIER_REQUEST_SUPPLIER_BINDINGS_ENABLED',documentary_ack:'SUPPLIER_DELIVERY_ACK_ENABLED'} as const);
const invalid=():never=>{throw Error('runtime_readiness_contract_invalid');};
const obj=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:invalid();
const bool=(v:unknown)=>typeof v==='boolean'?v:invalid();
const name=(v:unknown)=>typeof v==='string'&&/^[A-Za-z_][A-Za-z0-9_$-]{0,62}$/.test(v)?v:invalid();
function ids(v:unknown,max:number,pattern:RegExp):string[]{if(!Array.isArray(v)||v.length>max||v.some(s=>typeof s!=='string'||!pattern.test(s))||new Set(v).size!==v.length)return invalid();return [...v];}
const safe=(v:unknown,p:RegExp)=>typeof v==='string'&&p.test(v)?v:null;
export function projectRuntimeReadiness(raw:unknown,env:Record<string,string|undefined>={},now=Date.now()){
 const r=obj(raw),db=obj(r.database),role=obj(r.role),catalogs=obj(r.catalogs),at=typeof r.observed_at==='string'?Date.parse(r.observed_at):NaN;
 if(!Number.isFinite(at)||at>now+30000||now-at>60000)return invalid();
 const endpoint=db.endpoint_id===null||db.endpoint_id===''?null:safe(db.endpoint_id,/^ep-[a-z0-9-]{1,100}$/);
 if(db.endpoint_id!==null&&db.endpoint_id!==''&&!endpoint)return invalid();
 const version=Number(db.server_version_num);if(!Number.isSafeInteger(version)||version<120000||version>999999)return invalid();
 const database={name:name(db.name),sessionRole:name(db.session_role),loginRole:name(db.login_role),endpointId:endpoint,serverVersionNumber:version,transactionReadOnly:bool(db.transaction_read_only)};
 const privileges={superuser:bool(role.superuser),bypassRls:bool(role.bypass_rls),createRole:bool(role.create_role),createDatabase:bool(role.create_database),createInPublicSchema:bool(role.create_public_schema),ownsDatabase:bool(role.owns_database),ownsPublicObjects:bool(role.owns_public_objects)};
 const applied=ids(r.migrations,512,/^(?:\d{14}_)?\d{4}[a-z]?_[a-z0-9_]+\.sql$/);
 if(r.migration_count!==applied.length||r.migrations_truncated!==false)return invalid();
 const carriers=ids(catalogs.carriers,128,/^[a-z0-9][a-z0-9_-]{0,100}$/),ledgers=ids(catalogs.ledgers,128,/^[a-z0-9][a-z0-9_-]{0,100}$/);
 if(catalogs.carriers_count!==carriers.length||catalogs.ledgers_count!==ledgers.length||catalogs.truncated!==false)return invalid();
 if(!Array.isArray(r.functions)||r.functions.length!==RUNTIME_FUNCTIONS.length)return invalid();
 const functions=new Map<string,{present:boolean;executable:boolean}>();
 for(const item of r.functions){const f=obj(item);if(!RUNTIME_FUNCTIONS.includes(f.signature)||functions.has(f.signature))return invalid();const present=bool(f.present),executable=bool(f.executable);if(!present&&executable)return invalid();functions.set(f.signature,{present,executable});}
 const missingRuntime=DEFAULT_REQUIRED_SCHEMA_MIGRATIONS.filter(id=>!applied.includes(id));
 const featureFlags=Object.fromEntries(Object.entries(RUNTIME_FLAG_KEYS).map(([feature,key])=>[feature,{configured:env[key]!==undefined,enabled:env[key]==='true'}]));
 const requirements=RUNTIME_REQUIREMENTS.map(f=>{
  const missingMigrations=f.migrations.filter(m=>!applied.includes(m)),missingFunctions=f.functions.filter(n=>!functions.get(n)?.present),unavailableExecute=f.functions.filter(n=>functions.get(n)?.present&&!functions.get(n)?.executable);
  return {id:f.id,status:missingMigrations.length||missingFunctions.length?'schema_or_ledger_missing':unavailableExecute.length?'execute_privilege_missing':'named_prerequisites_present',missingMigrations,missingFunctions,unavailableExecute};
 });
 const missingCarriers=CARRIER_PROFILES.map(c=>c.code).filter(c=>!carriers.includes(c)),missingLedgers=['none','polygon','iota'].filter(c=>!ledgers.includes(c));
 const blockingFlags=requirements.filter(r=>featureFlags[r.id]?.enabled&&r.status!=='named_prerequisites_present').map(r=>r.id);
 return {protocol:RUNTIME_READINESS_PROTOCOL,observedAt:new Date(at).toISOString(),scope:'nexid_global_admin',
  runtime:{environment:['production','preview','development'].includes(env.VERCEL_ENV||'')?env.VERCEL_ENV:'unverified',deploymentId:safe(env.VERCEL_DEPLOYMENT_ID,/^dpl_[A-Za-z0-9]{8,80}$/),commit:safe(env.VERCEL_GIT_COMMIT_SHA,/^[a-f0-9]{40}$/)},
  database,role:privileges,privilegedConnection:privileges.superuser||privileges.bypassRls||privileges.createRole||privileges.createDatabase||privileges.createInPublicSchema||privileges.ownsDatabase||privileges.ownsPublicObjects,
  ledger:{count:applied.length,requiredRuntimeMissing:missingRuntime,featureMigrations:RUNTIME_LEDGER_IDS.map(id=>({id,recorded:applied.includes(id)})),fullRepositoryReconciliation:'not_performed'},
  catalogs:{missingCarriers,missingLedgerProviders:missingLedgers,valuesOrPricesReturned:false},requirements,featureFlags,enabledWithoutPrerequisites:blockingFlags,
  readiness:missingRuntime.length||missingCarriers.length||missingLedgers.length||requirements.some(r=>r.status!=='named_prerequisites_present')?'blocked_on_named_prerequisites':'further_acceptance_required',
  promotionAllowed:false,migrationExecutionAllowed:false,customerRowsRead:false,
  unverified:['control_plane_branch_mapping','deployed_dashboard_compatibility','function_bodies_constraints_and_effective_table_acl','migration_checksums_and_historical_bootstrap','physical_or_supplier_acceptance'],
 };
}
/** One fixed catalog/ledger statement. No supplied SQL, no tenant data or keys. */
export async function collectRuntimeReadiness(query:SqlExecutor=sql){
 const [row]=await query`WITH role_identity AS (
   SELECT oid,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user
 ), migration_rows AS (SELECT id FROM public.schema_migrations ORDER BY id LIMIT 513),
 carrier_rows AS (SELECT code FROM public.carrier_profiles ORDER BY code LIMIT 129),
 ledger_rows AS (SELECT code FROM public.ledger_providers ORDER BY code LIMIT 129),
 required_functions AS (SELECT signature,to_regprocedure(signature) AS oid FROM unnest(${RUNTIME_FUNCTIONS}::text[]) AS wanted(signature))
 SELECT jsonb_build_object(
  'observed_at',clock_timestamp(),
  'database',jsonb_build_object('name',current_database(),'session_role',current_user,'login_role',session_user,'endpoint_id',current_setting('neon.endpoint_id',true),'server_version_num',current_setting('server_version_num'),'transaction_read_only',current_setting('transaction_read_only')='on'),
  'role',(SELECT jsonb_build_object('superuser',rolsuper,'bypass_rls',rolbypassrls,'create_role',rolcreaterole,'create_database',rolcreatedb,'create_public_schema',has_schema_privilege(current_user,'public','CREATE'),'owns_database',EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=role_identity.oid),'owns_public_objects',EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relowner=role_identity.oid)) FROM role_identity),
  'migrations',(SELECT COALESCE(jsonb_agg(id ORDER BY id),'[]'::jsonb) FROM migration_rows),
  'migration_count',(SELECT count(*)::int FROM migration_rows),'migrations_truncated',(SELECT count(*)>512 FROM migration_rows),
  'catalogs',jsonb_build_object('carriers',(SELECT COALESCE(jsonb_agg(code ORDER BY code),'[]'::jsonb) FROM carrier_rows),'carriers_count',(SELECT count(*)::int FROM carrier_rows),'ledgers',(SELECT COALESCE(jsonb_agg(code ORDER BY code),'[]'::jsonb) FROM ledger_rows),'ledgers_count',(SELECT count(*)::int FROM ledger_rows),'truncated',(SELECT count(*)>128 FROM carrier_rows) OR (SELECT count(*)>128 FROM ledger_rows)),
  'functions',(SELECT jsonb_agg(jsonb_build_object('signature',signature,'present',oid IS NOT NULL,'executable',COALESCE(has_function_privilege(current_user,oid,'EXECUTE'),false)) ORDER BY signature) FROM required_functions)
  ) AS observation`;
 if(!row||!Object.hasOwn(row,'observation'))return invalid();return row.observation;
}
