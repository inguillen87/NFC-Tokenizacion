import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pageUrl = new URL("../src/app/(public)/demo-lab/mobile/[tenant]/[itemId]/page.tsx", import.meta.url);
const clientUrl = new URL("../src/components/mobile-demo-client.tsx", import.meta.url);

test("mobile Demo Lab accepts every seed envelope and resolves the requested identity first", async () => {
  const page = await readFile(pageUrl, "utf8");

  assert.match(page, /function parseSeedItems\(value: unknown\)/);
  assert.match(page, /const candidate = Array\.isArray\(value\)/);
  assert.match(page, /Array\.isArray\(value\.items\)/);
  assert.match(page, /Array\.isArray\(value\.products\)/);

  const itemIdMatch = page.indexOf('["itemId", "item_id", "id"]');
  const uidMatch = page.indexOf('["uidHex", "uid_hex"]');
  const skuMatch = page.indexOf('["sku", "serial", "rollId", "roll_id"]');
  const uidFallback = page.indexOf("items.find((item) => normalizeIdentifier(item.uidHex || item.uid_hex).length > 0)");
  assert.ok(itemIdMatch >= 0 && itemIdMatch < uidMatch);
  assert.ok(uidMatch < skuMatch);
  assert.ok(skuMatch < uidFallback);
});

test("mobile Demo Lab labels every BID source as preview without claiming a physical tap", async () => {
  const [page, client] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(clientUrl, "utf8"),
  ]);

  assert.match(page, /const BID_RE = \/\^\[A-Za-z0-9\._:-\]\{3,120\}\$\//);
  assert.match(page, /fs\.readFile\(path\.join\(packDirectory, "manifest\.csv"\)/);
  assert.match(page, /const bid = recordBid\(item\) \|\| recordBid\(parsed\) \|\| parseManifestBid\(manifestRaw\)/);
  assert.match(page, /const bid = queryBid \|\| seed\.bid/);
  assert.match(page, /queryBid \? "query" : bid \? "demo-pack" : "missing"/);
  assert.match(client, /SIMULACIÓN · NO ES UN TAP NFC FÍSICO/);
  assert.match(client, /DEMO MODE · BID provisto por el dataset de demostración; no prueba una lectura física\./);
  assert.match(client, /BID PROVIDED · Identificador de preview sin validación SUN en esta pantalla\./);
  assert.doesNotMatch(client, /PRODUCTION MODE|mode=\$\{[^\n]*"production"/);
});

test("mobile Demo Lab keeps sensitive mutations on the physical SUN flow and provenance read-only", async () => {
  const client = await readFile(clientUrl, "utf8");

  assert.match(client, /const identityMissing = !effectiveBid \|\| !activeUid/);
  assert.match(client, /const provenanceDisabled = identityMissing \|\| ctaPending/);
  assert.match(client, /disabled=\{provenanceDisabled\}/);
  assert.match(client, /Preview solamente: escaneá el NFC físico para obtener un handoff SUN fresco/);
  assert.match(client, /disabled title=\{protectedMutationReason\}[^>]*>Activar ownership · requiere tap físico<\/button>/);
  assert.match(client, /disabled title=\{protectedMutationReason\}[^>]*>Registrar garantía · requiere tap físico<\/button>/);
  assert.match(client, /new URL\(`\/api\/public-cta\/provenance`, window\.location\.origin\)/);
  assert.match(client, /fetch\(url\.toString\(\), \{ method: "GET" \}\)/);
  assert.match(client, /La provenance es una lectura histórica\. Esta pantalla nunca crea capacidades frescas ni ejecuta mutaciones protegidas\./);
  assert.doesNotMatch(client, /postCta|\/api\/sun-context|\/api\/public-cta\/(?:claim-ownership|register-warranty|tokenize-request)/);
  assert.equal((client.match(/!response\.ok \|\| data\?\.ok === false/g) ?? []).length, 2);
});

test("mobile Demo Lab confirms leads over HTTP before success and persists no lead PII", async () => {
  const client = await readFile(clientUrl, "utf8");

  const leadStart = client.indexOf("async function saveLeadInterest()");
  const leadEnd = client.indexOf("  return (", leadStart);
  assert.ok(leadStart >= 0 && leadEnd > leadStart, "saveLeadInterest must remain inspectable as one bounded flow");
  const leadFlow = client.slice(leadStart, leadEnd);
  assert.ok(leadFlow.indexOf("!response.ok") < leadFlow.indexOf("setLeadSaved(true)"));
  assert.match(leadFlow, /setLeadSaved\(false\)/);
  assert.match(leadFlow, /pushEvent\("LEAD_CAPTURED", `\$\{leadIntent\} · server accepted`\)/);
  assert.match(leadFlow, /LEAD_CAPTURE_FAILED/);
  assert.match(client, /window\.localStorage\.setItem\(storeKey\(tenant, itemId, pack\), serializeStoredEvents\(next\)\)/);
  assert.equal((client.match(/localStorage\.setItem/g) ?? []).length, 1);

  const serializerStart = client.indexOf("function serializeStoredEvents(events: EventItem[])");
  const serializerEnd = client.indexOf("function purgeLegacyMobileDemoStorage", serializerStart);
  assert.ok(serializerStart >= 0 && serializerEnd > serializerStart, "storage serializer must remain a bounded allowlist");
  const serializer = client.slice(serializerStart, serializerEnd);
  assert.match(serializer, /map\(\(\{ type, at \}\) => \(\{/);
  assert.doesNotMatch(serializer, /note|email|name|company|country|role|message/i);
});

test("mobile Demo Lab uses versioned sanitized storage and purges legacy preview data", async () => {
  const client = await readFile(clientUrl, "utf8");

  assert.match(client, /const MOBILE_DEMO_STORAGE_PREFIX = "nexid:mobile:"/);
  assert.match(client, /const MOBILE_DEMO_STORAGE_VERSION = "v2"/);
  assert.match(client, /return `\$\{MOBILE_DEMO_STORAGE_PREFIX\}\$\{MOBILE_DEMO_STORAGE_VERSION\}:\$\{tenant\}:\$\{itemId\}:\$\{pack\}`/);
  assert.match(client, /if \(!\/\^\[A-Z0-9_:-\]\{1,64\}\$\/\.test\(type\) \|\| !Number\.isFinite\(Date\.parse\(at\)\)\) return \[\]/);
  assert.match(client, /return \[\{ type, at: new Date\(at\)\.toISOString\(\), note: STORED_EVENT_NOTE \}\]/);
  assert.match(client, /key\?\.startsWith\(MOBILE_DEMO_STORAGE_PREFIX\)/);
  assert.match(client, /!key\.startsWith\(`\$\{MOBILE_DEMO_STORAGE_PREFIX\}\$\{MOBILE_DEMO_STORAGE_VERSION\}:`\)/);
  assert.match(client, /storage\.removeItem\(key\)/);
  assert.match(client, /purgeLegacyMobileDemoStorage\(window\.localStorage\)/);
});

test("mobile Demo Lab minimizes optional GPS at collection time", async () => {
  const client = await readFile(clientUrl, "utf8");

  assert.match(client, /function approximateCoordinate\(value: number\)/);
  assert.match(client, /Math\.round\(value \* 1_000\) \/ 1_000/);
  assert.match(client, /lat: approximateCoordinate\(position\.coords\.latitude\)/);
  assert.match(client, /lng: approximateCoordinate\(position\.coords\.longitude\)/);
  assert.match(client, /accuracy: Math\.max\(150,/);
  assert.match(client, /\{ enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 \}/);
  assert.match(client, /GPS aproximado \{geoState\.lat\.toFixed\(3\)\}, \{geoState\.lng\.toFixed\(3\)\}/);
  assert.doesNotMatch(client, /enableHighAccuracy: true|toFixed\(5\)/);
});

test("mobile Demo Lab lazy-loads one illustrative vertical map", async () => {
  const client = await readFile(clientUrl, "utf8");

  assert.match(client, /const Globe3dMap = dynamic\(/);
  assert.match(client, /import\("@product\/ui\/globe-3d-map"\)\.then\(\(module\) => module\.Globe3dMap\)/);
  assert.match(client, /ssr: false/);
  assert.match(client, /const ILLUSTRATIVE_ORIGINS: Record<VerticalTemplate\["key"\]/);
  for (const vertical of ["wine", "agro", "perfume", "pharma"]) {
    assert.match(client, new RegExp(`\\b${vertical}: \\{ name: "Origen demo`));
  }
  assert.match(client, /const illustrativeOrigin = ILLUSTRATIVE_ORIGINS\[activeVertical\]/);
  assert.match(client, /data-mobile-demo-map-truth=/);
  assert.match(client, /Mapa ilustrativo del preview/);
  assert.match(client, /Sin telemetría productiva/);
  assert.match(client, /no genera un mapa de calor productivo ni se adjunta al lead/);
  assert.doesNotMatch(client, /pending-location|illustrativeOrigin\.lat \+ 7|illustrativeOrigin\.lng \+ 16/);
  assert.doesNotMatch(client, /WINERY_HQ|distanceFromWinery|winery_origin/);
  assert.equal((client.match(/<Globe3dMap/g) ?? []).length, 1);
});

test("mobile Demo Lab has accessible progress, dialogs and two native forms", async () => {
  const client = await readFile(clientUrl, "utf8");

  assert.equal((client.match(/role="progressbar"/g) ?? []).length, 2);
  assert.match(client, /role="dialog"/);
  assert.match(client, /aria-modal="true"/);
  assert.match(client, /aria-labelledby=\{activeDialog === "token"/);
  assert.match(client, /aria-describedby=\{activeDialog === "token"/);
  assert.match(client, /event\.key === "Escape"/);
  assert.match(client, /event\.key !== "Tab"/);
  assert.match(client, /mainRef\.current\?\.setAttribute\("inert", ""\)/);
  assert.match(client, /if \(restoreTarget\?\.isConnected\) restoreTarget\.focus\(\)/);
  assert.match(client, /\[data-autofocus\]/);
  assert.equal((client.match(/<form onSubmit=/g) ?? []).length, 2);
  assert.match(client, /htmlFor="mobile-token-email"/);
  assert.match(client, /htmlFor="mobile-lead-email"/);
  assert.doesNotMatch(client, /htmlFor="mobile-demo-warranty-name"/);
});
