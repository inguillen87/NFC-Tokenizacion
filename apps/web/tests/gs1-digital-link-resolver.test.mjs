import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const {
  GS1_DIGITAL_LINK_AUTH_LEVEL,
  GS1_DIGITAL_LINK_TRUST_LEVEL,
  GS1_LINKSET_CONTEXT,
  GS1_LINKSET_MEDIA_TYPE,
  NEXID_OFFLINE_PUBLIC_CERTIFICATE_REL,
  NEXID_DPP_REL,
  NEXID_PRODUCT_REL,
  NEXID_LOT_REL,
  NEXID_SERIAL_REL,
  NEXID_TECHNICAL_SHEET_REL,
  NEXID_SAFETY_SHEET_REL,
  NEXID_SUPPORT_REL,
  NEXID_RECALL_STATUS_REL,
  buildOfflinePublicCertificateViewerUrl,
  buildGs1DigitalLinkSunUrl,
  buildGs1Linkset,
  buildGs1ResolverDescription,
  gs1OptionsResponse,
  isValidGtin14,
  resolveGs1DigitalLink,
  validateGs1DigitalLinkIdentity,
} = await import("../src/app/id/_lib/gs1-digital-link-resolver.ts");

const VALID_GTIN = "09506000134352";
const REGISTRY = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  gtin: VALID_GTIN,
  lot: "",
  serial: "",
  tenantSlug: "winery-one",
  bid: "BID-1",
  displayName: "Registered product",
};
const found = async (identity) => ({ status: "found", registry: { ...REGISTRY, ...identity } });

test("GS1 Digital Link validates GTIN-14 check digits and bounded qualifiers", () => {
  assert.equal(isValidGtin14(VALID_GTIN), true);
  assert.equal(isValidGtin14("09506000134353"), false);
  assert.equal(isValidGtin14("9506000134352"), false);
  assert.equal(validateGs1DigitalLinkIdentity({ gtin: VALID_GTIN, lot: "LOT-9", serial: "SER-42" }).ok, true);
  assert.equal(validateGs1DigitalLinkIdentity({ gtin: VALID_GTIN, lot: "LOT/ESCAPE" }).ok, false);
  assert.equal(validateGs1DigitalLinkIdentity({ gtin: VALID_GTIN, serial: "X".repeat(21) }).ok, false);
});

test("resolver maps only server-registered scope to SUN without crypto-auth claims or sensitive query forwarding", () => {
  const target = buildGs1DigitalLinkSunUrl(
    `https://id.nexid.lat/01/${VALID_GTIN}/10/LOT-9/21/SER-42?tenant=winery-one&bid=BID-1&recall=R-7&token=drop&linkType=gs1:pip`,
    { gtin: VALID_GTIN, lot: "LOT-9", serial: "SER-42" },
    { ...REGISTRY, lot: "LOT-9", serial: "SER-42" },
  );

  assert.equal(target.pathname, "/sun");
  assert.equal(target.searchParams.get("qr"), "1");
  assert.equal(target.searchParams.get("carrier"), "gs1_digital_link");
  assert.equal(target.searchParams.get("gtin"), VALID_GTIN);
  assert.equal(target.searchParams.get("lot"), "LOT-9");
  assert.equal(target.searchParams.get("serial"), "SER-42");
  assert.equal(target.searchParams.get("trust_level"), GS1_DIGITAL_LINK_TRUST_LEVEL);
  assert.equal(target.searchParams.get("authentication_level"), GS1_DIGITAL_LINK_AUTH_LEVEL);
  assert.equal(target.searchParams.get("tenant"), "winery-one");
  assert.equal(target.searchParams.get("bid"), "BID-1");
  assert.equal(target.searchParams.get("recall"), "R-7");
  assert.equal(target.searchParams.get("token"), null);
  assert.equal(target.searchParams.get("linkType"), null);
  assert.equal(GS1_DIGITAL_LINK_TRUST_LEVEL, "GS1_IDENTITY_RESOLVED");
  assert.equal(GS1_DIGITAL_LINK_AUTH_LEVEL, "NOT_CRYPTOGRAPHICALLY_AUTHENTICATED");
});

test("default resolution redirects and rejects malformed identifiers and unsupported link types", async () => {
  const redirect = await resolveGs1DigitalLink(new Request(`https://id.nexid.lat/01/${VALID_GTIN}`), { gtin: VALID_GTIN }, { registryLookup: found });
  assert.equal(redirect.status, 307);
  assert.match(redirect.headers.get("location") || "", new RegExp(`/sun\\?.*gtin=${VALID_GTIN}`));
  assert.equal(redirect.headers.get("access-control-allow-origin"), "*");

  const malformed = await resolveGs1DigitalLink(new Request("https://id.nexid.lat/01/123"), { gtin: "123" }, { registryLookup: found });
  assert.equal(malformed.status, 400);
  assert.match(await malformed.text(), /valid 14-digit GTIN/);

  const unsupported = await resolveGs1DigitalLink(
    new Request(`https://id.nexid.lat/01/${VALID_GTIN}?linkType=gs1:instructions`),
    { gtin: VALID_GTIN },
    { registryLookup: found },
  );
  assert.equal(unsupported.status, 404);
});

test("registered GS1 identities expose the signed public offline certificate without carrying caller scope", async () => {
  const requestUrl = `https://id.nexid.lat/01/${VALID_GTIN}/10/LOT-9/21/SER-42?linkType=nexid:offlineCertificate&tenant=attacker&token=drop`;
  const viewer = buildOfflinePublicCertificateViewerUrl(requestUrl, { gtin: VALID_GTIN, lot: "LOT-9", serial: "SER-42" });
  assert.equal(viewer.toString(), `https://id.nexid.lat/offline/certificate?gtin=${VALID_GTIN}&lot=LOT-9&serial=SER-42`);

  const redirect = await resolveGs1DigitalLink(
    new Request(requestUrl),
    { gtin: VALID_GTIN, lot: "LOT-9", serial: "SER-42" },
    { registryLookup: found },
  );
  assert.equal(redirect.status, 307);
  assert.equal(redirect.headers.get("location"), viewer.toString());
  assert.equal(viewer.searchParams.get("tenant"), null);
  assert.equal(viewer.searchParams.get("token"), null);
});

test("machine clients receive an RFC 9264-shaped GS1 linkset and immutable JSON-LD context", async () => {
  const request = new Request(`https://id.nexid.lat/01/${VALID_GTIN}/10/LOT-9?linkType=linkset`, {
    headers: { accept: GS1_LINKSET_MEDIA_TYPE },
  });
  const resolved = await resolveGs1DigitalLink(request, { gtin: VALID_GTIN, lot: "LOT-9" }, { registryLookup: found });
  assert.equal(resolved.status, 200);
  assert.match(resolved.headers.get("content-type") || "", /^application\/linkset\+json/);
  assert.match(resolved.headers.get("link") || "", new RegExp(GS1_LINKSET_CONTEXT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const payload = await resolved.json();
  assert.equal(payload.linkset.length, 1);
  const item = payload.linkset[0];
  assert.equal(item.anchor, `https://id.nexid.lat/01/${VALID_GTIN}/10/LOT-9`);
  assert.equal(item["https://ref.gs1.org/voc/defaultLink"].length, 1);
  assert.equal(item["https://ref.gs1.org/voc/pip"].length, 1);
  assert.equal(item["https://ref.gs1.org/voc/traceability"].length, 1);
  assert.equal(item[NEXID_OFFLINE_PUBLIC_CERTIFICATE_REL][0].href, `https://id.nexid.lat/offline/certificate?gtin=${VALID_GTIN}&lot=LOT-9`);
  assert.equal(item["https://ref.gs1.org/voc/defaultLink"][0].href, item["https://ref.gs1.org/voc/pip"][0].href);
  assert.equal(item["https://ref.gs1.org/voc/defaultLink"][0].type, "text/html");
});

test("linkType=linkset offers human HTML while HEAD and OPTIONS preserve protocol semantics", async () => {
  const request = new Request(`https://id.nexid.lat/01/${VALID_GTIN}?linkType=linkset`);
  const html = await resolveGs1DigitalLink(request, { gtin: VALID_GTIN }, { registryLookup: found });
  assert.equal(html.status, 200);
  assert.match(html.headers.get("content-type") || "", /^text\/html/);
  assert.match(await html.text(), /Recursos del producto/);

  const head = await resolveGs1DigitalLink(request, { gtin: VALID_GTIN }, { head: true, registryLookup: found });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");

  const options = gs1OptionsResponse();
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("allow"), "GET, HEAD, OPTIONS");
  assert.equal(options.headers.get("access-control-allow-origin"), "*");
});

test("valid but unknown identities return 404 and registry outages fail closed", async () => {
  const request = new Request(`https://id.nexid.lat/01/${VALID_GTIN}`);
  const unknown = await resolveGs1DigitalLink(request, { gtin: VALID_GTIN }, {
    registryLookup: async () => ({ status: "not_found" }),
  });
  assert.equal(unknown.status, 404);
  assert.match(await unknown.text(), /syntactically valid but is not registered/i);

  const unavailable = await resolveGs1DigitalLink(request, { gtin: VALID_GTIN }, {
    registryLookup: async () => ({ status: "unavailable" }),
  });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("retry-after"), "5");
});

test("resolver description advertises only implemented primary keys and link namespace", () => {
  const description = buildGs1ResolverDescription("https://id.nexid.lat/.well-known/gs1resolver");
  assert.equal(description.resolverRoot, "https://id.nexid.lat");
  assert.deepEqual(description.supportedPrimaryKeys, ["01"]);
  assert.deepEqual(description.supportedLinkType[1], { namespace: "https://nexid.lat/rel/", prefix: "nexid:" });
  assert.equal(description.linkTypeDefaultCanBeLinkset, false);
  assert.equal(description.jsonLdContextLocation, GS1_LINKSET_CONTEXT);
});

test("web exposes full /id and id-subdomain GS1 qualifier route families plus resolver description", async () => {
  const required = [
    "../src/app/id/01/[gtin]/route.ts",
    "../src/app/id/01/[gtin]/10/[lot]/route.ts",
    "../src/app/id/01/[gtin]/21/[serial]/route.ts",
    "../src/app/id/01/[gtin]/10/[lot]/21/[serial]/route.ts",
    "../src/app/01/[gtin]/route.ts",
    "../src/app/01/[gtin]/10/[lot]/route.ts",
    "../src/app/01/[gtin]/21/[serial]/route.ts",
    "../src/app/01/[gtin]/10/[lot]/21/[serial]/route.ts",
    "../src/app/.well-known/gs1resolver/route.ts",
  ];
  for (const rel of required) await access(new URL(rel, import.meta.url));

  const legacy = await readFile(new URL("../src/app/01/[gtin]/21/[serial]/route.ts", import.meta.url), "utf8");
  assert.match(legacy, /resolveGs1DigitalLink/);
  assert.match(legacy, /HEAD/);
  assert.match(legacy, /OPTIONS/);

  const resolverSource = await readFile(new URL("../src/app/id/_lib/gs1-digital-link-resolver.ts", import.meta.url), "utf8");
  assert.match(resolverSource, /process\.env\.NEXID_GS1_REGISTRY_API_URL/);
  assert.doesNotMatch(resolverSource, /process\.env\.NEXT_PUBLIC_API_URL|https:\/\/api\.nexid\.lat/);
});

test("direct linkset builder keeps the QR trust boundary explicit", () => {
  const payload = buildGs1Linkset(`https://id.nexid.lat/01/${VALID_GTIN}`, { gtin: VALID_GTIN });
  assert.match(payload.linkset[0].description, /QR no autentica criptograficamente/i);
});

test("registered GS1 product, lot and serial share one DPP and expose only configured HTTPS resources", async () => {
  const registry = {
    ...REGISTRY,
    lot: "LOT-9",
    serial: "SER-42",
    publicLinks: {
      technicalSheet: "https://docs.example.test/technical.pdf",
      safetySheet: "https://docs.example.test/safety.pdf",
      support: "https://support.example.test/agro",
      recallStatus: "https://status.example.test/recalls/LOT-9",
    },
  };
  const requestUrl = `https://id.nexid.lat/01/${VALID_GTIN}/10/LOT-9/21/SER-42`;
  const payload = buildGs1Linkset(requestUrl, { gtin: VALID_GTIN, lot: "LOT-9", serial: "SER-42" }, registry);
  const item = payload.linkset[0];
  assert.equal(item[NEXID_DPP_REL][0].href, item["https://ref.gs1.org/voc/defaultLink"][0].href);
  assert.equal(item[NEXID_PRODUCT_REL][0].href, `https://id.nexid.lat/01/${VALID_GTIN}`);
  assert.equal(item[NEXID_LOT_REL][0].href, `https://id.nexid.lat/01/${VALID_GTIN}/10/LOT-9`);
  assert.equal(item[NEXID_SERIAL_REL][0].href, requestUrl);
  assert.equal(item[NEXID_TECHNICAL_SHEET_REL][0].href, registry.publicLinks.technicalSheet);
  assert.equal(item[NEXID_SAFETY_SHEET_REL][0].href, registry.publicLinks.safetySheet);
  assert.equal(item[NEXID_SUPPORT_REL][0].href, registry.publicLinks.support);
  assert.equal(item[NEXID_RECALL_STATUS_REL][0].href, registry.publicLinks.recallStatus);

  const technical = await resolveGs1DigitalLink(
    new Request(`${requestUrl}?linkType=nexid:technicalSheet`),
    { gtin: VALID_GTIN, lot: "LOT-9", serial: "SER-42" },
    { registryLookup: async () => ({ status: "found", registry }) },
  );
  assert.equal(technical.status, 307);
  assert.equal(technical.headers.get("location"), registry.publicLinks.technicalSheet);

  const dppFallback = await resolveGs1DigitalLink(
    new Request(`https://id.nexid.lat/01/${VALID_GTIN}?linkType=nexid:safetySheet`),
    { gtin: VALID_GTIN },
    { registryLookup: found },
  );
  assert.equal(dppFallback.status, 307);
  assert.match(dppFallback.headers.get("location") || "", /\/sun\?.*#safety-sheet$/);
});
