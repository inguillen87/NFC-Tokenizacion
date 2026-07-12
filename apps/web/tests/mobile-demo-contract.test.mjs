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

test("mobile Demo Lab supplies a validated BID without claiming unverified production", async () => {
  const [page, client] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(clientUrl, "utf8"),
  ]);

  assert.match(page, /const BID_RE = \/\^\[A-Za-z0-9\._:-\]\{3,120\}\$\//);
  assert.match(page, /fs\.readFile\(path\.join\(packDirectory, "manifest\.csv"\)/);
  assert.match(page, /const bid = recordBid\(item\) \|\| recordBid\(parsed\) \|\| parseManifestBid\(manifestRaw\)/);
  assert.match(page, /const bid = queryBid \|\| seed\.bid/);
  assert.match(page, /queryBid \? "query" : bid \? "demo-pack" : "missing"/);
  assert.match(client, /BID PROVIDED · Validacion de servidor pendiente\./);
  assert.doesNotMatch(client, /PRODUCTION MODE|mode=\$\{[^\n]*"production"/);
});

test("mobile Demo Lab blocks identity-dependent actions and requires HTTP success", async () => {
  const client = await readFile(clientUrl, "utf8");

  assert.match(client, /const identityMissing = !effectiveBid \|\| !activeUid/);
  assert.match(client, /const actionDisabled = ctaBlocked \|\| ctaPendingAuth \|\| identityMissing \|\| ctaPending/);
  assert.match(client, /const provenanceDisabled = identityMissing \|\| ctaPending/);
  assert.match(client, /disabled=\{provenanceDisabled\}/);
  assert.equal((client.match(/!response\.ok \|\| data\?\.ok === false/g) ?? []).length, 3);

  const leadFlow = client.slice(
    client.indexOf("async function saveLeadInterest()"),
    client.indexOf("useEffect(() => {", client.indexOf("async function saveLeadInterest()")),
  );
  assert.ok(leadFlow.indexOf("!response.ok") < leadFlow.indexOf("setLeadSaved(true)"));
  assert.match(leadFlow, /setLeadSaved\(false\)/);
  assert.match(leadFlow, /LEAD_CAPTURE_FAILED/);
});

test("mobile Demo Lab has one route map and accessible progress and dialogs", async () => {
  const client = await readFile(clientUrl, "utf8");

  assert.equal((client.match(/<Globe3dMap/g) ?? []).length, 1);
  assert.equal((client.match(/role="progressbar"/g) ?? []).length, 2);
  assert.match(client, /role="dialog"/);
  assert.match(client, /aria-modal="true"/);
  assert.match(client, /event\.key === "Escape"/);
  assert.match(client, /event\.key !== "Tab"/);
  assert.match(client, /mainRef\.current\?\.setAttribute\("inert", ""\)/);
  assert.match(client, /if \(restoreTarget\?\.isConnected\) restoreTarget\.focus\(\)/);
  assert.match(client, /\[data-autofocus\]/);
  assert.match(client, /htmlFor="mobile-demo-warranty-name"/);
  assert.match(client, /htmlFor="mobile-token-email"/);
  assert.match(client, /htmlFor="mobile-lead-email"/);
});
