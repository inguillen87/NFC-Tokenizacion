import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { localStyleSources } from '../scripts/public-style-source-graph.mjs';

test('source inventory follows static, re-export and literal dynamic imports without running modules', async()=>{
 const folder=await mkdtemp(join(tmpdir(),'nexid-style-graph-'));
 try{
  await mkdir(join(folder,'nested'));
  const files={'route.tsx':'import "./shared"; export { item } from "./nested"; const load=()=>import("./dynamic"); import "./styles.module.css"; import "react";', 'shared.ts':'import "./route"; throw Error("MUST_NOT_EXECUTE");', 'nested/index.ts':'export const item=1;', 'dynamic.tsx':'export default 1;'};
  for(const [name,source] of Object.entries(files))await writeFile(join(folder,name),source);
  assert.deepEqual(await localStyleSources([join(folder,'route.tsx')]),Object.keys(files).map(name=>resolve(folder,name)).sort());
  await writeFile(join(folder,'route.tsx'),'import "./missing-component";');
  await assert.rejects(localStyleSources([join(folder,'route.tsx')]),/Unable to inventory local style dependency/);
 }finally{
  assert.equal(resolve(dirname(folder)),resolve(tmpdir()));assert.ok(folder.includes('nexid-style-graph-'));
  await rm(folder,{recursive:true});
 }
});
