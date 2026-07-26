import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url),
  "utf8",
);

test("admin proxy authenticates and authorizes before consuming a mutation body", () => {
  const productionAuth = source.indexOf("if (isProduction && !scopedRole)");
  const permissionCheck = source.indexOf("const requiredPermission = requiredPermissionForAdminResource");
  const bodyRead = source.indexOf("const bodyResult = await readBoundedAdminProxyBody(req)");

  assert.ok(productionAuth >= 0, "production session boundary must exist");
  assert.ok(permissionCheck > productionAuth, "permission boundary must follow session auth");
  assert.ok(bodyRead > permissionCheck, "body must be consumed only after auth and permission checks");
  assert.doesNotMatch(source, /await req\.text\(\)/);
});

test("admin proxy rejects declared and streamed oversized bodies", () => {
  assert.match(source, /MAX_ADMIN_PROXY_BODY_BYTES = 512 \* 1024/);
  assert.match(source, /declared > MAX_ADMIN_PROXY_BODY_BYTES/);
  assert.match(source, /req\.body\?\.getReader\(\)/);
  assert.match(source, /total > MAX_ADMIN_PROXY_BODY_BYTES/);
  assert.match(source, /reader\.cancel\("admin_proxy_request_too_large"\)/);
  assert.match(source, /status: 413/);
  assert.match(source, /cache-control": "no-store"/);
});

