import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(apiRoot, "../..");
const { canUseConsumerDemoBypass } = await import("../src/lib/consumer-demo-policy.ts");

test("consumer demo bypass fails closed in production and remains explicit in development", () => {
  const request = { demoConsumer: true };

  assert.equal(canUseConsumerDemoBypass(request, { DEMO_MODE: "true", NODE_ENV: "production" }), false);
  assert.equal(canUseConsumerDemoBypass(request, { CONSUMER_AUTH_MODE: "demo", VERCEL_ENV: "production" }), false);
  assert.equal(canUseConsumerDemoBypass(request, { DEMO_MODE: "true", NODE_ENV: "Production" }), false);
  assert.equal(canUseConsumerDemoBypass(request, { DEMO_MODE: "true", NODE_ENV: "development" }), true);
  assert.equal(canUseConsumerDemoBypass({ consumerMode: "DEMO" }, { CONSUMER_AUTH_MODE: "demo" }), true);
  assert.equal(canUseConsumerDemoBypass({}, { DEMO_MODE: "true", NODE_ENV: "development" }), false);
});

test("marketplace demo consumer bypass delegates to the shared production-safe policy", () => {
  const marketplaceRoute = readFileSync(
    path.join(apiRoot, "src/app/marketplace/products/[id]/request-to-buy/route.ts"),
    "utf8",
  );
  const verifyRoute = readFileSync(path.join(apiRoot, "src/app/consumer/auth/verify/route.ts"), "utf8");

  assert.match(marketplaceRoute, /canUseConsumerDemoBypass/);
  assert.match(verifyRoute, /canUseConsumerDemoBypass/);
  assert.doesNotMatch(marketplaceRoute, /CONSUMER_AUTH_MODE/);
  assert.doesNotMatch(marketplaceRoute, /startsWith\("demo-"\)/);
});

test("production environment example fails closed for consumer demo auth", () => {
  const example = readFileSync(path.join(apiRoot, ".env.example"), "utf8");

  assert.match(example, /^DEMO_MODE=false\r?$/m);
  assert.match(example, /^CONSUMER_AUTH_MODE=smart\r?$/m);
  assert.doesNotMatch(example, /^CONSUMER_AUTH_MODE=demo\r?$/m);
});

test("production migration workflow is manual, confirmed and environment-protected", () => {
  const workflow = readFileSync(path.join(repoRoot, ".github/workflows/prisma-migrate.yml"), "utf8");

  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s*push:/m);
  assert.match(workflow, /confirmation:/);
  assert.match(workflow, /MIGRATE_PRODUCTION/);
  assert.match(workflow, /needs: validate_request/);
  assert.match(workflow, /environment:\s*\n\s*name: production/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /DATABASE_URL[\s\S]*exit 1/);
  assert.doesNotMatch(workflow, /skipping Prisma migrations/i);
});
