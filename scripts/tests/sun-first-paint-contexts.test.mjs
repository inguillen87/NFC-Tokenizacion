import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';

// Run explicitly after checksum-verifying the official actionlint binary.
// A missing validator is a failure, never a skipped semantic contract.
const actionlint=process.env.ACTIONLINT_PATH;
assert(typeof actionlint==='string'&&isAbsolute(actionlint),'ACTIONLINT_PATH must point to the verified actionlint executable');
assert((await lstat(actionlint)).isFile()&&!(await lstat(actionlint)).isSymbolicLink(),'ACTIONLINT_PATH must be a regular executable');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>/^(?:PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|LANG|LC_ALL)$/i.test(name)));
function lint(file,cwd){
 const result=spawnSync(actionlint,['-no-color','-shellcheck=','-pyflakes=',file],{cwd,env,shell:false,windowsHide:true,encoding:'utf8',timeout:15000,maxBuffer:1000000});
 assert.equal(result.error,undefined,'actionlint must actually execute');
 assert.equal(result.signal,null,'actionlint must close normally');
 return {code:result.status,output:result.stdout+result.stderr};
}
async function fixture(t,placement){
 const base=await mkdtemp(join(tmpdir(),'nexid-sun-context-'));
 t.after(async()=>{assert.equal(dirname(base),resolve(tmpdir()));assert(basename(base).startsWith('nexid-sun-context-'));await rm(base,{recursive:true,force:true});});
 await mkdir(join(base,'.github','workflows'),{recursive:true});
 const file=join(base,'.github','workflows','fixture.yml');
 const jobEnv=placement==='job'?"    env:\n      PLAYWRIGHT_MODULE: ${{ runner.temp }}/sun-browser/node_modules/playwright-core/index.mjs\n      AXE_MODULE_PATH: ${{ runner.temp }}/sun-browser/node_modules/axe-core/axe.min.js\n":'';
 const stepEnv=placement==='step'?"        env:\n          PLAYWRIGHT_MODULE: ${{ runner.temp }}/sun-browser/node_modules/playwright-core/index.mjs\n          AXE_MODULE_PATH: ${{ runner.temp }}/sun-browser/node_modules/axe-core/axe.min.js\n":'';
 await writeFile(file,'name: Synthetic context contract\non: workflow_dispatch\njobs:\n  context-check:\n    runs-on: ubuntu-24.04\n'+jobEnv+'    steps:\n      - name: Observe synthetic fixture\n'+stepEnv+'        run: echo synthetic\n',{flag:'wx'});
 return {base,file};
}

test('actual SUN workflow passes the real context/schema validator',()=>{
 const result=lint(join(root,'.github','workflows','sun-first-paint-acceptance.yml'),root);
 assert.equal(result.code,0,result.output);
});
test('real validator rejects both runner expressions in job env before jobs can start',async t=>{
 const f=await fixture(t,'job'),result=lint(f.file,f.base);
 assert.notEqual(result.code,0,'Invalid job context must fail validation');
 assert.equal((result.output.match(/context "runner" is not allowed here/g)||[]).length,2,result.output);
 assert.match(result.output,/\[expression\]/);
});
test('the same two expressions are valid in step env',async t=>{
 const f=await fixture(t,'step'),result=lint(f.file,f.base);
 assert.equal(result.code,0,result.output);
});
