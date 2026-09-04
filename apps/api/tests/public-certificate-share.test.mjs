import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const previousSecret = process.env.PUBLIC_CERTIFICATE_SIGNING_SECRET;
process.env.PUBLIC_CERTIFICATE_SIGNING_SECRET = "nexid-public-certificate-test-secret";

const {
  createPublicCertificateShareToken,
  verifyPublicCertificateShareToken,
} = await import("../src/lib/public-certificate-share.ts");

test.after(() => {
  if (previousSecret === undefined) delete process.env.PUBLIC_CERTIFICATE_SIGNING_SECRET;
  else process.env.PUBLIC_CERTIFICATE_SIGNING_SECRET = previousSecret;
});

test("certificate share tokens are event-bound and tamper evident", () => {
  const token = createPublicCertificateShareToken("613");

  assert.match(token, /^v1\.[A-Za-z0-9_-]{40,}$/);
  assert.equal(verifyPublicCertificateShareToken("613", token), true);
  assert.equal(verifyPublicCertificateShareToken("614", token), false);
  assert.equal(verifyPublicCertificateShareToken("613", `${token}x`), false);
  assert.equal(verifyPublicCertificateShareToken("613", ""), false);
});

test("public certificates allow unsigned demo rows but require a signed capability for real rows", async () => {
  const [route, sunRoute, snapshots, summary] = await Promise.all([
    readFile(new URL("../src/app/public/certificates/[eventId]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/sun-diagnostics.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/public/proof/summary/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /verifyPublicCertificateShareToken\(eventId, shareToken\)/);
  assert.match(
    route,
    /\$\{signedAccess\}[\s\S]*OR \([\s\S]*LOWER\(COALESCE\(e\.source::text, ''\)\) = 'demo'[\s\S]*DEMO_TENANT_SLUG[\s\S]*DEMO_BATCH_BID/,
  );
  assert.match(route, /signedAccess \? "private, no-store"/);
  assert.match(route, /createPublicCertificateShareToken\(eventId\)/);
  assert.match(sunRoute, /certificateShareToken = createPublicCertificateShareToken\(eventId\)/);
  assert.match(snapshots, /createPublicCertificateShareToken\(tokenizationEventId\)/);

  assert.match(summary, /PUBLIC_DEMO_TENANT_SLUG \|\| "demobodega"/);
  assert.match(summary, /LOWER\(COALESCE\(e\.source::text, ''\)\) = 'demo'/);
  assert.match(summary, /scope: "public-demo-only"/);
  assert.doesNotMatch(summary, /prod_events/);

  const validRatePredicate = summary.match(
    /COUNT\(\*\) FILTER \(WHERE\s*UPPER\(COALESCE\(e\.result, ''\)\) IN \(([^)]*)\)\s*AND LOWER\(COALESCE\(e\.verdict, ''\)\) = 'valid'\s*AND UPPER\(COALESCE\(e\.event_type::text, ''\)\) = 'TAP_VALID'\s*AND e\.cmac_ok IS TRUE\s*AND e\.allowlisted IS TRUE\s*\)/,
  )?.[1] || "";
  assert.deepEqual(
    [...validRatePredicate.matchAll(/'([^']+)'/g)].map((match) => match[1]),
    [
      "VALID",
      "TAP_VALID",
      "VALID_AUTHENTIC",
      "VALID_CLOSED",
      "OPENED",
      "OPENED_PREVIOUSLY",
      "VALID_OPENED",
      "VALID_OPENED_PREVIOUSLY",
      "VALID_UNKNOWN_TAMPER",
    ],
  );
  assert.doesNotMatch(summary, /LIKE\s+'VALID_%'/);
  assert.doesNotMatch(summary, /(?:VALID_)?MANUAL_OPENED/);
});
