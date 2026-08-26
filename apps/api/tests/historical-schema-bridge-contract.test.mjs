import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readMigration = (name) => readFile(new URL(`../db/migrations/${name}`, import.meta.url), "utf8");

const [supplierBridge, enumBridge, leadBridge] = await Promise.all([
  readMigration("20260728110000_0061b_supplier_runtime_baseline_bridge.sql"),
  readMigration("20260729100000_0067b_canonical_event_enums_bridge.sql"),
  readMigration("20260729150000_0071b_order_request_lead_scope_bridge.sql"),
]);

test("supplier bridge refuses to reinterpret populated incompatible legacy tables", () => {
  assert.match(supplierBridge, /supplier_runtime_legacy_shape_contains_data/);
  assert.match(supplierBridge, /EXISTS \(SELECT 1 FROM supplier_orders LIMIT 1\)/);
  assert.match(supplierBridge, /EXISTS \(SELECT 1 FROM supplier_sub_batches LIMIT 1\)/);
  assert.match(supplierBridge, /EXISTS \(SELECT 1 FROM batch_keys LIMIT 1\)/);
  assert.match(supplierBridge, /structural normalization, never an implicit data conversion/);
  assert.doesNotMatch(supplierBridge, /INSERT\s+INTO\s+(supplier_orders|supplier_sub_batches|batch_keys)/i);
});

test("canonical enum bridge is additive and does not rewrite historical events", () => {
  assert.match(enumBridge, /to_regtype\('public\.event_type'\) IS NULL/);
  assert.match(enumBridge, /ALTER TYPE public\.event_type ADD VALUE IF NOT EXISTS/);
  assert.match(enumBridge, /ALTER TYPE public\.risk_level ADD VALUE IF NOT EXISTS/);
  assert.match(enumBridge, /ALTER TYPE public\.geo_precision ADD VALUE IF NOT EXISTS/);
  assert.doesNotMatch(enumBridge, /UPDATE\s+(?:public\.)?events/i);
  assert.doesNotMatch(enumBridge, /ALTER TABLE\s+(?:public\.)?events/i);
});

test("lead bridge restores only a nullable FK and never guesses a commercial relation", () => {
  assert.match(leadBridge, /ADD COLUMN lead_id uuid/);
  assert.match(leadBridge, /order_request_lead_scope_bridge_orphaned_lead_ids/);
  assert.match(leadBridge, /ON DELETE SET NULL/);
  assert.match(leadBridge, /VALIDATE CONSTRAINT order_requests_lead_id_fkey/);
  assert.match(leadBridge, /does not infer historical lead relationships/);
  assert.doesNotMatch(leadBridge, /UPDATE\s+(?:public\.)?order_requests/i);
});
