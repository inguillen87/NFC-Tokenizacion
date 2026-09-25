import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import React from 'react';
import ts from 'typescript';
import {canReadRuntimeConsole} from '../src/lib/runtime-readiness-access.ts';
import {canReadGlobalNotifications,parseAdminNotificationSummary} from '../src/lib/admin-notification-access.ts';
const current={id:'qa-session',role:'super-admin',tenantId:null,tenantSlug:null,isDemo:false,deniedPermissions:[]};
const pageSource=await readFile(new URL('../src/app/(app)/settings/runtime/page.tsx',import.meta.url),'utf8');
function pageFor(session){
  const exports={};let resolved=0;
  const code=ts.transpileModule(pageSource.replace(/^import .*;\r?$/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
  const Panel=()=>null,Notice=()=>null;
  new Function('exports','React','notFound','requireDashboardSession','canReadRuntimeConsole','RuntimeReadinessPanel','RuntimeAccessNotice',code)(exports,React,()=>{throw Error('not_found_selector');},async()=>{resolved++;if(!session)throw Error('login_required');return session;},canReadRuntimeConsole,Panel,Notice);
  return{run:exports.default,Panel,Notice,get resolved(){return resolved;}};
}
test('company admin opening real runtime page receives an access explanation, not notFound or a diagnostic component',async()=>{
 const p=pageFor({...current,role:'tenant-admin',tenantId:'qa-tenant',tenantSlug:'qa-balmec'});const result=await p.run({searchParams:Promise.resolve({})});assert.equal(result.type,p.Notice);assert.equal(result.props.reason,'tenant');assert.equal(p.resolved,1);
});
for(const patch of [{role:'tenant-owner',tenantId:'tenant'},{role:'supplier-operator'},{role:'viewer'},{isDemo:true},{deniedPermissions:['audit.read']},{deniedPermissions:['audit:read']},{deniedPermissions:['*']},{tenantSlug:'qa-company'}])test('runtime restriction stays intact '+JSON.stringify(patch),async()=>{
 const p=pageFor({...current,...patch});const r=await p.run({searchParams:Promise.resolve({})});assert.equal(r.type,p.Notice);assert.notEqual(r.type,p.Panel);
});
test('global authorized page still exposes only its server-derived scope to the existing panel',async()=>{const p=pageFor(current),r=await p.run({searchParams:Promise.resolve({})});assert.equal(r.type,p.Panel);assert.deepEqual(r.props.access,current);});
test('session requirement is not replaced by an anonymous access notice',async()=>{await assert.rejects(pageFor(null).run({searchParams:Promise.resolve({})}),/login_required/);});
for(const params of [{tenant:'qa-balmec'},{sql:'select 1'},{url:'https://other.invalid'}])test('invalid runtime selectors still go nowhere '+JSON.stringify(params),async()=>{for(const session of [current,{...current,role:'tenant-admin',tenantSlug:'qa-balmec'}])await assert.rejects(pageFor(session).run({searchParams:Promise.resolve(params)}),/not_found_selector/);});
for(const patch of [{role:'tenant-admin'},{role:'tenant-owner'},{role:'supplier-operator'},{role:'viewer'},{role:'api-integration'},{tenantSlug:'qa-balmec'},{tenantId:'tenant'},{isDemo:true},{}])test('notifications mirror global API role, independently of sensitive-event access '+JSON.stringify(patch),()=>{
 assert.equal(canReadGlobalNotifications({...current,...patch}),Object.keys(patch).length===0);
});
test('notification summary projects safe counters only and permits a genuinely confirmed zero',()=>{
 const v={ok:true,unreadCount:3,counts:{new_leads:1,open_tickets:2,new_orders:0},latest:[{contact:'private@example.invalid'}]};
 assert.deepEqual(parseAdminNotificationSummary(v),{unreadCount:3,counts:{new_leads:1,open_tickets:2,new_orders:0}});assert.doesNotMatch(JSON.stringify(parseAdminNotificationSummary(v)),/private|latest/);
 assert.equal(parseAdminNotificationSummary({ok:true,unreadCount:0,counts:{new_leads:0,open_tickets:0,new_orders:0}}).unreadCount,0);
});
for(const patch of [{ok:false},{unreadCount:4},{unreadCount:'3'},{demoMode:true},{demo:true},{counts:{new_leads:-1,open_tickets:4,new_orders:0}},{counts:{new_leads:1,open_tickets:2}},{counts:{new_leads:Number.MAX_SAFE_INTEGER,open_tickets:2,new_orders:0}}])test('malformed notification does not become a known zero '+JSON.stringify(patch),()=>assert.throws(()=>parseAdminNotificationSummary({ok:true,unreadCount:3,counts:{new_leads:1,open_tickets:2,new_orders:0},...patch})));
test('shell adds a role gate separate from CRM destination permission, with keyed scope isolation',async()=>{
 const shell=await readFile(new URL('../src/components/dashboard-shell.tsx',import.meta.url),'utf8');
 assert.match(shell,/canReadNotifications=\{canReadGlobalNotifications\(\{role:currentRole,tenantSlug:currentTenantSlug,isDemo:currentIsDemo\}\)\}/);
 assert.match(shell,/scopeKey=\{JSON.stringify\(\[currentEmail,currentRole,currentTenantSlug,currentIsDemo,currentPermissions,currentDeniedPermissions\]\)\}/);
 const bell=await readFile(new URL('../src/components/admin-notification-bell.tsx',import.meta.url),'utf8');assert.match(bell,/if \(!canReadNotifications\) return null/);assert.match(bell,/key=\{scopeKey\}/);assert.match(bell,/response.status===401 \|\| response.status===403/);assert.match(bell,/deniedRef.current=true/);
});
test('access notice carries no diagnostics, fetches, redirect service, tenant data or permission editor',async()=>{
 const notice=await readFile(new URL('../src/components/runtime-access-notice.tsx',import.meta.url),'utf8');assert.match(notice,/La página existe/);assert.match(notice,/No se consultaron datos del diagnóstico/);assert.doesNotMatch(notice,/fetch\(|useEffect|sessionStorage|localStorage|tenantSlug|sessionRole|endpointId|href="https?:/);
 assert.match(notice,/href="\/settings"/);assert.match(notice,/href="\/"/);
});
