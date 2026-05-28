import test from "node:test";
import assert from "node:assert/strict";

const { parseSunPayloadFromFields } = await import("../src/lib/sun-payload.ts");

test("admin SUN payload binding ignores bid-only body so diagnostic payload can be used", () => {
  const payload = parseSunPayloadFromFields({ bid: "DEMO-2026-02" }, "DEMO-2026-02");
  assert.equal(payload, null);
});

test("admin SUN payload binding accepts complete inline payload", () => {
  const payload = parseSunPayloadFromFields({
    bid: "DEMO-2026-02",
    picc_data: "00112233445566778899AABBCCDDEEFF",
    enc: "0102030405060708090A",
    cmac: "0102030405060708",
  }, "DEMO-2026-02");

  assert.equal(payload?.bid, "DEMO-2026-02");
  assert.equal(payload?.piccDataHex, "00112233445566778899AABBCCDDEEFF");
});
