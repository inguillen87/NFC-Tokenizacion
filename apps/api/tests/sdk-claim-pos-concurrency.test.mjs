import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const route = readFileSync("apps/api/src/app/api/v1/sdk/claim/route.ts", "utf8");

test("sdk claim atomically consumes a POS token with lead and claim creation", () => {
  const statementStart = route.indexOf("WITH claim_ids AS MATERIALIZED");
  const statementEnd = route.indexOf("const persistedClaim", statementStart);
  assert.notEqual(statementStart, -1, "atomic claim statement is missing");
  assert.notEqual(statementEnd, -1, "atomic claim result guard is missing");

  const statement = route.slice(statementStart, statementEnd);
  assert.equal(route.match(/UPDATE sdk_pos_activations/g)?.length, 1, "POS consumption must have one authoritative update");
  assert.match(statement, /consumed_pos AS \(\s*UPDATE sdk_pos_activations activation/);
  assert.match(statement, /claim_request_id = claim_ids\.claim_id/);
  assert.match(statement, /activation\.id = \$\{posActivationId \|\| null\}/);
  assert.match(statement, /activation\.tenant_id = \$\{auth\.context\.tenantId\}/);
  assert.match(statement, /activation\.bid = \$\{bid\}/);
  assert.match(statement, /activation\.tag_id = \$\{clean\(row\.tag_id\) \|\| null\}/);
  assert.match(statement, /activation\.pos_token_hash = \$\{hashSdkApiKey\(posToken\)\}/);
  assert.match(statement, /activation\.activation_status = 'active'/);
  assert.match(statement, /activation\.claim_request_id IS NULL/);
  assert.match(statement, /activation\.expires_at IS NULL OR activation\.expires_at > now\(\)/);
  assert.match(statement, /UPPER\(activation\.uid_hex\) = UPPER\(\$\{uidHex\}\)/);
  assert.doesNotMatch(statement, /activation\.uid_hex IS NULL|activation\.tag_id IS NULL/);
  assert.match(statement, /RETURNING activation\.id/);

  assert.match(statement, /claim_gate AS \([\s\S]*LEFT JOIN consumed_pos ON true[\s\S]*WHERE \$\{posToken\} = '' OR consumed_pos\.id IS NOT NULL/);
  assert.match(statement, /created_lead AS \(\s*INSERT INTO leads[\s\S]*FROM claim_gate\s*RETURNING id/);
  assert.match(statement, /created_claim AS \(\s*INSERT INTO sdk_claim_requests[\s\S]*FROM claim_gate\s*JOIN created_lead/);
  assert.ok(statement.indexOf("consumed_pos AS") < statement.indexOf("created_lead AS"));
  assert.ok(statement.indexOf("created_lead AS") < statement.indexOf("created_claim AS"));
});

test("sdk claim fails closed when another request consumes the POS token first", () => {
  const conflictGuard = route.indexOf("if (!persistedClaim && posToken)");
  const persistenceGuard = route.indexOf("if (!persistedClaim)", conflictGuard + 1);
  const webhookDispatch = route.indexOf("await enqueueSdkWebhookGuaranteed", conflictGuard);

  assert.notEqual(conflictGuard, -1, "concurrent-consumption guard is missing");
  assert.ok(persistenceGuard > conflictGuard, "generic persistence guard must follow the POS conflict guard");
  assert.ok(webhookDispatch > persistenceGuard, "webhooks must run only after persistence succeeds");

  const conflictPath = route.slice(conflictGuard, persistenceGuard);
  assert.match(conflictPath, /statusCode: 409/);
  assert.match(conflictPath, /reason: "pos_token_invalid_or_consumed"/);
  assert.match(conflictPath, /\}, 409\)/);
  assert.match(route, /const claimId = String\(persistedClaim\.id/);
  assert.match(route, /const leadId = String\(persistedClaim\.lead_id/);
});
