import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const { incidentEventNavigationKey, snapshotIncidentEventSelection, moveIncidentEventSelection } = await tsImport("../src/lib/incident-event-navigation.ts", import.meta.url);

const row = (eventId, tenantSlug = "balmec", tenantId = "tenant-a") => ({ eventId, tenantSlug, tenantId, uidMasked: `masked-${eventId}` });

test("drawer navigation includes only the selected tenant's visible events in their displayed order", () => {
  const first = row("1");
  const selected = row("2");
  const visible = [row("3", "another", "tenant-b"), first, selected, row("4", "balmec", "tenant-b")];
  const selection = snapshotIncidentEventSelection(selected, visible);
  assert.deepEqual(selection.events.map((event) => event.eventId), ["1", "2"]);
  assert.equal(selection.index, 1);
  assert.equal(moveIncidentEventSelection(selection, -1).events[0].eventId, "1");
});

test("incoming events and row mutations cannot reorder or replace an open navigation snapshot", () => {
  const first = row("1");
  const visible = [first, row("2")];
  const selection = snapshotIncidentEventSelection(first, visible);
  visible.unshift(row("new"));
  first.uidMasked = "changed-in-stream";
  const next = moveIncidentEventSelection(selection, 1);
  assert.equal(next.events[next.index].eventId, "2");
  assert.equal(selection.events[0].uidMasked, "masked-1");
  assert.equal(selection.events.length, 2);
});

test("navigation never wraps or includes an unrelated event when tenant or visible identity is missing", () => {
  const selected = row("1", null, null);
  const selection = snapshotIncidentEventSelection(selected, [selected, row("2", null, null), row("1", "other", "tenant-b")]);
  assert.equal(selection.events.length, 1);
  assert.equal(moveIncidentEventSelection(selection, -1), selection);
  assert.equal(moveIncidentEventSelection(selection, 1), selection);
  assert.equal(moveIncidentEventSelection(null, 1), null);
  assert.deepEqual(snapshotIncidentEventSelection(row("absent"), [row("2")]).events.map((event) => event.eventId), ["absent"]);
  assert.notEqual(incidentEventNavigationKey(row("1")), incidentEventNavigationKey(row("1", "other")));
});

test("an event ID collision cannot substitute a different tenant ID for the selected event", () => {
  const selected = row("1");
  const selection = snapshotIncidentEventSelection(selected, [row("1", "balmec", "tenant-b"), selected, row("2")]);
  assert.deepEqual(selection.events.map((event) => event.tenantId), ["tenant-a", "tenant-a"]);
  assert.equal(selection.index, 0);
});

test("drawer presentation keeps demo and unknown sources read-only and editing progressively disclosed", async () => {
  const [drawer, crm] = await Promise.all([
    readFile(new URL("../src/components/incident-event-drawer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(drawer, /canEditIncident = canWrite && event\.source === "production" && !isDemo/);
  assert.match(drawer, /if \(!canEditIncident \|\| !tenantSlug/);
  assert.match(drawer, /<details[^>]+data-testid="incident-edit-disclosure"/);
  assert.doesNotMatch(drawer, /<details[^>]+data-testid="incident-edit-disclosure"[^>]+open/);
  assert.match(drawer, /Expediente ilustrativo · sólo lectura/);
  assert.match(drawer, /Historial de ejemplo/);
  assert.match(drawer, /title=\{event\.productName\?\.trim\(\) \|\| "Lectura NFC"\}/);
  assert.match(drawer, /description=\{readingDateContext\(event\)\}/);
  assert.match(drawer, /Identificador del evento:/);
  assert.match(drawer, /hasNormalEvidence = classifyRealtimeVerdict\(event\.verdict, event\.reason\) === "valid" && explanation\.severity === "low"/);
  assert.match(drawer, /hasNormalEvidence \? "Resumen de la lectura" : "Por qué requiere atención"/);
  assert.match(crm, /snapshotIncidentEventSelection\(event, visibleEvents\.slice\(0, 4\)\)/);
  assert.match(crm, /canWrite=\{canWriteIncidents && selectedEvent\.source === "production"\}/);
});

test("reading summary retains technical evidence in an accessible, initially closed disclosure", async () => {
  const drawer = await readFile(new URL("../src/components/incident-event-drawer.tsx", import.meta.url), "utf8");
  assert.match(drawer, /Empresa · identificador/);
  assert.match(drawer, /\{tenantSlug \|\| "No informado"\}/);
  assert.match(drawer, /\{event\.batchId \|\| "No informado"\}/);
  const technical = drawer.slice(drawer.indexOf('<details className="mt-4 rounded-xl border border-white/10 bg-slate-950/55" data-testid="incident-technical-disclosure"'));
  assert.match(technical, /<summary[^>]*>Datos técnicos de la lectura<\/summary>/);
  assert.doesNotMatch(technical.split(">", 1)[0], /\bopen\b/);
  for (const evidence of ["event.uidMasked", "event.eventId", "event.timezone", "explanation.facts.map", "incident.id", "incident.ticketId", "incident.version"]) assert.ok(technical.includes(evidence));
  assert.match(technical, /canRead && incident/);
  assert.doesNotMatch(drawer.slice(drawer.indexOf("return ("), drawer.indexOf('data-testid="incident-existing-state"')), /explanation\.facts\.map|Identificador del evento:|UID enmascarada/);
  assert.match(drawer, /timeZoneName: "shortOffset"/);
  assert.match(drawer, /opened: "Expediente abierto"/);
  assert.match(drawer, /transitioned: "Estado actualizado"/);
  assert.match(drawer, /severity_changed: "Severidad actualizada"/);
  assert.match(drawer, /HISTORY_ACTION_LABEL\[entry\.action\]/);
});

test("pending lookup is a live loading status, not a failed-query claim, and scrolling has an inset focus ring", async () => {
  const drawer = await readFile(new URL("../src/components/incident-event-drawer.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/components/incident-event-drawer-frame.module.css", import.meta.url), "utf8");
  const pending = drawer.slice(drawer.indexOf(') : eventLookupState === "loading" ? ('), drawer.indexOf('data-testid="incident-unconfirmed-state"'));
  assert.match(pending, /data-testid="incident-loading-state" role="status" aria-live="polite" aria-busy="true"/);
  assert.match(pending, /LoaderCircle/);
  assert.match(pending, /Consultando el expediente/);
  assert.doesNotMatch(pending, /no respondió|No se interpreta/);
  assert.match(css, /\.content:focus-visible\s*\{[^}]*outline: 3px solid #0891b2;[^}]*outline-offset: -3px;/);
});
