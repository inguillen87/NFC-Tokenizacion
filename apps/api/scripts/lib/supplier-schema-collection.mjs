import{readFile,readdir}from'node:fs/promises';
import{join}from'node:path';
import{fileURLToPath}from'node:url';
import{assessSupplierSchema,observeSqlObjects,SUPPLIER_SCHEMA_FEATURES,MAX_SCHEMA_BYTES}from'./supplier-schema-observation.mjs';
export function validateSchemaTarget(target){
 if(!target||['projectId','branchId','databaseName'].some(k=>typeof target[k]!=='string')||Object.keys(target).some(k=>!['projectId','branchId','databaseName'].includes(k))||! /^[a-z0-9-]{1,60}$/.test(target.projectId)||! /^br-[a-z0-9-]{1,57}$/.test(target.branchId)||! /^[A-Za-z_][A-Za-z0-9_-]{0,62}$/.test(target.databaseName))throw Error('supplier_schema_target_invalid');
 return{projectId:target.projectId,branchId:target.branchId,databaseName:target.databaseName};
}
export async function loadExpectedSupplierBodies(directory){
 if(directory instanceof URL)directory=fileURLToPath(directory);
 const needed=new Set(SUPPLIER_SCHEMA_FEATURES.flatMap(f=>f.functions)),bodies={};
 const names=(await readdir(directory)).filter(n=>/^\d{14}_01(?:1[2-9]|2[01])_[a-z0-9_]+\.sql$/.test(n)).sort();
 for(const name of names){const text=await readFile(join(directory,name),'utf8');const objects=observeSqlObjects(text);for(const[key,entries]of objects.functions){const unqualified=key.replace(/^public\./,'');if(needed.has(unqualified)&&entries.at(-1)?.bodyHash)bodies[unqualified]=entries.at(-1).bodyHash;}}
 if([...needed].some(k=>!bodies[k]))throw Error('supplier_schema_expected_source_incomplete');
 return{bodies,migrationFiles:names};
}
export async function collectSupplierSchema(target,request,{clock=()=>Date.now(),expectedBodies={}}={}){
 const t=validateSchemaTarget(target),base='/projects/'+t.projectId+'/branches/'+t.branchId;
 const start=clock(),metadata=await request(base,[]);
 if(!metadata?.branch||metadata.branch.id!==t.branchId||metadata.branch.project_id!==t.projectId)throw Error('supplier_schema_branch_identity_mismatch');
 const jsonSchema=await request(base+'/schema',['db_name='+t.databaseName,'format=json']);
 const sqlSchema=await request(base+'/schema',['db_name='+t.databaseName,'format=sql']);
 const end=clock();if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||end-start>120000)throw Error('supplier_schema_collection_timeout');
 const report=assessSupplierSchema({jsonSchema,sqlSchema,expectedBodies,source:{...t,provider:'neon-control-plane',method:'GET',observedAt:new Date(start).toISOString()}},end);
 return{...report,collection:{method:'three_explicit_control_plane_GETs',durationMs:end-start,branchIdentityVerified:true,exportPairTransactionallyConsistent:false,finishedAt:new Date(end).toISOString()}};
}
export function parseSchemaProviderJson(bytes){
 const buffer=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);if(buffer.byteLength>MAX_SCHEMA_BYTES)throw Error('supplier_schema_provider_response_too_large');
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer));}catch{throw Error('supplier_schema_provider_response_invalid');}
}
