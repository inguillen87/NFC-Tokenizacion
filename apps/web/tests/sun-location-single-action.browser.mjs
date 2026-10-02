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
  const url = new URL(req.url, "http://fixture.invalid");
  if (req.method === "POST" && url.pathname === "/fixture-context") {
    // Actual streamed HTTP exercises fetch aborts both before headers and while
    // reading a response body; mocked fetch promises would not prove that path.
    req.resume();
    if (url.searchParams.get("submission") === "stall_body") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.write('{"ok":true,');
    }
  }
  else if (req.url === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); res.end(js); }
  else if (req.url === "/fixture.css") { res.setHeader("Content-Type", "text/css"); res.end(css); }
  else if (req.method === "GET") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end('<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/fixture.css"><style>body{font:16px system-ui;margin:12px}button{min-height:48px;margin:0}svg{max-width:24px}#summary{padding:16px;border:1px solid teal}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  } else { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
const results = [];
if(process.env.QA_OUTPUT)await mkdir(process.env.QA_OUTPUT,{recursive:true});
try {
  for (const scenario of ["success", "permission_pregranted", "permission_api_unavailable", "permission_api_rejected", "permission_api_throws", "abandoned_measurement", "denied", "timeout", "uncertain", "upstream_unknown", "upstream_error", "expired", "unauthorized", "retryable", "stall_headers", "stall_body", "disabled"]) {
    const isSuccess = scenario === "success" || scenario.startsWith("permission_");
    const noPermissionInspection = scenario.startsWith("permission_api_");
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    if (scenario.startsWith("stall_")) await page.clock.install();
    const streamedResponse = scenario === "stall_body"
      ? page.waitForResponse(response => new URL(response.url()).pathname === "/fixture-context")
      : null;
    const errors = [];
    const posts = [];
    let releaseResponse;
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname !== "/fixture-context") return route.continue();
      posts.push(route.request().postDataJSON());
      if (scenario.startsWith("stall_")) return route.continue();
      if (isSuccess) await new Promise(resolve => { releaseResponse = resolve; });
      const now = new Date().toISOString();
      if (scenario === "retryable") return route.fulfill({ status: 429, json: { reason: "rate_limited" } });
      if (scenario === "upstream_unknown") return route.fulfill({ status: 503, json: { reason: "sun_context_upstream_unavailable" } });
      if (scenario === "upstream_error") return route.fulfill({ status: 500, json: { reason: "persistence_unknown" } });
      if (scenario === "expired") return route.fulfill({ status: 403, json: { reason: "fresh_tap_capability_required", fresh_token_status: "fresh_token_expired" } });
      if (scenario === "unauthorized") return route.fulfill({ status: 401, json: { reason: "authentication_unknown" } });
      if (scenario === "uncertain") return route.fulfill({ status: 200, json: { ok: true, updated: true, eventId: "wrong-fixture", matchedBy: "signed_event_bid_uid_ctr" } });
      return route.fulfill({ status: 200, json: {
        ok: true, updated: true, eventId: posts.at(-1).eventId, matchedBy: "signed_event_bid_uid_ctr",
        location: { lat: -32.9, lng: -68.8, city: "Mendoza", countryCode: "AR", precision: "approximate", source: "browser_geolocation_approximate_consent", accuracyM: 150, measuredAt: now, receivedAt: now, timing: "client_reported_after_tap" },
      } });
    });
    await page.addInitScript(({ scenario }) => {
      window.fixtureGeoCalls = 0;
      window.fixtureGeoCallbacks = [];
      const permission = new EventTarget();
      const permissionListeners = new Set();
      const addPermissionListener = permission.addEventListener.bind(permission);
      const removePermissionListener = permission.removeEventListener.bind(permission);
      permission.addEventListener = (type, listener, options) => {
        if (type === "change") permissionListeners.add(listener);
        addPermissionListener(type, listener, options);
      };
      permission.removeEventListener = (type, listener, options) => {
        if (type === "change") permissionListeners.delete(listener);
        removePermissionListener(type, listener, options);
      };
      window.fixturePermissionListenerCount = () => permissionListeners.size;
      permission.state = scenario === "permission_pregranted" ? "granted" : "prompt";
      window.fixtureGrantPermission = () => { permission.state = "granted"; permission.dispatchEvent(new Event("change")); };
      Object.defineProperty(navigator, "permissions", { configurable: true, value: scenario === "permission_api_unavailable" ? undefined : {
        query: () => {
          if (scenario === "permission_api_throws") throw new Error("Permission inspection unsupported");
          return scenario === "permission_api_rejected" ? Promise.reject(new Error("Permission inspection unsupported")) : Promise.resolve(permission);
        },
      } });
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
    await page.goto(`${origin}/${scenario === "disabled" ? "?disabled=1" : scenario.startsWith("stall_") ? `?submission=${scenario}` : ""}`);
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
      const entryBounds=await quick.boundingBox();
      assert.ok(entryBounds && entryBounds.height<=190,"Optional location prompt remains compact at 390px");
      assert.match(await quick.locator("h2 + p").innerText(),/Opcional.*aproximada/,"Optional scope is visible before consent");
      assert.equal(await quick.locator("details").getAttribute("open"),null,"Full privacy explanation starts collapsed");
      await quick.getByRole("button",{name:"Ahora no",exact:true}).click();
      assert.equal(await page.evaluate(()=>window.fixtureGeoCalls),0,"Declining never requests location");
      assert.ok((await quick.getByRole("button",{name:"Compartir ubicación",exact:true}).boundingBox()).height>=44,"Reopen target remains at least 44px");
      await quick.getByRole("button",{name:"Compartir ubicación",exact:true}).click();
      assert.equal(await page.evaluate(()=>window.fixtureGeoCalls),0,"Reopening is not consent");
      assert.ok((await quick.locator("summary").boundingBox()).height>=44,"Privacy disclosure target remains at least 44px");
      const bounds=await firstButton.boundingBox();assert.ok(bounds && bounds.height>=44 && bounds.y+bounds.height<844,"Primary action visible in fixture viewport");
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"No horizontal overflow");
      if(process.env.QA_OUTPUT){await page.screenshot({path:join(process.env.QA_OUTPUT,"location-prompt-light.png"),fullPage:false});await page.evaluate(()=>document.documentElement.dataset.theme="dark");await page.screenshot({path:join(process.env.QA_OUTPUT,"location-prompt-dark.png"),fullPage:false});}
    }
    await firstButton.click();
    await page.waitForFunction(() => window.fixtureGeoCalls === 1 && document.querySelector('[data-testid="sun-location-consent-cta"]').disabled);
    assert.equal(await firstButton.isDisabled(), true);
    if (scenario !== "permission_pregranted") {
      assert.match(await firstButton.textContent(), /Solicitando permiso/);
      assert.match(await page.getByTestId("sun-location-phase").textContent(), /Si aparece el permiso/);
      await page.evaluate(() => window.fixtureGrantPermission());
    }
    if (noPermissionInspection) {
      assert.equal(await page.locator('[data-location-state="measuring"]').count(), 0, "No unconfirmed claim that permission was granted");
    } else {
      await page.waitForFunction(() => document.querySelector('[data-location-state="measuring"]'));
      assert.match(await firstButton.textContent(), /Obteniendo zona/);
      assert.match(await page.getByTestId("sun-location-phase").textContent(), /todavía no se guardó/);
    }
    if(scenario === "success" && process.env.QA_OUTPUT)await page.screenshot({path:join(process.env.QA_OUTPUT,"location-measuring.png"),fullPage:false});
    // A rapid double tap or alternate entry point must not create another request.
    await page.evaluate(() => {
      document.querySelector('[data-testid="sun-location-consent-cta"]').click();
      document.querySelector('#tap-location-consent button').click();
    });
    assert.equal(await page.evaluate(() => window.fixtureGeoCalls), 1);
    if (scenario === "abandoned_measurement") {
      assert.equal(await page.evaluate(() => window.fixturePermissionListenerCount()), 1, "Active measurement observes permission changes");
      await page.locator("#next-tap").click();
      await page.waitForFunction(() => document.querySelector('[data-location-state="idle"]') && !document.querySelector('[data-testid="sun-location-consent-cta"]').disabled);
      assert.equal(await page.evaluate(() => window.fixturePermissionListenerCount()), 0, "Unmount immediately removes the permission listener");
      await page.evaluate(() => window.fixtureGeoCallbacks.shift()());
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(posts.length, 0, "Measurement from an abandoned tap never starts a POST");
      assert.equal(await page.getByTestId("sun-summary-location-confirmed").count(), 0, "Old measurement cannot confirm the new tap");
      assert.equal(await page.locator('[data-location-state="idle"]').count(), 1, "New tap stays idle after the old callback");
      assert.equal(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith("nexid:tap-context:")).length), 0, "Discarded measurement creates no receipt");
      await firstButton.click();
      await page.waitForFunction(() => window.fixtureGeoCalls === 2 && document.querySelector('[data-location-state="measuring"]'));
      await page.evaluate(() => window.fixtureGeoCallbacks.shift()());
      await page.locator('[data-location-state="updated"]').waitFor();
      const confirmedQuick=page.getByTestId("sun-location-quick-action");
      assert.equal(await confirmedQuick.getByTestId("sun-location-quick-confirmed").innerText(),"Mendoza, AR","The quick card displays the server receipt, not the previous network estimate");
      assert.equal(await confirmedQuick.getByTestId("sun-location-quick-confirmed").getAttribute("data-sun-server-evidence"),"true","Receipt city and country remain protected evidence");
      assert.match(await confirmedQuick.locator("p").first().innerText(),/zona aproximada con permiso/,"The receipt source remains visible");
      const mapLink=confirmedQuick.getByRole("link",{name:"Ver zona en el mapa",exact:true});
      assert.equal(await mapLink.getAttribute("href"),"#geo-trace");
      assert.equal(await mapLink.isVisible(),true,"The map action is outside collapsed evidence");
      assert.ok((await mapLink.boundingBox()).height>=44,"Confirmed map action remains touch sized");
      assert.equal(posts.length, 1, "A separate user request can save the new tap once");
      assert.equal(posts[0].eventId, "local-fixture-2", "Only the new tap is sent");
      assert.equal(await page.evaluate(() => window.fixturePermissionListenerCount()), 0, "Completed measurement releases its permission listener");
      assert.deepEqual(errors, [], "No React or client errors after abandoning a measurement");
      results.push({ scenario, pass: true, permissionRequests: 2, abandonedSubmissions: 0, submissions: 1 });
      await context.close();
      continue;
    }
    await page.evaluate(() => window.fixtureGeoCallbacks.shift()());
    if (isSuccess) {
      await page.waitForFunction(() => document.querySelector('[data-location-state="saving"]'));
      assert.equal(posts.length, 1);
      assert.match(await firstButton.textContent(), /Guardando zona/);
      assert.match(await page.getByTestId("sun-location-phase").textContent(), /Esperamos el comprobante/);
      if(scenario === "success" && process.env.QA_OUTPUT)await page.screenshot({path:join(process.env.QA_OUTPUT,"location-saving.png"),fullPage:false});
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
      const isAmbiguous = ["uncertain", "upstream_unknown", "upstream_error", "unauthorized", "stall_headers", "stall_body"].includes(scenario);
      if (scenario.startsWith("stall_")) {
        await page.locator('[data-location-state="saving"]').waitFor();
        await page.waitForFunction(() => document.querySelector('[data-testid="sun-location-quick-action"]').dataset.state === "saving");
        assert.match(await page.getByTestId("sun-location-phase").textContent(), /Esperamos el comprobante/);
        assert.equal(posts.length, 1);
        if (streamedResponse) assert.equal((await streamedResponse).status(), 200, "Body-stall scenario has already received response headers");
        // Move simulated time past the actual component budget, covering headers
        // and body without a 12-second wall-clock sleep in each scenario.
        await page.clock.fastForward(12_001);
      }
      const expectedState = isAmbiguous ? "uncertain" : scenario === "expired" ? "fresh_tap_required" : scenario;
      await page.locator(`[data-location-state="${expectedState}"]`).waitFor();
      assert.equal(await page.getByTestId("sun-summary-location-confirmed").count(), 0);
      assert.equal(posts.length, isAmbiguous || ["expired", "retryable"].includes(scenario) ? 1 : 0);
      if (isAmbiguous || scenario === "expired") {
        assert.equal(await firstButton.count(), 0, "Uncertain delivery cannot silently resend");
        assert.match(await page.getByTestId("sun-location-quick-action").textContent(), /TAP|etiqueta/);
        await page.getByRole("link", { name: "Ver estado de la ubicación" }).click();
        assert.equal(await page.evaluate(() => window.fixtureGeoCalls), 1);
        assert.equal(posts.length, 1, "Reading the status never resends a consumed or ambiguous capability");
        assert.equal(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith("nexid:tap-context:")).length), 0, "No saved receipt for an ambiguous or rejected response");
      } else {
        assert.equal(await firstButton.isEnabled(), true);
        assert.equal(await firstButton.innerText(), "Reintentar", "Retryable measurement or delivery offers an explicit manual retry");
        if (scenario === "retryable") {
          assert.match(await page.getByTestId("sun-location-quick-action").textContent(), /La zona no se guardó esta vez/);
          assert.doesNotMatch(await page.getByTestId("sun-location-quick-action").textContent(), /No se obtuvo una ubicación utilizable/);
        }
      }
    }
    assert.deepEqual(errors, [], "No React or client errors");
    results.push({ scenario, pass: true, permissionRequests: 1, submissions: posts.length });
    await context.close();
  }
  for (const copy of [
    { locale: "es-AR", retry: "Reintentar", retryMessage: "La zona no se guardó esta vez", details: "Qué se comparte", conditional: "cuando esté disponible" },
    { locale: "en", retry: "Try again", retryMessage: "The area was not saved this time", details: "What is shared", conditional: "when available" },
    { locale: "pt-BR", retry: "Tentar novamente", retryMessage: "A área não foi salva desta vez", details: "O que é compartilhado", conditional: "quando disponível" },
  ]) {
    const context = await browser.newContext({ viewport: { width: 320, height: 844 } }), page = await context.newPage();
    const posts = [], errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/fixture-context") {
        posts.push(request.postDataJSON());
        return route.fulfill({ status: 429, json: { reason: "rate_limited" } });
      }
      return route.continue();
    });
    await page.addInitScript(() => {
      window.fixtureGeoCalls = 0; window.fixtureGeoCallbacks = [];
      const permission = new EventTarget(); permission.state = "granted";
      Object.defineProperty(navigator, "permissions", { configurable: true, value: { query: async () => permission } });
      Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
        getCurrentPosition(success) {
          window.fixtureGeoCalls++;
          window.fixtureGeoCallbacks.push(() => success({ coords: { latitude: -32.901234, longitude: -68.801234, accuracy: 10 }, timestamp: Date.now() }));
        },
      } });
    });
    await page.goto(`${origin}/?locale=${copy.locale}`);
    const quick = page.getByTestId("sun-location-quick-action"), button = quick.getByTestId("sun-location-consent-cta");
    await page.waitForFunction(() => !document.querySelector('[data-testid="sun-location-consent-cta"]').disabled);
    await quick.locator("summary").filter({ hasText: copy.details }).click();
    assert.ok((await quick.innerText()).includes(copy.conditional), "IP copy makes availability conditional in " + copy.locale);
    assert.equal(await page.evaluate(() => window.fixtureGeoCalls), 0, "Reading privacy is not location consent");
    assert.equal(posts.length, 0);
    await button.click();
    await page.waitForFunction(() => window.fixtureGeoCalls === 1);
    await page.evaluate(() => window.fixtureGeoCallbacks.shift()());
    await page.waitForFunction(() => document.querySelector('[data-testid="sun-location-quick-action"]').dataset.state === "retryable");
    assert.ok((await quick.innerText()).includes(copy.retryMessage), "Failed persistence is explained without calling it a measurement failure in " + copy.locale);
    assert.equal(await button.innerText(), copy.retry);
    assert.equal(await page.getByTestId("sun-summary-location-confirmed").count(), 0, "429 never becomes a saved receipt");
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(posts.length, 1, "Displaying the retry state never automatically resends");
    assert.equal(await page.evaluate(() => window.fixtureGeoCalls), 1);
    await button.focus(); await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.fixtureGeoCalls === 2);
    assert.equal(posts.length, 1, "A user retry still waits for a new measurement");
    await page.evaluate(() => window.fixtureGeoCallbacks.shift()());
    await page.waitForFunction(() => document.querySelector('[data-testid="sun-location-quick-action"]').dataset.state === "retryable");
    assert.equal(posts.length, 2, "Only the explicit keyboard retry starts another local submission");
    assert.equal(posts[1].geoConsent, true);
    assert.equal(await page.getByTestId("sun-summary-location-confirmed").count(), 0);
    assert.deepEqual(errors, []);
    results.push({ scenario: "localized_manual_retry", locale: copy.locale, pass: true, permissionRequests: 2, submissions: 2, automaticRetries: 0 });
    if (process.env.QA_OUTPUT) await page.screenshot({ path: join(process.env.QA_OUTPUT, `location-retry-${copy.locale}-320.png`), fullPage: false });
    await context.close();
  }
  if(process.env.QA_OUTPUT)await writeFile(join(process.env.QA_OUTPUT,"report.json"),JSON.stringify({localSynthetic:true,results},null,2));
  console.log(JSON.stringify({ evidence: "LOCAL simulated permission and API, real React components and Chromium; NOT physical certification", results }, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
