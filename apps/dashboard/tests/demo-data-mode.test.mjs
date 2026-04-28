import test from "node:test";
import assert from "node:assert/strict";

const { readDemoDataMetaFromPayload } = await import("../src/lib/demo-data-mode.ts");

test("UI detector marca demo cuando payload indica demoMode", () => {
  const meta = readDemoDataMetaFromPayload({ demoMode: true, dataSource: "demo" });
  assert.equal(meta.demoMode, true);
  assert.equal(meta.dataSource, "demo");
});

test("UI detector marca producción por defecto", () => {
  const meta = readDemoDataMetaFromPayload({ ok: true });
  assert.equal(meta.demoMode, false);
  assert.equal(meta.dataSource, "production");
});
