import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [panel, page, forgotRoute, resetRoute, guard, userManagement, adminResetRoute] = await Promise.all([
  read("../src/components/forgot-password-panel.tsx"),
  read("../src/app/forgot-password/page.tsx"),
  read("../src/app/api/auth/forgot-password/route.ts"),
  read("../src/app/api/auth/reset-password/route.ts"),
  read("../src/lib/auth-recovery-proxy.ts"),
  read("../src/components/user-management-panel.tsx"),
  read("../src/app/api/iam/users/[userId]/reset-password/route.ts"),
]);

test("forgot-password is disabled until a delivery provider is explicitly configured", () => {
  assert.match(page, /AUTH_PASSWORD_RESET_DELIVERY_ENABLED === "true"/);
  assert.match(panel, /disabled=\{!deliveryEnabled \|\| pending\}/);
  assert.match(panel, /No existe un proveedor de email o SMS confirmado/);
  assert.doesNotMatch(panel, /resetToken|Token generado|reset qued[oÃ³] emitido/);
});

test("auth recovery proxies enforce request boundaries before the upstream call", () => {
  for (const route of [forgotRoute, resetRoute]) {
    assert.match(route, /requireSameOrigin\(request\)/);
    assert.match(route, /consumeAuthRecoveryRateLimit\(request/);
    assert.match(route, /readBoundedJson\(request\)/);
    assert.match(route, /AUTH_PASSWORD_RESET_DELIVERY_ENABLED/);
    assert.doesNotMatch(route, /new NextResponse\(text/);
  }
  assert.match(guard, /MAX_BODY_BYTES = 4_096/);
  assert.match(guard, /controller\.abort\(\), 8_000/);
  assert.match(guard, /cache-control/);
});

test("forgot-password exposes delivery status only and never forwards an upstream token", () => {
  assert.match(forgotRoute, /deliveryStatus/);
  assert.match(forgotRoute, /reset_request_failed/);
  assert.doesNotMatch(forgotRoute, /resetToken|upstream\.text/);
});

test("admin reset never exposes a reset token through the dashboard", () => {
  assert.match(adminResetRoute, /deliveryStatus/);
  assert.match(adminResetRoute, /isCrossSiteMutation/);
  assert.match(adminResetRoute, /cache-control/);
  assert.doesNotMatch(adminResetRoute, /upstream\.text|resetToken/);
  assert.match(userManagement, /esta pantalla no confirm[oó] ninguna entrega/);
  assert.doesNotMatch(userManagement, /data\?\.resetToken|Reset token:/);
});
