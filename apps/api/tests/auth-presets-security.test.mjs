import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

test("auth presets no contienen passwords demo hardcodeados", () => {
  const file = path.join(repoRoot, "apps/api/src/lib/auth-presets.ts");
  const content = fs.readFileSync(file, "utf8");

  assert.ok(content.includes("password: read(process.env.SUPER_ADMIN_PASSWORD"));
  assert.ok(content.includes("password: read(process.env.TENANT_ADMIN_PASSWORD"));
  assert.ok(content.includes("password: read(process.env.RESELLER_PASSWORD"));
  assert.ok(content.includes("password: read(process.env.GENERIC_DEMO_PASSWORD"));

  assert.equal(content.includes("Marcelog2026"), false);
  assert.equal(content.includes("DemoBodega2026"), false);
  assert.equal(content.includes("NexidPartner2026"), false);
  assert.equal(content.includes("NexidDemo2026"), false);
});

test("auth presets enforce tenant binding and never auto-promote malformed super-admin authority", () => {
  const file = path.join(repoRoot, "apps/api/src/lib/auth-presets.ts");
  const content = fs.readFileSync(file, "utf8");

  assert.match(content, /preset\.role === "super_admin" \? null : await resolveDemoTenantId\(sql\)/);
  assert.match(content, /preset\.role !== "super_admin" && !tenantIdForMembership/);
  assert.match(content, /preset\.role === "super_admin" && membershipRows\[0\]\?\.tenant_id/);
  assert.match(content, /Never turn a historical tenant-bound super-admin into global authority/);
  assert.match(content, /membershipRows\.length > 1/);
  assert.match(content, /String\(membershipRows\[0\]\.role\) !== preset\.role/);
  assert.doesNotMatch(content, /FROM memberships WHERE user_id[^\n]*AND role = \$\{preset\.role\}/);
  assert.match(content, /INSERT INTO resource_permissions \(user_id, tenant_id, resource, action\)[^\n]*\$\{tenantIdForMembership\}::uuid/);
  assert.doesNotMatch(content, /preset\.role === "tenant_admin" \? await resolveDemoTenantId/);
});
