import test from "node:test";
import assert from "node:assert/strict";

import { E2E_MUTATION_CONFIRMATION, readE2eSimulationConfig } from "../scripts/lib/e2e-simulation-safety.mjs";

const validLocal = {
  E2E_TARGET: "local",
  E2E_ALLOW_MUTATION: E2E_MUTATION_CONFIRMATION,
  E2E_API_BASE: "http://127.0.0.1:3000",
  E2E_DATABASE_URL: "postgresql://nexid:test@localhost:5432/nexid_e2e",
  E2E_DATABASE_HOST_ALLOWLIST: "localhost",
  E2E_ADMIN_SESSION_TOKEN: "local-e2e-admin-session-token",
};

test("E2E harness fails closed when explicit configuration is absent", () => {
  assert.throws(() => readE2eSimulationConfig({}), /E2E_TARGET is required/);
});

test("E2E harness rejects production even with mutation consent", () => {
  assert.throws(
    () => readE2eSimulationConfig({ ...validLocal, E2E_TARGET: "staging", E2E_API_BASE: "https://api.nexid.lat" }),
    /Refusing to run destructive E2E against production host api\.nexid\.lat/,
  );
});

test("E2E harness rejects a database outside the explicit host allowlist", () => {
  assert.throws(
    () => readE2eSimulationConfig({ ...validLocal, E2E_DATABASE_URL: "postgresql://nexid:test@prod-db.example.com:5432/nexid" }),
    /is not present in E2E_DATABASE_HOST_ALLOWLIST/,
  );
});

test("E2E harness accepts an explicit loopback test target", () => {
  const config = readE2eSimulationConfig(validLocal);
  assert.equal(config.target, "local");
  assert.equal(config.apiBase, "http://127.0.0.1:3000");
  assert.equal(config.adminSessionToken, "local-e2e-admin-session-token");
});

test("E2E harness accepts an explicitly allowlisted HTTPS staging target", () => {
  const config = readE2eSimulationConfig({
    ...validLocal,
    E2E_TARGET: "staging",
    E2E_API_BASE: "https://staging-api.nexid.lat/",
    E2E_DATABASE_URL: "postgresql://nexid:test@ep-e2e-branch.us-east-2.aws.neon.tech/nexid",
    E2E_DATABASE_HOST_ALLOWLIST: "ep-e2e-branch.us-east-2.aws.neon.tech",
  });
  assert.equal(config.target, "staging");
  assert.equal(config.apiBase, "https://staging-api.nexid.lat");
});
