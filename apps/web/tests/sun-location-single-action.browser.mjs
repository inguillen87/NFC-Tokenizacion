// Real React components in Chromium; permission and persistence are LOCAL mocks.
// No signed SUN URLs, production calls, credentials or physical-tag claims.
// PLAYWRIGHT_MODULE may point to an existing playwright-core installation.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { mkdir,writeFile } from "node:fs/promises";
import { join } from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright-core");
const bundle = await build({
  entryPoints: [fileURLToPath(new URL("browser/sun-location-single-action.fixture.tsx", import.meta.url))],
  bundle: true, write: false, outfile: "fixture.js", format: "iife", platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
});
const js = bundle.outputFiles.find(file => file.path.endsWith(".js")).contents;
const css = bundle.outputFiles.find(file => file.path.endsWith(".css"))?.contents || "";
const server = createServer((req, res) => {
  if (req.url === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); res.end(js); }
  else if (req.url === "/fixture.css") { res.setHeader("Content-Type", "text/css"); res.end(css); }
  else if (req.method === "GET") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end('<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/fixture.css"><style>body{font:16px system-ui;margin:12px}button{min-height:48px;margin:0}svg{max-width:24px}#summary{padding:16px;border:1px solid teal}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  } else { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const results = [];
if(process.env.QA_OUTPUT)await mkdir(process.env.QA_OUTPUT,{recursive:true});
try {
  for (const scenario of ["success", "denied", "timeout", "uncertain", "upstream_unknown", "retryable", "disabled"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    const posts = [];
    let releaseResponse;
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname !== "/fixture-context") return route.continue();
      posts.push(route.request().postDataJSON());
      if (scenario === "success") await new Promise(resolve => { releaseResponse = resolve; });
      const now = new Date().toISOString();
      if (scenario === "retryable") return route.fulfill({ status: 429, json: { reason: "rate_limited" } });
      if (scenario === "upstream_unknown") return route.fulfill({ status: 503, json: { reason: "sun_context_upstream_unavailable" } });
      if (scenario === "uncertain") return route.fulfill({ status: 200, json: { ok: true, updated: true, eventId: "wrong-fixture", matchedBy: "signed_event_bid_uid_ctr" } });
      return route.fulfill({ status: 200, json: {
        ok: true, updated: true, eventId: posts.at(-1).eventId, matchedBy: "signed_event_bid_uid_ctr",
        location: { lat: -32.9, lng: -68.8, city: "Mendoza", countryCode: "AR", precision: "approximate", source: "browser_geolocation_approximate_consent", accuracyM: 150, measuredAt: now, receivedAt: now, timing: "client_reported_after_tap" },
      } });
    });
    await page.addInitScript(({ scenario }) => {
      window.fixtureGeoCalls = 0;
      window.fixtureGeoCallbacks = [];
      Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
        getCurrentPosition(success, error, options) {
          window.fixtureGeoCalls += 1;
          window.fixtureGeoOptions = options;
          window.fixtureGeoCallbacks.push(() => {
            if (scenario === "denied" || scenario === "timeout") error({ code: scenario === "denied" ? 1 : 3 });
            else success({ coords: { latitude: -32.901234, longitude: -68.801234, accuracy: 10 }, timestamp: Date.now() });
          });
        },
      } });
    }, { scenario });
    await page.goto(`${origin}/${scenario === "disabled" ? "?disabled=1" : ""}`);
    const firstButton = page.getByTestId("sun-location-consent-cta");
    await firstButton.waitFor();
    if (scenario === "disabled") {
      assert.equal(await firstButton.isDisabled(), true);
      assert.equal(await page.evaluate(() => window.fixtureGeoCalls), 0);
      assert.equal(posts.length, 0);
      results.push({ scenario, pass: true });
      await context.close();
      continue;
    }
    await page.waitForFunction(() => !document.querySelector('[data-testid="sun-location-consent-cta"]').disabled);
    assert.equal(await page.evaluate(() => window.fixtureGeoCalls), 0, "No permission on mount");
    if(scenario === "success") {
      const quick=page.getByTestId("sun-location-quick-action");
      await quick.getByRole("button",{name:"Ahora no",exact:true}).click();
      assert.equal(await page.evaluate(()=>window.fixtureGeoCalls),0,"Declining never requests location");
      await quick.getByRole("button",{name:"Compartir ubicación",exact:true}).click();
      assert.equal(await page.evaluate(()=>window.fixtureGeoCalls),0,"Reopening is not consent");
      const bounds=await firstButton.boundingBox();assert.ok(bounds && bounds.height>=44 && bounds.y+bounds.height<844,"Primary action visible in fixture viewport");
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No horizontal overflow");
      if(process.env.QA_OUTPUT){await page.screenshot({path:join(process.env.QA_OUTPUT,"location-prompt-light.png"),fullPage:false});await page.evaluate(()=>document.documentElement.dataset.theme="dark");await page.screenshot({path:join(process.env.QA_OUTPUT,"location-prompt-dark.png"),fullPage:false});}
    }
    await firstButton.click();
    await page.waitForFunction(() => window.fixtureGeoCalls === 1 && document.querySelector('[data-testid="sun-location-consent-cta"]').disabled);
    assert.equal(await firstButton.isDisabled(), true);
    assert.match(await firstButton.textContent(), /Solicitando permiso/);
    // A rapid double tap or alternate entry point must not create another request.
    await page.evaluate(() => {
      document.querySelector('[data-testid="sun-location-consent-cta"]').click();
      document.querySelector('#tap-location-consent button').click();
    });
    assert.equal(await page.evaluate(() => window.fixtureGeoCalls), 1);
    await page.evaluate(() => window.fixtureGeoCallbacks.shift()());
    if (scenario === "success") {
      await page.waitForFunction(() => document.querySelector('[data-location-state="saving"]'));
      assert.equal(posts.length, 1);
      assert.match(await firstButton.textContent(), /Guardando zona/);
      assert.equal(await page.getByTestId("sun-summary-location-confirmed").count(), 0, "Not saved before receipt");
      assert.equal(posts[0].geoConsent, true);
      assert.equal(posts[0].geo.lat, -32.901);
      assert.equal(posts[0].geo.accuracy, 150);
      releaseResponse();
      await page.locator('[data-location-state="updated"]').waitFor();
      assert.match(await page.getByTestId("sun-summary-location-confirmed").textContent(), /Mendoza, AR/);
      assert.match(await page.getByTestId("sun-origin-location-confirmed").textContent(), /Origen y zona compartida/);
      assert.doesNotMatch(await page.getByTestId("sun-origin-location-confirmed").textContent(), /estimada por red|Estimación de red/);
      assert.equal(await page.locator('[data-sun-passport-map]').getAttribute("data-location-source"), "consented_browser");
      assert.match(await page.locator("#geo-trace").textContent(), /Mendoza, AR/);
      assert.equal(posts.length, 1);
      if(process.env.QA_OUTPUT)await page.screenshot({path:join(process.env.QA_OUTPUT,"location-confirmed.png"),fullPage:false});
      await page.reload();
      await page.getByTestId("sun-summary-location-confirmed").waitFor();
      assert.equal(await page.evaluate(() => window.fixtureGeoCalls), 0, "Reload restores receipt, not permission");
      assert.equal(posts.length, 1);
      await page.locator("#next-tap").click();
      await page.getByTestId("sun-location-consent-cta").waitFor();
      assert.equal(await page.getByTestId("sun-summary-location-confirmed").count(), 0, "New tap cannot reuse prior receipt");
      assert.match(await page.locator("#geo-trace").textContent(), /Buenos Aires, AR/);
    } else {
      await page.locator(`[data-location-state="${scenario === "upstream_unknown" ? "uncertain" : scenario}"]`).waitFor();
      assert.equal(await page.getByTestId("sun-summary-location-confirmed").count(), 0);
      assert.equal(posts.length, ["uncertain", "upstream_unknown", "retryable"].includes(scenario) ? 1 : 0);
      if (scenario === "uncertain" || scenario === "upstream_unknown") {
        assert.equal(await firstButton.count(), 0, "Uncertain delivery cannot silently resend");
        await page.getByRole("link", { name: "Ver estado de la ubicación" }).click();
        assert.equal(await page.evaluate(() => window.fixtureGeoCalls), 1);
      } else {
        assert.equal(await firstButton.isEnabled(), true);
      }
    }
    assert.deepEqual(errors, [], "No React or client errors");
    results.push({ scenario, pass: true, permissionRequests: 1, submissions: posts.length });
    await context.close();
  }
  if(process.env.QA_OUTPUT)await writeFile(join(process.env.QA_OUTPUT,"report.json"),JSON.stringify({localSynthetic:true,results},null,2));
  console.log(JSON.stringify({ evidence: "LOCAL simulated permission and API, real React components and Chromium; NOT physical certification", results }, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
