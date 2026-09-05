// Explicit demo-only browser QA. Never submits credentials or modifies incidents.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const base = new URL(process.env.QA_BASE_URL || "http://localhost:3311");
assert.ok(["127.0.0.1", "localhost", "app.nexid.lat"].includes(base.hostname));
const modulePath = process.env.PLAYWRIGHT_MODULE;
assert.ok(modulePath, "Set PLAYWRIGHT_MODULE to an installed Playwright module");
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
const output = resolve(process.env.QA_OUTPUT || "test-results/tap-navigation");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [390, 1440]) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width, height: 960 } });
    const page = await context.newPage();
    const errors = [], failedApi = [], blocked = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin === base.origin && url.pathname.startsWith("/api/admin/") && response.status() >= 400) failedApi.push({ path: url.pathname, status: response.status() });
    });
    await page.route("**/*", (route) => {
      const req = route.request(), url = new URL(req.url());
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method()) && !(url.origin === base.origin && url.pathname === "/api/session/demo")) {
        blocked.push({ host: url.hostname, path: url.pathname, method: req.method() });
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(new URL("/login?logged_out=1", base).href, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Correo electrónico", { exact: true }).waitFor();
    // ThemeToggle writes the preference once its real client effect is ready.
    // Do not click a server-rendered control before hydration has attached it.
    await page.waitForFunction(() => localStorage.getItem("theme") === "light");
    if (theme === "dark") {
      await page.getByTestId("dashboard-auth-theme-control").getByRole("button").click();
      await page.waitForFunction(() => document.documentElement.dataset.theme === "dark" || document.documentElement.classList.contains("theme-dark"));
    }
    assert.equal(await page.getByLabel("Correo electrónico", { exact: true }).inputValue(), "");
    const submit = await page.getByRole("button", { name: "Ingresar a mi empresa", exact: true }).boundingBox();
    assert.ok(submit && submit.y >= 0 && submit.y + submit.height <= 960, "Company submit visible in first viewport");
    await page.screenshot({ path: resolve(output, `login-${width}-${theme}.png`), fullPage: true });
    await page.getByTestId("login-bodega-demo-button").click();
    const rows = page.getByTestId("open-event-incident-drawer");
    await rows.first().waitFor({ timeout: 45000 });
    await page.getByTestId("crm-source-badge").waitFor();
    assert.match(await page.getByTestId("crm-source-badge").innerText(), /demo/i);
    await page.waitForFunction(() => /En vivo.*demo/.test(document.querySelector('[data-testid="crm-responsive-header"]')?.textContent || ""), undefined, { timeout: 30000 });
    const map = page.getByTestId("crm-maplibre-map");
    await map.locator("canvas").waitFor();
    await map.locator('[aria-busy="true"]').waitFor({ state: "detached", timeout: 30000 });
    assert.equal(await map.getByRole("alert").count(), 0, "Cartographic layer loaded");
    const count = await rows.count();
    assert.ok(count >= 2);
    await rows.first().click();
    const dialog = page.getByTestId("incident-event-drawer");
    await dialog.waitFor();
    const visited = [];
    for (let index = 0; index < count; index++) {
      await page.waitForFunction(() => !!document.querySelector('[data-testid="incident-empty-state"], [data-testid="incident-existing-state"]'), undefined, { timeout: 15000 });
      await dialog.getByText(`${index + 1} de ${count}`, { exact: true }).waitFor();
      const header = await page.getByTestId("incident-drawer-header").boundingBox();
      const close = await dialog.getByRole("button", { name: "Cerrar detalle", exact: true }).boundingBox();
      assert.ok(header && header.y >= 0 && header.y + header.height <= 960);
      assert.ok(close && close.x >= 0 && close.x + close.width <= width && close.y >= 0 && close.y + close.height <= 960);
      assert.equal(await dialog.getByTestId("incident-edit-disclosure").count(), 0, "Demo has no mutation form");
      await page.waitForFunction(() => {
        const dialog = document.querySelector('dialog[data-testid="incident-event-drawer"]');
        return dialog && dialog.contains(document.activeElement);
      });
      await page.keyboard.press("Tab");
      assert.ok(await dialog.evaluate((element) => element.contains(document.activeElement)), "Tab remains in detail");
      visited.push(await dialog.locator("h2").innerText());
      if (await dialog.getByTestId("incident-existing-state").count()) await dialog.getByText("Historial de ejemplo", { exact: true }).waitFor();
      await page.screenshot({ path: resolve(output, `tap-${index + 1}-${width}-${theme}.png`) });
      if (index < count - 1) await dialog.getByRole("button", { name: /Siguiente/ }).click();
    }
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.ok(await rows.last().evaluate((element) => element === document.activeElement), "Close returns focus to selected row");
    assert.equal(await map.getAttribute("data-map-data-state"), "demo");
    await page.screenshot({ path: resolve(output, `returned-${width}-${theme}.png`) });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.equal(dimensions.document, dimensions.viewport, "No document overflow");
    assert.deepEqual(failedApi, []);
    assert.deepEqual(errors, []);
    assert.equal(blocked.filter((row) => row.path.startsWith("/api/admin/")).length, 0, "No incident mutation attempted");
    console.log(JSON.stringify({ base: base.origin, width, theme, visited, count, dimensions, errors, failedApi, blocked, status: "passed-demo-only" }));
    await context.close();
  }
} finally { await browser.close(); }
