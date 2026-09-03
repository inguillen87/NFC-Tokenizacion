import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const {
  ENTERPRISE_ROLE_PERMISSION_MODE,
  normalizeEnterpriseRoleCode,
  parseEnterpriseRoleCatalog,
} = await import(`../src/lib/enterprise-role-catalog.ts?ts=${Date.now()}`);

function catalog(overrides = {}) {
  return {
    ok: true,
    permissionMode: ENTERPRISE_ROLE_PERMISSION_MODE,
    roles: [{
      code: "security_operator",
      display_name: "Security Operator",
      description: "Opera controles de seguridad delegados.",
      tenant_bound: true,
      human_session_allowed: true,
      default_permissions: ["risk_rules.write", "webhooks.manage"],
      permission_mode: ENTERPRISE_ROLE_PERMISSION_MODE,
      updated_at: "2026-08-02T12:00:00.000Z",
    }],
    ...overrides,
  };
}

test("enterprise role catalog parses only bounded authoritative presets", () => {
  assert.equal(normalizeEnterpriseRoleCode("Security-Operator"), "security_operator");
  assert.deepEqual(parseEnterpriseRoleCatalog(catalog()), [{
    code: "security_operator",
    displayName: "Security Operator",
    description: "Opera controles de seguridad delegados.",
    tenantBound: true,
    humanSessionAllowed: true,
    defaultPermissions: ["risk_rules.write", "webhooks.manage"],
    permissionMode: ENTERPRISE_ROLE_PERMISSION_MODE,
    updatedAt: "2026-08-02T12:00:00.000Z",
  }]);
});

test("enterprise role catalog fails closed for malformed, duplicate, or non-human profiles", () => {
  assert.equal(parseEnterpriseRoleCatalog({ ...catalog(), permissionMode: "custom" }), null);
  assert.equal(parseEnterpriseRoleCatalog(catalog({ roles: [] })), null);
  assert.equal(parseEnterpriseRoleCatalog(catalog({
    roles: [catalog().roles[0], { ...catalog().roles[0] }],
  })), null);
  assert.equal(parseEnterpriseRoleCatalog(catalog({
    roles: [{ ...catalog().roles[0], human_session_allowed: false }],
  })), null);
  assert.equal(parseEnterpriseRoleCatalog(catalog({
    roles: [{ ...catalog().roles[0], default_permissions: ["risk:"] }],
  })), null);
});

test("user and invitation consoles consume role defaults and expose no free-form grants", () => {
  const userPanel = readFileSync(new URL("../src/components/user-management-panel.tsx", import.meta.url), "utf8");
  const invitePanel = readFileSync(new URL("../src/components/invite-user-panel.tsx", import.meta.url), "utf8");
  const catalogControl = readFileSync(new URL("../src/components/enterprise-role-catalog-control.tsx", import.meta.url), "utf8");
  const proxyRoute = readFileSync(new URL("../src/app/api/iam/rbac/roles/route.ts", import.meta.url), "utf8");
  const invitePage = readFileSync(new URL("../src/app/invite-user/page.tsx", import.meta.url), "utf8");

  for (const panel of [userPanel, invitePanel]) {
    assert.match(panel, /ENTERPRISE_ROLE_PERMISSION_MODE/);
    assert.match(panel, /permissions:\s*\[\]/);
    assert.match(panel, /EnterpriseRoleSelect/);
    assert.match(panel, /EnterpriseRolePresetSummary/);
    assert.doesNotMatch(panel, /<textarea/);
    assert.doesNotMatch(panel, /permissions\.split/);
  }
  const saveUser = userPanel.slice(
    userPanel.indexOf("async function saveUser"),
    userPanel.indexOf("async function issueReset"),
  );
  assert.doesNotMatch(saveUser, /permissions\s*:/);
  assert.match(userPanel, /Guardar el rol no elimina esas excepciones/);
  assert.match(userPanel, /user\.denied_permissions\?\.length/);
  assert.match(catalogControl, /fetch\("\/api\/iam\/rbac\/roles"/);
  assert.match(catalogControl, /cache:\s*"no-store"/);
  assert.match(catalogControl, /status:\s*"failed",\s*roles:\s*\[\]/);
  assert.match(proxyRoute, /proxyToApi\("\/admin\/rbac\/roles"\)/);
  assert.match(proxyRoute, /"cache-control":\s*"no-store"/);
  assert.match(invitePage, /requireDashboardSession\("users:manage"\)/);
});
