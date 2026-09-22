import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/app/api/admin/[...path]/route.ts", import.meta.url),
  "utf8",
);

test("admin proxy authenticates and authorizes before consuming a mutation body", () => {
  const productionAuth = source.indexOf("if (isProduction && !scopedRole)");
  const permissionCheck = source.indexOf("const requiredPermission = requiredPermissionForAdminResource");
  const bodyRead = source.indexOf("const bodyResult = await readBoundedAdminProxyBody(req,");

  assert.ok(productionAuth >= 0, "production session boundary must exist");
  assert.ok(permissionCheck > productionAuth, "permission boundary must follow session auth");
  assert.ok(bodyRead > permissionCheck, "body must be consumed only after auth and permission checks");
  assert.match(source, /readBoundedAdminProxyBody\(req, ticketPatch \? 16 \* 1024 : MAX_ADMIN_PROXY_BODY_BYTES\)/);
  assert.doesNotMatch(source, /await req\.text\(\)/);
});

test("admin proxy rejects declared and streamed oversized bodies", () => {
  assert.match(source, /MAX_ADMIN_PROXY_BODY_BYTES = 512 \* 1024/);
  assert.match(source, /readBoundedAdminProxyBody\(req: Request, maximumBytes = MAX_ADMIN_PROXY_BODY_BYTES\)/);
  assert.match(source, /declared > maximumBytes/);
  assert.match(source, /req\.body\?\.getReader\(\)/);
  assert.match(source, /total > maximumBytes/);
  assert.match(source, /reader\.cancel\("admin_proxy_request_too_large"\)/);
  assert.match(source, /status: 413/);
  assert.match(source, /cache-control": "no-store"/);
});

test("the actual bounded reader preserves the 512 KiB default and the tighter 16 KiB ticket limit", async () => {
  const ast = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "readBoundedAdminProxyBody");
  const limitDeclaration = ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(ast) === "MAX_ADMIN_PROXY_BODY_BYTES"));
  assert.ok(declaration); assert.ok(limitDeclaration);
  const compiled = ts.transpileModule(`${limitDeclaration.getText(ast)}\n${declaration.getText(ast)}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const readBody = new Function("NextResponse", `${compiled}\nreturn readBoundedAdminProxyBody;`)(Response);
  for (const override of [undefined, 16 * 1024]) {
    const limit = override ?? 512 * 1024;
    let readStarted = false;
    const declared = await readBody({ method: "POST", headers: new Headers({ "content-length": String(limit + 1) }), body: { getReader() { readStarted = true; throw Error("Oversized declared body must not be read"); } } }, override);
    assert.equal(declared.ok, false); assert.equal(declared.response.status, 413); assert.equal(readStarted, false);
    assert.equal(declared.response.headers.get("cache-control"), "no-store");

    const exact = await readBody(new Request("https://dashboard.example.invalid/api/admin/resource", { method: "POST", body: "x".repeat(limit) }), override);
    assert.equal(exact.ok, true); assert.equal(exact.body.length, limit);

    // A forged small length cannot bypass the byte limit, including multibyte text.
    const oversized = new Request("https://dashboard.example.invalid/api/admin/resource", { method: "POST", headers: { "content-length": "1" }, body: "é".repeat(limit / 2 + 1) });
    const streamed = await readBody(oversized, override);
    assert.equal(streamed.ok, false); assert.equal(streamed.response.status, 413);
    assert.equal((await streamed.response.json()).reason, "admin_proxy_request_too_large");
  }
});

test("admin proxy preserves upstream no-store for one-time credential responses", () => {
  assert.match(source, /headers\.set\("Cache-Control", response\.headers\.get\("cache-control"\) \|\| "no-store"\)/);
});
