import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [panel, settings, login, usersPage, userPanel, shell, accountMenu] = await Promise.all([
  read("../src/components/mfa-settings-panel.tsx"),
  read("../src/app/(app)/settings/page.tsx"),
  read("../src/components/login-form-panel.tsx"),
  read("../src/app/(app)/users/page.tsx"),
  read("../src/components/user-management-panel.tsx"),
  read("../src/components/dashboard-shell.tsx"),
  read("../src/components/tenant-account-menu.tsx"),
]);

test("MFA screen is fail-closed and exposes no unusable enrollment controls", () => {
  assert.match(panel, /data-mfa-enrollment="unavailable"/);
  assert.match(panel, /TOTP nexID temporalmente no disponible/);
  assert.match(panel, /fail-closed/);
  assert.match(panel, /no genera secretos ni recovery codes incompletos/);
  assert.doesNotMatch(panel, /fetch\(.*\/api\/iam\/mfa\/(?:setup|disable)/);
  assert.doesNotMatch(panel, /Confirmar MFA|Iniciar setup|Deshabilitar/);
});

test("login and settings never invite users into the disabled TOTP flow", () => {
  assert.match(login, /TOTP nexID está temporalmente bloqueado/);
  assert.doesNotMatch(login, /MFA \/ TOTP code \(optional\)|mfaCode/);
  assert.match(settings, /TOTP nexID no disponible/);
  assert.match(settings, /Simulador de plan/);
  assert.match(settings, /No representa MRR, contratos ni renovaciones confirmadas/);
  assert.doesNotMatch(settings, /Activar segundo factor/);
  assert.doesNotMatch(settings, /Plan contratado, renovacion/);
  assert.match(shell, /Account Security/);
  assert.match(accountMenu, /TOTP no disponible/);
  assert.doesNotMatch(accountMenu, /Segundo factor antes de escalar permisos/);
});

test("IAM only offers revocation for a legacy MFA flag", () => {
  assert.match(usersPage, /sólo puede revocarse MFA legacy detectado/);
  assert.match(userPanel, /user\.mfa_enabled \? <Button/);
  assert.match(userPanel, /Revocar MFA legacy/);
  assert.match(userPanel, /MFA legacy revocado y sesiones invalidadas/);
  assert.doesNotMatch(userPanel, />Reset MFA</);
});

