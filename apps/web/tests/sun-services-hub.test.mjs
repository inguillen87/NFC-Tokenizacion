import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { resolveSunServicesHubAvailability } from "../src/app/sun/sun-services-hub-model.ts";

const allAvailable = {
  promotion: true,
  purchase: true,
  subscribe: true,
  claimOrManage: true,
  warranty: true,
};

test("SUN services only exposes actions with both policy and a real destination", () => {
  assert.deepEqual(resolveSunServicesHubAvailability({
    riskState: "clear",
    policyAvailability: allAvailable,
    promotionPublished: true,
    purchaseHref: "/buy",
    subscribeHref: "#subscribe",
    claimOrManageHref: " ",
    warrantyHref: null,
  }), {
    promotionVisible: true,
    promotionSuppressed: false,
    promotionDegraded: false,
    purchase: true,
    subscribe: true,
    claimOrManage: false,
    warranty: false,
  });
});

test("a blocked risk hides promotional detail and protects claim and warranty", () => {
  assert.deepEqual(resolveSunServicesHubAvailability({
    riskState: "blocked",
    policyAvailability: allAvailable,
    promotionPublished: true,
    purchaseHref: "/buy",
    subscribeHref: "#subscribe",
    claimOrManageHref: "/claim",
    warrantyHref: "/warranty",
  }), {
    promotionVisible: false,
    promotionSuppressed: true,
    promotionDegraded: false,
    purchase: true,
    subscribe: true,
    claimOrManage: false,
    warranty: false,
  });
});

test("an observed risk degrades a published promotion and rejects unsafe destinations", () => {
  assert.deepEqual(resolveSunServicesHubAvailability({
    riskState: "observed",
    policyAvailability: allAvailable,
    promotionPublished: true,
    purchaseHref: "javascript:alert(1)",
    subscribeHref: "#subscribe",
    claimOrManageHref: "/claim",
    warrantyHref: "https://brand.example/warranty",
  }), {
    promotionVisible: true,
    promotionSuppressed: false,
    promotionDegraded: true,
    purchase: false,
    subscribe: true,
    claimOrManage: true,
    warranty: true,
  });
});

test("SUN services reject backslash paths, protocol-relative links and credentialed HTTPS URLs", () => {
  const availability = resolveSunServicesHubAvailability({
    riskState: "clear",
    policyAvailability: allAvailable,
    promotionPublished: false,
    purchaseHref: "/\\evil.example",
    subscribeHref: "//evil.example",
    claimOrManageHref: "https://user:pass@example.com/claim",
    warrantyHref: "/warranty",
  });
  assert.equal(availability.purchase, false);
  assert.equal(availability.subscribe, false);
  assert.equal(availability.claimOrManage, false);
  assert.equal(availability.warranty, true);
});

test("SUN services copy describes requests without promising purchase, prize or ownership", async () => {
  const component = await readFile(new URL("../src/app/sun/sun-services-hub.tsx", import.meta.url), "utf8");

  assert.match(component, /La marca no publicó una promoción para este producto/);
  assert.match(component, /Solicitar compra/);
  assert.match(component, /La solicitud no confirma stock ni completa una compra/);
  assert.match(component, /No promete premios/);
  assert.match(component, /El tap no transfiere propiedad/);
  assert.match(component, /Enviar la solicitud no confirma su aceptación/);
  assert.match(component, /Muestra sin tap físico/);
  assert.match(component, /role="status"/);
  assert.match(component, /aria-label="Servicios disponibles para este producto"/);
  assert.doesNotMatch(component, /Comprar ahora|Premio confirmado|Propiedad confirmada|Garantía activada/);
});
