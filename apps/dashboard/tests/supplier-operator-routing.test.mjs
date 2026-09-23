import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { supplierOperatorPermissions, supplierOperatorPageAllowed, isSupplierOperator, SUPPLIER_OPERATOR_HOME } from '../src/lib/supplier-operator-access.ts';
import { normalizeDashboardReturnPath } from '../src/lib/dashboard-return-path.ts';
import { dashboardPermissionMatches } from '../src/lib/permission-policy.ts';

// Run actual handlers with imports removed and explicit synthetic I/O boundaries.
async function load(path,bindings={},onlyFunction){
 const source=await readFile(new URL(path,import.meta.url),'utf8');
 const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const nodes=ast.statements.filter(node=>onlyFunction?ts.isFunctionDeclaration(node)&&node.name?.text===onlyFunction:!ts.isImportDeclaration(node));
 const printer=ts.createPrinter();
 const code=ts.transpileModule(nodes.map(node=>printer.printNode(ts.EmitHint.Unspecified,node,ast)).join('\n'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('exports',...Object.keys(bindings),code)(exports,...Object.values(bindings));return exports;
}
const operator={id:'session',userId:'20000000-0000-4000-8000-000000000001',role:'supplier-operator',tenantId:null,tenantSlug:null,permissions:['*','supplier_request.assigned.read','supplier_request.assigned.review'],isDemo:false};
const privateDenied=response=>{assert.equal(response.status,403);assert.match(response.headers.get('cache-control'),/private.*no-store/);};

test('standalone AI BFFs refuse operator before consuming a body or contacting any provider',async()=>{
 for(const path of ['assistant/chat','realtime/session','cognitive-ai']){
  let providers=0;
  const route=await load(`../src/app/api/${path}/route.ts`,{NextResponse:Response,getDashboardSession:async()=>operator,fetch:async()=>{providers++;throw Error('unexpected real boundary');},process:{env:{NODE_ENV:'production'}}});
  const request=new Request('https://dashboard.invalid/api/'+path,{method:'POST',headers:{origin:'https://dashboard.invalid','content-type':'application/json'},body:'not even parsed'});
  privateDenied(await route.POST(request));assert.equal(request.bodyUsed,false);assert.equal(providers,0);
  if(route.GET)privateDenied(await route.GET());
 }
});

test('generic IAM and admin proxy refuse operator before forwarding any credential',async()=>{
 let providers=0,cookieReads=0;
 const proxy=await load('../src/lib/api-proxy.ts',{getDashboardSessionCredential:async()=>({session:operator,bearerToken:'PRIVATE'}),cookies:async()=>{cookieReads++;return {get:()=>({value:'PRIVATE'})};},DASHBOARD_SESSION_COOKIE:'session',dashboardFetch:async()=>{providers++;throw Error('unexpected provider');},process:{env:{}}});
 for(const path of ['/admin/users','/admin/rbac/roles','/superadmin/tenants'])privateDenied(await proxy.proxyToApi(path));
 assert.equal(providers,0);assert.equal(cookieReads,0);
});

test('SSR redirects other operator pages without trusting broad grants',async()=>{
 for(const path of ['/','/users','/batches','/supplier-orders/create','/reports']){
  const route=await load('../src/lib/session.ts',{getDashboardRequestReturnPath:async()=>path,getDashboardSession:async()=>operator,isDashboardSessionUpstreamUnavailable:()=>false,dashboardAuthPath:()=>'/login',isSupplierOperator,supplierOperatorPageAllowed,SUPPLIER_OPERATOR_HOME,dashboardPermissionMatches,redirect:value=>{throw new Error('redirect:'+value);}},'requireDashboardSession');
  await assert.rejects(route.requireDashboardSession(),{message:'redirect:/supplier-orders/requests'});
 }
 const route=await load('../src/lib/session.ts',{getDashboardRequestReturnPath:async()=>SUPPLIER_OPERATOR_HOME,getDashboardSession:async()=>operator,isDashboardSessionUpstreamUnavailable:()=>false,dashboardAuthPath:()=>'/login',isSupplierOperator,supplierOperatorPageAllowed,SUPPLIER_OPERATOR_HOME,dashboardPermissionMatches,redirect:()=>{throw Error('unexpected redirect');}},'requireDashboardSession');
 assert.equal(await route.requireDashboardSession(),operator);
});

test('Clerk bridge preserves the API-approved operator role and constrains its return path',async()=>{
 let body={ok:true,role:'supplier-operator',sessionToken:'opaque.synthetic',email:'synthetic@example.invalid',permissions:['*','users:manage','supplier_request.assigned.read'],tenantId:null,tenantSlug:null};
 const cookieWrites=[];
 class MockResponse extends Response {constructor(data,init){super(data,init);this.cookies={set:(...args)=>cookieWrites.push(args),delete:()=>{}};}static redirect(url,status){return new MockResponse(null,{status,headers:{location:String(url)}});}}
 const bindings={NextResponse:MockResponse,auth:async()=>({userId:'clerk_synthetic',getToken:async()=>'synthetic_clerk_token'}),currentUser:async()=>({id:'clerk_synthetic',emailAddresses:[{id:'email',emailAddress:'synthetic@example.invalid',verification:{status:'verified'}}],primaryEmailAddressId:'email'}),isClerkConfiguredForRuntime:()=>true,DASHBOARD_CLERK_AUTOSYNC_BLOCK_COOKIE:'block',DASHBOARD_SESSION_COOKIE:'session',DASHBOARD_SESSION_SNAPSHOT_COOKIE:'snapshot',normalizeDashboardReturnPath,dashboardFetch:async()=>Response.json(body),supplierOperatorPermissions,supplierOperatorPageAllowed,SUPPLIER_OPERATOR_HOME,process:{env:{NODE_ENV:'production'}}};
 const route=await load('../src/app/auth/clerk/super-admin/route.ts',bindings);
 const response=await route.GET(new Request('https://dashboard.invalid/auth/clerk/super-admin?next=/users'));
 assert.equal(response.headers.get('location'),'https://dashboard.invalid/supplier-orders/requests');assert.match(response.headers.get('cache-control'),/private.*no-store/);
 const snapshot=JSON.parse(Buffer.from(cookieWrites.find(item=>item[0]==='snapshot')[1],'base64url').toString('utf8'));
 assert.equal(snapshot.role,'supplier-operator');assert.deepEqual(snapshot.permissions,['supplier_request.assigned.read']);assert.equal(cookieWrites[0][2].httpOnly,true);
 for(const patch of [{tenantSlug:'foreign'},{tenantId:'10000000-0000-4000-8000-000000000001'},{role:'tenant-admin'}]){const count=cookieWrites.length;const old=body;body={...old,...patch};const denied=await route.GET(new Request('https://dashboard.invalid/auth/clerk/super-admin'));assert.match(denied.headers.get('location'),/login\?auth_error=clerk_sync_failed/);assert.equal(cookieWrites.length,count);body=old;}
});
