import test from "node:test";
import assert from "node:assert/strict";
import { permissionMatches } from "../src/lib/permission-matcher.js";

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
