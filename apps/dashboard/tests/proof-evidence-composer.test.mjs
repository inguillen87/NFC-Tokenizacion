import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const composerUrl = new URL("../src/app/(app)/proof/anchor/proof-anchor-composer.tsx", import.meta.url);
const pageUrl = new URL("../src/app/(app)/proof/anchor/page.tsx", import.meta.url);
const stylesUrl = new URL("../src/app/(app)/proof/anchor/page.module.css", import.meta.url);
const proofPageUrl = new URL("../src/app/(app)/proof/page.tsx", import.meta.url);
const tenantPageUrl = new URL("../src/app/(app)/tenants/[slug]/page.tsx", import.meta.url);

test("evidence composer uses real proof contracts and explains network responsibility", async () => {
  const [composer, page, proofPage, tenantPage] = await Promise.all([
    readFile(composerUrl, "utf8"),
    readFile(pageUrl, "utf8"),
    readFile(proofPageUrl, "utf8"),
    readFile(tenantPageUrl, "utf8"),
  ]);

  assert.match(page, /requireDashboardSession\(\)/);
  assert.match(page, /dashboardHighImpactPermissionMatches\([\s\S]*"proofs\.read"[\s\S]*session\.deniedPermissions/);
  assert.match(page, /dashboardHighImpactPermissionMatches\([\s\S]*"proofs\.anchor"[\s\S]*session\.deniedPermissions/);
  assert.match(composer, /\/api\/admin\/proof\/events/);
  assert.match(composer, /\/api\/admin\/proof\/anchor/);
  assert.match(composer, /\/api\/admin\/proof\/anchors/);
  assert.match(composer, /\/api\/admin\/proof\/providers/);
  assert.match(composer, /SHA-256 canonico/);
  assert.match(composer, /IOTA testnet/);
  assert.match(composer, /Polygon ownership/);
  assert.match(composer, /href="\/tokenization"/);
  assert.match(composer, /Sandbox de solo lectura/);
  assert.match(composer, /!isDemo/);
  assert.match(composer, /proof_payload_sensitive_key_rejected/);
  assert.match(composer, /Verificar prueba/);
  assert.match(proofPage, /Registrar evidencia/);
  assert.match(tenantPage, /`\/proof\/anchor\?tenant=\$\{tenantSlug\}`/);

  assert.doesNotMatch(composer, /Gasless Enabled/);
  assert.doesNotMatch(composer, /KECCAK256/);
  assert.doesNotMatch(composer, /Awaiting Payload Injection/);
  assert.doesNotMatch(composer, /transparenttextures\.com/);
});

test("evidence composer remains page-scroll based and responsive", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /\.workspace[\s\S]*?grid-template-columns: minmax\(0, 1\.45fr\)/);
  assert.match(styles, /\.preview[\s\S]*?position: sticky/);
  assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*?\.preview[\s\S]*?position: static/);
  assert.doesNotMatch(styles, /overflow-y:\s*(auto|scroll)/);
  assert.doesNotMatch(styles, /height:\s*300px/);
});
