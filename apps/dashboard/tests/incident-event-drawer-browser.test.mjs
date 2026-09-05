import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const browserModule = process.env.NEXID_TEST_PLAYWRIGHT_MODULE;
const chromiumPath = process.env.NEXID_TEST_CHROMIUM;

test("incident drawer stays above global headers and preserves keyboard, scroll and row return", {
  skip: !browserModule || !chromiumPath ? "Set NEXID_TEST_PLAYWRIGHT_MODULE and NEXID_TEST_CHROMIUM to run the installed-browser check." : false,
  timeout: 60_000,
}, async () => {
  const { build } = await import("esbuild");
  const { chromium } = await import(browserModule);
  const fixture = `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { IncidentEventDrawerFrame } from './incident-event-drawer-frame';
    import { IncidentEventDrawer } from './incident-event-drawer';
    const onIncident = () => {};
    const localEvent = {eventId:'local-ui-fixture-only', tenantId:'fixture-tenant', tenantSlug:'local-ui-fixture', uidMasked:'••••1234', productName:'Producto ilustrativo local', occurredAt:'2026-09-05T15:00:00Z', timezone:'America/Argentina/Buenos_Aires', verdict:'VALID', riskLevel:'none', reason:'valid_reading', source:'demo', eventSource:'demo'};
    function Fixture() {
      const [selected, setSelected] = useState(null);
      const [detailSource, setDetailSource] = useState(null);
      return <>
        <header style={{position:'fixed',top:0,left:0,right:0,height:100,zIndex:2147483647,background:'#eedddd'}} data-testid="global-header">Global header</header>
        <main style={{paddingTop:180,minHeight:2000,transform:'translateZ(0)',isolation:'isolate'}}>
          {[0,1].map(index => <button key={index} data-incident-event-key={'event-'+index} onClick={() => setSelected(index)}>Open event {index+1}</button>)}
          {['demo','production','unknown'].map(source=><button key={source} onClick={()=>setDetailSource(source)}>Open {source} detail</button>)}
          {detailSource ? <IncidentEventDrawer event={{...localEvent,source:detailSource,eventSource:detailSource}} operationalTimeZone={{timeZone:'America/Argentina/Buenos_Aires',isFallback:false}} incident={null} incidentAvailability="ready" canRead={true} canWrite={true} onClose={()=>setDetailSource(null)} onIncident={onIncident} /> : null}
          {selected !== null ? <IncidentEventDrawerFrame
            key={selected} eventKey={'event-'+selected} title={'Evidence '+(selected+1)} description="Local UI fixture; no API or physical event."
            onClose={() => setSelected(null)}
            navigation={{position:selected+1,total:2,onPrevious:selected>0?()=>setSelected(selected-1):undefined,onNext:selected<1?()=>setSelected(selected+1):undefined}}
          >
            <label>Editable fixture field<input aria-label="Fixture field" /></label>
            {Array.from({length:35},(_,i)=><p key={i}>Evidence row {i+1}</p>)}
            <button>Last content control</button>
          </IncidentEventDrawerFrame> : null}
        </main>
      </>;
    }
    createRoot(document.getElementById('root')).render(<Fixture />);
  `;
  const built = await build({
    stdin: { contents: fixture, resolveDir: fileURLToPath(new URL("../src/components/", import.meta.url)), sourcefile: "drawer-fixture.tsx", loader: "tsx" },
    bundle: true, write: false, outdir: "fixture-output", format: "esm", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const javascript = built.outputFiles.find((file) => file.path.endsWith(".js")).text;
  const stylesheet = built.outputFiles.find((file) => file.path.endsWith(".css")).text;
  const { default: postcss } = await import("postcss");
  const { default: tailwindcss } = await import("tailwindcss");
  const drawerSource = await readFile(new URL("../src/components/incident-event-drawer.tsx", import.meta.url), "utf8");
  const globals = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const globalStyles = (await postcss([tailwindcss({ content: [{raw:drawerSource,extension:"tsx"}] })]).process(globals, {from:undefined})).css;
  const apiRequests = [];
  const server = createServer((request, response) => {
    if (request.url.startsWith("/api/")) {
      apiRequests.push(request.method);
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ok:true,incidents:[],dataSource:"demo"}));
    } else if (request.url === "/fixture.js") { response.setHeader("content-type", "text/javascript"); response.end(javascript); }
    else { response.setHeader("content-type", "text/html"); response.end(`<!doctype html><html class="theme-light" data-theme="light"><head><meta name="viewport" content="width=device-width"><style>${globalStyles}html,body{margin:0;font-family:system-ui}*{box-sizing:border-box}${stylesheet}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>`); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true, executablePath: chromiumPath });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Open event 1", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    assert.equal(await dialog.evaluate((element) => element.matches(":modal")), true);
    assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), "hidden");
    assert.equal(await page.getByRole("button", { name: "Cerrar detalle", exact: true }).evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }), true, "the close control must be above even a maximum-z-index global header");
    for (let index = 0; index < 9; index += 1) {
      await page.keyboard.press("Tab");
      assert.equal(await dialog.evaluate((element) => element.contains(document.activeElement)), true, "Tab must remain in the modal");
    }
    await page.getByRole("button", { name: "Cerrar detalle", exact: true }).focus();
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.getByRole("button", { name: "Volver a últimos eventos", exact: true }).evaluate((button) => button === document.activeElement), true);
    const headerTop = await page.getByTestId("incident-drawer-header").evaluate((element) => element.getBoundingClientRect().top);
    await page.getByTestId("incident-drawer-content").evaluate((element) => { element.scrollTop = element.scrollHeight; });
    assert.equal(await page.getByTestId("incident-drawer-header").evaluate((element) => element.getBoundingClientRect().top), headerTop);
    assert.equal(await page.getByRole("button", { name: "Cerrar detalle", exact: true }).isVisible(), true);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog") && document.activeElement?.getAttribute("data-incident-event-key") === "event-0");
    assert.equal(await page.evaluate(() => document.body.style.overflow), "");

    await page.getByRole("button", { name: "Open event 1", exact: true }).click();
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await page.getByRole("heading", { name: "Evidence 2", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Siguiente", exact: true }).isDisabled(), true);
    assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
    await page.getByRole("button", { name: "Volver a últimos eventos", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector("dialog") && document.activeElement?.getAttribute("data-incident-event-key") === "event-1");

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 740 });
      await page.getByRole("button", { name: "Open event 1", exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const close = await page.getByRole("button", { name: "Cerrar detalle", exact: true }).boundingBox();
      assert.ok(close.x >= 0 && close.x + close.width <= width && close.height >= 44);
      if (process.env.NEXID_TEST_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.NEXID_TEST_SCREENSHOT_DIR}/incident-drawer-${width}.png` });
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector("dialog"));
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "Open event 1", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.mouse.click(20, 300);
    await page.waitForFunction(() => !document.querySelector("dialog"));

    // Hold one localhost lookup to distinguish a pending request from failure.
    let receiveLookup;
    const pendingLookup = new Promise((resolve) => { receiveLookup = resolve; });
    await page.route(/\/api\/admin\/incidents\?/, (route) => receiveLookup(route), {times:1});
    await page.getByRole("button", {name:"Open demo detail",exact:true}).click();
    const heldLookup = await pendingLookup;
    await page.getByTestId("incident-loading-state").waitFor();
    assert.equal(await page.getByTestId("incident-unconfirmed-state").count(), 0);
    assert.equal(await page.getByTestId("incident-empty-state").count(), 0);
    await heldLookup.fulfill({status:503,contentType:"application/json",body:JSON.stringify({ok:false,reason:"local_test_unavailable"})});
    await page.getByTestId("incident-unconfirmed-state").waitFor();
    assert.equal(await page.getByTestId("incident-loading-state").count(), 0);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog"));

    // Render the real detail component against a local-only empty lookup. This
    // checks source labels and utility colors after escaping the CRM ancestry.
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
        document.documentElement.className = `theme-${value}`;
      }, theme);
      for (const width of [1280, 390, 320]) {
        await page.setViewportSize({width,height:800});
        await page.getByRole("button", {name:"Open demo detail",exact:true}).click();
        await page.getByTestId("incident-empty-state").waitFor();
        assert.equal(await page.getByRole("heading", {name:"Producto ilustrativo local",exact:true}).count(), 1);
        assert.equal(await page.getByTestId("incident-edit-disclosure").count(), 0);
        assert.equal(await page.locator('[data-evidence-tone="normal"]').count(), 1);
        assert.equal(await page.getByTestId("incident-technical-disclosure").getAttribute("open"), null);
        assert.doesNotMatch(await page.getByTestId("incident-drawer-header").innerText(), /America\//);
        assert.match(await page.getByTestId("incident-drawer-header").innerText(), /UTC-03:00/);
        const colors = await page.getByTestId("incident-drawer-content").evaluate((content) => {
          const text = content.querySelector('p.text-white');
          const card = text.parentElement;
          return { text:getComputedStyle(text).color, card:getComputedStyle(card).backgroundColor, width:document.documentElement.scrollWidth };
        });
        assert.equal(colors.text, theme === "light" ? "rgb(19, 43, 68)" : "rgb(255, 255, 255)");
        assert.notEqual(colors.text, colors.card);
        assert.ok(colors.width <= width);
        if (process.env.NEXID_TEST_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.NEXID_TEST_SCREENSHOT_DIR}/incident-detail-${theme}-${width}.png`});
        const technicalSummary = page.getByText("Datos técnicos de la lectura", {exact:true});
        await technicalSummary.focus();
        await page.keyboard.press("Enter");
        assert.notEqual(await page.getByTestId("incident-technical-disclosure").getAttribute("open"), null);
        assert.match(await page.getByTestId("incident-technical-disclosure").innerText(), /local-ui-fixture-only/);
        assert.match(await page.getByTestId("incident-technical-disclosure").innerText(), /Resultado canónico: VALID/);
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector("dialog"));
      }
    }
    for (const source of ["production", "unknown"]) {
      await page.getByRole("button", {name:`Open ${source} detail`,exact:true}).click();
      await page.getByTestId("incident-empty-state").waitFor();
      if (source === "production") {
        assert.equal(await page.getByTestId("incident-edit-disclosure").getAttribute("open"), null);
        await page.getByText("Abrir un expediente", {exact:true}).click();
        await page.getByRole("textbox", {name:"Razón auditable de la decisión"}).waitFor();
      } else assert.equal(await page.getByTestId("incident-edit-disclosure").count(), 0);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector("dialog"));
    }
    assert.ok(apiRequests.length > 0);
    assert.ok(apiRequests.every((method) => method === "GET"));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
