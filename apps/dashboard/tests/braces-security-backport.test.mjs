import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import test from 'node:test';

const require=createRequire(import.meta.url);
const root=new URL('../../../',import.meta.url);
const vendor=new URL('vendor/braces-security/',root);
const braces=require(fileURLToPath(new URL('index.js',vendor)));
const sha=value=>createHash('sha256').update(value).digest('hex');
const sourceSha=value=>sha(value.toString('utf8').replaceAll('\r\n','\n'));
const nested=(depth,open='{',close='}')=>open.repeat(depth)+'a,b'+close.repeat(depth);
const methods={default:input=>braces(input),create:input=>braces.create(input),parse:input=>braces.parse(input),compile:input=>braces.compile(input),expand:input=>braces.expand(input),stringify:input=>braces.stringify(input)};
const controlled=error=>error.code==='ERR_BRACES_MAX_DEPTH'||(error instanceof SyntaxError&&/max characters/.test(error.message));

test('all installed Tailwind braces consumers resolve the actual reviewed private backport',()=>{
 for(const entry of [require.resolve('micromatch'),require.resolve('chokidar',{paths:[require.resolve('tailwindcss')]})]){
  const consumer=createRequire(entry),metadata=consumer('braces/package.json');
  assert.equal(metadata.name,'@nexid/braces-security-backport');
  assert.equal(metadata.version,'3.0.3-nexid.1');
  assert.equal(metadata.private,true);
  assert.throws(()=>consumer('braces').compile(nested(1000)),controlled);
 }
});
for(const depth of [1000,4000,10000])for(const [name,call]of Object.entries(methods))test(`${name} rejects hostile string depth ${depth} before stack exhaustion`,()=>{
 assert.throws(()=>call(nested(depth)),controlled);
 assert.throws(()=>call(nested(depth,'(',')')),controlled);
});
test('the depth option cannot disable the ceiling and ordinary depth boundaries still work',()=>{
 for(const maxDepth of [false,0,-1,Infinity,NaN,1.5,129,100000])for(const method of ['parse','compile','expand','stringify']){
  assert.throws(()=>braces[method]('{a,b}',{maxDepth}),/maxDepth must be an integer/);
 }
 for(const method of ['parse','compile','expand','stringify']){
  assert.doesNotThrow(()=>braces[method](nested(1),{maxDepth:1}));
  assert.throws(()=>braces[method](nested(2),{maxDepth:1}),controlled);
  assert.doesNotThrow(()=>braces[method](nested(64)));
  assert.throws(()=>braces[method](nested(65)),controlled);
  assert.doesNotThrow(()=>braces[method](nested(128),{maxDepth:128}));
  assert.throws(()=>braces[method](nested(129),{maxDepth:128}),controlled);
 }
});
test('supplied deep ASTs and child cycles are checked before every public walker',()=>{
 const deep=()=>{let ast={type:'text',value:'x'};for(let i=0;i<10000;i++)ast={type:'root',nodes:[ast]};return ast;};
 for(const call of [braces,braces.create,braces.compile,braces.expand,braces.stringify]){
  assert.throws(()=>call(deep()),controlled);
  const cycle={type:'root',nodes:[]};cycle.nodes.push(cycle);
  assert.throws(()=>call(cycle),error=>error.code==='ERR_BRACES_AST_INVALID');
  const hostileValue={type:'root',nodes:[{type:'text',value:[]}]};
  assert.throws(()=>call(hostileValue),error=>error.code==='ERR_BRACES_AST_INVALID');
 }
});
test('supplied AST parent cycles are rejected under a child-process watchdog',()=>{
 const entry=fileURLToPath(new URL('index.js',vendor));
 const program=`const b=require(${JSON.stringify(entry)});for(const call of [b,b.create,b.compile,b.expand,b.stringify]){for(const two of [false,true]){const a={type:'paren',nodes:[]};if(two){const p={type:'paren',nodes:[]};a.parent=p;p.parent=a;}else a.parent=a;try{call(a);process.exit(2);}catch(e){if(e.code!=='ERR_BRACES_AST_INVALID')throw e;}}}process.stdout.write('parent-cycles-rejected');`;
 assert.equal(execFileSync(process.execPath,['-e',program],{encoding:'utf8',timeout:3000,windowsHide:true}),'parent-cycles-rejected');
});
test('ordinary glob matching, expansion, escaping and incomplete literal patterns retain their outputs',()=>{
 const goldens=[
  ['src/**/*.{ts,tsx}','src/**/*.(ts|tsx)',['src/**/*.ts','src/**/*.tsx']],
  ['a/{b,{c,d}}/e','a/(b|(c|d))/e',['a/b/e','a/c/e','a/d/e']],
  ['x{1..3}','x([1-3])',['x1','x2','x3']],
  ['foo{a,b','foo{a,b',['foo{a,b']],
  ['foo(a|b','foo(a|b',['foo(a|b']],
  ['${var','${var',['${var']],
  ['x\\{a,b\\}','x{a,b}',['x{a,b}']],
  ['foo{a,{b,c}','foo{a,(b|c)',['foo{a,b','foo{a,c']],
  ['foo(a{b,c}','foo(a(b|c)',['foo(ab','foo(ac']],
 ];
 for(const [input,compiled,expanded]of goldens){
  assert.equal(braces.compile(input),compiled,input);
  assert.deepEqual(braces.expand(input),expanded,input);
  assert.equal(braces.stringify(braces.parse(input)),input.replaceAll('\\',''),input);
 }
 const deepArray=[];let branch=deepArray;for(let i=0;i<10000;i++){const child=[];branch.push(child);branch=child;}branch.push('x');
 const flatten=require(fileURLToPath(new URL('lib/utils.js',vendor))).flatten;
 assert.deepEqual(flatten(deepArray),['x']);
 const cycle=[];cycle.push(cycle);assert.throws(()=>flatten(cycle),/cyclic brace expansion array/);
});
test('upstream license and immutable published source provenance are preserved',async()=>{
 const provenance=JSON.parse(await readFile(new URL('UPSTREAM.json',vendor),'utf8'));
 assert.equal(provenance.upstream.name,'braces');assert.equal(provenance.upstream.version,'3.0.3');
 assert.equal(provenance.upstream.integrity,'sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==');
 assert.equal(provenance.officialPatchedRelease,false);
 for(const path of ['LICENSE','index.js','lib/constants.js'])assert.equal(sourceSha(await readFile(new URL(path,vendor))),provenance.upstream.filesSha256[path],path);
 assert.match(await readFile(new URL('LICENSE',vendor),'utf8'),/MIT License|Permission is hereby granted/);
});
test('the lock and every installed consumer bind exactly to the reviewed local source component',async()=>{
 const expected=['LICENSE','README.md','UPSTREAM.json','package.json','index.js',...(await readdir(new URL('lib/',vendor))).map(path=>'lib/'+path)].sort();
 const provenance=JSON.parse(await readFile(new URL('UPSTREAM.json',vendor),'utf8'));
 assert.deepEqual(Object.keys(provenance.localPatch.filesSha256).sort(),expected.filter(path=>path!=='UPSTREAM.json'));
 for(const [path,digest]of Object.entries(provenance.localPatch.filesSha256))assert.equal(sourceSha(await readFile(new URL(path,vendor))),digest,path+' exact reviewed local source');
 const lock=JSON.parse(await readFile(new URL('package-lock.json',root),'utf8'));
 const installs=Object.entries(lock.packages).filter(([path])=>path.endsWith('/braces'));
 assert.deepEqual(installs,[['node_modules/braces',{resolved:'vendor/braces-security',link:true}]]);
 assert.equal(lock.packages['vendor/braces-security'].name,'@nexid/braces-security-backport');
 const manifest=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
 assert.equal(manifest.devDependencies.braces,'file:vendor/braces-security');assert.equal(manifest.overrides.braces,'$braces');
 for(const entry of [require.resolve('micromatch'),require.resolve('chokidar',{paths:[require.resolve('tailwindcss')]})]){
  const consumer=createRequire(entry),installed=new URL('./',pathToFileURL(consumer.resolve('braces/package.json')));
  for(const path of expected)assert.equal(sourceSha(await readFile(new URL(path,installed))),sourceSha(await readFile(new URL(path,vendor))),path+' actual installed source');
 }
});
