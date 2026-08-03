import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  scanPlaceholderRepository,
  shouldScanPlaceholderFile,
} from "../check-no-placeholders.mjs";

async function createFixtureRepository(t, files) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "nexid-placeholder-gate-"));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(repoRoot, ...relativePath.split("/"));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
  }
  return repoRoot;
}

test("reports public loopback links, coming-soon copy, and dead anchors", async (t) => {
  const repoRoot = await createFixtureRepository(t, {
    "apps/web/src/app/page.tsx": `
      export default function Page() {
        return <main>
          <a href="http://localhost:3000/account">Account</a>
          <a href={'#'}>Broken action</a>
          <p>Coming Soon</p>
        </main>;
      }
    `,
  });

  const violations = scanPlaceholderRepository({ repoRoot });
  assert.deepEqual(
    violations.map((violation) => violation.rule).sort(),
    ["coming-soon", "dead-anchor", "public-loopback-url"],
  );
  assert.ok(violations.every((violation) => violation.relativePath === "apps/web/src/app/page.tsx"));
  assert.ok(violations.every((violation) => violation.line > 0 && violation.column > 0));
});

test("ignores explicit non-runtime fixtures without weakening runtime scanning", async (t) => {
  const repoRoot = await createFixtureRepository(t, {
    "apps/web/.env.example": "NEXT_PUBLIC_APP_URL=http://localhost:3000\n",
    "apps/web/tests/navigation.test.ts": 'const local = "http://localhost:3000"; // Coming Soon\n',
    "apps/api/scripts/demo-smoke.mjs": 'const baseUrl = "http://localhost:3003";\n',
    "apps/web/src/lib/host-parser.ts": 'export const local = /^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname);\n',
  });

  assert.equal(shouldScanPlaceholderFile("apps/web/.env.example"), false);
  assert.equal(shouldScanPlaceholderFile("apps/web/tests/navigation.test.ts"), false);
  assert.equal(shouldScanPlaceholderFile("apps/api/scripts/demo-smoke.mjs"), false);
  assert.equal(shouldScanPlaceholderFile("apps/web/src/lib/host-parser.ts"), true);
  assert.deepEqual(scanPlaceholderRepository({ repoRoot }), []);
});

test("allows only the exact audited runtime development contexts", async (t) => {
  const repoRoot = await createFixtureRepository(t, {
    "apps/executor/src/server.mjs": `
      const parsed = new URL(req.url || "/", "http://localhost");
      export const unsafePublicLink = "http://localhost:3000/claim";
    `,
    "apps/dashboard/src/lib/clerk-env.ts": `
      const localOrigins = isProductionDeployment()
        ? []
        : ["http://localhost:3000", "http://localhost:3010", "http://127.0.0.1:3000", "http://127.0.0.1:3010"];
    `,
    "apps/api/src/app/realtime/session/route.ts": `
      if (!productionRuntime()) {
        origins.add("http://localhost:3000");
        origins.add("http://127.0.0.1:3000");
      }
    `,
    "apps/api/src/lib/consumer-mutation-origin.ts": `
      const LOCAL_DEVELOPMENT_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3003",
        "http://127.0.0.1:3003",
      ] as const;
      export const unsafePublicLink = "http://localhost:3000/claim";
    `,
    "apps/api/src/app/admin/users/invite/route.ts": `
      const activationLink = allowDevLink
        ? \`\${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3002'}/reset-password?token=\${encodeURIComponent(token)}\`
        : undefined;
    `,
  });

  const violations = scanPlaceholderRepository({ repoRoot });
  assert.equal(violations.length, 2);
  assert.ok(violations.every((violation) => violation.rule === "public-loopback-url"));
  assert.ok(violations.every((violation) => violation.match === "http://localhost:3000/claim"));
  assert.ok(violations.every((violation) => /unsafePublicLink/.test(violation.excerpt)));
});

test("does not treat a generic URL constructor as an audited parser exception", async (t) => {
  const repoRoot = await createFixtureRepository(t, {
    "apps/web/src/lib/public-link.ts": `
      export const publicClaimUrl = new URL("/claim", "http://localhost:3000").toString();
    `,
  });

  const violations = scanPlaceholderRepository({ repoRoot });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, "public-loopback-url");
});
