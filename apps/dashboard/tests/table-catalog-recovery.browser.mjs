import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, stop } from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

assert.ok(process.env.PLAYWRIGHT_MODULE && process.env.CHROME_PATH && process.env.AXE_MODULE_PATH && process.env.QA_OUTPUT, "Use the installed, explicit QA tools and an output directory; this test never installs tools");
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axe = await readFile(process.env.AXE_MODULE_PATH, "utf8");
const app = fileURLToPath(new URL("../", import.meta.url)), root = resolve(app, "../.."), output = resolve(process.env.QA_OUTPUT);
const sourcePaths = ["src/components/data-table.tsx", "src/components/tenant-marketplace-workspace.tsx", "src/components/tenant-marketplace-workspace.module.css", "src/components/dashboard-shell-header.module.css", "src/lib/data-table-copy.ts", "src/lib/dashboard-content.ts"];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const sourceHashes = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async name => [name, hash(await readFile(join(app, name)))])));
const before = await sourceHashes();
const rows = [
  { status: "pending", product: "Malbec sintético", message: "Consulta QA Malbec" },
  { status: "contacted", product: "Pinot sintético", message: "Consulta QA Pinot" },
  { status: "qualified", product: "=SUM(1,2)", message: "<b>Literal QA</b>" },
];
const time = "2026-10-06T12:34:56.123456Z";
const catalog = {
  tenant: "qa-only",
  brand: { id: "20000000-0000-4000-8000-000000000001", status: "active", display_name: "Marca sintética QA", slug: "qa-only", vertical: "cosmetics", description: null, country: null, city: null, visible_in_network: true, updatedAt: time },
  items: Array.from({ length: 30 }, (_, index) => ({ id: "10000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"), status: "draft", title: "Producto QA " + (index + 1), description: "Contenido sintético", vertical: "cosmetics", category: null, image_url: null, price_amount: null, price_currency: null, external_checkout_url: null, request_to_buy_enabled: true, age_gate_required: false, updatedAt: time })),
  hasMore: false,
};
const entry = [
  'import React from "react";import {createRoot} from "react-dom/client";',
  'import {DataTable} from "./src/components/data-table";import TenantMarketplaceWorkspace from "./src/components/tenant-marketplace-workspace";',
  'import {dashboardContent} from "./src/lib/dashboard-content";import headerStyles from "./src/components/dashboard-shell-header.module.css";',
  "const initialRows=" + JSON.stringify(rows) + ",catalog=" + JSON.stringify(catalog) + ";",
  "window.__recoveryQa={downloads:[],downloadNames:[],refreshes:0,prints:0,fetches:[],scrollBehaviors:[]};",
  "const makeUrl=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{const item={type:blob.type,text:null};window.__recoveryQa.downloads.push(item);blob.text().then(text=>item.text=text);return makeUrl(blob);};",
  "const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){window.__recoveryQa.downloadNames.push(this.download);return;}return click.call(this);};",
  "window.print=()=>window.__recoveryQa.prints++;window.fetch=(...args)=>{window.__recoveryQa.fetches.push(String(args[0]));return Promise.reject(Error('Unexpected synthetic QA transport'));};",
  "const scroll=HTMLElement.prototype.scrollIntoView;HTMLElement.prototype.scrollIntoView=function(options){window.__recoveryQa.scrollBehaviors.push(options?.behavior||null);return scroll.call(this,options);};",
  // Actual production header CSS and matching two-row identity/controls geometry.
  // No account-menu component/session is mounted; geometry is measured below.
  'function HeaderGeometry(){return <header data-testid="catalog-header-geometry" className={"dashboard-header sticky top-0 z-30 border-b border-white/5 "+headerStyles.header}><div className={headerStyles.layout}><div className={headerStyles.identity}><button type="button" aria-label="Abrir navegación" className="min-h-11">☰</button><h1 className={headerStyles.title}>Catálogo sintético QA</h1></div><div className={headerStyles.controls}><select className="locale-switcher" aria-label="Idioma de ensayo"><option>ES</option></select><button type="button" className="theme-toggle" aria-label="Apariencia de ensayo">◐</button><div className="dashboard-shell-account-menu"><button type="button" data-testid="tenant-account-menu-trigger">Cuenta QA</button></div></div></div></header>;}',
  'function Fixture(){const [rows,setRows]=React.useState(initialRows);const [locale,setLocale]=React.useState("en");window.__qaReplaceRows=setRows;window.__qaSetLocale=setLocale;const copy=dashboardContent[locale];const view=new URLSearchParams(location.search).get("view");',
  'if(view==="catalog")return <div className="dashboard-main mx-auto max-w-7xl"><HeaderGeometry/><div className="p-4"><TenantMarketplaceWorkspace tenant="qa-only" canWrite={true} canSelectTenant={false} initialData={catalog}/></div></div>;',
  'return <main className="dashboard-main mx-auto w-full max-w-7xl min-w-0 space-y-6 p-4"><h1 className="text-2xl font-bold">Recuperación de tablas · datos sintéticos</h1><section data-testid="primary-table"><h2>Solicitudes sintéticas</h2><DataTable title="Pedidos QA" columns={[{key:"status",label:"Estado"},{key:"product",label:"Producto"},{key:"message",label:"Mensaje"}]} rows={rows} filterKey="status" loadingLabel="Actualizando solicitudes" emptyLabel="La fuente confirmó que no hay solicitudes para el scope actual." searchPlaceholder="Buscar solicitud" allFilterLabel="Todos los estados" statusMap={{pending:"Pendiente",contacted:"Contactado",qualified:"Calificado"}}/></section>',
  '<section data-testid="localized-table"><h2>Localized table recovery</h2><DataTable key={locale} {...copy.tableFeedback} title="Contacts QA" columns={[{key:"status",label:"Status"},{key:"product",label:"Product"},{key:"message",label:"Message"}]} rows={[initialRows[0]]} filterKey="status" loadingLabel={copy.shell.loading} emptyLabel={copy.shell.empty} searchPlaceholder={copy.shell.search} allFilterLabel={copy.shell.all} refreshLabel={copy.shell.refresh}/></section></main>;}',
  'createRoot(document.getElementById("root")).render(<Fixture/>);',
].join("\n");
const navigation = "export const useRouter=()=>({refresh(){window.__recoveryQa.refreshes++;}});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);";
const bundle = await build({ stdin: { contents: entry, loader: "tsx", resolveDir: app }, bundle: true, write: false, outfile: "recovery.js", platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" }, logLevel: "silent", plugins: [{
  name: "synthetic-next-navigation-only",
  setup(builder) {
    builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "qa" }));
    builder.onLoad({ filter: /.*/, namespace: "qa" }, () => ({ contents: navigation, loader: "js" }));
  },
}] });
const css = (await postcss([tailwindcss({
  content: [join(app, "src/**/*.{ts,tsx}").replaceAll("\\", "/"), join(root, "packages/ui/src/**/*.{ts,tsx}").replaceAll("\\", "/"), { raw: entry, extension: "tsx" }],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: { extend: { colors: { brand: { dark: "#020617", card: "#0f172a", border: "#1e293b", cyan: "#06b6d4", blue: "#3b82f6" } } } }, plugins: [],
})]).process(await readFile(join(app, "src/app/globals.css"), "utf8"), { from: undefined })).css + (bundle.outputFiles.find(file => file.path.endsWith(".css"))?.text || "");
const js = bundle.outputFiles.find(file => file.path.endsWith(".js")).contents;
const server = createServer((req, res) => {
  if (req.method !== "GET") { res.writeHead(405); res.end(); return; }
  const url = new URL(req.url, "http://synthetic.invalid");
  if (url.pathname === "/recovery.js") { res.setHeader("content-type", "text/javascript"); res.end(js); return; }
  if (url.pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }
  if (url.pathname !== "/") { res.writeHead(404); res.end(); return; }
  const theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
  res.setHeader("content-type", "text/html;charset=utf-8");
  res.end('<!doctype html><html lang="es-AR" class="theme-' + theme + '" data-theme="' + theme + '"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>Recuperación local · QA sintética</title><style>' + css + '</style></head><body><div id="root"></div><script src="/recovery.js"></script></body></html>');
});
const report = { localOnly: true, syntheticData: true, actualComponents: ["DataTable", "TenantMarketplaceWorkspace"], productionHeaderCssWithEquivalentGeometry: true, realDashboardShell: false, navigationStubbed: true, exportDownloadIntercepted: true, realNextServer: false, database: false, authentication: false, providerMutations: 0, checks: [], views: [], geometry: [], clientErrors: [], blockedRequests: [], sourceBefore: before, sourceAfter: null, closure: { contexts: false, browser: false, server: false, esbuild: false }, passed: false };
function check(condition, description) { report.checks.push({ description, passed: Boolean(condition) }); assert.ok(condition, description); }
async function unobstructedEditorFocus(page, target, width, theme, phase) {
  const geometry = await target.evaluate(element => {
    const rect = value => { const r = value.getBoundingClientRect();return { top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height }; };
    const header=document.querySelector('[data-testid="catalog-header-geometry"]'),layout=header.firstElementChild,bounds=rect(element),headerBounds=rect(header),hit=document.elementFromPoint((bounds.left+bounds.right)/2,(bounds.top+bounds.bottom)/2);
    return {bounds,headerBounds,headerPosition:getComputedStyle(header).position,headerColumns:getComputedStyle(layout).gridTemplateColumns,active:document.activeElement===element,ownHit:hit===element||element.contains(hit),unobstructed:bounds.top>=headerBounds.bottom+8&&bounds.bottom<=innerHeight-8};
  });
  report.geometry.push({width,theme,phase,...geometry});
  check(geometry.headerPosition==='sticky'&&(width<736?geometry.headerBounds.height>=119:geometry.headerBounds.height>=67),'Measured equivalent header preserves the production responsive identity/control geometry');
  check(geometry.active&&geometry.ownHit&&geometry.unobstructed,phase+': focused editor target remains visible below the measured sticky header');
}
let browser, origin;const contexts = new Set();
await mkdir(output, { recursive: true });
async function inspect(page, label, theme, width) {
  await page.addScriptTag({ content: axe });
  const violations = await page.evaluate(async () => (await axe.run("main", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) })));
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  const screenshot = label + "-" + width + "-" + theme + ".png";
  await page.screenshot({ path: join(output, screenshot), fullPage: false });
  report.views.push({ label, theme, width, violations, dimensions, screenshot });
  check(violations.length === 0, label + " " + width + " " + theme + ": no axe violations");
  check(dimensions.document <= dimensions.viewport + 1, label + " " + width + " " + theme + ": no horizontal page overflow");
}
async function setup(view, theme, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "es-AR", colorScheme: theme, reducedMotion: "reduce", serviceWorkers: "block", acceptDownloads: false });
  contexts.add(context);const page = await context.newPage();page.setDefaultTimeout(10000);
  page.on("pageerror", error => report.clientErrors.push({ view, theme, width, message: error.message }));
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin || request.method() !== "GET") { report.blockedRequests.push({ method: request.method(), origin: url.origin, pathname: url.pathname }); return route.abort(); }
    return route.continue();
  });
  await page.goto(origin + "/?view=" + view + "&theme=" + theme, { waitUntil: "networkidle" });
  return { context, page };
}
try {
  for (let port = 35070; ; port++) {
    try { await new Promise((done, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", done); }); server.removeAllListeners("error"); break; }
    catch (error) { server.removeAllListeners("error"); if (error.code !== "EADDRINUSE" || port >= 35079) throw error; }
  }
  origin = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  for (const theme of ["light", "dark"]) for (const width of [390, 1280]) {
    const tableView = await setup("table", theme, width);
    try {
      const { page } = tableView, table = page.getByTestId("primary-table"), search = table.getByRole("textbox", { name: "Buscar solicitud", exact: true }), filter = table.getByRole("combobox", { name: "Filtrar por estado", exact: true });
      await table.getByRole("status").getByText("3 de 3 filas visibles", { exact: true }).waitFor();
      check(await search.evaluate(e => e.labels.length === 1 && e.getAttribute("aria-describedby") && document.getElementById(e.getAttribute("aria-describedby")) !== null), "Search has an associated label and count description");
      check(await filter.evaluate(e => e.labels.length === 1), "Status selector has an associated label");
      check(await table.locator('.data-table-toolbar :is(input,select,button)').evaluateAll(elements => elements.every(e => e.getBoundingClientRect().height >= 44)), "Toolbar controls provide at least 44px touch targets");
      check(await page.getByTestId("localized-table").getByRole("status").innerText() === "1 of 1 rows visible", "Real English dashboard copy reaches the table count");
      const ids = await page.locator('input[id],select[id]').evaluateAll(elements => elements.map(e => e.id));
      check(new Set(ids).size === ids.length, "Multiple tables have distinct input/select IDs");
      await search.fill("Sin coincidencia QA");
      await table.getByTestId("data-table-filtered-empty").waitFor();
      check(await table.getByTestId("data-table-source-empty").count() === 0, "A local no-match search never claims the source is empty");
      check(await table.getByRole("status").innerText() === "0 de 3 filas visibles", "Live count reflects filtered results");
      await inspect(page, "table-filtered-empty", theme, width);
      await table.getByTestId("data-table-filtered-empty").getByRole("button", { name: "Limpiar filtros", exact: true }).click();
      check(await search.evaluate(e => e === document.activeElement), "Clearing empty results returns focus to search");
      check(await search.inputValue() === "" && await filter.inputValue() === "all", "Clear removes both filters");
      await filter.selectOption("pending");
      await page.evaluate(values => window.__qaReplaceRows(values.map(row => ({ ...row, status: row.status === "pending" ? "contacted" : row.status }))), rows);
      await filter.getByRole("option", { name: "Pendiente · sin filas en esta vista", exact: true }).waitFor({ state: "attached" });
      check(await filter.inputValue() === "pending", "An active status remains selected after a row refresh removes it");
      check(await table.getByTestId("data-table-filtered-empty").count() === 1, "A retained no-match status shows filtered-empty feedback");
      await table.locator(".data-table-toolbar").getByRole("button", { name: "Limpiar filtros", exact: true }).click();
      check(await search.evaluate(e => e === document.activeElement), "Toolbar clear also preserves keyboard focus");
      await page.evaluate(values => window.__qaReplaceRows(values), rows);
      await search.fill("Malbec");
      await table.getByRole("button", { name: "CSV", exact: true }).click();
      await table.getByRole("button", { name: "Excel", exact: true }).click();
      await page.waitForFunction(() => window.__recoveryQa.downloads.length === 2 && window.__recoveryQa.downloads.every(d => d.text !== null));
      const firstExports = await page.evaluate(() => window.__recoveryQa.downloads.map(d => d.text));
      check(firstExports.every(text => text.includes("Malbec sintético") && !text.includes("Pinot sintético") && !text.includes("Literal QA")), "CSV and Excel contain only the filtered record");
      await search.fill("Literal QA");await table.getByRole("button", { name: "CSV", exact: true }).click();await table.getByRole("button", { name: "Excel", exact: true }).click();
      await page.waitForFunction(() => window.__recoveryQa.downloads.length === 4 && window.__recoveryQa.downloads.every(d => d.text !== null));
      const escaped = await page.evaluate(() => window.__recoveryQa.downloads.slice(2).map(d => d.text));
      check(escaped[0].includes('"' + "'=SUM(1,2)" + '"') && escaped[1].includes("&#39;=SUM(1,2)") && escaped[1].includes("&lt;b&gt;Literal QA&lt;/b&gt;"), "Exports retain formula neutralization and literal HTML escaping");
      await search.fill("");await table.getByRole("button", { name: "Actualizar", exact: true }).click();
      check(await page.evaluate(() => window.__recoveryQa.refreshes) === 1, "Refresh still invokes the router once");
      await table.getByRole("button", { name: "PDF", exact: true }).click();
      check(await page.evaluate(() => window.__recoveryQa.prints) === 1, "PDF still opens the print action");
      await page.evaluate(() => window.__qaReplaceRows([]));await table.getByTestId("data-table-source-empty").waitFor();
      check((await table.getByTestId("data-table-source-empty").innerText()).includes("La fuente confirmó que no hay solicitudes para el scope actual."), "The original source-empty message appears only for an empty collection");
      check(await table.getByTestId("data-table-filtered-empty").count() === 0, "Source-empty and filtered-empty states are distinct");
      for(const [locale,count,searchLabel,filterLabel,empty,clear] of [
        ['en','1 of 1 rows visible','Search...','Filter by status','No matches for the current filters.','Clear filters'],
        ['pt-BR','1 de 1 linhas visíveis','Buscar...','Filtrar por estado','Nenhum resultado com os filtros atuais.','Limpar filtros'],
        ['es-AR','1 de 1 filas visibles','Buscar...','Filtrar por estado','No hay coincidencias con los filtros actuales.','Limpiar filtros']]){
        await page.evaluate(value=>window.__qaSetLocale(value),locale);
        const localized=page.getByTestId('localized-table');await localized.getByRole('status').getByText(count,{exact:true}).waitFor();
        await localized.getByRole('textbox',{name:searchLabel,exact:true}).fill('none');await localized.getByText(empty,{exact:true}).waitFor();
        check(await localized.getByRole('combobox',{name:filterLabel,exact:true}).count()===1&&await localized.getByRole('button',{name:clear,exact:true}).count()===2,locale+': real dashboard copy localizes filtering and recovery controls');
        await localized.getByTestId('data-table-filtered-empty').getByRole('button',{name:clear,exact:true}).click();
        check(await localized.getByRole('textbox',{name:searchLabel,exact:true}).evaluate(e=>document.activeElement===e),locale+': localized recovery retains search focus');
      }
      check(await page.evaluate(() => window.__recoveryQa.fetches.length) === 0, "Table interactions do not make backend requests");
    } finally { await tableView.context.close();contexts.delete(tableView.context); }

    const catalogView = await setup("catalog", theme, width);
    try {
      const { page } = catalogView, workspace = page.getByTestId("tenant-marketplace-workspace"), editor = page.getByTestId("tenant-catalog-editor");
      check(await page.evaluate(() => scrollY === 0 && document.activeElement === document.body), "Catalog mounting does not move focus or scroll");
      await workspace.getByRole("button", { name: "Revisar Producto QA 2", exact: true }).focus();
      await page.keyboard.press("Enter");
      const heading = editor.getByRole("heading", { name: "Contenido del producto", exact: true });
      await page.waitForFunction(() => document.activeElement?.textContent === "Contenido del producto");
      await unobstructedEditorFocus(page,heading,width,theme,'Selecting a product');
      check(await editor.getByRole("textbox", { name: "Título del producto", exact: true }).inputValue() === "Producto QA 2", "Selection loads the intended product");
      await editor.getByRole("textbox", { name: "Título del producto", exact: true }).fill("Edición QA sin guardar");
      const denied = workspace.getByRole("button", { name: "Revisar Producto QA 3", exact: true });
      await denied.click();
      await workspace.getByTestId("tenant-catalog-message").getByText("Tu formulario sigue aquí.", { exact: false }).waitFor();
      check(await denied.evaluate(e => e === document.activeElement), "A denied dirty selection leaves focus on its initiating control");
      check(await editor.getByRole("textbox", { name: "Título del producto", exact: true }).inputValue() === "Edición QA sin guardar", "A denied selection preserves unsaved fields");
      await editor.getByRole("button", { name: "Descartar cambios del formulario", exact: true }).click();
      await workspace.getByRole("button", { name: "Crear borrador de producto", exact: true }).click();
      const title = editor.getByRole("textbox", { name: "Título del producto", exact: true });
      await page.waitForFunction(() => document.activeElement?.closest("label")?.textContent === "Título del producto");
      check(await title.inputValue() === "", "Creating a local draft keeps its first field empty");await unobstructedEditorFocus(page,title,width,theme,'Creating a draft');
      await inspect(page, "catalog-new-draft-focus", theme, width);
      await editor.getByRole("button", { name: "Descartar cambios del formulario", exact: true }).click();
      await workspace.getByRole("button", { name: "Perfil de la marca", exact: true }).click();
      const brand = editor.getByRole("heading", { name: "Perfil de la marca", exact: true });
      await page.waitForFunction(() => document.activeElement?.tagName === "H2" && document.activeElement.textContent === "Perfil de la marca");
      await unobstructedEditorFocus(page,brand,width,theme,'Choosing the brand');
      const behavior = await page.evaluate(() => window.__recoveryQa.scrollBehaviors);
      check(behavior.length >= 3 && behavior.every(value => value === "auto"), "Editor navigation respects reduced-motion preference");
      check(await page.evaluate(() => window.__recoveryQa.fetches.length) === 0, "Catalog navigation, drafts and discard do not send changes");
    } finally { await catalogView.context.close();contexts.delete(catalogView.context); }
  }
  report.sourceAfter = await sourceHashes();assert.deepEqual(report.sourceAfter, before);
  check(report.clientErrors.length === 0 && report.blockedRequests.length === 0, "No client errors or attempted outbound requests");
  report.passed = true;
} catch (error) { report.failure = error.message;process.exitCode = 1; }
finally {
  report.closure.contexts = contexts.size === 0;
  for (const context of contexts) await context.close();contexts.clear();
  if (browser) { await browser.close();report.closure.browser = true; }
  server.closeAllConnections();if (server.listening) await new Promise(done => server.close(done));report.closure.server = !server.listening;
  stop();report.closure.esbuild = true;
  report.completedAt = new Date().toISOString();
  await writeFile(join(output, "table-catalog-recovery-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ report: join(output, "table-catalog-recovery-report.json"), passed: report.passed, checks: report.checks.length, views: report.views.length, failure: report.failure ?? null, closure: report.closure }));
}

