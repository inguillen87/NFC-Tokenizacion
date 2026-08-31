import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  MAX_PUBLIC_LOT_LABEL_LENGTH,
  normalizePublicLotLabelInput,
  resolvePublicLotLabel,
} from "../src/lib/public-lot-label.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "../src/app/sun/route.ts"), "utf8");
const diagnostics = fs.readFileSync(path.join(here, "../src/lib/sun-diagnostics.ts"), "utf8");
const productConfigRoute = fs.readFileSync(path.join(here, "../src/app/admin/batches/[bid]/product-config/route.ts"), "utf8");

test("public lot label prefers the explicit consumer label", () => {
  assert.equal(resolvePublicLotLabel({
    public_lot_label: "  Cosecha 2022 · Lote 02  ",
    lot: "fallback-lot",
    batch_lot: "fallback-batch-lot",
    lot_number: "fallback-number",
  }), "Cosecha 2022 · Lote 02");
});

test("public lot label uses the documented legacy fallbacks in order", () => {
  assert.equal(resolvePublicLotLabel({ lot: "LOT-A", batch_lot: "LOT-B", lot_number: "LOT-C" }), "LOT-A");
  assert.equal(resolvePublicLotLabel({ lot: "", batch_lot: "LOT-B", lot_number: "LOT-C" }), "LOT-B");
  assert.equal(resolvePublicLotLabel({ lot_number: 202602 }), "202602");
  assert.equal(resolvePublicLotLabel({ public_lot_label: { secret: true }, lot: "LOT-A" }), "LOT-A");
  assert.equal(resolvePublicLotLabel(null), null);
});

test("admin public lot labels are single-line, bounded and nullable", () => {
  assert.deepEqual(normalizePublicLotLabelInput("  Balmec TT \n Cosecha 2022  "), {
    ok: true,
    value: "Balmec TT Cosecha 2022",
  });
  assert.deepEqual(normalizePublicLotLabelInput("   "), { ok: true, value: null });
  assert.deepEqual(normalizePublicLotLabelInput(null), { ok: true, value: null });
  assert.deepEqual(normalizePublicLotLabelInput(2022), {
    ok: false,
    reason: "public_lot_label_invalid_type",
  });
  assert.deepEqual(normalizePublicLotLabelInput("L".repeat(MAX_PUBLIC_LOT_LABEL_LENGTH + 1)), {
    ok: false,
    reason: "public_lot_label_too_long",
  });
});

test("tenant-scoped product config persists the public label without changing BID", () => {
  assert.match(productConfigRoute, /normalizePublicLotLabelInput\(body\.public_lot_label\)/);
  assert.match(productConfigRoute, /nextConfig\.public_lot_label = publicLotLabel\.value/);
  assert.match(productConfigRoute, /public_lot_label_too_long|publicLotLabel\.reason/);
  assert.match(productConfigRoute, /WHERE id = \$\{batches\[0\]\.id\}/);
  assert.doesNotMatch(productConfigRoute, /SET\s+bid\s*=/);
});

test("SUN contract adds the public label without replacing the operational BID", () => {
  assert.match(route, /identity:\s*\{[\s\S]*?bid:\s*params\.bid,[\s\S]*?displayLot:\s*publicLotLabel/);
  assert.match(route, /product:\s*\{[\s\S]*?lotLabel:\s*publicLotLabel/);
  assert.match(route, /const bid = tenantBatch\.bid/);
  assert.doesNotMatch(route, /bid:\s*publicLotLabel/);
});

test("SUN snapshots rehydrate the current public lot label and preserve product fields", () => {
  assert.match(diagnostics, /AS public_lot_label/);
  assert.match(diagnostics, /const product = asRecord\(contract\.product\)/);
  assert.match(diagnostics, /const publicLotLabel = resolvePublicLotLabel\(\{ public_lot_label: currentIdentity\.public_lot_label \}\)/);
  assert.match(diagnostics, /contract\.identity = \{[\s\S]*?displayLot: publicLotLabel \|\| textOrNull\(identity\.displayLot\) \|\| null/);
  assert.match(diagnostics, /contract\.product = \{[\s\S]*?\.\.\.product,[\s\S]*?lotLabel: publicLotLabel \|\| textOrNull\(product\.lotLabel\) \|\| null/);
  assert.doesNotMatch(diagnostics, /bid:\s*publicLotLabel/);
});
