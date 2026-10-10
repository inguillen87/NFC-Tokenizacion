// Actual React login/contact/CSS; no Next server, OTP, provider or customer session.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const root = fileURLToPath(new URL("../../../", import.meta.url)), web = join(root, "apps/web");
const output = resolve(process.env.QA_OUTPUT || join(root, "artifacts/consumer-login-focus"));
await mkdir(output, { recursive: true });
const sourcePaths = ["apps/web/src/app/login/consumer-login-panel.tsx", "apps/web/src/app/login/consumer-login.module.css", "apps/web/src/components/consumer-contact-input.tsx", "apps/web/src/lib/consumer-request.ts", "apps/web/tests/consumer-login-focus.browser.mjs", "apps/web/tests/browser/consumer-login-focus.fixture.tsx"];
const hashes = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, createHash("sha256").update(await readFile(join(root, path))).digest("hex")])));
const report = { localOnly: true, actualReactComponent: true, actualNextAndBff: false, syntheticAuthTransport: true, realOtpOrSessionVerified: false, sourceHashesStart: await hashes(), checks: [], views: [], contexts: [], interactions: [], transitions: [], errors: [], browserClosed: false, serverClosed: false };
const check = (passed, name) => { report.checks.push({ name, passed: Boolean(passed) }); assert.ok(passed, name); };
const bundle = await build({ entryPoints: [join(web, "tests/browser/consumer-login-focus.fixture.tsx")], bundle: true, write: false, outdir: join(output, "bundle"), format: "iife", platform: "browser", jsx: "automatic", loader: { ".module.css": "local-css" }, define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "synthetic-next", setup(builder) {
  builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "next-shim", namespace: "fixture" }));
  builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const useSearchParams=()=>new URLSearchParams(window.location.search);", loader: "js", resolveDir: web }));
  builder.onResolve({ filter: /^@product\/config\/safe-return-path$/ }, () => ({ path: join(root, "packages/config/src/safe-return-path.ts") }));
} }], logLevel: "silent" });
const js = bundle.outputFiles.find(file => file.path.endsWith(".js")).contents;
const css = bundle.outputFiles.find(file => file.path.endsWith(".css")).contents;
const globals = (await postcss([tailwindcss({ base: web })]).process(await readFile(join(web, "src/app/globals.css"), "utf8"), { from: join(web, "src/app/globals.css") })).css;
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://fixture.invalid");
  if (req.method !== "GET") { res.writeHead(405); return res.end(); }
  if (url.pathname === "/fixture.js") { res.setHeader("content-type", "text/javascript"); return res.end(js); }
  if (url.pathname === "/fixture.css") { res.setHeader("content-type", "text/css"); return res.end(css); }
  if (url.pathname === "/base.css") { res.setHeader("content-type", "text/css"); return res.end(globals); }
  if (url.pathname === "/favicon.ico") { res.writeHead(204); return res.end(); }
  if (url.pathname !== "/") { res.writeHead(404); return res.end(); }
  const theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
  const compact = url.searchParams.get("layout") === "compact";
  res.setHeader("content-type", "text/html;charset=utf-8");
  res.end(`<!doctype html><html lang="es-AR" data-theme="${theme}" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Foco local</title><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;font:16px system-ui;color:var(--text)}main{box-sizing:border-box;margin:0 auto;max-width:620px;padding:16px}h1{font-size:24px}.outside-control{min-height:44px;padding:8px 12px;margin:0 8px 12px 0;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)}.reading{min-height:${compact ? "0" : "1200px"};padding-top:24px}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright-core");
const axe = await readFile(process.env.AXE_MODULE_PATH, "utf8");
let browser;
async function open(width, theme, { compact = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, locale: "es-AR", reducedMotion: "reduce", serviceWorkers: "block" });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const entry = { width, theme, blocked: [], errors: [], closed: false }; report.contexts.push(entry);
  page.on("pageerror", () => entry.errors.push("pageerror"));
  page.on("console", message => { if (message.type() === "error") entry.errors.push("console_error"); });
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin || request.method() !== "GET" || !["/", "/fixture.js", "/fixture.css", "/base.css", "/favicon.ico"].includes(url.pathname)) { entry.blocked.push("unexpected_network_request"); return route.abort(); }
    return route.continue();
  });
  await page.goto(`${origin}/?theme=${theme}${compact ? "&layout=compact" : ""}`, { waitUntil: "load" });
  await page.getByRole("textbox", { name: "Correo electrónico", exact: true }).fill("persona@example.test");
  check(await page.evaluate(() => window.__loginFocusCalls.length === 0), "Mount and editing do not request a code");
  return { page, entry, async close() { await context.close(); entry.closed = true; } };
}
async function requestCode(page) {
  await page.getByRole("button", { name: "Recibir código", exact: true }).click();
  await page.waitForFunction(() => window.__loginFocusPending === "/api/consumer/auth/start");
}
async function accepted(page) {
  await page.evaluate(() => window.__loginFocusResolve(200, { ok: true, delivery: { channel: "email", status: "accepted" } }));
  await page.getByRole("textbox", { name: "Código de acceso", exact: true }).waitFor();
}
async function interaction(page, kind) {
  if (kind === "focus") await page.locator("#read-elsewhere").focus();
  else if (kind === "scroll") { await page.evaluate(() => window.scrollTo(0, 400)); await page.waitForFunction(() => window.scrollY >= 350); }
  else if (kind === "keyboard") await page.keyboard.press("ArrowDown");
  else await page.evaluate(value => {
    if (value === "pointer") document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    else (value === "touchmove" ? document : window).dispatchEvent(new Event(value, { bubbles: true }));
  }, kind);
  return page.evaluate(() => ({ id: document.activeElement?.id || "", scroll: window.scrollY }));
}
async function uncertainWhatsApp(page) {
  await page.getByRole("button", { name: "WhatsApp", exact: true }).click();
  await page.getByRole("textbox", { name: "Número de teléfono sin código de país", exact: true }).fill("1155551234");
  await requestCode(page);
  await page.evaluate(() => window.__loginFocusResolve(504, { ok: false, error: "meta_delivery_timeout" }));
  const recovery = page.getByRole("button", { name: "Continuar con email", exact: true });
  await recovery.waitFor();
  return recovery;
}
const layout = page => page.evaluate(() => ({ scroll: window.scrollY, maximum: Math.max(0, document.documentElement.scrollHeight - innerHeight), activeTag: document.activeElement?.tagName, activeType: document.activeElement?.type || "", starts: window.__loginFocusCalls.filter(call => call.path.endsWith("/start")).length }));
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
  for (const width of [320, 390, 1280]) for (const theme of ["light", "dark"]) {
    const fixture = await open(width, theme), page = fixture.page;
    try {
      await requestCode(page);
      await page.locator('button[type="submit"]').evaluate(node => { node.click(); node.click(); });
      check(await page.evaluate(() => window.__loginFocusCalls.filter(c => c.path.endsWith("/start")).length === 1), "In-flight double click creates one synthetic challenge");
      await accepted(page);
      const code = page.getByRole("textbox", { name: "Código de acceso", exact: true });
      check(await code.evaluate(node => node === document.activeElement), "A still-owned accepted request focuses the code field");
      await code.fill("135791");
      await page.getByRole("button", { name: "Validar y continuar", exact: true }).click();
      await page.waitForFunction(() => window.__loginFocusPending === "/api/consumer/auth/verify");
      await page.evaluate(() => window.__loginFocusResolve(400, { ok: false, error: "invalid_otp" }));
      await page.getByRole("status").filter({ hasText: "No pudimos validar ese código." }).waitFor();
      check(await code.inputValue() === "135791" && await code.evaluate(node => node === document.activeElement), "Owned validation error focuses the preserved code");
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Login recovery fits mobile and desktop");
      await page.addScriptTag({ content: axe });
      const violations = await page.evaluate(async () => (await axe.run(".consumer-login-panel", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(v => ({ id: v.id, impact: v.impact })));
      check(violations.length === 0, "Code error remains accessible in both themes");
      const screenshot = `login-code-error-${width}-${theme}.png`; await page.screenshot({ path: join(output, screenshot) });
      report.views.push({ scenario: "owned-code-error", width, theme, screenshot, violations });
      await page.getByRole("button", { name: "Cambiar contacto", exact: true }).click();
      const contact = page.getByRole("textbox", { name: "Correo electrónico", exact: true });
      check(await contact.inputValue() === "persona@example.test" && await contact.evaluate(node => node === document.activeElement), "Explicit contact recovery keeps its draft and focuses the contact field");
    } finally { await fixture.close(); }
  }
  for (const kind of ["focus", "wheel", "touchmove", "scroll", "keyboard", "pointer"]) {
    const fixture = await open(390, "light"), page = fixture.page;
    try {
      await requestCode(page); const before = await interaction(page, kind);
      await accepted(page);
      const after = await page.evaluate(() => ({ id: document.activeElement?.id || "", scroll: window.scrollY }));
      const codeFocused = await page.getByRole("textbox", { name: "Código de acceso", exact: true }).evaluate(node => node === document.activeElement);
      report.interactions.push({ scenario: "accepted", kind, before, after, codeFocused });
      check(after.id === before.id && (["scroll", "keyboard"].includes(kind) ? after.scroll >= before.scroll - 2 : Math.abs(after.scroll - before.scroll) <= 2) && !codeFocused, `Delayed acceptance respects newer ${kind} interaction`);
      check(await page.getByRole("status").getAttribute("aria-live") === "polite" && (await page.getByRole("status").innerText()).includes("Solicitud de código aceptada"), `Delayed acceptance is still announced after ${kind}`);
      check(await page.evaluate(() => window.__loginFocusCalls.filter(c => c.path.endsWith("/start")).length === 1), `Delayed acceptance does not resend after ${kind}`);
    } finally { await fixture.close(); }
  }
  for (const theme of ["light", "dark"]) {
    const fixture = await open(320, theme, { compact: true }), page = fixture.page;
    try {
      const recovery = await uncertainWhatsApp(page);
      await recovery.focus();
      await page.evaluate(() => window.scrollTo(0, Math.max(0, document.documentElement.scrollHeight - innerHeight)));
      await page.waitForFunction(() => window.scrollY >= Math.max(0, document.documentElement.scrollHeight - innerHeight) - 1);
      const before = await layout(page);
      await recovery.click();
      await page.waitForFunction(() => document.activeElement?.type === "email");
      const after = await layout(page);
      report.transitions.push({ scenario: "explicit-email-layout-clamp", width: 320, theme, before, after });
      check(before.maximum > after.maximum && before.scroll > after.scroll, "Explicit email recovery tolerates only its immediate layout adjustment");
      check(after.scroll <= Math.min(before.scroll, after.maximum) + 2, "Email recovery focuses without adding a scroll jump");
      check(await page.getByRole("textbox", { name: "Correo electrónico", exact: true }).inputValue() === "persona@example.test" && after.starts === 1, "Explicit email transition preserves the draft and never sends another code");
      check(await page.locator("#consumer-access-feedback").getAttribute("aria-live") === "polite", "Email transition preserves live feedback semantics");
      const visibility = await page.getByRole("textbox", { name: "Correo electrónico", exact: true }).evaluate(node => { const r = node.getBoundingClientRect(); return { focused: node === document.activeElement, top: r.top, bottom: r.bottom, viewport: innerHeight, hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === node }; });
      report.transitions.at(-1).visibility = visibility;
      check(visibility.focused && visibility.top >= 0 && visibility.bottom <= visibility.viewport && visibility.hit, "Explicit email recovery leaves the focused field visible and unobstructed at 320px");
      await page.addScriptTag({ content: axe });
      const violations = await page.evaluate(async () => (await axe.run(".consumer-login-panel", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(v => ({ id: v.id, impact: v.impact })));
      check(violations.length === 0, "Explicit email layout recovery is accessible at 320px in both themes");
      const screenshot = `login-email-layout-clamp-320-${theme}.png`; await page.screenshot({ path: join(output, screenshot) });
      report.views.push({ scenario: "explicit-email-layout-clamp", width: 320, theme, screenshot, violations });
    } finally { await fixture.close(); }
  }
  for (const theme of ["light", "dark"]) {
    const fixture = await open(390, theme), page = fixture.page;
    try {
      await requestCode(page);
      await page.evaluate(() => {
        // Offset changes synchronously; the browser scroll event is queued for
        // a later frame. The response must still preserve the reader's position.
        window.scrollTo(0, 400);
        window.__loginFocusResolve(200, { ok: true, delivery: { channel: "email", status: "accepted" } });
      });
      const code = page.getByRole("textbox", { name: "Código de acceso", exact: true }); await code.waitFor();
      check(!await code.evaluate(node => node === document.activeElement) && await page.evaluate(() => window.scrollY >= 398), "A delayed response rejects a changed scroll offset even before its scroll event");
      check((await layout(page)).starts === 1, "The scroll-offset race never resends a challenge");
    } finally { await fixture.close(); }
  }
  for (const kind of ["focus", "scroll", "keyboard"]) {
    const fixture = await open(390, "dark"), page = fixture.page;
    try {
      await requestCode(page); await accepted(page);
      const code = page.getByRole("textbox", { name: "Código de acceso", exact: true }); await code.fill("135791");
      await page.getByRole("button", { name: "Validar y continuar", exact: true }).click();
      await page.waitForFunction(() => window.__loginFocusPending === "/api/consumer/auth/verify");
      const before = await interaction(page, kind);
      await page.evaluate(() => window.__loginFocusResolve(400, { ok: false, error: "invalid_otp" }));
      await page.getByRole("status").filter({ hasText: "No pudimos validar ese código." }).waitFor();
      const after = await page.evaluate(() => ({ id: document.activeElement?.id || "", scroll: window.scrollY }));
      check(after.id === before.id && (["scroll", "keyboard"].includes(kind) ? after.scroll >= before.scroll - 2 : Math.abs(after.scroll - before.scroll) <= 2) && !await code.evaluate(node => node === document.activeElement), `Delayed code error respects newer ${kind} interaction`);
      check(await code.inputValue() === "135791" && await code.getAttribute("aria-invalid") === "true", `Delayed error preserves code and field semantics after ${kind}`);
    } finally { await fixture.close(); }
  }
  {
    const fixture = await open(390, "dark"), page = fixture.page;
    try {
      await requestCode(page);
      await page.evaluate(() => window.__loginFocusResolve(504, { ok: false, error: "resend_delivery_timeout" }));
      await page.getByRole("button", { name: "Ya tengo un código", exact: true }).click();
      const code = page.getByRole("textbox", { name: "Código de acceso", exact: true }); await code.waitFor();
      check(await code.evaluate(node => node === document.activeElement) && await page.evaluate(() => window.__loginFocusCalls.length === 2), "Explicit late-code recovery focuses entry without another challenge");
    } finally { await fixture.close(); }
  }
  {
    const fixture = await open(390, "light"), page = fixture.page;
    try {
      await requestCode(page);
      await page.locator("#close-login").click(); await page.locator("#closed-login").waitFor();
      const focus = await page.evaluate(() => document.activeElement?.id || "");
      await page.evaluate(() => window.__loginFocusResolve(200, { ok: true, delivery: { channel: "email", status: "accepted" } }));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      check(await page.getByRole("textbox", { name: "Código de acceso", exact: true }).count() === 0 && await page.evaluate(() => document.activeElement?.id || "") === focus, "Unmounted response cannot focus or reopen an old login");
    } finally { await fixture.close(); }
  }
} catch { report.errors.push("login_focus_assertion_or_runtime_failure"); }
finally {
  if (browser) { await browser.close(); report.browserClosed = true; }
  server.closeAllConnections(); await new Promise(done => server.close(done)); report.serverClosed = true;
  report.sourceHashesEnd = await hashes();
  report.accepted = report.checks.every(item => item.passed) && report.views.length === 8 && report.contexts.length === 21 && report.contexts.every(entry => entry.closed && entry.errors.length === 0 && entry.blocked.length === 0) && report.errors.length === 0 && JSON.stringify(report.sourceHashesStart) === JSON.stringify(report.sourceHashesEnd) && report.browserClosed && report.serverClosed;
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ accepted: report.accepted, checks: report.checks.length, views: report.views.length, contexts: report.contexts.length, errors: report.errors }));
  if (!report.accepted) process.exitCode = 1;
}
