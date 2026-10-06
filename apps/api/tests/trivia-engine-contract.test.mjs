import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import ts from 'typescript';
import {createHash} from 'node:crypto';
import { getTriviaForTap, submitTriviaForTap, publicTriviaQuestion, quizRevision } from '../src/lib/trivia-service.ts';
import { installEphemeralE2eSqlExecutor } from '../src/lib/db.ts';

const service = readFileSync(new URL('../src/lib/trivia-service.ts', import.meta.url), "utf8");
const migration = readFileSync(new URL('../db/migrations/20260625113000_0036_loyalty_trivia_engine.sql', import.meta.url), "utf8");

test("trivia schema persists quiz definitions and attempts", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS loyalty_quizzes/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS loyalty_quiz_attempts/);
  assert.match(migration, /idempotency_key text UNIQUE/);
  assert.match(migration, /idx_loyalty_quiz_attempts_tenant_created/);
});

test("public trivia payload does not expose the answer key", () => {
  const question=publicTriviaQuestion({id:'q1',prompt:'Question',options:['A','B'],correctIndex:0,explanation:'Explanation',insightTag:'fixture'});
  assert.deepEqual(question.options,['A','B']);assert.equal(question.prompt,'Question');assert.equal(Object.hasOwn(question,'correctIndex'),false);
});

test("opaque quiz revisions preserve object-order equivalence and change with the scoring contract", () => {
  const program={id:'program',status:'active',rules_json:{pointsPerValidTap:0,cooldownSeconds:0}};
  const quiz={id:'quiz',tenant_id:'tenant',program_id:'program',points_per_correct:0,completion_bonus:0,questions_json:[{id:'q1',options:['A','B'],correctIndex:0}]};
  const revision=quizRevision(quiz,program);assert.match(revision,/^[0-9a-f]{64}$/);
  assert.equal(quizRevision({...quiz,questions_json:[{correctIndex:0,options:['A','B'],id:'q1'}]},program),revision);
  assert.notEqual(quizRevision({...quiz,points_per_correct:10},program),revision);
  assert.notEqual(quizRevision(quiz,{...program,status:'paused'}),revision);
});

test("only explicit previews simulate; invalid IDs and missing expected revision cannot read or write storage", async () => {
  let calls=0;const remove=installEphemeralE2eSqlExecutor(async()=>{calls++;throw new Error('Unexpected database call');},{NODE_ENV:'test',VERCEL_ENV:'test',NEXID_E2E_CONFIRMATION:'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE',NEXID_E2E_DATABASE_URL:'postgresql://nexid_e2e:synthetic@127.0.0.1/nexid_e2e_trivia'});
  try {
    const preview=await getTriviaForTap({eventId:'preview:read-only',memberKey:'preview'});assert.equal(preview.preview,true);
    assert.equal((await getTriviaForTap({eventId:'arbitrary-text',memberKey:'bad'})).error,'invalid_event_id');
    assert.equal((await submitTriviaForTap({eventId:'900001',memberKey:'consumer',consumerId:'00000000-0000-0000-0000-000000000101',answers:[0]})).error,'quiz_configuration_changed');
    for(const answers of [[null],[{questionId:'q1',answerIndex:null}],[{questionId:'q1',answerIndex:'0'}]]) assert.equal((await submitTriviaForTap({eventId:'900001',memberKey:'consumer',consumerId:'00000000-0000-0000-0000-000000000101',answers})).error,'invalid_trivia_answers');
    assert.equal(calls,0);
  }finally{remove();}
});

test("trivia copy stays clean spanish without mojibake", () => {
  assert.doesNotMatch(service, /Ã|Â|�/);
  assert.match(service, /¿Qué dato confirma mejor/);
  assert.match(service, /campañas por cercanía/);
});

function readSetupFixture({consumerStatus='registered',membershipStatus='active'}={}) {
  const tenantId='00000000-0000-4000-8000-000000000101',consumerId='00000000-0000-4000-8000-000000000102',programId='00000000-0000-4000-8000-000000000103';
  const queries=[];
  const event={id:'900001',tenant_id:tenantId};
  const program={id:programId,tenant_id:tenantId,status:'active',vertical:'wine',rules_json:{pointsPerValidTap:0,cooldownSeconds:0}};
  const quiz={id:'00000000-0000-4000-8000-000000000104',tenant_id:tenantId,program_id:programId,status:'active',title:'Configured quiz',questions_json:[{id:'q1',prompt:'Choice',options:['A','B'],correctIndex:0}],points_per_correct:0,completion_bonus:0,pass_threshold:0};
  const member={id:'00000000-0000-4000-8000-000000000105',tenant_id:tenantId,program_id:programId,consumer_id:consumerId,status:'enrolled',points_balance:0};
  const query=async(strings,...values)=>{
    const statement=strings.join('?');queries.push({statement,values});
    assert.doesNotMatch(statement,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER)\b/i,'Quiz setup must remain read-only');
    if(/JOIN tenants ten/.test(statement))return[{id:event.id,tenant_id:tenantId,tenant_slug:'fixture',tenant_name:'Fixture',vertical:'wine',product_name:'Fixture product',winery:'Fixture brand'}];
    if(/FROM loyalty_quizzes/.test(statement))return[quiz];
    if(/FROM loyalty_members/.test(statement)){
      assert.deepEqual(values,[tenantId,programId,consumerId]);
      const allowed=/consumer\.status\s+IN\s*\(([^)]+)\)/i.exec(statement)?.[1].match(/'[^']+'/g)?.map(value=>value.slice(1,-1));
      const membershipGuard=/NOT EXISTS\s*\([\s\S]*FROM tenant_consumer_memberships[\s\S]*membership\.status IS DISTINCT FROM 'active'/i.test(statement);
      if(allowed&&!allowed.includes(consumerStatus)||membershipGuard&&membershipStatus!==null&&membershipStatus!=='active')return[];
      return[member];
    }
    if(/FROM loyalty_quiz_attempts/.test(statement))return[];
    throw Error('Unexpected read-only quiz setup query');
  };
  const code=ts.transpileModule(service,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const modules={
    'node:crypto':{createHash},'./db':{sql:query},
    './loyalty-service':{getTapEvent:async()=>event,getActiveProgram:async()=>program},
    './tap-commercial-rights':{readCurrentTapCommercialRights:async()=>({allowed:true})},
    './commercial-runtime-schema':{ensureConsumerPortalSchema:async()=>{throw Error('GET must not initialize or enroll');}},
    './loyalty-tap-policy':{isCurrentLoyaltyTapEligible:()=>true,LOYALTY_TAP_RESULTS:new Set(['VALID_CLOSED'])},
  };
  const module={exports:{}};
  new Function('require','module','exports',code)(name=>{assert.ok(Object.hasOwn(modules,name),name);return modules[name]},module,module.exports);
  return {queries,read:()=>module.exports.getTriviaForTap({eventId:event.id,memberKey:`consumer:${consumerId}`,consumerId})};
}

test('actual trivia setup GET keeps all supported account statuses readable with active membership and hides answer keys',async()=>{
  for(const consumerStatus of ['anonymous','registered','verified']){
    const fixture=readSetupFixture({consumerStatus});const result=await fixture.read();
    assert.equal(result.ok,true);assert.equal(result.quiz.pointsPerCorrect,0);assert.equal(result.quiz.questions.length,1);
    assert.equal(Object.hasOwn(result.quiz.questions[0],'correctIndex'),false);
  }
});

test('actual trivia setup GET preserves an absent membership without creating or enrolling it',async()=>{
  const fixture=readSetupFixture({membershipStatus:null});assert.equal((await fixture.read()).ok,true);
  assert.equal(fixture.queries.length,4);
});

test('actual trivia setup GET denies each existing nonactive membership without returning quiz or reading attempts',async()=>{
  for(const membershipStatus of ['invited','paused','blocked','left']){
    const fixture=readSetupFixture({membershipStatus});assert.deepEqual(await fixture.read(),{ok:false,status:409,error:'consumer_not_enrolled'});
    assert.equal(fixture.queries.length,3);
  }
});

test('actual trivia setup GET denies blocked or deleted accounts without returning quiz or reading attempts',async()=>{
  for(const consumerStatus of ['blocked','deleted']){
    const fixture=readSetupFixture({consumerStatus});assert.deepEqual(await fixture.read(),{ok:false,status:409,error:'consumer_not_enrolled'});
    assert.equal(fixture.queries.length,3);
  }
});

test('trivia setup GET scopes account and membership gates to the canonical member without a stored session alias',async()=>{
  const fixture=readSetupFixture();await fixture.read();const memberQuery=fixture.queries.find(row=>/FROM loyalty_members/.test(row.statement)).statement;
  assert.match(memberQuery,/consumer\.id = member\.consumer_id/);
  assert.match(memberQuery,/membership\.tenant_id = member\.tenant_id/);
  assert.match(memberQuery,/membership\.consumer_id = member\.consumer_id/);
  assert.doesNotMatch(memberQuery,/session_revoked_at/);
});
