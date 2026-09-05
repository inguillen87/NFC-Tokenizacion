import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/components/user-management-panel.tsx", import.meta.url), "utf8");

test("managed-user creation has persistent Spanish labels associated with every identity field", () => {
  for (const [id, label] of [
    ["managed-user-email", "Correo electrónico"],
    ["managed-user-full-name", "Nombre completo"],
    ["managed-user-initial-password", "Contraseña inicial"],
  ]) {
    assert.match(source, new RegExp(`<label htmlFor="${id}"[^>]*>\\s*${label}`));
    assert.match(source, new RegExp(`<input id="${id}"`));
  }
  assert.doesNotMatch(source, /placeholder="(?:Temp password|Work email|Full name)"/);
});

test("the initial-password field stays masked and describes its actual lifecycle", () => {
  assert.match(source, /id="managed-user-initial-password"[^>]*type="password"[^>]*autoComplete="new-password"[^>]*aria-describedby="managed-user-password-help"/);
  assert.match(source, /id="managed-user-password-help"[^>]*>No vence ni exige cambio automático al ingresar\. Crear la cuenta no verifica el correo\./);
  assert.match(source, /useState\(\{ email: "", fullName: "", password: ""/);
  assert.match(source, /if \(res\?\.ok\) \{\s*setForm\(\{ email: "", fullName: "", password: ""/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|console\.(?:log|info|warn|error)\(/);
});
