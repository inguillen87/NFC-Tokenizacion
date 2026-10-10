import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [loginPanel, loginPage, securityPanel, securityPage, web3Bridge] = await Promise.all([
  read("../src/app/login/consumer-login-panel.tsx"),
  read("../src/app/login/page.tsx"),
  read("../src/app/me/security/security-panel.tsx"),
  read("../src/app/me/security/page.tsx"),
  read("../src/app/api/consumer/auth/web3/route.ts"),
]);

test("consumer login describes same-code multi-channel delivery without claiming MFA", async () => {
  const delivery = await read("../src/app/login/consumer-login-delivery.ts");
  assert.match(delivery, /payload\.deliveryChannel === "both"/);
  assert.match(delivery, /mismo c.digo por email y tel.fono/);
  assert.match(delivery, /cualquiera de los dos/);
  assert.doesNotMatch(delivery, /MFA activo|dos factores|Doble factor activo/);
  assert.doesNotMatch(loginPanel, /Doble factor activo/);
  assert.doesNotMatch(loginPage, /MFA-ready/);
});

test("consumer security treats linked contacts as recovery channels, not two factors", () => {
  assert.match(securityPanel, /model\.hasBothLinkedChannels/);
  assert.match(securityPanel, /Contactos de esta cuenta/);
  assert.match(securityPanel, /no agrega una segunda verificación al ingreso/);
  assert.match(securityPage, /Revisá los contactos de tu cuenta y las opciones disponibles/);
  assert.doesNotMatch(securityPanel, /isVerified2FA|Doble factor activo|Bono 2FA/);
  assert.doesNotMatch(securityPage, /estatus Verificado \(2FA\)/);
});

test("Clerk bridge delegates identity resolution to the API-verified Clerk token", () => {
  assert.match(web3Bridge, /clerkAuth\?\.getToken\(\)/);
  assert.match(web3Bridge, /authorization: `Bearer \$\{clerkSessionToken\}`/);
  assert.doesNotMatch(web3Bridge, /emailAddresses|phoneNumbers|walletAddress|externalUserId|ADMIN_API_KEY|cookie:/);
});
