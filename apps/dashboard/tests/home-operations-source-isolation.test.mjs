import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

const componentUrl = new URL("../src/components/dashboard-home-client.tsx", import.meta.url);
const componentsDirectory = fileURLToPath(new URL("../src/components/", import.meta.url));
const componentSource = await readFile(componentUrl, "utf8");
const serverSource = await readFile(new URL("../src/app/(app)/page.tsx", import.meta.url), "utf8");
const operationsUrl = new URL("../src/components/ops-command-center.tsx", import.meta.url);
const operationsSource = await readFile(operationsUrl, "utf8");

// Execute the actual home rendering branch offline. Only select the existing infra tab
// and replace child surfaces with inert components; availability logic is not mocked.
const stubs = {
  react: 'export function useState(initial){return [initial === "summary" ? "infra" : initial, () => {}]};export function useMemo(compute){return compute()}',
  "next/link": "export default function Link(){return null}",
  "@product/ui": "export function Badge(){return null};export function Card(){return null};export function StatusChip(){return null}",
  "./ops-command-center.module.css": "export default {workspace:'fixture-workspace',hero:'fixture-hero',iconRail:'fixture-icon-rail'}",
  "lucide-react": "export function LayoutDashboard(){return null};export function Cpu(){return null};export function Trophy(){return null};export function Terminal(){return null};export function Building2(){return null};export function Sparkles(){return null};export function ShieldCheck(){return null}",
};
for (const [path, names] of [
  ["lucide-react", "BadgeCheck Boxes ClipboardCheck Database MapPin PackageCheck QrCode Radar Send ShieldCheck ShoppingBag Sprout Store UserCog"],
  ["recharts", "Area AreaChart Bar BarChart CartesianGrid ResponsiveContainer Tooltip XAxis YAxis"],
]) {
  stubs[path] = (stubs[path] || "") + names.split(" ")
    .filter((name) => !stubs[path]?.includes(`function ${name}(`))
    .map((name) => `;export function ${name}(){return null}`).join("");
}
for (const [path, name] of [
  ["admin-action-forms", "AdminActionForms"], ["data-table", "DataTable"],
  ["module-grid", "ModuleGrid"], ["multirubro-ops-panel", "MultirubroOpsPanel"],
  ["ops-command-center", "OpsCommandCenter"], ["executive-realtime-crm", "ExecutiveRealtimeCrm"],
  ["verified-experiences-panel", "VerifiedExperiencesPanel"],
  ["customer-growth-command-center", "CustomerGrowthCommandCenter"],
  ["enterprise-ops-state", "EnterpriseOpsState"],
]) stubs[`./${path}`] = `export function ${name}(){return null}`;

async function loadComponent(url) {
  const bundle = await build({
  entryPoints: [fileURLToPath(url)], bundle: true, write: false,
  format: "cjs", platform: "node", jsx: "automatic", external: ["react/jsx-runtime"],
  logLevel: "silent",
  plugins: [{ name: "home-operation-offline-surfaces", setup(builder) {
    builder.onResolve({ filter: /.*/ }, (args) => Object.hasOwn(stubs, args.path)
      ? { path: args.path, namespace: "fixture" } : undefined);
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
      contents: stubs[args.path], loader: "js", resolveDir: componentsDirectory,
    }));
  } }],
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  return module.exports;
}
const DashboardHomeClient = (await loadComponent(componentUrl)).default;
const OpsCommandCenter = (await loadComponent(operationsUrl)).OpsCommandCenter;

function elements(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => elements(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props?.children, predicate)];
}

function render(overrides = {}) {
  return DashboardHomeClient({
    session: { role: "tenant_admin", permissions: ["batches:read", "tags:read"], isDemo: false },
    tenantScope: "offline-fixture", isTenantAdmin: true,
    copy: { shell: { openModule: "Abrir" } },
    overviewAvailability: "ready", batchAvailability: "ready", realtimeAvailability: "ready",
    tokenizationAvailability: "upstream_error",
    overviewAvailabilityDetail: "Overview confirmado", batchAvailabilityDetail: "Lotes confirmados",
    realtimeAvailabilityDetail: "Eventos confirmados", tokenizationAvailabilityDetail: "HTTP_403: módulo no autorizado",
    overviewDataSource: "production", batchDataSource: "production", realtimeDataSource: "production", tokenizationDataSource: "unavailable",
    opsTenantRows: [{ slug: "offline-fixture", name: "Empresa de prueba", scans: 7, batches: 1, tags: 10 }],
    scopedBatchRows: [{ bid: "LOT-FIXTURE" }], importedTags: 10, activeTags: 10, plannedTags: 10,
    activityTotal: 7, authenticatedInteractions: 6, riskInteractions: 1,
    opsSteps: [
      { label: "Batch supplier cargado", body: "Lote confirmado", status: "ready", owner: "Operaciones" },
      { label: "Ownership, NFT y experiencia", body: "Derivado de tokenización", status: "working", owner: "Growth" },
    ],
    mintedTokens: 0, scopedTokenizationRows: [], tokenizationByStatus: {},
    ...overrides,
  });
}

const commandCenters = (tree) => elements(tree, (element) => element.type?.name === "OpsCommandCenter");
const states = (tree, testId) => elements(tree, (element) => element.props?.testId === testId);

test("tokenization 403 does not hide confirmed lots, tags and TAP operation or fabricate token zeros", () => {
  const tree = render();
  const [center] = commandCenters(tree);
  assert.ok(center, "confirmed core sources render the operation center");
  assert.equal(states(tree, "home-operations-unavailable").length, 0);
  assert.deepEqual(center.props.metrics.map(({ value }) => value), ["1", "1", "10", "1"]);
  assert.deepEqual(center.props.funnel.map(({ stage }) => stage), ["Tenants", "Batches", "Tags", "Actividad"]);
  assert.deepEqual(center.props.readiness.map(({ label }) => label), ["Manifest", "Activación", "Autenticación"]);
  assert.deepEqual(center.props.steps.map(({ label }) => label), ["Batch supplier cargado"]);
  const [unavailable] = states(tree, "home-tokenization-unavailable");
  assert.ok(unavailable);
  assert.match(unavailable.props.description, /No se muestra cero/);
  assert.deepEqual(unavailable.props.checklist, ["HTTP_403: módulo no autorizado"]);
});

test("each unavailable core source still prevents unconfirmed operation metrics", () => {
  for (const field of ["overviewAvailability", "batchAvailability", "realtimeAvailability"]) {
    const tree = render({ [field]: "upstream_error" });
    assert.equal(commandCenters(tree).length, 0, field);
    assert.equal(states(tree, "home-operations-unavailable").length, 1, field);
    assert.equal(states(tree, "home-tokenization-unavailable").length, 1, field);
  }
});

test("confirmed tokenization keeps its numeric metrics and derived step", () => {
  const tree = render({ tokenizationAvailability: "ready", tokenizationDataSource: "production", mintedTokens: 2,
    scopedTokenizationRows: [{ id: "offline-1", status: "minted" }, { id: "offline-2", status: "minted" }],
  });
  const [center] = commandCenters(tree);
  assert.deepEqual(center.props.funnel.at(-1), { stage: "NFT", value: 2 });
  assert.deepEqual(center.props.readiness.at(-1), { label: "Token", ready: 2, pending: 0 });
  assert.equal(center.props.steps.length, 2);
  assert.equal(states(tree, "home-tokenization-unavailable").length, 0);
});

test("declared demo fallback remains labelled and does not confer missing module availability", () => {
  const tree = render({ overviewAvailability: "fallback", overviewDataSource: "demo" });
  assert.equal(commandCenters(tree).length, 1);
  assert.equal(states(tree, "home-explicit-demo-source").length, 1);
  assert.equal(states(tree, "home-tokenization-unavailable").length, 1);
});

test("optional step gating follows the current server contract and adds no requests or permission changes", () => {
  assert.match(serverSource, /label: "Ownership, NFT y experiencia",[\s\S]*?status: mintedTokens > 0 \? "ready" : "working"/);
  assert.match(componentSource, /const operationsAvailable = overviewAvailable && batchesAvailable && realtimeAvailable;/);
  assert.doesNotMatch(componentSource, /\bfetch\(|setInterval\(|new EventSource/);
  assert.match(componentSource, /deniedPermissions: session\.deniedPermissions/);
});

test("operation scope is fixed by the caller and exposes no simulated role or tenant mutations", () => {
  assert.doesNotMatch(operationsSource, /useState|selectedMode|setSelectedMode|pausedTenants|networkModes|actionAlert|handleTogglePause|handleToggleMode/);
  assert.doesNotMatch(operationsSource, /activado exitosamente|pausado preventivamente|anclaje cambiado|<button|onClick=|\bfetch\(|setTimeout\(/);
  for (const [mode, label] of [["tenant", "Admin tenant"], ["global", "Super Admin"], ["auditor", "Equipo operativo"]]) {
    const tree = OpsCommandCenter({ mode,
      metrics: [{ label: "Tags", value: "10", detail: "Fixture" }],
      steps: [], funnel: [{ stage: "Tags", value: 10 }], readiness: [{ label: "Activación", ready: 10, pending: 0 }],
      tenants: [{ name: "Empresa de prueba", slug: "offline-fixture", scans: 7, batches: 1, tags: 10, riskScore: 0, status: "healthy" }],
    });
    const [badge] = elements(tree, (element) => element.props?.["data-testid"] === "operations-session-role");
    assert.deepEqual(badge.props.children, [label, " · Alcance de la sesión"]);
    assert.equal(elements(tree, (element) => element.type === "button").length, 0);
    assert.equal(elements(tree, (element) => element.props?.href === "/?tenant=offline-fixture").length, mode === "global" ? 1 : 0);
    for (const href of ["/tags", "/events"]) assert.ok(elements(tree, (element) => element.props?.href === href).length > 0);
    if (mode !== "global") assert.ok(elements(tree, (element) => element.props?.href === "/batches").length > 0);
    assert.ok(elements(tree, (element) => element.props?.label === "healthy").length > 0, "tenant status stays source-backed");
  }
});

test("operation navigation describes consultation and optional setup rather than completed commercial actions", () => {
  for (const [href, cta] of [
    ["/batches/supplier", "Ver lotes"], ["/tags", "Ver tags"], ["/events", "Auditar eventos"],
    ["/tokenization", "Revisar anclaje"], ["/loyalty/rewards", "Ver beneficios"],
    ["/api-keys", "Consultar integración"], ["/loyalty/campaigns", "Ver campañas"],
  ]) assert.ok(operationsSource.includes(`href: "${href}",\n      cta: "${cta}"`), `${cta} keeps its existing destination`);
  assert.match(operationsSource, /title: "4\. Anclaje opcional"/);
  assert.match(operationsSource, /no emite tokens ni publica un pasaporte/);
  assert.match(operationsSource, /no activa ventas ni envía promociones/);
  assert.match(operationsSource, /permisos y la configuración del módulo/);
  assert.match(operationsSource, /requiere configuración y validación independientes/);
  assert.match(operationsSource, /no constituyen una aprobación de QA o producción/);
  assert.doesNotMatch(operationsSource, /Cropwise|cta: "Anclar"|cta: "Activar venta"|cta: "Crear acción"|Cada tap produce|cada bloque abre una pantalla donde se hace trabajo real|label="listo para operar"/i);
});
