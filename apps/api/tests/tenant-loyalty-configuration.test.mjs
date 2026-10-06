import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {parseConfigurationWrite,ConfigurationError,readConfiguration} from '../src/lib/tenant-loyalty-configuration.ts';
import {createConfigurationHandlers} from '../src/lib/tenant-loyalty-configuration-http.ts';
const base={kind:'program',action:'save_draft',id:randomUUID(),expectedRevision:null,operationId:randomUUID(),name:'',vertical:'wine',pointsName:'',pointsPerValidTap:null,cooldownSeconds:null,startAt:'2026-10-05T00:00:00Z',endAt:null};
test('draft does not fabricate points; zero publication remains zero',()=>{
  assert.equal(parseConfigurationWrite(base).fields.pointsPerValidTap,null);
  const p=parseConfigurationWrite({...base,action:'publish',expectedRevision:'2026-10-05 00:00:00.123456+00',name:'Club',pointsName:'Puntos',pointsPerValidTap:0,cooldownSeconds:0});
  assert.equal(p.fields.pointsPerValidTap,0);assert.equal(p.expectedRevision,'2026-10-05 00:00:00.123456+00');
});
test('publication requires stable draft, bounded explicit rules and valid dates',()=>{
  for(const patch of [{action:'publish'}, {pointsPerValidTap:10.2},{cooldownSeconds:-1},{startAt:'bad'},{endAt:'2020-01-01T00:00:00Z'},{operationId:'secret'},{expectedRevision:'2026-10-05'}])
    assert.throws(()=>parseConfigurationWrite({...base,...patch}),ConfigurationError);
});
test('services deny unknown/duplicate actions and client statuses',()=>{
  const profile={kind:'profile',action:'save_draft',expectedRevision:'2026-10-05 00:00:00+00',operationId:randomUUID(),allowedActions:[]};
  assert.deepEqual(parseConfigurationWrite(profile).fields.allowedActions,[]);
  for(const actions of [['lead','lead'],['owner'],['lead','SECRET']]) assert.throws(()=>parseConfigurationWrite({...profile,allowedActions:actions}),ConfigurationError);
});
test('quiz publish requires unique question ids/options and a valid correct answer',()=>{
  const quiz={...base,kind:'quiz',programId:randomUUID(),title:'Historia',description:'',startsAt:base.startAt,endsAt:null,questions:[],pointsPerCorrect:0,completionBonus:0,passThreshold:0};
  assert.equal(parseConfigurationWrite(quiz).fields.pointsPerCorrect,0);
  const published={...quiz,action:'publish',expectedRevision:'2026-10-05 00:00:00+00',questions:[{id:'q1',prompt:'Origen',options:['A','B'],correctIndex:0}]};
  assert.equal(parseConfigurationWrite(published).fields.pointsPerCorrect,0);
  for(const patch of [{questions:[]},{passThreshold:2},{questions:[{...published.questions[0],correctIndex:2}]},{questions:[{...published.questions[0],options:['A','A']}]},{questions:[published.questions[0],published.questions[0]]}])
    assert.throws(()=>parseConfigurationWrite({...published,...patch}),ConfigurationError);
});
test('permission denial happens before tenant/data reads and carries no-store',async()=>{
  let calls=0; const h=createConfigurationHandlers({authorize:async()=>Response.json({reason:'forbidden'},{status:403}),query:async()=>{calls++;throw Error('unexpected')} });
  for(const method of ['GET','POST']){const r=await h[method](new Request('https://api.example.invalid/admin/loyalty/configuration'));assert.equal(r.status,403);assert.match(r.headers.get('cache-control'),/no-store/)}
  assert.equal(calls,0);
});
test('operator tenant wins over a forged query and superadmin must choose an explicit tenant',async()=>{
  const tenantId=randomUUID(),userId=randomUUID(),calls=[];
  const principal={scope:'tenant_operator',tenantId,tenantSlug:'canonical-qa',userId};
  const h=createConfigurationHandlers({authorize:async()=>null,principal:()=>principal,query:async(strings,...values)=>{
    calls.push(values);const s=strings.join('?');
    if(s.includes('FROM public.tenants'))return [{id:tenantId,slug:'canonical-qa'}];
    if(s.includes('FROM tenant_sun_profiles'))return [{metadata:{},revision:'2026-10-05 00:00:00.123456+00'}];
    return [];
  }});
  const response=await h.GET(new Request('https://api.example.invalid/admin/loyalty/configuration?tenant=attacker'));
  assert.equal(response.status,200);assert.equal((await response.json()).tenant,'canonical-qa');assert(!calls.flat().includes('attacker'));
  principal.scope='super_admin';const n=calls.length;
  assert.equal((await h.GET(new Request('https://api.example.invalid/admin/loyalty/configuration'))).status,400);assert.equal(calls.length,n);
});
test('bounded configuration reads disclose truncation and retain independent services',async()=>{
  const calls=[];
  const c=await readConfiguration({id:randomUUID(),slug:'canonical-qa'},async(strings)=>{
    const s=strings.join('?');calls.push(s);
    if(s.includes('tenant_sun_profiles'))return [{metadata:{postTap:{version:'nexid.tenant-actions.v1',status:'published',allowedActions:['feedback']}},revision:'2026-10-05 00:00:00+00'}];
    if(s.includes('loyalty_programs'))return Array.from({length:101},(_,i)=>({id:String(i),rules_json:{},revision:'2026-10-05 00:00:00+00'}));
    return Array.from({length:301},(_,i)=>({id:String(i),product_filter_json:{},revision:'2026-10-05 00:00:00+00'}));
  });
  assert.equal(c.programs.length,100);assert.equal(c.quizzes.length,300);
  assert.deepEqual(c.limits,{programs:100,quizzes:300,programsTruncated:true,quizzesTruncated:true});
  assert.deepEqual(c.profile.allowedActions,['feedback']);assert(calls.some(s=>/LIMIT 101/.test(s)));assert(calls.some(s=>/LIMIT 301/.test(s)));
});
