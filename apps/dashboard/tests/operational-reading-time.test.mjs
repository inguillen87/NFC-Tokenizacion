import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const timeModule = new URL("../src/lib/operational-reading-time.ts", import.meta.url);
const { parseOperationalTimestamp, resolveOperationalTimeZone, formatOperationalDateTime, formatReadingDateTime } = await tsImport(timeModule.href, import.meta.url);
const { incidentStatusLabel } = await tsImport("../src/lib/incident-workflow.ts", import.meta.url);
const buenosAires = { timeZone: "America/Argentina/Buenos_Aires", isFallback: false };
const reading = (timezone, tenantSlug = "tenant-a") => ({ timezone, tenantSlug });

test("ISO, explicit offsets, PostgreSQL and existing Date-string events preserve the same instant", () => {
  const instant = Date.UTC(2026, 8, 4, 3);
  for (const input of ["2026-09-04T03:00:00Z", "2026-09-04T00:00:00-03:00", "2026-09-04 03:00:00+00", "Fri Sep 04 2026 00:00:00 GMT-0300 (Argentina Standard Time)"]) {
    assert.equal(parseOperationalTimestamp(input), instant, input);
  }
  assert.equal(parseOperationalTimestamp("2026-09-04 03:00:00.123456+00"), instant + 123);
  assert.equal(parseOperationalTimestamp("2026-09-04T03:00:00.123456789Z"), instant + 123);
  assert.equal(parseOperationalTimestamp("2026-09-04T08:30:00+0530"), instant);
});

test("ambiguous, missing and impossible dates never acquire the browser zone or the current time", () => {
  for (const input of [null, undefined, "", "0", "1750000000000", "2026-09-04", "2026-09-04T03:00:00", "04/09/2026, 00:00:00", "2026-02-29T03:00:00Z", "2026-04-31T03:00:00Z", "2026-09-04T25:00:00Z", "2026-09-04T03:60:00Z", "2026-09-04T03:00:00+24:00", "2026-09-04T03:00:00+03:61", NaN, Infinity]) {
    assert.equal(parseOperationalTimestamp(input), null, String(input));
    assert.equal(formatOperationalDateTime(input, buenosAires), "Fecha y hora no informadas");
  }
  assert.equal(parseOperationalTimestamp("1970-01-01T00:00:00Z"), 0);
  assert.equal(parseOperationalTimestamp(0), 0);
  assert.equal(parseOperationalTimestamp("2024-02-29T03:00:00Z"), Date.UTC(2024, 1, 29, 3));
});

test("reading candidates prefer a valid canonical instant and do not parse localized display text", () => {
  const expected = formatOperationalDateTime("2026-09-04T03:00:00Z", buenosAires);
  assert.equal(formatReadingDateTime({ occurredAtUtc: "bad", occurredAt: "2026-09-04T03:00:00Z" }, buenosAires), expected);
  assert.equal(formatReadingDateTime({ occurredAtUtc: "2026-09-04T03:00:00Z", occurredAt: "2025-01-01T00:00:00Z" }, buenosAires), expected);
  assert.equal(formatReadingDateTime({ occurredAtLocal: "2026-09-04T00:00:00-03:00" }, buenosAires), expected);
  assert.equal(formatReadingDateTime({ occurredAtLocal: "04/09/2026, 00:00:00" }, buenosAires), "Fecha y hora no informadas");
});

test("zone resolution only trusts consistent explicit zones inside the selected tenant", () => {
  const scoped = resolveOperationalTimeZone([reading("UTC", "other"), reading(buenosAires.timeZone)], "tenant-a");
  assert.equal(scoped.isFallback, false);
  assert.match(formatOperationalDateTime("2026-09-04T03:00:00Z", scoped), /UTC-03:00/);
  assert.deepEqual(resolveOperationalTimeZone([reading("UTC", "demobodega")], "demobodega"), { timeZone: "UTC", isFallback: false });
  for (const rows of [[], [reading("")], [reading("Not/AZone")], [reading("UTC"), reading(null)], [reading("UTC"), reading(buenosAires.timeZone)]]) {
    assert.deepEqual(resolveOperationalTimeZone(rows), { timeZone: "UTC", isFallback: true });
  }
  assert.deepEqual(resolveOperationalTimeZone([reading("UTC", "other")], "tenant-a"), { timeZone: "UTC", isFallback: true });
  assert.deepEqual(resolveOperationalTimeZone([reading("UTC"), reading(buenosAires.timeZone, "other")], "all", "tenant-a"), { timeZone: "UTC", isFallback: true });
});

test("offsets follow the event instant, including midnight rollover, DST and explicit UTC fallback", () => {
  assert.match(formatOperationalDateTime("2026-09-04T02:59:00Z", buenosAires), /3 .*2026.*23:59:00.*UTC-03:00/);
  const newYork = {timeZone:"America/New_York",isFallback:false};
  assert.match(formatOperationalDateTime("2026-01-04T12:00:00Z", newYork), /UTC-05:00/);
  assert.match(formatOperationalDateTime("2026-07-04T12:00:00Z", newYork), /UTC-04:00/);
  assert.match(formatOperationalDateTime("2026-09-04T03:00:00Z", {timeZone:"Invalid/Zone",isFallback:false}), /03:00:00.*UTC\+00:00 · zona no confirmada/);
  assert.match(formatOperationalDateTime("2026-09-04T03:00:00Z"), /UTC\+00:00 · zona no confirmada/);
  assert.doesNotMatch(formatOperationalDateTime("2026-09-04T03:00:00Z", {timeZone:"UTC",isFallback:false}), /no confirmada/);
});

test("the same displayed instant is independent of the host/browser default timezone", () => {
  const code = `import { formatOperationalDateTime, formatReadingDateTime } from ${JSON.stringify(timeModule.href)}; const zone=${JSON.stringify(buenosAires)}; console.log(JSON.stringify([formatOperationalDateTime('2026-09-04T02:59:00Z',zone),formatReadingDateTime({occurredAt:'Thu Sep 03 2026 23:59:00 GMT-0300 (Argentina Standard Time)'},zone)]));`;
  const results = ["America/Los_Angeles", "Asia/Tokyo"].map((TZ) => execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], { env: {...process.env,TZ}, encoding:"utf8" }).trim());
  assert.equal(results[0], results[1]);
  const [history, latest] = JSON.parse(results[0]);
  assert.equal(history, latest);
});

test("incident states share Spanish labels without inventing a status for unknown data", () => {
  assert.deepEqual(["open", "investigating", "contained", "resolved", "dismissed"].map(incidentStatusLabel), ["Abierto", "En investigación", "Contenido", "Resuelto", "Descartado"]);
  for (const value of [undefined, null, "future_status", "__proto__"]) assert.equal(incidentStatusLabel(value), "Estado no informado");
});

test("latest rows, drawer header and history use the same operational-zone prop and labels", async () => {
  const [crm, drawer] = await Promise.all([
    readFile(new URL("../src/components/executive-realtime-crm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/incident-event-drawer.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(crm, /resolveOperationalTimeZone\(visibleEvents, effectiveSelectedTenant, tenantScope\)/);
  assert.match(crm, /operationalTimeZone=\{operationalTimeZone\}/);
  for (const component of [crm, drawer]) assert.match(component, /formatReadingDateTime\(event, operationalTimeZone\)/);
  assert.match(drawer, /formatOperationalDateTime\(entry\.createdAt, operationalTimeZone\)/);
  assert.match(crm, /incidentStatusLabel\(linkedIncident\.status\)/);
  assert.match(drawer, /incidentStatusLabel\(incident\.status\)/);
  assert.doesNotMatch(crm, /occurredAt \|\| Date\.now\(\)|TIMEZONE_HINTS|safeDate\(value\) \|\| Date\.now\(\)/);
  assert.doesNotMatch(drawer, /toLocaleString|readingDateContext/);
});
