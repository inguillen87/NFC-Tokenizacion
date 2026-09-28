import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {resolvePilotScope,buildPilotLaunchpad} from '../src/lib/pilot-launchpad-model.ts';
import {readPilotSource} from '../src/lib/pilot-launchpad-read.ts';
const source=await readFile(new URL('../src/app/(app)/onboarding/page.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source.replace(/^import .*;\r?$/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
const tenant={id:'qa-session',role:'tenant-admin',tenantSlug:'qa-company',permissions:['batches:read'],deniedPermissions:[],isDemo:false,setupCompleted:true};
async function page(session=tenant,query={},response=Response.json([],{headers:{'x-nexid-data-mode':'production'}})){
 const calls=[],contextCalls=[],exports={},React={createElement:(type,props,...children)=>({type,props,children})};
 const factory=new Function('exports','React','requireDashboardSession','createAdminPageContext','fetchAdminPage','resolvePilotScope','buildPilotLaunchpad','readPilotSource','OnboardingSetupWizard','PilotLaunchpad',compiled);
 factory(exports,React,async()=>session,async(s,slug)=>{contextCalls.push(slug);return{tenantSlug:slug};},async(context,path,init)=>{calls.push({context,path,init});return response;},resolvePilotScope,buildPilotLaunchpad,readPilotSource,'wizard','launchpad');
 const node=await exports.default({searchParams:Promise.resolve(query)});return{node,model:node.children.find(x=>x?.type==='launchpad').props.model,calls,contextCalls};
}
test('real page performs only the existing company-bound batches GET and no optional blockchain/assets reads',async()=>{
 const r=await page();assert.equal(r.calls.length,1);assert.equal(r.calls[0].path,'batches');assert.equal(r.calls[0].context.tenantSlug,'qa-company');assert.equal(r.calls[0].init.method,'GET');assert.equal(r.calls[0].init.redirect,'error');assert.equal(r.model.state,'ready');
 assert.doesNotMatch(source,/product-assets|proof\/anchors|tokenization\/requests|numberFrom|has_meta_key|qa_passed|assetScore/);
});
for(const [session,query,state] of [[{...tenant,role:'super-admin',tenantSlug:null},{},'tenant_required'],[tenant,{tenant:'foreign'},'forbidden'],[{...tenant,isDemo:true},{},'demo'],[{...tenant,permissions:[]},{},'forbidden'],[{...tenant,role:'super-admin',tenantSlug:null},{tenant:['qa-company','foreign']},'invalid']])test('real page '+state+' makes no context or data request',async()=>{const r=await page(session,query);assert.equal(r.model.state,state);assert.equal(r.calls.length,0);assert.equal(r.contextCalls.length,0);assert.deepEqual(r.model.batches,[]);});
test('the unchanged company setup wizard is available only to its actual tenant-admin scope',async()=>{
 assert.ok((await page({...tenant,setupCompleted:false})).node.children.some(x=>x?.type==='wizard'));
 for(const change of [{role:'tenant-owner'},{isDemo:true},{permissions:[]}])assert.ok(!(await page({...tenant,setupCompleted:false,...change})).node.children.some(x=>x?.type==='wizard'));
});
test('permission loss or an unavailable BFF cannot turn a previous selection into readiness',async()=>{
 for(const [status,expected]of [[403,'forbidden'],[503,'unavailable']]){const r=await page(tenant,{},Response.json({ok:false},{status}));assert.equal(r.model.state,expected);assert.deepEqual(r.model.batches,[]);}
});
