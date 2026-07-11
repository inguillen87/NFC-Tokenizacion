import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const proofSource = await readFile(new URL("../src/app/(app)/proof/page.tsx", import.meta.url), "utf8");
const proofStyles = await readFile(new URL("../src/app/(app)/proof/page.module.css", import.meta.url), "utf8");
const dashboardStyles = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("Trust Operations reads private tenant contracts through the authenticated BFF", () => {
  assert.match(proofSource, /await requireDashboardSession\("proof:read"\)/);
  assert.match(proofSource, /headers: cookie \? \{ cookie \} : undefined/);
  assert.match(proofSource, /\/api\/admin\/proof\/anchors/);
  assert.match(proofSource, /\/api\/admin\/proof\/events\?limit=60/);
  assert.match(proofSource, /\/api\/admin\/tokenization\/requests\?limit=80/);
  assert.match(proofSource, /response\.headers\.get\("x-nexid-data-mode"\) === "demo"/);
  assert.match(proofSource, /value\.ok !== true/);
  assert.doesNotMatch(proofSource, /process\.env\.ADMIN_API_KEY|fetch\(`\$\{apiOrigin\}\/admin\//);
});

test("public testnet references come from productUrls.api and stay outside tenant metrics", () => {
  assert.match(proofSource, /productUrls\.api/);
  assert.match(proofSource, /withPath\(productUrls\.web, "\/proof\/verify"\)/);
  assert.doesNotMatch(proofSource, /const PUBLIC_VERIFY_URL = "https:\/\/nexid\.lat/);
  assert.match(proofSource, /\/public\/proof\/demo-cases/);
  assert.match(proofSource, /data-testid="proof-private-tenant"/);
  assert.match(proofSource, /data-testid="proof-public-testnet"/);
  assert.match(proofSource, /Los casos publicos de referencia no participan de estas metricas/);
  assert.match(proofSource, /nunca se suman al tenant/);

  const metricsStart = proofSource.indexOf("const metrics: Metric[]");
  const metricsEnd = proofSource.indexOf("const anchorsToDisplay", metricsStart);
  assert.ok(metricsStart >= 0 && metricsEnd > metricsStart, "calculated metrics block must exist");
  assert.doesNotMatch(proofSource.slice(metricsStart, metricsEnd), /publicCases|realIotaCases|publicProofResult/);
});

test("hash-only verification remains available when anchor_id is absent", () => {
  assert.match(proofSource, /if \(!hash\) return null/);
  assert.doesNotMatch(proofSource, /if \(!hash \|\| !anchorId\) return null/);
  assert.match(proofSource, /if \(UUID_PATTERN\.test\(anchorId\)\) params\.set\("anchor_id", anchorId\)/);
});

test("sandbox anchors never masquerade as public registry evidence", () => {
  assert.match(proofSource, /anchorsResult\.mode === "demo"[\s\S]*\? null[\s\S]*: publicVerifyHref\(firstHash, anchorId\)/);
  assert.match(proofSource, /Sandbox local, no publicado/);
});

test("tenant metrics are calculated and fail to an unavailable value", () => {
  assert.match(proofSource, /anchorsResult\.ok \? anchors\.length : null/);
  assert.match(proofSource, /normalize\(anchor\.status\) === "confirmed"/);
  assert.match(proofSource, /eventsResult\.ok \? events\.length : null/);
  assert.match(proofSource, /total \+ \(readCount\(anchor\.event_count\) \|\| 0\)/);
  assert.match(proofSource, /tokenizationRows\.filter\(isOwnershipTransaction\)\.length/);
  assert.match(proofSource, /network\.includes\("polygon"\) \|\| network\.includes\("amoy"\)/);
  assert.match(proofSource, /value === null \? "-"/);
  assert.match(proofSource, /No disponible/);
  assert.match(proofSource, /Sandbox BFF/);
});

test("anchors and events expose the required verifiable fields", () => {
  assert.match(proofSource, /Eventos incluidos/);
  assert.match(proofSource, /Merkle root/);
  assert.match(proofSource, /anchor\.resource_type, anchor\.resource_id/);
  assert.match(proofSource, /anchor\.anchored_at \|\| anchor\.created_at/);
  assert.match(proofSource, /safeHttpUrl\(anchor\.explorer_url\)/);
  assert.match(proofSource, /new URLSearchParams\(\{ event_hash: hash \}\)/);
  assert.match(proofSource, /UUID_PATTERN\.test\(anchorId\)\) params\.set\("anchor_id", anchorId\)/);
  assert.match(proofSource, /Verificar hash/);
  assert.match(proofSource, /payload_hash \|\| event\.event_hash \|\| event\.hash/);
});

test("copy separates tenant evidence, public testnet, IOTA integrity and Polygon ownership", () => {
  assert.match(proofSource, /Evidencia privada del tenant/);
  assert.match(proofSource, /Testnet publico de referencia/);
  assert.match(proofSource, /IOTA integridad hash-only vs Polygon ownership/);
  assert.match(proofSource, /No publica el payload privado ni representa ownership/);
  assert.match(proofSource, /No sustituye el historial operativo del tenant/);
  assert.match(proofSource, /withPath\(productUrls\.web, "\/proof\/verify"\)/);
  assert.match(proofSource, /withPath\(productUrls\.web, "\/proof\/ownership"\)/);
  assert.match(proofSource, /href="\/tokenization"/);
  assert.match(proofSource, /withPath\(productUrls\.web, "\/demo-lab"\)/);
});

test("Proof has explicit light mode, compact mobile layout and no cyberpunk fakes", () => {
  assert.match(proofStyles, /:global\(html\.theme-light\) \.page/);
  assert.match(proofStyles, /:global\(html\[data-theme="light"\]\) \.page/);
  assert.match(proofStyles, /@media \(max-width: 430px\)/);
  assert.match(proofStyles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(proofStyles, /overflow-x:\s*auto|max-height:\s*70vh|height:\s*70vh|animation:/);
  assert.doesNotMatch(proofSource, /Nexus Command Center|Live Hash Validation Stream|\bSECURE\b/);
  assert.doesNotMatch(proofSource, /transparenttextures|animate-|70vh|min-h-\[600px\]/);
  assert.doesNotMatch(proofSource, /href="\/proof\/anchor"/);
  assert.doesNotMatch(proofSource, /\b(?:98|100)%\b/);
  assert.doesNotMatch(proofSource, /sha256:[0-9a-f]{64}|0x0{32,}/i);
});

test("mobile support controls stay above the dashboard navigation dock", () => {
  assert.match(dashboardStyles, /\.helpbot-trigger\s*\{[\s\S]*?bottom:\s*calc\(5\.25rem \+ env\(safe-area-inset-bottom\)\) !important/);
  assert.match(dashboardStyles, /\.helpbot-hint,[\s\S]*?\.helpbot-panel\s*\{[\s\S]*?bottom:\s*calc\(9rem \+ env\(safe-area-inset-bottom\)\) !important/);
});
