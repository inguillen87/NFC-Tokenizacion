import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const protectedRoutes = [
  "src/app/mobile/passport/[eventId]/consumer/claim/route.ts",
  "src/app/mobile/passport/[eventId]/consumer/join-tenant/route.ts",
  "src/app/mobile/passport/[eventId]/consumer/save-product/route.ts",
];

for (const routePath of protectedRoutes) {
  test(`mobile consumer route requires a real consumer session: ${routePath}`, () => {
    const source = readFileSync(path.join(root, routePath), "utf8");

    assert.match(source, /getConsumerFromRequest/, "route must read the authenticated consumer from the request");
    assert.doesNotMatch(
      source,
      /getOrCreateDemoConsumer|canUseDemoConsumerForTap|demo\.consumer@nexid\.local|demoConsumer/,
      "route must not fall back to demo consumers or auto-authorize tap claims",
    );
  });
}
