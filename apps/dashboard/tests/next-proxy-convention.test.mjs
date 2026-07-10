import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function pathExists(pathUrl) {
  try {
    await access(pathUrl);
    return true;
  } catch {
    return false;
  }
}

const dashboardProxyUrl = new URL("../src/proxy.ts", import.meta.url);
const dashboardMiddlewareUrl = new URL("../src/middleware.ts", import.meta.url);
const webProxyUrl = new URL("../../web/src/proxy.ts", import.meta.url);
const webMiddlewareUrl = new URL("../../web/src/middleware.ts", import.meta.url);

const dashboardProxySource = await readFile(dashboardProxyUrl, "utf8");
const webProxySource = await readFile(webProxyUrl, "utf8");

test("Next apps use the Next 16 proxy convention instead of middleware", async () => {
  assert.equal(await pathExists(dashboardMiddlewareUrl), false);
  assert.equal(await pathExists(webMiddlewareUrl), false);

  assert.match(dashboardProxySource, /export function proxy\(req: NextRequest, event: NextFetchEvent\)/);
  assert.match(webProxySource, /export function proxy\(req: NextRequest, event:/);

  assert.match(dashboardProxySource, /const clerkGuard = isClerkConfiguredForRuntime\(\)/);
  assert.match(dashboardProxySource, /return clerkGuard \? clerkGuard\(req, event\) : NextResponse\.next\(\)/);

  assert.match(webProxySource, /function landingMiddleware\(req: NextRequest\)/);
  assert.match(webProxySource, /host\.toLowerCase\(\) === "www\.nexid\.lat"/);
  assert.match(webProxySource, /return clerkGuard \? clerkGuard\(req, event\) : landingMiddleware\(req\)/);

  assert.match(dashboardProxySource, /export const config = \{/);
  assert.match(webProxySource, /export const config = \{/);
  assert.doesNotMatch(dashboardProxySource, /export default function middleware/);
  assert.doesNotMatch(webProxySource, /export default function middleware/);
});
