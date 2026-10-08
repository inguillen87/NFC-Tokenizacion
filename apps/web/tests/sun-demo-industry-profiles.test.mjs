import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEMO_PRODUCT_PROFILES,
  isDemoProductProfileKey,
  resolveDemoProductProfile,
} from "../src/lib/demo-product-profiles.ts";

test("agrochemicals, perfumery and packaging resolve to distinct server-owned demonstrations", () => {
  const agro = resolveDemoProductProfile("agrochem");
  const fragrance = resolveDemoProductProfile("fragrance");
  const packaging = resolveDemoProductProfile("perfume");
  assert.equal(agro.category, "Agroquímicos · ejemplo ilustrativo");
  assert.equal(fragrance.name, "Bruma · Eau de Parfum");
  assert.equal(packaging.name, "Estuche Aurora");
  assert.equal(new Set([agro.name, fragrance.name, packaging.name]).size, 3);
  assert.equal(agro.vertical, "agro");
  assert.equal(fragrance.vertical, "perfume");
});

test("demo profile selection cannot inject a brand, endpoint or external photograph", () => {
  for (const value of ["syngenta", "https://example.test/brand", "../../tenant", "fragrance&tenant=private", "__proto__"]) {
    assert.equal(isDemoProductProfileKey(value), false);
    assert.equal(resolveDemoProductProfile(value), DEMO_PRODUCT_PROFILES.wine);
  }
  assert.equal(resolveDemoProductProfile("  FRAGRANCE  "), DEMO_PRODUCT_PROFILES.fragrance);
  assert.equal(resolveDemoProductProfile(" AGROCHEM "), DEMO_PRODUCT_PROFILES.agrochem);
});

test("every profile photograph exists locally and every illustrative coordinate is bounded", async () => {
  for (const profile of Object.values(DEMO_PRODUCT_PROFILES)) {
    for (const image of profile.images) {
      assert.match(image, /^\/(?:landing|demo)\/[a-z0-9/._-]+$/);
      await access(fileURLToPath(new URL(`../public${image}`, import.meta.url)));
    }
    for (const point of [profile.origin, profile.sampleTap]) {
      assert.ok(Number.isFinite(point.lat) && Math.abs(point.lat) <= 90);
      assert.ok(Number.isFinite(point.lng) && Math.abs(point.lng) <= 180);
    }
  }
});

test("existing Demo Lab examples retain their identities and profile keys", () => {
  assert.equal(resolveDemoProductProfile("wine").name, "Reserva Andina");
  assert.equal(resolveDemoProductProfile("perfume").brand, "Aurora Packaging");
  assert.equal(resolveDemoProductProfile("agro").category, "Semillas");
});
