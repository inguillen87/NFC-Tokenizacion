import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  authoritativeLeadTenant,
  leadBelongsToTenant,
} from "../src/lib/customer-signal-timeline.ts";

test("persisted tenant scope wins over conflicting tenant text in lead content", () => {
  const lead = {
    tenant_slug: "tenant-a",
    message: "Consulta tenant=tenant-b",
    notes: "[tenant=tenant-b]",
    vertical: "tenant-b",
  };

  assert.equal(authoritativeLeadTenant(lead), "tenant-a");
  assert.equal(leadBelongsToTenant(lead, "tenant-a"), true);
  assert.equal(leadBelongsToTenant(lead, "tenant-b"), false);
});

test("server and client tenant filters use only the authoritative projection", async () => {
  const [page, client] = await Promise.all([
    readFile(new URL("../src/app/(app)/leads-tickets/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(app)/leads-tickets/leads-tickets-client.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /leadBelongsToTenant\(lead, tenantScope\)/);
  assert.match(page, /authoritativeLeadTenant\(lead\)/);
  assert.match(client, /authoritativeLeadTenant\(l\)/);
  assert.doesNotMatch(page, /parseMeta\(lead\.(?:message|notes), "tenant"\)/);
  assert.doesNotMatch(client, /tenant=\(\[\^/);
});
