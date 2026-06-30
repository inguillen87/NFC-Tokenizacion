import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const {
  GS1_DIGITAL_LINK_AUTH_LEVEL,
  GS1_DIGITAL_LINK_TRUST_LEVEL,
  buildGs1DigitalLinkSunUrl,
} = await import("../src/app/id/_lib/gs1-digital-link-resolver.ts");

test("GS1 Digital Link resolver maps identity fields to SUN without crypto-auth claims", () => {
  const target = buildGs1DigitalLinkSunUrl(
    "https://id.nexid.lat/id/01/07791234567890/10/LOT-9/21/SER-42?tenant=winery-one&bid=BID-1&token=drop",
    { gtin: "07791234567890", lot: "LOT-9", serial: "SER-42" },
  );

  assert.equal(target.pathname, "/sun");
  assert.equal(target.searchParams.get("qr"), "1");
  assert.equal(target.searchParams.get("channel"), "qr");
  assert.equal(target.searchParams.get("source"), "gs1");
  assert.equal(target.searchParams.get("carrier"), "gs1_digital_link");
  assert.equal(target.searchParams.get("gtin"), "07791234567890");
  assert.equal(target.searchParams.get("lot"), "LOT-9");
  assert.equal(target.searchParams.get("serial"), "SER-42");
  assert.equal(target.searchParams.get("trust_level"), GS1_DIGITAL_LINK_TRUST_LEVEL);
  assert.equal(target.searchParams.get("authentication_level"), GS1_DIGITAL_LINK_AUTH_LEVEL);
  assert.equal(target.searchParams.get("tenant"), "winery-one");
  assert.equal(target.searchParams.get("bid"), "BID-1");
  assert.equal(target.searchParams.get("token"), null);
});

test("web exposes /id/01 GS1 resolver routes and the legacy /01 route delegates to the same contract", async () => {
  const required = [
    "../src/app/id/01/[gtin]/route.ts",
    "../src/app/id/01/[gtin]/10/[lot]/route.ts",
    "../src/app/id/01/[gtin]/10/[lot]/21/[serial]/route.ts",
    "../src/app/01/[gtin]/21/[serial]/route.ts",
  ];
  for (const rel of required) {
    await access(new URL(rel, import.meta.url));
  }

  const legacy = await readFile(new URL("../src/app/01/[gtin]/21/[serial]/route.ts", import.meta.url), "utf8");
  assert.match(legacy, /buildGs1DigitalLinkSunUrl/);
});
