import {SUPPLIER_RUNTIME_ROLE_RE} from './supplier-runtime-profile.mjs';
const CONFIRMATION='I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE';
const VERSIONS=new Map([['16.4',160004],['17.10',170010],['18.4',180004]]);
const fail=()=>{throw Error('supplier_runtime_worker_target_invalid');};
export function parseSupplierRuntimeWorkerInput(input,env=process.env){
  if(env.NODE_ENV!=='test'||env.VERCEL_ENV!=='test'||env.NEXID_E2E_CONFIRMATION!==CONFIRMATION)return fail();
  if(['DATABASE_URL','DIRECT_URL','PGHOST','PGHOSTADDR','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSERVICE','PGSERVICEFILE','PGOPTIONS'].some(k=>env[k]!==undefined))return fail();
  if(!input||typeof input!=='object'||Array.isArray(input))return fail();
  let url;try{url=new URL(input.runtimeUrl);}catch{return fail();}
  if(!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.search||url.hash)return fail();
  if(!SUPPLIER_RUNTIME_ROLE_RE.test(url.username)||url.username!==input.roleName||! /^[a-f0-9]{64}$/.test(url.password))return fail();
  const database=decodeURIComponent(url.pathname.slice(1));
  if(!/^nexid_e2e(?:_[a-z0-9][a-z0-9_-]{0,48})?$/.test(database)||database!==input.expectedDatabase)return fail();
  if(!VERSIONS.has(env.NEXID_E2E_EXPECTED_POSTGRES_VERSION)||VERSIONS.get(env.NEXID_E2E_EXPECTED_POSTGRES_VERSION)!==input.expectedServerVersion)return fail();
  if(!Array.isArray(input.ledger)||!input.ledger.includes('20260924163000_0121_support_ticket_status_type_compatibility.sql')||input.ledger.some(v=>typeof v!=='string'||!/^(?:\d{14}_)?\d{4}[a-z]?_[a-z0-9_]+\.sql$/.test(v)))return fail();
  return Object.freeze({url:url.toString(),roleName:input.roleName,databaseName:database,serverVersion:input.expectedServerVersion});
}
