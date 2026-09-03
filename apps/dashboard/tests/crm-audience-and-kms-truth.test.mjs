import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const crm = await readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8");
const home = await readFile(new URL("../src/app/(app)/page.tsx", import.meta.url), "utf8");
const growth = await readFile(new URL("../src/components/customer-growth-command-center.tsx", import.meta.url), "utf8");
const eventsPage = await readFile(new URL("../src/app/(app)/events/page.tsx", import.meta.url), "utf8");
const supplierPage = await readFile(new URL("../src/app/(app)/batches/supplier/page.tsx", import.meta.url), "utf8");
const supplierConsole = await readFile(new URL("../src/components/supplier-order-console.tsx", import.meta.url), "utf8");

test("CRM treats UID as product activity and never exports an event as an audience recipient", () => {
  assert.match(crm, /function isCommercialActivitySignal/);
  assert.match(crm, /function isGeoOpportunitySignal/);
  assert.match(crm, /classifyLocationProvenance\(value\) === "consented_gps"/);
  assert.match(crm, /isClientReportedGps\(row\.locationSource\)/);
  assert.match(crm, /row\.interactionClass !== "security_signal"/);
  assert.match(crm, /flatMap\(\(row\) => row\.commercialConsentChannels\)/);
  assert.match(crm, /filter\(\(opportunity\) => opportunity\.geoCommercialSignals > 0\)/);
  assert.match(crm, /visibleEvents\.filter\(isCommercialActivitySignal\)/);
  assert.match(crm, /city === opportunity\.city && country === opportunity\.country && isGeoOpportunitySignal\(event\)/);
  assert.match(crm, /commercialActivityEvents\.map\(\(event\) =>/);
  assert.match(crm, /commercialConsent: event\.commercialConsentGranted/);
  assert.doesNotMatch(crm, /consentChannels: event\.commercialConsentChannels\.join/);
  assert.match(crm, /audience_ready: "false"/);
  assert.match(crm, /audience_source: "server_actor_scope_required"/);
  assert.match(crm, /no destinatarios/);
  assert.doesNotMatch(crm, /unique_valid_uid|UIDs válidos únicos|const audience =|opportunity\.audience/);
});

test("home, growth and events surfaces do not turn neutral activity or product UIDs into failures or audience", () => {
  assert.match(home, /event\.authenticationVerified === true/);
  assert.match(home, /isRealtimeRisk\(event\.verdict, event\.reason\)/);
  assert.doesNotMatch(home, /scopedLiveEvents\.length - successfulTaps|result \|\| ""\)\.toUpperCase\(\) === "VALID"/);

  assert.match(growth, /event\.productIdentityRecognized === true/);
  assert.match(growth, /event\.knownActor === true && event\.commercialConsentGranted === true/);
  assert.match(growth, /classifyLocationProvenance\(event\.locationSource\) === "consented_gps"/);
  assert.match(growth, /nexid-growth-activity-signals\.csv/);
  assert.match(growth, /no contiene contactos, audiencia ni destinatarios/);
  assert.doesNotMatch(growth, /uniqueUids|segment\.audience|nexid-growth-segmentos\.csv|audiencia: segment/);

  assert.match(eventsPage, /normalizeTenantTapRealtimeEvent/);
  assert.match(eventsPage, /event\.authenticationVerified/);
  assert.match(eventsPage, /event\.productIdentityRecognized/);
  assert.match(eventsPage, /isRealtimeRisk\(event\.verdict, event\.reason\)/);
  assert.doesNotMatch(eventsPage, /item\.result !== "VALID"|row\.result === "VALID" \? "active" : "risk"/);
});

test("supplier UI distinguishes the Vercel application secret from KMS and HSM", () => {
  const copy = `${supplierPage}\n${supplierConsole}`;
  assert.match(copy, /clave maestra de aplicación guardada como secreto de Vercel/);
  assert.match(copy, /No es Google Cloud KMS ni HSM/);
  assert.match(copy, /Google Cloud KMS SOFTWARE queda reservado a custodia blockchain/);
  assert.doesNotMatch(copy, /nexID conserva KMS|No se expone KMS|sin KMS expuesta/);
});
