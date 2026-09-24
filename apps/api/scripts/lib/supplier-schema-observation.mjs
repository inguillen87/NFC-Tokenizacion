import {createHash} from 'node:crypto';
export const SCHEMA_OBSERVATION_PROTOCOL='nexid.supplier-schema-observation.v1';
export const MAX_SCHEMA_BYTES=8*1024*1024;
const ident='(?:"([a-z][a-z0-9_]*)"|([a-z][a-z0-9_]*))';
const fail=reason=>{throw Error('supplier_schema_observation_'+reason);};
export const sha256=value=>createHash('sha256').update(value).digest('hex');

/** A nonexecuting lexer for pg_dump DDL. Semicolons and CREATE text inside
 * strings, comments and dollar-quoted routine bodies are never statements. */
export function splitSchemaStatements(input){
 if(typeof input!=='string'||Buffer.byteLength(input)>MAX_SCHEMA_BYTES||input.includes('\0'))return fail('sql_invalid');
 const sql=input.replaceAll('\r\n','\n');
 const statements=[];let start=0,i=0,state='normal',depth=0,tag='',backslash=false;
 while(i<sql.length){const c=sql[i],n=sql[i+1];
  if(state==='line'){if(c==='\n')state='normal';i++;continue;}
  if(state==='block'){if(c==='/'&&n==='*'){depth++;i+=2;}else if(c==='*'&&n==='/'){if(!--depth)state='normal';i+=2;}else i++;continue;}
  if(state==='dollar'){if(sql.startsWith(tag,i)){i+=tag.length;state='normal';}else i++;continue;}
  if(state==='single'){if(backslash&&c==='\\'){i+=2;continue;}if(c==="'"){if(n==="'"){i+=2;continue;}state='normal';}i++;continue;}
  if(state==='double'){if(c==='"'){if(n==='"'){i+=2;continue;}state='normal';}i++;continue;}
  if(c==='\\'&&(i===0||sql[i-1]==='\n')){const meta=/^\\(?:un)?restrict [A-Za-z0-9]+[ \t]*(?:\n|$)/.exec(sql.slice(i));if(meta){if(sql.slice(start,i).trim())statements.push(sql.slice(start,i));i+=meta[0].length;start=i;continue;}}
  if(c==='-'&&n==='-'){state='line';i+=2;continue;}if(c==='/'&&n==='*'){state='block';depth=1;i+=2;continue;}
  if(c==="'"){state='single';backslash=/[eE]/.test(sql[i-1]||'')&&!/[A-Za-z0-9_]/.test(sql[i-2]||'');i++;continue;}
  if(c==='"'){state='double';i++;continue;}
  if(c==='$'){const m=sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);if(m){tag=m[0];state='dollar';i+=tag.length;continue;}}
  if(c===';'){statements.push(sql.slice(start,i+1));start=i+1;}i++;
 }
 if(!['normal','line'].includes(state))return fail('sql_unterminated');
 if(sql.slice(start).trim())statements.push(sql.slice(start));
 return statements;
}
function stripLeadingComments(input){let s=input.trimStart();while(s.startsWith('--')||s.startsWith('/*')){
 if(s.startsWith('--')){const p=s.indexOf('\n');if(p<0)return '';s=s.slice(p+1).trimStart();continue;}
 let level=1,i=2;while(i<s.length&&level){if(s.slice(i,i+2)==='/*'){level++;i+=2;}else if(s.slice(i,i+2)==='*/'){level--;i+=2;}else i++;}if(level)return fail('sql_unterminated');s=s.slice(i).trimStart();}return s;}
function routineBodyHash(s){
 let i=0,state='normal',nested=0,parens=0,escape=false;
 while(i<s.length){const c=s[i],n=s[i+1];
  if(state==='line'){if(c==='\n')state='normal';i++;continue;}
  if(state==='block'){if(c==='/'&&n==='*'){nested++;i+=2;}else if(c==='*'&&n==='/'){if(!--nested)state='normal';i+=2;}else i++;continue;}
  if(state==='single'){if(escape&&c==='\\'){i+=2;continue;}if(c==="'"){if(n==="'"){i+=2;continue;}state='normal';}i++;continue;}
  if(state==='double'){if(c==='"'){if(n==='"'){i+=2;continue;}state='normal';}i++;continue;}
  if(c==='-'&&n==='-'){state='line';i+=2;continue;}if(c==='/'&&n==='*'){state='block';nested=1;i+=2;continue;}
  if(c==="'"){state='single';escape=/[eE]/.test(s[i-1]||'')&&!/[A-Za-z0-9_]/.test(s[i-2]||'');i++;continue;}if(c==='"'){state='double';i++;continue;}
  if(c==='(')parens++;else if(c===')')parens--;
  if(parens===0&&!/[A-Za-z0-9_]/.test(s[i-1]||'')){
   const marker=/^AS\s+(\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$)/i.exec(s.slice(i));
   if(marker){const start=i+marker[0].length,end=s.indexOf(marker[1],start);if(end<0)return fail('routine_body_invalid');return sha256(s.slice(start,end).replaceAll('\r\n','\n').trim());}
  }
  // Dollar-quoted defaults are allowed in parameters; skip them rather than
  // interpreting embedded AS/CREATE text as the outer function declaration.
  if(c==='$'){const m=/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(s.slice(i));if(m){const end=s.indexOf(m[0],i+m[0].length);if(end<0)return fail('routine_body_invalid');i=end+m[0].length;continue;}}
  i++;
 }
 return null;
}

export function observeSqlObjects(input){
 const functions=new Map(),tables=new Set();
 const fn=new RegExp('^CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+'+ident+'\\.'+ident+'\\s*\\(','i');
 const table=new RegExp('^CREATE\\s+(?:UNLOGGED\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?'+ident+'\\.'+ident+'\\s*\\(','i');
 for(const raw of splitSchemaStatements(input)){const s=stripLeadingComments(raw),m=fn.exec(s),t=table.exec(s);
  if(t){const name=(t[1]||t[2])+'.'+(t[3]||t[4]);if(tables.has(name))return fail('duplicate_table');tables.add(name);}
  if(m){const name=(m[1]||m[2])+'.'+(m[3]||m[4]);const bodyHash=routineBodyHash(s);
   const old=functions.get(name)||[];old.push({bodyHash});functions.set(name,old);
  }
 }
 return {functions,tables};
}
export function observeJsonTables(value){
 if(!value||typeof value!=='object'||Buffer.byteLength(JSON.stringify(value))>MAX_SCHEMA_BYTES||!value.json||!Array.isArray(value.json.tables)||value.json.tables.length>5000)return fail('json_invalid');
 const out=new Map();for(const t of value.json.tables){if(!t||typeof t.schema!=='string'||typeof t.name!=='string'||!Array.isArray(t.columns)||t.columns.length>1000)return fail('table_invalid');
 const key=t.schema+'.'+t.name;if(out.has(key))return fail('duplicate_table');const cols=new Map();
 for(const c of t.columns){if(!c||typeof c.name!=='string'||typeof c.type!=='string'||typeof c.nullable!=='boolean'||cols.has(c.name))return fail('column_invalid');cols.set(c.name,{type:c.type,nullable:c.nullable});}
 out.set(key,cols);
 }return out;
}
export const SUPPLIER_SCHEMA_FEATURES=Object.freeze([
 {id:'assignments',migrationSuffix:'0116_supplier_request_assignments.sql',tables:{supplier_request_assignments:['tenant_id','request_id','operator_id','revision'],supplier_request_assignment_events:['id','tenant_id','request_id','revision']},functions:['nexid_supplier_requests_assigned_v1','nexid_mutate_supplier_request_assignment_v1']},
 {id:'cancellation',migrationSuffix:'0117_supplier_request_cancellation.sql',tables:{supplier_requests:['cancellation_reason','cancelled_by','cancelled_at']},functions:['nexid_cancel_supplier_request_v1']},
 {id:'quotations',migrationSuffix:'0118_supplier_request_quotes.sql',tables:{supplier_request_quote_events:['id','tenant_id','request_id','revision']},functions:['nexid_mutate_supplier_quote_v1','nexid_supplier_quote_read_v1']},
 {id:'supplier_binding',migrationSuffix:'0119_supplier_request_binding.sql',tables:{supplier_request_binding_events:['id','tenant_id','request_id','order_id']},functions:['nexid_mutate_supplier_binding_v1','nexid_supplier_binding_read_v1']},
 {id:'documentary_ack',migrationSuffix:'0120_supplier_delivery_ack.sql',tables:{supplier_delivery_ack_events:['id','tenant_id','request_id','artifact_id','artifact_hash']},functions:['nexid_mutate_supplier_delivery_ack_v1','nexid_supplier_delivery_ack_read_v1']},
 {id:'ticket_type_compatibility',migrationSuffix:'0121_support_ticket_status_type_compatibility.sql',tables:{tickets:['id','status','tenant_id'],support_ticket_workflow_operations:['id','ticket_id','tenant_id']},functions:['nexid_support_ticket_current_v1','nexid_read_support_ticket_workflow_v1','nexid_transition_support_ticket_v1']},
]);
/** Structure is evidence of neither ledger application nor live-role privileges.
 * This report is deliberately never a production promotion authorization. */
export function assessSupplierSchema({jsonSchema,sqlSchema,source,expectedBodies={}},now=Date.now()){
 if(!source||['projectId','branchId','databaseName'].some(k=>typeof source[k]!=='string')||source.provider!=='neon-control-plane'||source.method!=='GET'||! /^[a-z0-9-]{1,60}$/.test(source.projectId)||! /^br-[a-z0-9-]{1,57}$/.test(source.branchId)||! /^[A-Za-z_][A-Za-z0-9_-]{0,62}$/.test(source.databaseName))return fail('source_invalid');
 if(!Number.isFinite(now)||typeof source.observedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(source.observedAt))return fail('source_invalid');
 const when=Date.parse(source.observedAt);if(!Number.isFinite(when)||when>now+30000||now-when>60*60*1000)return fail('observation_stale');
 const tables=observeJsonTables(jsonSchema);if(!sqlSchema||typeof sqlSchema.sql!=='string')return fail('sql_invalid');const sql=observeSqlObjects(sqlSchema.sql);
 const features=SUPPLIER_SCHEMA_FEATURES.map(f=>{
  const missingTables=[],missingColumns=[],missingFunctions=[],unverifiedBodies=[],differentBodies=[];
  for(const [name,cols]of Object.entries(f.tables)){const key='public.'+name,found=tables.get(key);if(Boolean(found)!==sql.tables.has(key))return fail('exports_disagree');if(!found){missingTables.push(name);continue;}for(const col of cols)if(!found.has(col))missingColumns.push(name+'.'+col);}
  for(const name of f.functions){const entries=sql.functions.get('public.'+name)||[];if(!entries.length){missingFunctions.push(name);continue;}if(entries.length!==1)return fail('routine_ambiguous');if(!expectedBodies[name]||!entries[0].bodyHash)unverifiedBodies.push(name);else if(expectedBodies[name]!==entries[0].bodyHash)differentBodies.push(name);}
  const structurePresent=!(missingTables.length||missingColumns.length||missingFunctions.length);
  return{id:f.id,migrationSuffix:f.migrationSuffix,structurePresent,missingTables,missingColumns,missingFunctions,bodyComparison:differentBodies.length?'different':(unverifiedBodies.length||missingFunctions.length)?'unverified':'matches',differentBodies,unverifiedBodies,ledgerApplied:'unverified'};
 });
 return{protocol:SCHEMA_OBSERVATION_PROTOCOL,status:features.every(f=>f.structurePresent&&f.bodyComparison==='matches')?'named_structure_matches_checks_incomplete':'blocked_on_schema_or_definition',promotionAllowed:false,source:{provider:source.provider,method:source.method,projectId:source.projectId,branchId:source.branchId,databaseName:source.databaseName,observedAt:source.observedAt},atomicSnapshot:false,retrievedDatabaseCredentials:false,deploymentSecretValuesRead:false,businessRowsRead:false,remoteSqlExecuted:false,schemaHashes:{json:sha256(JSON.stringify(jsonSchema)),sql:sha256(sqlSchema.sql.replaceAll('\r\n','\n'))},features,ticketStatusType:tables.get('public.tickets')?.get('status')?.type||null,unverified:['deployment_database_binding','migration_ledger','routine_signatures_and_security_attributes','column_constraints_and_types','catalog_values','actual_runtime_role','effective_database_acl','runtime_feature_flags','authenticated_end_to_end_acceptance'],nextActions:['Bind the chosen Neon branch to the exact deployment before authorizing any database action.','Reconcile the migration ledger; structure presence is not permission to rerun a migration.','Validate missing definitions on an isolated schema before any production change.','Verify real runtime privileges and catalog values with an approved read-only database connection.','Coordinate compatible API/BFF/dashboard releases; leave new writes disabled until acceptance.']};
}
