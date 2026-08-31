import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { publishedPromotionsFromLocaleData } from "../src/lib/sun-engagement.ts";
import { parseTagManifest } from "../src/lib/tag-manifest.ts";

test("manifest promotion columns become declared public engagement", () => {
  const manifest = parseTagManifest([
    "uid_hex;batch_id;promotion_title;promotion_description;promotion_points;promotion_state;promotion_public",
    "04AABBCCDD1090;LOT-1;Club de la marca;Beneficio sujeto a condiciones;40;PUBLICADA;SI",
  ].join("\n"), "LOT-1");
  assert.equal(manifest.rejectedRows.length, 0);
  assert.deepEqual(manifest.rows[0].engagementData, {
    promotions: [{
      title: "Club de la marca",
      description: "Beneficio sujeto a condiciones",
      points: 40,
      state: "published",
      public: true,
    }],
  });
  assert.deepEqual(publishedPromotionsFromLocaleData({ engagement: manifest.rows[0].engagementData }), [{
    title: "Club de la marca",
    description: "Beneficio sujeto a condiciones",
    points: 40,
    state: "published",
    sourceLabel: "DECLARADO POR LA MARCA",
  }]);
});

test("public promotion projection omits codes, targeting and arbitrary JSON", () => {
  const promotions = publishedPromotionsFromLocaleData({
    engagement: {
      promotions: [{
        title: "Beneficio informado",
        description: "Consultar vigencia",
        points: 15,
        state: "published",
        public: true,
        couponCode: "PRIVATE-CODE",
        targeting: { segment: "vip" },
        apiKey: "must-not-leak",
      }],
    },
  });
  assert.deepEqual(Object.keys(promotions[0]).sort(), ["description", "points", "sourceLabel", "state", "title"]);
  assert.doesNotMatch(JSON.stringify(promotions), /PRIVATE-CODE|must-not-leak|segment/);
});

test("draft, disabled and non-public promotions never reach the public SUN projection", () => {
  const promotions = publishedPromotionsFromLocaleData({
    engagement: {
      promotions: [
        { title: "Borrador", state: "draft", public: true },
        { title: "Deshabilitada", state: "disabled", public: true },
        { title: "Sin opt-in", state: "published", public: false },
        { title: "Legado ambiguo", state: "published" },
        { title: "Publicada", state: "published", public: true },
      ],
    },
  });
  assert.deepEqual(promotions.map((item) => item.title), ["Publicada"]);
});

test("manifest promotions default to private draft and reject unknown states", () => {
  const privateDraft = parseTagManifest(
    "uid_hex;batch_id;promotion_title\n04AABBCCDD1090;LOT-1;Beneficio interno\n",
    "LOT-1",
  );
  assert.deepEqual(privateDraft.rows[0].engagementData.promotions[0], {
    title: "Beneficio interno",
    description: null,
    points: null,
    state: "draft",
    public: false,
  });
  assert.deepEqual(publishedPromotionsFromLocaleData({ engagement: privateDraft.rows[0].engagementData }), []);

  const invalid = parseTagManifest(
    "uid_hex;batch_id;promotion_title;promotion_state;promotion_public\n04AABBCCDD1090;LOT-1;Oferta;BORRADOR_SECRETO;true\n",
    "LOT-1",
  );
  assert.equal(invalid.rows.length, 0);
  assert.equal(invalid.rejectedRows[0].reason, "invalid_engagement_json");
});

test("manifest promotion JSON rejects unsupported or secret fields", () => {
  const promotionJson = '"{""title"":""Oferta"",""couponCode"":""PRIVATE""}"';
  const manifest = parseTagManifest(`uid_hex;batch_id;promotion_json\n04AABBCCDD1090;LOT-1;${promotionJson}\n`, "LOT-1");
  assert.equal(manifest.rows.length, 0);
  assert.equal(manifest.rejectedRows[0].reason, "invalid_engagement_json");
  assert.doesNotMatch(String(manifest.rejectedRows[0].value || ""), /PRIVATE/);
});

test("SUN contract emits declared promotions from the passport locale data", async () => {
  const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");
  assert.match(route, /publishedPromotionsFromLocaleData\(params\.passport\?\.locale_data\)/);
  assert.match(route, /engagement: \{ promotions: publishedPromotions \}/);
});
