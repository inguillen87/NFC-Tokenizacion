import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [context, header, ...pages] = await Promise.all([
  read("../src/components/public-route-context.tsx"),
  read("../src/components/public-site-header.tsx"),
  ...["about", "audiences", "demo", "docs", "glossary", "pricing", "resellers", "stack"].map((route) =>
    read(`../src/app/${route}/page.tsx`),
  ),
]);

test("public route context stays localized, compact and route-aware", () => {
  assert.match(context, /"es-AR"[\s\S]*Contexto de la sección/);
  assert.match(context, /"pt-BR"[\s\S]*Contexto da seção/);
  assert.match(context, /en:[\s\S]*Section context/);
  assert.match(context, /aria-current="page"/);
  assert.match(context, /matchesPath\(pathname, candidate\.prefix\)/);
  assert.doesNotMatch(context, /demo-lab|contact-modal|className=\{styles\.actions\}/);
});

test("shared public pages expose one localized skip target", () => {
  assert.match(header, /href="#main-content"/);
  assert.match(header, /<PublicRouteContext locale=\{locale\} \/>/);

  for (const page of pages) {
    assert.match(page, /<PublicSiteHeader \/>/);
    assert.match(page, /<main id="main-content" tabIndex=\{-1\}/);
  }
});
