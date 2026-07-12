import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appRoot = new URL("../src/app/", import.meta.url);

test("private and identity-bearing surfaces opt out of search indexing", async () => {
  const metadata = await readFile(new URL("../src/lib/private-surface-metadata.ts", import.meta.url), "utf8");
  const privateLayouts = [
    "login/layout.tsx",
    "register/layout.tsx",
    "me/layout.tsx",
    "web3/layout.tsx",
    "proof/layout.tsx",
    "certificado/[eventId]/layout.tsx",
    "r/[token]/layout.tsx",
    "s/[token]/layout.tsx",
    "demo-sandbox/layout.tsx",
    "investor-snapshot/layout.tsx",
  ];

  assert.match(metadata, /index:\s*false/);
  assert.match(metadata, /follow:\s*false/);
  assert.match(metadata, /noimageindex:\s*true/);

  for (const path of privateLayouts) {
    const source = await readFile(new URL(path, appRoot), "utf8");
    assert.match(source, /privateSurfaceMetadata/, `${path} must inherit noindex metadata`);
  }
});

test("robots and sitemap separate public acquisition pages from private workflows", async () => {
  const robots = await readFile(new URL("robots.ts", appRoot), "utf8");
  const sitemap = await readFile(new URL("sitemap.ts", appRoot), "utf8");

  for (const route of ["/login", "/register", "/me/", "/web3/", "/proof/", "/certificado/", "/r/", "/s/"]) {
    assert.match(robots, new RegExp(route.replaceAll("/", "\\/")));
    assert.doesNotMatch(sitemap, new RegExp(route.replaceAll("/", "\\/")));
  }

  for (const route of ["/demo-lab", "/pricing", "/sdk", "/docs", "/sun", "/audiences", "/stack", "/resellers", "/glossary"]) {
    assert.match(sitemap, new RegExp(route.replaceAll("/", "\\/")));
  }
});
