import assert from "node:assert/strict";
import pg from "pg";
import { runCampaignDraftsPostgresQa } from "../tests/helpers/campaign-drafts-postgres-qa.mjs";

// Fixed disposable release branch, never the production endpoint. Credentials
// are injected in the subprocess; no .env file or connection URL is printed.
const endpoint = "ep-curly-fire-aixp1rdj";
const connection = new URL(process.env.CAMPAIGN_DRAFTS_QA_DATABASE_URL || "");
assert.equal(connection.hostname.split(".")[0], endpoint, "This validator only accepts the campaign release QA branch");
assert.equal(connection.pathname, "/neondb");
connection.searchParams.set("sslmode", "verify-full");
async function connect() {
  const client = new pg.Client({ connectionString: connection.toString(), connectionTimeoutMillis: 10000, query_timeout: 20000 });
  try {
    await client.connect();
    const target = (await client.query("SELECT current_setting('neon.endpoint_id', true) AS endpoint, current_database() AS database")).rows[0];
    assert.equal(target.endpoint, endpoint);
    assert.equal(target.database, "neondb");
    return client;
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }
}

let verifier;
try {
  verifier = await connect();
  const tenants = (await verifier.query("SELECT id, slug FROM public.tenants ORDER BY (slug = 'demobodega') DESC, id LIMIT 2")).rows;
  const actor = (await verifier.query("SELECT id FROM public.users ORDER BY id LIMIT 1")).rows[0];
  assert.equal(tenants.length, 2, "Two existing isolated-branch tenant fixtures are required");
  assert.ok(actor, "An existing isolated-branch user fixture is required");
  const result = await runCampaignDraftsPostgresQa({ connect, tenant: tenants[0], otherTenant: tenants[1], actor: { id: actor.id, label: "QA automatizado - sin envios" } });
  const audit = (await verifier.query("SELECT resource_id, action, before_hash, after_hash FROM public.audit_logs WHERE resource_type = 'campaign_draft' AND resource_id = ANY($1::text[]) ORDER BY action", [result.draftIds])).rows;
  const primary = audit.filter(row => row.resource_id === result.draftIds[0]);
  assert.equal(primary.length, 4, "Exactly create/edit/archive/restore are audited, not retries or rejected concurrent edits");
  assert.deepEqual(primary.map(row => row.action).sort(), ["campaign_draft_created", "campaign_draft_updated", "campaign_draft_archived", "campaign_draft_restored"].sort());
  assert.ok(primary.every(row => /^[a-f0-9]{64}$/.test(row.after_hash)));
  assert.ok(primary.filter(row => row.action !== "campaign_draft_created").every(row => /^[a-f0-9]{64}$/.test(row.before_hash)));
  const secondary = audit.filter(row => row.resource_id === result.draftIds[1]);
  assert.equal(secondary.length, 1);
  console.log(JSON.stringify({ ...result, endpoint, audit: { primaryChanges: 4, secondaryCreates: 1, hashesVerified: true }, syntheticDataOnly: true, productionWrites: false }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, endpoint, reason: String(error?.message || "campaign_drafts_qa_failed"), code: error?.code || null }));
  process.exitCode = 1;
} finally {
  await verifier?.end();
}
