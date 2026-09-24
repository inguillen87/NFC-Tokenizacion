import{spawn}from'node:child_process';
import{stat,writeFile}from'node:fs/promises';
import{resolve,dirname,isAbsolute}from'node:path';
import{fileURLToPath}from'node:url';
import{collectSupplierSchema,loadExpectedSupplierBodies,parseSchemaProviderJson,validateSchemaTarget}from'./lib/supplier-schema-collection.mjs';
import{MAX_SCHEMA_BYTES}from'./lib/supplier-schema-observation.mjs';

export function parseSchemaPreflightArgs(args){
 const options={},allowed=new Set(['project','branch','database','output','cli-module']);
 for(let i=0;i<args.length;i+=2){const key=args[i]?.replace(/^--/,'');if(!args[i]?.startsWith('--')||!allowed.has(key)||!args[i+1]||args[i+1].startsWith('--')||Object.hasOwn(options,key))throw Error('supplier_schema_preflight_arguments_invalid');options[key]=args[i+1];}
 validateSchemaTarget({projectId:options.project,branchId:options.branch,databaseName:options.database});
 if(!options.output||!options['cli-module']||!isAbsolute(options['cli-module']))throw Error('supplier_schema_preflight_explicit_paths_required');
 return options;
}
export async function readSchemaThroughCli(cliModule,path,query){
 // Path and query are created exclusively by the strict target validator.
 if(!/^\/projects\/[a-z0-9-]+\/branches\/br-[a-z0-9-]+(?:\/schema)?$/.test(path)||query.some(q=>! /^(?:db_name=[A-Za-z_][A-Za-z0-9_-]{0,62}|format=(?:json|sql))$/.test(q)))throw Error('supplier_schema_preflight_request_invalid');
 const args=[cliModule,'api',path,'--method','GET','--output','json',...query.flatMap(v=>['--query',v]),'--no-analytics'];
 return new Promise((resolvePromise,reject)=>{
  const child=spawn(process.execPath,args,{stdio:['ignore','pipe','pipe'],windowsHide:true,shell:false});let chunks=[],size=0,failure=null;
  const timer=setTimeout(()=>{failure=Error('supplier_schema_preflight_cli_timeout');child.kill();},60000);
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>MAX_SCHEMA_BYTES){failure=Error('supplier_schema_provider_response_too_large');child.kill();}else chunks.push(chunk);});
  child.stderr.on('data',chunk=>{size+=chunk.length;if(size>MAX_SCHEMA_BYTES){failure=Error('supplier_schema_provider_response_too_large');child.kill();}});
  child.on('error',()=>{failure=Error('supplier_schema_preflight_cli_unavailable');});
  child.on('close',code=>{clearTimeout(timer);if(failure)return reject(failure);if(code!==0)return reject(Error('supplier_schema_preflight_read_failed'));try{resolvePromise(parseSchemaProviderJson(Buffer.concat(chunks)));}catch{reject(Error('supplier_schema_provider_response_invalid'));}finally{chunks=[];}});
 });
}
export async function main(args=process.argv.slice(2)){
 const options=parseSchemaPreflightArgs(args),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 const output=resolve(options.output);
 if(await stat(output).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;}))throw Error('supplier_schema_preflight_output_exists');
 if(!(await stat(dirname(output))).isDirectory())throw Error('supplier_schema_preflight_output_directory_invalid');
 const {bodies,migrationFiles}=await loadExpectedSupplierBodies(resolve(root,'db/migrations'));
 const result=await collectSupplierSchema({projectId:options.project,branchId:options.branch,databaseName:options.database},(p,q)=>readSchemaThroughCli(options['cli-module'],p,q),{expectedBodies:bodies});
 await writeFile(output,JSON.stringify({...result,expectedSource:{migrationFiles}},null,2)+'\n',{encoding:'utf8',flag:'wx'});
 console.log(JSON.stringify({protocol:result.protocol,status:result.status,promotionAllowed:false,features:result.features.map(f=>({id:f.id,structurePresent:f.structurePresent,bodyComparison:f.bodyComparison,ledgerApplied:f.ledgerApplied})),report:output}));
 // 2 is an informative, explicit not-authorized result, never a green deploy gate.
 return 2;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().then(code=>{process.exitCode=code;}).catch(error=>{const reason=/^supplier_schema_[a-z_]+$/.test(error?.message||'')?error.message:'supplier_schema_preflight_failed';console.error(JSON.stringify({ok:false,reason,promotionAllowed:false}));process.exitCode=1;});
