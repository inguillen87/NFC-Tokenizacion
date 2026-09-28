import {createHash} from 'node:crypto';
import {planSupplierUpgrade,SUPPLIER_UPGRADE_DELTA} from './supplier-upgrade-plan.mjs';
import {canonicalMigrationSql} from './migration-source.mjs';

// Reviewed observation, not a configurable remote migration authorization.
export const OBSERVED_SCHEMA_SHA256='9a8be5aeeab9c7c60c0c77a678d88f3a63f8ddf8afc6dfce1c9ba95e0b299fac';
export const OBSERVED_LEDGER_SHA256='dbb58af33f9b1544eeb8ab310b7f0e88764f298de701a7a2fcf886af6495580f';
export const OBSERVED_SCHEMA_MAX_BYTES=4*1024*1024;
export const OBSERVED_DELTA_HASHES=Object.freeze({
 '20260924010000_0117_supplier_request_cancellation.sql':'be81286a20d58815b290b0781947c1a4f1a899b0a4a6d008f1901f3b43bbf581',
 '20260924050000_0118_supplier_request_quotes.sql':'c04a7794f7b12bf07f232b63b42c53d7f3192684b0e9cc16b3ac96f00c9e17f7',
 '20260924110000_0119_supplier_request_binding.sql':'acc00b268f6c2c110e62ce82dc234de9b0a0bd456fd00c4795606869ba37edc2',
 '20260924150000_0120_supplier_delivery_ack.sql':'08df6a1380a12782bd1551d1cc67253a969bff0b978dacc46abb5148155f061b',
 '20260924163000_0121_support_ticket_status_type_compatibility.sql':'9dabc6b9dc8b13b542cced05f9dff66f528bdc37f1ec4772026e9f6f9de60b1f',
});
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function verifyObservedSchema(bytes){
 if(!(bytes instanceof Uint8Array)||!bytes.byteLength||bytes.byteLength>OBSERVED_SCHEMA_MAX_BYTES)throw Error('observed_schema_size_invalid');
 if(sha256(bytes)!==OBSERVED_SCHEMA_SHA256)throw Error('observed_schema_fingerprint_mismatch');
 let sql;try{sql=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('observed_schema_encoding_invalid');}
 return sql;
}
export function verifyObservedDelta(files,ledger,sources){
 const plan=planSupplierUpgrade(files,ledger);
 if(ledger.length!==79||sha256([...ledger].sort().join('\n'))!==OBSERVED_LEDGER_SHA256)throw Error('observed_ledger_fingerprint_mismatch');
 if(!sources||Object.keys(sources).length!==5||plan.pending.length!==5||plan.alreadyRecorded.length)throw Error('observed_delta_source_invalid');
 const hashes=SUPPLIER_UPGRADE_DELTA.map(id=>{
  if(!Object.hasOwn(sources,id)||typeof sources[id]!=='string'||sha256(canonicalMigrationSql(sources[id]))!==OBSERVED_DELTA_HASHES[id])throw Error('observed_delta_fingerprint_mismatch');
  return Object.freeze({id,sha256:OBSERVED_DELTA_HASHES[id]});
 });
 return Object.freeze({pending:plan.pending,historicalGaps:plan.historicalGaps,migrations:Object.freeze(hashes),productionExecutionAllowed:false,liveRuntimeRoleVerified:false});
}
export function assertObservedRehearsalTarget(config,target,roles,siblingDatabases){
 if(config.expectedPostgresVersion!=='17.11'||target.server_version_number!==170011)throw Error('observed_rehearsal_postgres_mismatch');
 if(target.database_name!==config.databaseName||target.database_role!=='nexid_e2e'||target.host!=='127.0.0.1'||target.neon_endpoint_id)throw Error('observed_rehearsal_identity_mismatch');
 if(!Array.isArray(siblingDatabases)||siblingDatabases.length)throw Error('observed_rehearsal_shared_cluster_rejected');
 const expected=['cloud_admin','neon_superuser','neondb_owner'];
 if(!Array.isArray(roles)||roles.length!==3||expected.some(n=>!roles.some(r=>r.rolname===n&&r.rolcanlogin===false&&r.rolsuper===false&&r.rolcreaterole===false&&r.rolcreatedb===false&&r.rolreplication===false&&r.rolbypassrls===false)))throw Error('observed_rehearsal_placeholder_roles_invalid');
}
export function parseObservedRehearsalArgs(args){
 if(!Array.isArray(args)||args.length!==2||args[0]!=='--schema-file'||typeof args[1]!=='string'||!args[1]||args[1].startsWith('--')||args[1].includes('\0')||/^https?:/i.test(args[1]))throw Error('observed_rehearsal_arguments_invalid');
 return args[1];
}
export function observedChildEnvironment(config,env=process.env){
 const os=Object.fromEntries(Object.entries(env).filter(([key])=>/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|CI)$/i.test(key)));
 return {...os,NODE_ENV:'test',VERCEL_ENV:'test',DATABASE_URL:config.databaseUrl,NEXID_E2E_DATABASE_URL:config.databaseUrl,NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_EXPECTED_POSTGRES_VERSION:config.expectedPostgresVersion};
}
