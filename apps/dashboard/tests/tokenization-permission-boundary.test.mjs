import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { dashboardPermissionMatches, requiredPermissionForAdminResource } = await import("../src/lib/permission-policy.ts");
const tokenizationPage = await readFile(new URL("../src/app/(app)/tokenization/page.tsx", import.meta.url), "utf8");

test("tokenization surfaces require explicit read and write permissions", () => {
  assert.equal(requiredPermissionForAdminResource("GET", "tokenization/requests"), "tokenization:read");
  assert.equal(requiredPermissionForAdminResource("POST", "tokenization/requests"), "tokenization:write");
  assert.equal(requiredPermissionForAdminResource("GET", "polygon/wallet"), "tokenization:read");
  assert.equal(requiredPermissionForAdminResource("GET", "product-assets"), "tokenization:read");
  assert.equal(requiredPermissionForAdminResource("POST", "product-assets"), "tokenization:write");
  assert.equal(dashboardPermissionMatches(["tokenization:read"], "tokenization:write"), false);
  assert.equal(dashboardPermissionMatches(["tokenization:*"], "tokenization:write"), true);
});

test("tokenization copy limits nexID validation to NFC evidence and reported TT", () => {
  assert.match(tokenizationPage, /title="nexID valida el mensaje NFC"/);
  assert.match(tokenizationPage, /TT reportado/);
  assert.match(tokenizationPage, /valida el mensaje y la política aplicable/);
  assert.match(tokenizationPage, /no prueba por sí solo el contenido, el origen ni la custodia física/);
  assert.doesNotMatch(tokenizationPage, /nexID valida el producto|estado físico viven en el dominio nexID/);
});
