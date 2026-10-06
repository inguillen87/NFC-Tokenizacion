import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
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
