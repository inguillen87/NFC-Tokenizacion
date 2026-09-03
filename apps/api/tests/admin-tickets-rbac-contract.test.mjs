import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../src/app/admin/tickets/route.ts", import.meta.url), "utf8");

test("ticket reads require leads.manage before schema or tenant data access", () => {
  const get = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  const permission = get.indexOf('await checkAdminWithPermission(req, "leads.manage")');
  const principal = get.indexOf("getAdminPrincipal(req)");
  const schema = get.indexOf("ensureTicketsSchema()");
  const query = get.indexOf("FROM tickets ticket");

  assert.ok(permission >= 0);
  assert.ok(principal > permission);
  assert.ok(schema > permission);
  assert.ok(query > permission);
  assert.match(get, /WHERE ticket\.tenant_id = \$\{principal\.tenantId\}::uuid/);
});

test("ticket creation remains super-admin only and honors an explicit permission deny", () => {
  const post = route.slice(route.indexOf("export async function POST"));
  const roleGate = post.indexOf('await checkAdmin(req, ["super_admin"])');
  const permissionGate = post.indexOf('checkAdminPermission(req, "leads.manage")');
  const body = post.indexOf("await req.json()");
  const insert = post.indexOf("INSERT INTO tickets");

  assert.ok(roleGate >= 0);
  assert.ok(permissionGate > roleGate);
  assert.ok(body > permissionGate);
  assert.ok(insert > body);
});
