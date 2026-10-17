// One source-bound SUN build, reused by isolated browser jobs. No archives with arbitrary target paths.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,appendFile,readdir,mkdir,lstat,realpath} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const SCHEMA='nexid.sun-ci-build.v1',MAX_FILES=20000,MAX_FILE_BYTES=64*1024*1024,MAX_TOTAL_BYTES=1024*1024*1024;
const IDENTITY_KEYS=['checkoutSha','checkoutTree','headSha','runId','runAttempt','nodeVersion','lockSha256'];
export const GENERATED_PATHS=Object.freeze([
 'apps/web/src/app/generated/root-base.css','apps/web/src/app/generated/experience-root.css','apps/web/src/app/generated/manifest.json',
 'apps/web/public/maplibre/6.4.1/maplibre-gl-worker.mjs','apps/web/public/maplibre/6.4.1/maplibre-gl-shared.mjs','apps/web/public/maplibre/6.4.1/LICENSE.txt',
]);
const BUILD_ID_PATH='apps/web/.next/BUILD_ID',DEPENDENCIES=['sun-web-build','sun-web-browsers','sun-tenant-actions'];
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function exactKeys(value,keys){assert(value&&typeof value==='object'&&!Array.isArray(value));assert.deepEqual(Object.keys(value).sort(),[...keys].sort());}
export function safeRelative(path){
 assert(typeof path==='string'&&path.length>0&&path.length<1024&&!/[\\:\u0000-\u001f\u007f]/u.test(path)&&!isAbsolute(path),'Noncanonical build path');
 assert(path.split('/').every(part=>part&&part!=='.'&&part!=='..'),'Build path traversal');return path;
}
export function allowedBuildPath(path){
 safeRelative(path);const parts=path.split('/');assert(!parts.some(part=>/^\.env(?:$|\.)/iu.test(part)||['node_modules','.git','artifacts'].includes(part)),'Private or dependency path');
 if(GENERATED_PATHS.includes(path))return true;
 assert(path.startsWith('apps/web/.next/')&&!path.startsWith('apps/web/.next/cache/')&&path!=='apps/web/.next/cache','Build path outside whitelist');return true;
}
function validateIdentity(value){exactKeys(value,IDENTITY_KEYS);for(const key of ['checkoutSha','checkoutTree','headSha'])assert(/^[a-f0-9]{40}$/u.test(value[key]));for(const key of ['runId','runAttempt'])assert(/^[1-9][0-9]*$/u.test(value[key]));assert.equal(value.nodeVersion,'24.15.0');assert(/^[a-f0-9]{64}$/u.test(value.lockSha256));}
export function validateManifest(manifest,expected){
 exactKeys(manifest,['schemaVersion','identity','buildId','files']);assert.equal(manifest.schemaVersion,SCHEMA);validateIdentity(manifest.identity);validateIdentity(expected);assert.deepEqual(manifest.identity,expected,'Build identity differs from this checkout/run');
 assert(typeof manifest.buildId==='string'&&/^[A-Za-z0-9_-]{1,200}$/u.test(manifest.buildId));assert(Array.isArray(manifest.files)&&manifest.files.length>0&&manifest.files.length<=MAX_FILES);
 const seen=new Set();let total=0;
 for(const file of manifest.files){exactKeys(file,['path','sha256','bytes']);allowedBuildPath(file.path);const canonical=file.path.toLowerCase();assert(!seen.has(canonical),'Duplicate build path');seen.add(canonical);assert(/^[a-f0-9]{64}$/u.test(file.sha256));assert(Number.isSafeInteger(file.bytes)&&file.bytes>=0&&file.bytes<=MAX_FILE_BYTES);total+=file.bytes;assert(total<=MAX_TOTAL_BYTES);}
 assert.deepEqual(manifest.files.map(file=>file.path),manifest.files.map(file=>file.path).sort(),'Build manifest must be sorted');
 for(const path of [BUILD_ID_PATH,...GENERATED_PATHS])assert(seen.has(path.toLowerCase()),'Missing required generated build input: '+path);
 assert(manifest.files.some(file=>file.path.startsWith('apps/web/.next/server/'))&&manifest.files.some(file=>file.path.startsWith('apps/web/.next/static/')),'Missing compiled server/static files');
 return{fileCount:manifest.files.length,totalBytes:total,buildId:manifest.buildId};
}
async function physicalRoot(root){const stat=await lstat(root);assert(stat.isDirectory()&&!stat.isSymbolicLink(),'Physical directory required');return realpath(root);}
async function safePath(root,path,{createParents=false}={}){
 safeRelative(path);const full=resolve(root,...path.split('/')),rel=relative(root,full);assert(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'Path escaped physical root');
 const parts=path.split('/');let parent=root;
 for(const part of parts.slice(0,-1)){parent=join(parent,part);let stat;try{stat=await lstat(parent);}catch(error){if(error.code!=='ENOENT'||!createParents)throw error;await mkdir(parent);stat=await lstat(parent);}assert(stat.isDirectory()&&!stat.isSymbolicLink(),'Build parent symlink or non-directory');}
 try{const stat=await lstat(full);assert(stat.isFile()&&!stat.isSymbolicLink(),'Build leaf symlink or non-file');}catch(error){if(error.code!=='ENOENT')throw error;}
 return full;
}
async function directory(root,path){safeRelative(path);let current=root;for(const part of path.split('/')){current=join(current,part);const stat=await lstat(current);assert(stat.isDirectory()&&!stat.isSymbolicLink(),'Directory parent symlink or non-directory');}return current;}
async function regular(root,path){const full=await safePath(root,path),stat=await lstat(full);assert(stat.isFile()&&!stat.isSymbolicLink());assert(stat.size<=MAX_FILE_BYTES);return readFile(full);}
export async function createTransport(root,output,identity){
 root=await physicalRoot(root);validateIdentity(identity);assert.equal(digest(await readFile(join(root,'package-lock.json'))),identity.lockSha256);
 // Check the root directory separately; safePath itself only permits file leaves.
 await directory(root,'apps/web/.next');
 const walk=async path=>{const full=await directory(root,path),files=[];for(const name of (await readdir(full)).sort()){const child=path+'/'+name;if(child==='apps/web/.next/cache')continue;const stat=await lstat(join(root,...child.split('/')));assert(!stat.isSymbolicLink(),'Build symlinks are forbidden');if(stat.isDirectory())files.push(...await walk(child));else{assert(stat.isFile());allowedBuildPath(child);files.push(child);}}return files;};
 const paths=[...await walk('apps/web/.next'),...GENERATED_PATHS].sort(),files=[];let total=0;
 for(const path of paths){const bytes=await regular(root,path);total+=bytes.length;assert(total<=MAX_TOTAL_BYTES&&files.length<MAX_FILES);files.push({path,sha256:digest(bytes),bytes:bytes.length});}
 const buildId=(await regular(root,BUILD_ID_PATH)).toString().trim(),manifest={schemaVersion:SCHEMA,identity,buildId,files};validateManifest(manifest,identity);
 await mkdir(output);output=await physicalRoot(output);await mkdir(join(output,'blobs'));
 const written=new Set();for(const file of files){const bytes=await regular(root,file.path);assert.equal(digest(bytes),file.sha256,'Build changed while packing');if(!written.has(file.sha256)){await writeFile(join(output,'blobs',file.sha256),bytes,{flag:'wx'});written.add(file.sha256);}}
 const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');await writeFile(join(output,'manifest.json'),bytes,{flag:'wx'});return{manifest,manifestSha256:digest(bytes),...validateManifest(manifest,identity)};
}
async function loadTransport(transport,identity,expectedManifestSha256,expectedBuildId){
 transport=await physicalRoot(transport);assert(/^[a-f0-9]{64}$/u.test(expectedManifestSha256||''));const manifestBytes=await regular(transport,'manifest.json');assert.equal(digest(manifestBytes),expectedManifestSha256,'Build manifest hash differs from producer job');const manifest=JSON.parse(manifestBytes);const totals=validateManifest(manifest,identity);assert.equal(manifest.buildId,expectedBuildId,'BUILD_ID differs from producer job');
 assert.deepEqual((await readdir(transport)).sort(),['blobs','manifest.json']);await directory(transport,'blobs');const hashes=[...new Set(manifest.files.map(file=>file.sha256))].sort();assert.deepEqual((await readdir(join(transport,'blobs'))).sort(),hashes,'Unexpected or missing transported blob');
 for(const sha256 of hashes){const bytes=await regular(transport,'blobs/'+sha256);assert.equal(digest(bytes),sha256,'Transported build blob was altered');}
 for(const file of manifest.files)assert.equal((await lstat(join(transport,'blobs',file.sha256))).size,file.bytes,'Transported build size differs');return{transport,manifest,...totals};
}
export async function restoreTransport(root,transport,identity,expectedManifestSha256,expectedBuildId){
 root=await physicalRoot(root);assert.equal(digest(await readFile(join(root,'package-lock.json'))),identity.lockSha256);const bundle=await loadTransport(transport,identity,expectedManifestSha256,expectedBuildId);
 // Preflight every destination before creating or replacing anything. Stale builds and links fail closed.
 for(const file of bundle.manifest.files){const target=resolve(root,...file.path.split('/'));try{await lstat(target);assert.fail('Build destination already exists');}catch(error){if(error.code!=='ENOENT')throw error;}let current=root;for(const part of file.path.split('/').slice(0,-1)){current=join(current,part);try{const stat=await lstat(current);assert(stat.isDirectory()&&!stat.isSymbolicLink(),'Build destination parent is a symlink');}catch(error){if(error.code!=='ENOENT')throw error;}}}
 for(const file of bundle.manifest.files){const target=await safePath(root,file.path,{createParents:true}),bytes=await regular(bundle.transport,'blobs/'+file.sha256);assert.equal(digest(bytes),file.sha256);await writeFile(target,bytes,{flag:'wx'});}
 return verifyRestored(root,transport,identity,expectedManifestSha256,expectedBuildId);
}
export async function verifyRestored(root,transport,identity,expectedManifestSha256,expectedBuildId){
 root=await physicalRoot(root);assert.equal(digest(await readFile(join(root,'package-lock.json'))),identity.lockSha256);const bundle=await loadTransport(transport,identity,expectedManifestSha256,expectedBuildId);
 for(const file of bundle.manifest.files){const bytes=await regular(root,file.path);assert.equal(bytes.length,file.bytes);assert.equal(digest(bytes),file.sha256,'Restored build input was altered');}assert.equal((await regular(root,BUILD_ID_PATH)).toString().trim(),bundle.manifest.buildId);return{fileCount:bundle.fileCount,totalBytes:bundle.totalBytes,buildId:bundle.buildId};
}
export function requireSuccessfulDependencies(needs){exactKeys(needs,DEPENDENCIES);for(const name of DEPENDENCIES)assert.equal(needs[name]?.result,'success','Mandatory SUN dependency not successful: '+name);return true;}
function checkoutIdentity(root){
 assert.equal(process.env.GITHUB_ACTIONS,'true','Transport CLI is restricted to GitHub Actions');
 const git=args=>execFileSync('git',['--no-optional-locks','-C',root,...args],{encoding:'utf8',windowsHide:true});
 const [checkoutSha,checkoutTree]=git(['rev-parse','HEAD','HEAD^{tree}']).trim().split(/\r?\n/u);assert.equal(checkoutSha,process.env.GITHUB_SHA);assert.equal(git(['status','--porcelain','--untracked-files=no']).trim(),'');
 return{checkoutSha,checkoutTree,headSha:process.env.SUN_CI_HEAD_SHA||process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,nodeVersion:process.versions.node};
}
async function main(){
 const [mode,path]=process.argv.slice(2),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');assert(['pack','restore','verify','aggregate'].includes(mode));assert(path);
 if(mode==='aggregate'){const identity={...checkoutIdentity(root),lockSha256:digest(await readFile(join(root,'package-lock.json')))};validateIdentity(identity);const needs=JSON.parse(process.env.SUN_CI_NEEDS_JSON||'null');requireSuccessfulDependencies(needs);await mkdir(path,{recursive:true});const evidence={schemaVersion:'nexid.sun-ci-aggregate.v1',accepted:true,identity,dependencies:Object.fromEntries(DEPENDENCIES.map(name=>[name,needs[name].result]))};await writeFile(join(path,'sun-ci-aggregate.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(evidence));return;}
 const identity={...checkoutIdentity(root),lockSha256:digest(await readFile(join(root,'package-lock.json')))};validateIdentity(identity);
 if(mode==='pack'){const result=await createTransport(root,path,identity);assert(process.env.GITHUB_OUTPUT);await appendFile(process.env.GITHUB_OUTPUT,'manifest-sha256='+result.manifestSha256+'\nbuild-id='+result.buildId+'\n');console.log(JSON.stringify({packed:true,identity,manifestSha256:result.manifestSha256,buildId:result.buildId,fileCount:result.fileCount,totalBytes:result.totalBytes}));}
 else{const result=await(mode==='restore'?restoreTransport:verifyRestored)(root,path,identity,process.env.SUN_CI_MANIFEST_SHA256,process.env.SUN_CI_BUILD_ID);checkoutIdentity(root);console.log(JSON.stringify({[mode]:true,identity,...result}));}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
