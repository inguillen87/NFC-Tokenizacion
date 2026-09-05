import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(new URL("../src/components/login-form-panel.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/login-entry.module.css", import.meta.url), "utf8");

test("real company credentials are the first access form, ahead of illustrative demo and advanced choices", () => {
  assert.equal((panel.match(/id="tenant-credentials"/g) || []).length, 1);
  const form = panel.indexOf('id="tenant-credentials"');
  assert.ok(form > 0 && form < panel.indexOf('data-testid="login-bodega-demo-card"'));
  assert.ok(form < panel.indexOf('data-testid="login-superadmin-google-card"'));
  assert.ok(form < panel.indexOf('data-testid="login-access-status"'));
  assert.match(panel, /Ingresar a mi empresa/);
  assert.doesNotMatch(panel, /Demo Bodega Balmec|Perfil activo|firstAvailable/);
  assert.match(panel, /No muestra tus TAP físicos ni datos de tu empresa/);
  assert.match(panel, /Los TAP físicos de Bodega Balmec se consultan con una cuenta asignada/);
});

test("company login starts blank and has persistent accessible credential labels", () => {
  assert.match(panel, /const \[email, setEmail\] = useState\(""\)/);
  assert.match(panel, /htmlFor="tenant-email">Correo electrónico/);
  assert.match(panel, /htmlFor="tenant-password">Contraseña/);
  assert.match(panel, /autoComplete="username"/);
  assert.match(panel, /autoComplete="current-password"/);
  assert.match(panel, /aria-label=\{showPassword \? "Ocultar contraseña" : "Mostrar contraseña"\}/);
  assert.match(panel, /aria-pressed=\{showPassword\}/);
  assert.doesNotMatch(panel, /localStorage|sessionStorage|console\.log/);
});

test("pending requests cannot be submitted twice and errors preserve typed credentials", () => {
  assert.match(panel, /if \(requestInFlight\.current\) return/);
  assert.match(panel, /requestInFlight\.current = true/);
  assert.match(panel, /requestInFlight\.current = false/);
  assert.match(panel, /aria-busy=\{pending\}/);
  assert.match(panel, /Verificando acceso…/);
  assert.match(panel, /fetch\("\/api\/session\/login"/);
  const submit = panel.slice(panel.indexOf("async function submit"), panel.indexOf("  return ("));
  assert.doesNotMatch(submit, /setEmail\(|setPassword\(/);
  assert.match(panel, /window\.location\.assign\(safeNextPath\)/);
});

test("presentation remains scoped, mobile inputs avoid auto-zoom, and motion preference is respected", () => {
  assert.match(page, /login-entry\.module\.css/);
  assert.match(page, /Tu operación,/);
  assert.match(page, /Tu operación,<br \/>\{" "\}en un solo lugar\./, "hidden mobile line break must retain a word separator");
  assert.match(css, /\.field input \{[^}]*font-size: 16px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /html\.theme-light/);
  assert.match(css, /--entry-danger/);
  assert.match(css, /:focus-visible/);
});
