import test from "node:test";
import assert from "node:assert/strict";
import { permissionDenied, permissionMatches } from "../src/lib/permission-matcher.js";

test("permite wildcard global", () => {
  assert.equal(permissionMatches(["*"], "batches:read"), true);
  assert.equal(permissionMatches(["*"], "employees:write"), true);
});

test("permite wildcard por recurso", () => {
  assert.equal(permissionMatches(["batches:*"], "batches:read"), true);
  assert.equal(permissionMatches(["batches:*"], "batches:write"), true);
  assert.equal(permissionMatches(["crm:*"], "crm:campaigns:write"), true);
});

test("no permite recursos ajenos", () => {
  assert.equal(permissionMatches(["batches:*"], "employees:write"), false);
  assert.equal(permissionMatches(["analytics:read"], "analytics:write"), false);
});

test("mantiene permisos exactos y permiso vacio", () => {
  assert.equal(permissionMatches(["events:read"], "events:read"), true);
  assert.equal(permissionMatches(["events:read"], ""), true);
  assert.equal(permissionMatches([], null), true);
});

test("aliases enterprise son compuestos y no amplian permisos parciales", () => {
  assert.equal(permissionMatches(["webhooks.manage"], "webhooks:read"), true);
  assert.equal(permissionMatches(["webhooks.manage"], "webhooks:write"), true);
  assert.equal(permissionMatches(["webhooks:read"], "webhooks.manage"), false);
  assert.equal(permissionMatches(["webhooks:read", "webhooks:write"], "webhooks.manage"), true);
  assert.equal(permissionMatches(["packaging_lab.manage"], "supplier:packaging_lab_manage"), true);
  assert.equal(permissionMatches(["supplier:*"], "packaging_lab.manage"), true);
  assert.equal(permissionMatches(["supplier:*"], "webhooks.manage"), false);
  assert.equal(permissionMatches(["batch.activate"], "supplier:batch_activate"), true);
  assert.equal(permissionMatches(["batch.activate"], "tags:write"), false);
  assert.equal(permissionMatches(["tags:write"], "batch.activate"), false);
  assert.equal(permissionMatches(["proofs.read"], "proof:read"), true);
  assert.equal(permissionMatches(["proofs.read"], "proof:write"), false);
  assert.equal(permissionMatches(["proofs.anchor"], "proof:write"), true);
  assert.equal(permissionMatches(["proofs.anchor"], "proof:read"), false);
  assert.equal(permissionMatches(["supplier:qa"], "qa.approve"), true);
  assert.equal(permissionMatches(["supplier:qa_approve"], "qa.approve"), true);
  assert.equal(permissionMatches(["batch:lifecycle"], "batch.lifecycle"), true);
});

test("deny explicito prevalece sobre aliases y wildcards", () => {
  assert.equal(permissionDenied(["webhooks:write"], "webhooks.manage"), true);
  assert.equal(permissionDenied(["webhooks.manage"], "webhooks:read"), true);
  assert.equal(permissionDenied(["webhooks:write"], "webhooks:read"), false);
  assert.equal(permissionDenied(["webhooks:read"], "webhooks:write"), false);
  assert.equal(permissionMatches(["webhooks.manage"], "webhooks:read", ["webhooks:write"]), true);
  assert.equal(permissionMatches(["webhooks.manage"], "webhooks:write", ["webhooks:write"]), false);
  assert.equal(permissionMatches(["*"], "webhooks.manage", ["webhooks:*"]), false);
  assert.equal(permissionMatches(["webhooks.manage"], "webhooks:read", ["webhooks.manage"]), false);
  assert.equal(permissionMatches(["webhooks.manage"], "webhooks:read", ["audit:*"]), true);
  assert.equal(permissionMatches(["*"], "reports.export", ["*"]), false);
  assert.equal(permissionMatches(["qa.approve"], "supplier:qa_approve", ["supplier:qa"]), false);
  assert.equal(permissionMatches(["supplier:qa"], "qa.approve", ["supplier:qa_approve"]), false);
});
