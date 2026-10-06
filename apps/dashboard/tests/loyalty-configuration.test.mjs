import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {buildConfigurationCommand, configurationDate, configurationErrorCopy, configurationReconciliation, configurationState, dateInput, explicitInteger, parseLoyaltyConfiguration} from '../src/lib/loyalty-configuration.ts';
import {requiredPermissionForAdminResource} from '../src/lib/permission-policy.ts';
import {canDemoSandboxAccess} from '../src/lib/admin-proxy-policy.ts';

const id='10000000-0000-4000-8000-000000000001',qid='20000000-0000-4000-8000-000000000001',op='30000000-0000-4000-8000-000000000001';
const revision='2026-10-05 12:34:56.123456+00';
const profile={revision,lastOperationId:null,status:'draft',allowedActions:[]};
const program={id,revision,lastOperationId:null,name:'Club QA',vertical:'wine',status:'paused',pointsName:'Puntos QA',pointsPerValidTap:0,cooldownSeconds:0,startAt:'2026-01-01T12:34:56.123Z',endAt:null};
const quiz={id:qid,revision,lastOperationId:null,programId:id,title:'Trivia QA',description:'',vertical:'wine',status:'draft',startsAt:'2026-01-01T00:00:00.000Z',endsAt:null,questions:[{id:'question-qa',prompt:'Elegí la respuesta.',options:['Primera','Segunda'],correctIndex:1,explanation:''}],pointsPerCorrect:0,completionBonus:0,passThreshold:0,managed:true};
const fields={name:program.name,vertical:'wine',pointsName:program.pointsName,pointsPerValidTap:0,cooldownSeconds:0,startAt:program.startAt,endAt:null};
const quizFields=()=>({...quiz});
const board=()=>({ok:true,tenant:'qa-tenant',profile,programs:[program],quizzes:[quiz]});

test('configuration BFF permissions declare GET/POST only and demo cannot access the editor',()=>{
 assert.equal(requiredPermissionForAdminResource('GET','loyalty/configuration'),'rewards:read');
 assert.equal(requiredPermissionForAdminResource('POST','loyalty/configuration'),'rewards:write');
 for(const method of ['PUT','PATCH','DELETE'])assert.equal(requiredPermissionForAdminResource(method,'loyalty/configuration'),null);
 assert.equal(canDemoSandboxAccess('POST','loyalty/configuration'),false);
 assert.equal(canDemoSandboxAccess('GET','loyalty/configuration'),false);
});
test('reads require exact canonical tenant and complete persisted identities without defaults',()=>{
 assert.deepEqual(parseLoyaltyConfiguration(board(),'qa-tenant'),board());
 assert.equal(parseLoyaltyConfiguration(board(),'other-tenant'),null);
 for(const patch of [{revision:''},{lastOperationId:'invalid'},{id:'missing'},{pointsPerValidTap:NaN}])assert.equal(parseLoyaltyConfiguration({...board(),programs:[{...program,...patch}]},'qa-tenant'),null);
 assert.equal(parseLoyaltyConfiguration({...board(),quizzes:[{...quiz,programId:'invalid'}]},'qa-tenant'),null);
 assert.equal(parseLoyaltyConfiguration({...board(),programs:[program,program]},'qa-tenant'),null);
 assert.equal(parseLoyaltyConfiguration({...board(),profile:{...profile,allowedActions:['all']}},'qa-tenant'),null);
});
test('read-only legacy quizzes retain existing 50-question policy and a program outside the bounded list never invalidates profile reads',()=>{
 const questions=Array.from({length:50},(_,i)=>({...quiz.questions[0],id:'legacy-'+i,options:Array.from({length:8},(_,j)=>'Option '+j)}));
 assert.ok(parseLoyaltyConfiguration({...board(),quizzes:[{...quiz,managed:false,questions,programId:op}]},'qa-tenant'));
 assert.equal(parseLoyaltyConfiguration({...board(),quizzes:[{...quiz,managed:true,questions}]},'qa-tenant'),null);
 assert.equal(parseLoyaltyConfiguration({...board(),quizzes:[{...quiz,managed:false,questions:[...questions,{...questions[0],id:'extra'}]}]},'qa-tenant'),null);
 assert.throws(()=>buildConfigurationCommand('quiz','save_draft',{...quiz,managed:false,questions},op,quizFields()),/configuration_unavailable/);
 const limits={programs:100,quizzes:300,programsTruncated:true,quizzesTruncated:false};
 assert.deepEqual(parseLoyaltyConfiguration({...board(),limits},'qa-tenant').limits,limits);
 assert.equal(parseLoyaltyConfiguration({...board(),limits:{...limits,programsTruncated:'yes'}},'qa-tenant'),null);
});
test('all four services persist explicitly and no campaign or promotion is emitted',()=>{
 const command=buildConfigurationCommand('profile','save_draft',profile,op,{allowedActions:['lead','feedback','sommelier','marketplace']});
 assert.deepEqual(command.allowedActions,['lead','feedback','sommelier','marketplace']);
 assert.equal(command.expectedRevision,revision);assert.equal(command.operationId,op);
 assert.throws(()=>buildConfigurationCommand('profile','publish',profile,op,{allowedActions:['promotions']}),/configuration_invalid/);
});
test('draft program rules may remain null but publication requires explicit bounded values, preserving zero',()=>{
 const draft=buildConfigurationCommand('program','save_draft',{...program,revision:''},op,{...fields,pointsPerValidTap:null,cooldownSeconds:null});
 assert.equal(draft.pointsPerValidTap,null);assert.equal(draft.cooldownSeconds,null);assert.equal(draft.expectedRevision,null);
 const publish=buildConfigurationCommand('program','publish',program,op,fields);
 assert.equal(publish.pointsPerValidTap,0);assert.equal(publish.cooldownSeconds,0);assert.equal(publish.expectedRevision,revision);
 for(const patch of [{pointsPerValidTap:null},{cooldownSeconds:null},{pointsPerValidTap:10001},{cooldownSeconds:604801},{startAt:null},{vertical:'unknown'}])assert.throws(()=>buildConfigurationCommand('program','publish',program,op,{...fields,...patch}),/configuration_invalid/);
 for(const value of ['', 'NaN', 'Infinity','-1','1.5','1e2'])assert.throws(()=>explicitInteger(value),/configuration_invalid/);
 assert.equal(explicitInteger('0'),0);
});
test('new resources must first be saved as drafts; active and archived content cannot be edited',()=>{
 assert.throws(()=>buildConfigurationCommand('program','publish',{...program,revision:''},op,fields),/configuration_invalid/);
 for(const status of ['active','archived'])for(const action of ['publish','save_draft'])assert.throws(()=>buildConfigurationCommand('program',action,{...program,status},op,fields),/configuration_active_edit/);
 assert.throws(()=>buildConfigurationCommand('profile','save_draft',{...profile,status:'published'},op,{allowedActions:[]}),/configuration_active_edit/);
});
test('withdraw sends identity/revision only and preserves existing program and quiz binding',()=>{
 for(const [kind,resource]of [['profile',{...profile,status:'published'}],['program',{...program,status:'active'}],['quiz',{...quiz,status:'active'}]]){
  const command=buildConfigurationCommand(kind,'withdraw',resource,op,{name:'must not send',questions:[]});
  assert.deepEqual(Object.keys(command).sort(),(kind==='profile'?['kind','action','operationId','expectedRevision']:['kind','action','operationId','expectedRevision','id']).sort());
  assert.equal(command.expectedRevision,revision);
 }
 assert.throws(()=>buildConfigurationCommand('quiz','save_draft',quiz,op,{...quizFields(),programId:op}),/configuration_invalid/);
 assert.throws(()=>buildConfigurationCommand('quiz','save_draft',{...quiz,managed:false},op,quizFields()),/configuration_unavailable/);
});
test('quiz drafts may be incomplete while publication checks questions, distinct options, answer and scoring',()=>{
 assert.equal(buildConfigurationCommand('quiz','save_draft',quiz,op,{...quizFields(),questions:[]}).questions.length,0);
 const saved=buildConfigurationCommand('quiz','publish',quiz,op,quizFields());
 assert.equal(saved.pointsPerCorrect,0);assert.equal(saved.completionBonus,0);assert.equal(saved.passThreshold,0);
 assert.throws(()=>buildConfigurationCommand('quiz','publish',quiz,op,{...quizFields(),pointsPerCorrect:1000000,completionBonus:1}),/configuration_invalid/);
 for(const patch of [{questions:[]},{questions:[{...quiz.questions[0],prompt:''}]},{questions:[{...quiz.questions[0],options:['Only']}]},{questions:[{...quiz.questions[0],options:['Same','Same']}]},{questions:[{...quiz.questions[0],correctIndex:2}]},{passThreshold:2},{pointsPerCorrect:1000001},{completionBonus:1000001},{startsAt:null}])assert.throws(()=>buildConfigurationCommand('quiz','publish',quiz,op,{...quizFields(),...patch}),/configuration_invalid/);
});
test('quiz limits and stable unique IDs apply even to drafts',()=>{
 for(const questions of [[quiz.questions[0],quiz.questions[0]],Array.from({length:13},(_,i)=>({...quiz.questions[0],id:'qa-'+i})),[{...quiz.questions[0],options:Array(7).fill('qa')}],[{...quiz.questions[0],id:'unsafe id'}]])assert.throws(()=>buildConfigurationCommand('quiz','save_draft',quiz,op,{...quizFields(),questions}),/configuration_invalid/);
});
test('date entry is explicit UTC and status separates publication from scheduled and ended availability',()=>{
 assert.equal(dateInput('2026-01-01T09:30:10.123-03:00'),'2026-01-01T12:30');
 assert.equal(configurationDate('2026-01-01T12:30'),'2026-01-01T12:30:00.000Z');
 assert.equal(configurationState({...program,status:'draft'}),'Borrador');
 assert.equal(configurationState(program),'Retirado');
 assert.equal(configurationState({...program,status:'active',startAt:'2099-01-01T00:00:00Z'},Date.parse('2026-01-01')),'Publicado · programado');
 assert.equal(configurationState({...program,status:'active',startAt:'2024-01-01T00:00:00Z',endAt:'2025-01-01T00:00:00Z'},Date.parse('2026-01-01')),'Publicado · finalizado');
 assert.throws(()=>buildConfigurationCommand('program','save_draft',program,op,{...fields,endAt:'2025-01-01T00:00:00Z'}),/configuration_invalid/);
});
test('error copy is actionable and never displays raw internal errors',()=>{
 assert.match(configurationErrorCopy('configuration_revision_conflict'),/formulario sigue aquí/);
 assert.match(configurationErrorCopy('configuration_active_edit'),/Retirá/);
 assert.match(configurationErrorCopy('configuration_profile_required'),/perfil de marca/);
 assert.match(configurationErrorCopy('configuration_forbidden'),/permiso/);
 assert.doesNotMatch(configurationErrorCopy('postgres_password_secret'),/postgres_password_secret/);
});
test('server page enforces canonical tenant, read permission, explicit denies and no demo fallback',async()=>{
 const page=await readFile(new URL('../src/app/(app)/loyalty/configuration/page.tsx',import.meta.url),'utf8');
 assert.match(page,/requireDashboardSession\("rewards:read"\)/);assert.match(page,/createAdminPageContext\(session, query.tenant\)/);
 assert.match(page,/!session.isDemo/);assert.match(page,/dashboardPermissionDenied/);assert.match(page,/parseLoyaltyConfiguration/);
 assert.doesNotMatch(page,/demo-tenant|demobodega|PRESET/);
});
test('uncertain writes reconcile by operation marker before exact retry and all post-tap scope links retain tenant',async()=>{
 const command=buildConfigurationCommand('quiz','save_draft',quiz,op,quizFields());
 assert.equal(configurationReconciliation({...quiz,lastOperationId:op,revision:'new opaque revision'},command),'confirmed');
 assert.equal(configurationReconciliation(quiz,command),'retry_allowed');
 assert.equal(configurationReconciliation({...quiz,revision:'another revision'},command),'changed');
 assert.equal(configurationReconciliation(null,command),'unavailable');
 assert.equal(configurationReconciliation(null,{...command,expectedRevision:null}),'retry_allowed');
 const component=await readFile(new URL('../src/components/loyalty-configuration-workspace.tsx',import.meta.url),'utf8');
 assert.match(component,/configurationReconciliation\(saved, pending\) === "confirmed"/);
 assert.match(component,/JSON.stringify\(command\)/);assert.match(component,/send\(pending.action, pending\)/);
 assert.match(component,/configurationReconciliation\(reviewed, pending\) === "retry_allowed"/);assert.match(component,/lock.current = true/);
 assert.match(component,/resource.revision \|\| dirty/);assert.match(component,/fields.start === dateInput\(savedStart\) \? savedStart/);
 assert.match(component,/disabled=\{q.correctIndex === optionIndex\}/);
 for(const path of ['../src/app/(app)/loyalty/page.tsx','../src/app/(app)/loyalty/overview/page.tsx'])assert.match(await readFile(new URL(path,import.meta.url),'utf8'),/loyalty\/configuration.*new URLSearchParams\(\{ tenant: tenantScope \}\)/);
});
