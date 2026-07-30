import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  TAG_LIFECYCLE_STATES,
  evaluateTagLifecycleTransition,
  lifecycleResultOverride,
  operationalStatusForLifecycle,
} from "../src/lib/tag-lifecycle.ts";

const migration = await readFile(
  new URL("../db/migrations/20260728180000_0066_tag_lifecycle_governance.sql", import.meta.url),
  "utf8",
);
const route = await readFile(
  new URL("../src/app/admin/tags/[uid]/status/route.ts", import.meta.url),
  "utf8",
);
const service = await readFile(new URL("../src/lib/sun-service.ts", import.meta.url), "utf8");
const persistence = await readFile(
  new URL("../src/lib/sun-atomic-persistence.ts", import.meta.url),
  "utf8",
);

test("tag lifecycle is an explicit irreversible-by-default state machine", () => {
  assert.deepEqual(TAG_LIFECYCLE_STATES, [
    "inactive", "active", "suspended", "quarantined", "lost",
    "expired", "broken", "tampered", "revoked",
  ]);
  assert.equal(evaluateTagLifecycleTransition("inactive", "active").ok, true);
  assert.equal(evaluateTagLifecycleTransition("active", "tampered").ok, true);
  assert.equal(evaluateTagLifecycleTransition("lost", "active").ok, false);
  assert.equal(evaluateTagLifecycleTransition("revoked", "active").ok, false);
  assert.equal(evaluateTagLifecycleTransition("active", "active").ok, false);
});

test("business lifecycle maps to the legacy operational enum without weakening it", () => {
  assert.equal(operationalStatusForLifecycle("active"), "active");
  assert.equal(operationalStatusForLifecycle("revoked"), "revoked");
  for (const state of ["inactive", "suspended", "quarantined", "lost", "expired", "broken", "tampered"]) {
    assert.equal(operationalStatusForLifecycle(state), "inactive");
  }
  assert.equal(lifecycleResultOverride("revoked"), "REVOKED");
  assert.equal(lifecycleResultOverride("broken"), "BROKEN");
  assert.equal(lifecycleResultOverride("tampered"), "TAMPER_RISK");
  assert.equal(lifecycleResultOverride("active"), null);
});

test("0066 makes transitions tenant-scoped, compare-and-swap and idempotency-bound", () => {
  assert.match(migration, /UNIQUE \(tenant_id, operation_key\)/);
  assert.match(migration, /UNIQUE \(tag_id, lifecycle_revision\)/);
  assert.match(migration, /request_fingerprint[\s\S]*tag_lifecycle_idempotency_conflict/);
  assert.match(migration, /batch\.tenant_id = v_tenant_id/);
  assert.match(migration, /FOR UPDATE OF tag/);
  assert.match(migration, /v_current_revision <> v_expected_revision/);
  assert.match(migration, /pg_advisory_xact_lock[\s\S]*tag-lifecycle:/);
  assert.match(migration, /membership\.role::text = 'tenant_admin'[\s\S]*membership\.tenant_id = v_tenant_id/);
  assert.match(migration, /tags_lifecycle_operational_status_check/);
  assert.match(migration, /tag_lifecycle_supplier_activation_gate_failed/);
  assert.match(migration, /count\(\*\) > 0[\s\S]*bool_and/);
  assert.match(migration, /sub_batch\.qa_status = 'passed'/);
  assert.doesNotMatch(migration, /sub_batch\.qa_status = 'approved'/);
  assert.match(migration, /v_supplier_gate_ok IS DISTINCT FROM TRUE/);
  assert.match(migration, /trg_tag_lifecycle_history_append_only/);
});

test("0066 tightens SUN inside the existing atomic transaction and preserves physical evidence precedence", () => {
  const rename = migration.indexOf("RENAME TO nexid_persist_sun_scan_v1_base_0062");
  const wrapper = migration.indexOf("CREATE OR REPLACE FUNCTION public.nexid_persist_sun_scan_v1", rename);
  const baseCall = migration.indexOf("nexid_persist_sun_scan_v1_base_0062(p_input)", wrapper);
  const lifecycleRead = migration.indexOf("COALESCE(tag.lifecycle_state, tag.status::text)", baseCall);
  const eventUpdate = migration.indexOf("UPDATE events event", lifecycleRead);
  assert.ok(rename >= 0 && wrapper > rename && baseCall > wrapper);
  assert.ok(lifecycleRead > baseCall && eventUpdate > lifecycleRead);
  assert.match(migration, /NOT v_receipt\.replay_suspect/);
  assert.match(migration, /UPPER\(COALESCE\(v_receipt\.final_result, ''\)\) <> 'TAMPER_RISK'/);
  assert.match(migration, /tag_lifecycle_state[\s\S]*tag_lifecycle_revision/);
  assert.match(migration, /WHERE event\.id = v_receipt\.event_id\s+AND event\.created_at = v_receipt\.created_at/);
  assert.doesNotMatch(migration, /SET\s+(meta_key_ct|file_key_ct)|UPDATE\s+batches/i);
});

test("admin lifecycle API is bounded, authorized, tenant-scoped and receipt-driven", () => {
  assert.match(route, /checkAdmin\(req, \["super_admin", "tenant_admin"\]\)/g);
  assert.match(route, /checkAdminPermission\(req, "tags:read"\)/);
  assert.match(route, /checkAdminPermission\(req, "tags:write"\)/);
  assert.match(route, /readBoundedJsonBody\(req, MAX_BODY_BYTES\)/);
  assert.match(route, /idempotency-key/);
  assert.match(route, /expected_revision/);
  assert.match(route, /hashEvidencePayload/);
  assert.match(route, /nexid_transition_tag_lifecycle_v1/);
  assert.match(route, /batch\.tenant_id = \$\{tenantId\}::uuid/);
  assert.doesNotMatch(route, /UPDATE\s+tags|DELETE\s+FROM\s+tag_lifecycle_events/i);
});

test("persistent SUN response consumes canonical lifecycle receipt", () => {
  assert.match(persistence, /tagLifecycleState: nullableText\(row\.tag_lifecycle_state\)/);
  assert.match(persistence, /tagLifecycleRevision: tagLifecycleRevision \?\? 0/);
  assert.match(service, /tagLifecycleState = receipt\.tagLifecycleState \|\| tagLifecycleState/);
  assert.match(service, /tagLifecycleRevision = receipt\.tagLifecycleRevision/);
  assert.match(service, /normalizedLifecycleState = normalizeTagLifecycleState\(tagLifecycleState \|\| tagStatus\)/);
  assert.match(service, /lifecycle_evidence_boundary:/);
});
