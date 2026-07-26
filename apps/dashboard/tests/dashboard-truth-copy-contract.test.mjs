import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const executiveCrm = await readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8");
const loginPanel = await readFile(new URL("../src/components/login-form-panel.tsx", import.meta.url), "utf8");
const dashboardHome = await readFile(new URL("../src/components/dashboard-home-client.tsx", import.meta.url), "utf8");
const signInPage = await readFile(new URL("../src/app/sign-in/[[...sign-in]]/page.tsx", import.meta.url), "utf8");
const realtimeMonitor = await readFile(new URL("../src/components/realtime-ops-monitor.tsx", import.meta.url), "utf8");
const demoMobile = await readFile(new URL("../src/app/(app)/demo-lab/mobile/[tenant]/[itemId]/page.tsx", import.meta.url), "utf8");
const onboardingWizard = await readFile(new URL("../src/components/onboarding-setup-wizard.tsx", import.meta.url), "utf8");
const sdkVision = await readFile(new URL("../src/app/(app)/sdk-vision/page.tsx", import.meta.url), "utf8");
const premiumMap = await readFile(new URL("../../../packages/ui/src/premium-vector-map.tsx", import.meta.url), "utf8");
const worldMap = await readFile(new URL("../../../packages/ui/src/world-map-realtime.tsx", import.meta.url), "utf8");
const dashboardShell = await readFile(new URL("../src/components/dashboard-shell.tsx", import.meta.url), "utf8");
const sharedSidebar = await readFile(new URL("../../../packages/ui/src/sidebar.tsx", import.meta.url), "utf8");

test("global sidebars do not invent usage or realtime status", () => {
  for (const source of [dashboardShell, sharedSidebar]) {
    assert.match(source, /Uso: consultar facturación/);
    assert.match(source, /Realtime: estado en Analytics/);
    assert.doesNotMatch(source, />30%</);
    assert.doesNotMatch(source, /width:\s*"30%"/);
    assert.doesNotMatch(source, /3 de (?:tus )?10 lotes/i);
    assert.doesNotMatch(source, /Stream Live/i);
    assert.doesNotMatch(source, /120 TPM/i);
  }
});

test("dashboard map labels describe reported events instead of physical live movement", () => {
  const dashboardMapCopy = [executiveCrm, loginPanel, dashboardHome, signInPage, realtimeMonitor].join("\n");

  assert.match(executiveCrm, /Mapa de eventos por capas/);
  assert.match(loginPanel, /mapa de eventos reportados/);
  assert.match(dashboardHome, /evento reportado aparezca en el mapa/);
  assert.match(signInPage, /mapa de eventos reportados/);
  assert.match(realtimeMonitor, /Mapa de eventos reportados/);
  assert.doesNotMatch(dashboardMapCopy, /mapa vivo/i);
});

test("VALID remains a message-level NFC result and is not promoted to physical-product authenticity", () => {
  assert.match(executiveCrm, /title: "Mensaje NFC validado"/);
  assert.match(executiveCrm, /title: "Identidad NFC validada"/);
  assert.match(executiveCrm, /datos reportados por el evento; no prueban la ubicación física/);
  assert.match(executiveCrm, /verdict válido/);
  assert.doesNotMatch(executiveCrm, /title: "Unidad (?:física )?verificada"/);

  assert.match(demoMobile, /if \(result === "VALID"\)/);
  assert.match(demoMobile, /label: "VALID"/);
  assert.match(demoMobile, /Mensaje NFC válido e identidad del tag consistente/);
  assert.match(demoMobile, /title="Lectura NFC validada"/);
  assert.doesNotMatch(demoMobile, /Producto auténtico|title="Producto verificado"/);
});

test("realtime insights report digital evidence quality instead of physical authenticity", () => {
  assert.match(realtimeMonitor, /Buena calidad de mensajes NFC según la evidencia digital disponible/);
  assert.match(realtimeMonitor, /mensajes NFC con veredicto válido; no implica autenticidad física/);
  assert.doesNotMatch(realtimeMonitor, /Buena autenticidad/);
});

test("mobile demo explains exactly what the backend resolves", () => {
  assert.match(demoMobile, /validez criptográfica del mensaje NFC\/SUN, policy aplicada, riesgo digital y estado registrado/);
  assert.match(demoMobile, /no certifica por sí solo contenido, origen, sello, apertura, custodia ni autenticidad física/);
  assert.doesNotMatch(demoMobile, /Resuelto por backend nexID: autenticidad/);
});

test("onboarding configures evidence controls and policy-bound digital title only", () => {
  assert.match(onboardingWizard, /controles de empaque configurables y evidencia regulatoria aportada/);
  assert.match(onboardingWizard, /titularidad digital transferible segun politica/);
  assert.match(onboardingWizard, /Gobierna evidencia y controles digitales; no[\s\S]*certifica estado, autenticidad ni propiedad fisica/);
  assert.doesNotMatch(onboardingWizard, /autenticidad de empaque|propiedad transferible para ediciones limitadas/);
});

test("Developer Hub presents cryptographic tag evidence without physical-authenticity claims", () => {
  assert.match(sdkVision, /eyebrow: "Evidencia criptográfica"/);
  assert.match(sdkVision, /no autentica por sí solo el producto físico/);
  assert.doesNotMatch(sdkVision, /eyebrow: "Autenticidad fuerte"/);
});

test("shared map defaults expose reported events and never synthesize journeys", () => {
  assert.match(worldMap, /title = "Cobertura de eventos reportados"/);
  assert.match(worldMap, /const visibleRoutes = useMemo<MapRoute\[\]>\(\(\) => routes\.slice\(0, 16\), \[routes\]\)/);
  assert.match(worldMap, /no son recorridos físicos/);
  assert.match(worldMap, /scans: point\.scans \?\? 0/);
  assert.match(worldMap, /if \(!value\) return null/);
  assert.match(worldMap, /const \[timeWindowMode, setTimeWindowMode\] = useState<TimeWindowMode>\("all"\)/);
  assert.doesNotMatch(worldMap, /if \(!value\) return Date\.now\(\)/);
  assert.match(worldMap, /Boolean\(point\.chainProvider\?\.trim\(\)\)/);
  assert.match(worldMap, /Boolean\(point\.chainTxHash\?\.trim\(\)\)/);
  assert.match(worldMap, /sin evidencia transaccional suficiente/);
  assert.doesNotMatch(worldMap, /TOKEN\|MINT\|NFT\|CLAIM|sandbox ready|listo para emitir/);
  assert.doesNotMatch(worldMap, /rankedPoints\.slice\(0, 8\)\.flatMap|Mapa operativo real de autenticaciones|trazadas en vivo/);

  assert.match(premiumMap, /title = "Mapa de eventos reportados"/);
  assert.match(premiumMap, /no infiere autenticaciones ni recorridos físicos/);
  assert.match(premiumMap, /Conexión visual configurada; no demuestra movimiento físico/);
  assert.doesNotMatch(premiumMap, /title = "Mapa vivo"|Movimiento trazado sobre motor vectorial propio|rutas activas/);
});

test("batch validator scopes VALID and TT to tag evidence", async () => {
  const validator = await readFile(new URL("../src/components/batch-sun-validator.tsx", import.meta.url), "utf8");

  assert.match(validator, /Mensaje NFC válido · TT reporta cerrado/);
  assert.match(validator, /No certifica contenido, origen, custodia ni propiedad/);
  assert.doesNotMatch(validator, /Tap valido: sello intacto|Producto auténtico/i);
});
