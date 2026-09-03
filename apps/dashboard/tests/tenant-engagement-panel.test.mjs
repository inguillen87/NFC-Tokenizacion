import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseTenantEngagementPayload,
  readableEngagementEvent,
} from "../src/lib/tenant-engagement-view.ts";
import { requiredPermissionForAdminResource } from "../src/lib/permission-policy.ts";

function activity(overrides = {}) {
  return {
    id: "public-experience:1",
    domain: "content",
    stage: "VIEWED",
    occurredAt: "2026-09-03T17:30:00.000Z",
    dataMode: "real",
    sourceEventType: "TECHNICAL_SHEET_VIEWED",
    actor: {
      state: "anonymous",
      consumerId: null,
      contactable: false,
      consentChannels: [],
    },
    unit: {
      bid: "RA-2407",
      batchId: "batch-1",
      tagId: "tag-1",
      sourceTapEventId: "42",
      isActorIdentity: false,
    },
    provenance: {
      sourceKind: "public_experience_event",
      recordType: "sdk_external_events",
      recordId: "1",
      evidence: "client_reported_action",
      auditId: "audit-1",
      traceId: "trace-1",
      tenantScope: "server_derived",
      idempotency: {
        status: "recorded",
        key: "idem-1",
        requestFingerprint: "fingerprint-1",
      },
    },
    ...overrides,
  };
}

function payload(items, overrides = {}) {
  return {
    ok: true,
    scope: {
      tenant: { id: "tenant-1", slug: "demobodega", name: "Bodega Balmec" },
      range: "24h",
      domain: "all",
      stage: "all",
      source: "all",
      limit: 120,
    },
    taxonomy: { version: "nexid-post-tap-engagement-v1" },
    totals: { matched: items.length, returned: items.length, truncated: false },
    items,
    boundaries: {
      actor: "A UID, tag or tap is never treated as a person.",
      source: "Sources remain separated.",
      confirmed: "Confirmed means durably recorded by the source.",
    },
    ...overrides,
  };
}

test("engagement crosses the dashboard BFF only with crm:read", () => {
  assert.equal(requiredPermissionForAdminResource("GET", "engagement"), "crm:read");
  assert.equal(requiredPermissionForAdminResource("POST", "engagement"), null);
});

test("normalizes tenant-scoped activity and derives truthful visible counts", () => {
  const parsed = parseTenantEngagementPayload(payload([
    activity(),
    activity({
      id: "warranty:2",
      domain: "warranty",
      stage: "CONFIRMED",
      dataMode: "imported",
      sourceEventType: "WARRANTY_REGISTERED",
      actor: {
        state: "contactable_consumer",
        consumerId: "consumer-secret-reference",
        contactable: true,
        consentChannels: ["whatsapp"],
      },
    }),
  ]), "demobodega");

  assert.ok(parsed);
  assert.equal(parsed.matched, 2);
  assert.equal(parsed.counts.byDomain.content, 1);
  assert.equal(parsed.counts.byDomain.warranty, 1);
  assert.equal(parsed.counts.byStage.CONFIRMED, 1);
  assert.equal(parsed.counts.bySource.real, 1);
  assert.equal(parsed.counts.bySource.imported, 1);
  assert.equal(parsed.counts.contactable, 1);
  assert.deepEqual(parsed.activities[1].consentChannels, ["whatsapp"]);
  assert.equal("consumerId" in parsed.activities[1], false);
  assert.equal(parsed.activities[0].unit.bid, "RA-2407");
});

test("never enables contact without both explicit consent and the contactable actor state", () => {
  const missingConsent = activity({
    actor: {
      state: "contactable_consumer",
      consumerId: "consumer-1",
      contactable: true,
      consentChannels: [],
    },
  });
  const conflictingState = activity({
    id: "content:2",
    actor: {
      state: "linked_without_contact_consent",
      consumerId: "consumer-2",
      contactable: true,
      consentChannels: ["email"],
    },
  });
  const parsed = parseTenantEngagementPayload(payload([missingConsent, conflictingState]), "demobodega");

  assert.ok(parsed);
  assert.equal(parsed.counts.contactable, 0);
  assert.deepEqual(parsed.activities.map((item) => item.consentChannels), [[], []]);
});

test("fails closed on cross-tenant, unknown-source or identity-confused payloads", () => {
  assert.equal(parseTenantEngagementPayload(payload([activity()]), "otro-tenant"), null);
  assert.equal(parseTenantEngagementPayload(payload([activity({ dataMode: "synthetic" })]), "demobodega"), null);
  assert.equal(parseTenantEngagementPayload(payload([activity({
    unit: {
      bid: "RA-2407",
      batchId: "batch-1",
      tagId: "tag-1",
      sourceTapEventId: "42",
      isActorIdentity: true,
    },
  })]), "demobodega"), null);
  assert.equal(parseTenantEngagementPayload(payload([activity()], {
    totals: { matched: 4, returned: 2, truncated: true },
  }), "demobodega"), null);
});

test("turns known event codes into client-readable activity labels", () => {
  assert.equal(readableEngagementEvent("LOYALTY_JOINED"), "Adhesión a fidelización confirmada");
  assert.equal(readableEngagementEvent("CUSTOM_RECORDED_ACTION"), "Custom Recorded Action");
});

test("CRM overview renders an interactive, source-separated engagement surface", async () => {
  const [page, component] = await Promise.all([
    readFile(new URL("../src/app/(app)/loyalty/overview/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/tenant-engagement-panel.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /TenantEngagementPanel tenantSlug=\{tenantScope\} canRead=\{canReadEngagement\}/);
  assert.match(page, /dashboardPermissionMatches\([\s\S]*?"crm:read"/);
  assert.match(component, /\/api\/admin\/engagement\?\$\{query\.toString\(\)\}/);
  assert.match(component, /"24h"/);
  assert.match(component, /"7d"/);
  assert.match(component, /"30d"/);
  assert.match(component, /Lecturas de unidad ≠ acciones post-tap ≠ personas/);
  assert.match(component, /Cero acciones en esta vista no significa cero taps/);
  assert.match(component, /No se muestran ceros ni estimaciones/);
  assert.match(component, /Contacto habilitado/);
  assert.match(component, /consentChannels/);
  assert.match(component, /data-source=\{activity\.source\}/);
  assert.match(component, /aria-busy=/);
});
