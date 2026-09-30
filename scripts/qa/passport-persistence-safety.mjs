import assert from 'node:assert/strict';

export const API_SOURCE = '607fe4057458e4436982df2c08785e233b30b86f';
export const QA_CONFIRMATION = 'I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE';
const versions = new Map([['16.4', 160004], ['18.4', 180004]]);

/** This acceptance never discovers credentials or falls back to application settings. */
export function passportPersistenceConfig(env = process.env) {
  assert.equal(env.NODE_ENV, 'test', 'test_node_environment_required');
  assert.equal(env.VERCEL_ENV, 'test', 'test_vercel_environment_required');
  assert.equal(env.NEXID_E2E_CONFIRMATION, QA_CONFIRMATION, 'explicit_qa_confirmation_required');
  for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'NEON_DATABASE_URL']) {
    assert.ok(!env[key], 'application_database_configuration_not_allowed');
  }
  assert.equal(env.NEXID_EDITORIAL_API_SHA, API_SOURCE, 'paired_api_source_mismatch');
  assert.ok(versions.has(env.NEXID_E2E_EXPECTED_POSTGRES_VERSION), 'postgres_pin_required');
  assert.equal(typeof env.NEXID_E2E_DATABASE_URL, 'string', 'dedicated_qa_url_required');
  const url = new URL(env.NEXID_E2E_DATABASE_URL);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol), 'postgres_protocol_required');
  assert.equal(url.hostname, '127.0.0.1', 'literal_loopback_required');
  assert.equal(url.username, 'nexid_e2e', 'dedicated_qa_role_required');
  assert.equal(url.pathname, '/nexid_e2e_editorial', 'dedicated_qa_database_required');
  assert.ok(url.password, 'dedicated_qa_password_required');
  assert.ok(!url.search && !url.hash, 'connection_overrides_not_allowed');
  assert.ok(env.NEXID_EDITORIAL_API_ROOT, 'paired_api_checkout_required');
  return Object.freeze({
    databaseUrl: url.href,
    apiRoot: env.NEXID_EDITORIAL_API_ROOT,
    databaseName: 'nexid_e2e_editorial',
    databaseRole: 'nexid_e2e',
    expectedPostgresVersion: env.NEXID_E2E_EXPECTED_POSTGRES_VERSION,
    expectedServerVersionNumber: versions.get(env.NEXID_E2E_EXPECTED_POSTGRES_VERSION),
  });
}
