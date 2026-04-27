import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("auth presets no contienen passwords demo hardcodeados", () => {
  const file = path.join(process.cwd(), "apps/api/src/lib/auth-presets.ts");
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
