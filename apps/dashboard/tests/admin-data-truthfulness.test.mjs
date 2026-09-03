import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const events = await readFile(new URL("../src/app/(app)/events/page.tsx", import.meta.url), "utf8");
const tags = await readFile(new URL("../src/app/(app)/tags/page.tsx", import.meta.url), "utf8");
const consumerOverview = await readFile(new URL("../src/app/(app)/consumer-network/overview/page.tsx", import.meta.url), "utf8");
const batches = await readFile(new URL("../src/app/(app)/batches/page.tsx", import.meta.url), "utf8");

test("events distinguishes confirmed empty results from upstream failures", () => {
  assert.match(events, /type EventsResult/);
  assert.match(events, /availability: "upstream_error"/);
  assert.match(events, /availability: "invalid_payload"/);
  assert.match(events, /availability: "unreachable"/);
  assert.match(events, /events-source-unavailable/);
  assert.doesNotMatch(events, /if \(!response\.ok\) return \[\]/);
});

test("tag registry never turns a failed source into zero inventory", () => {
  assert.match(tags, /type TagsAvailability/);
  assert.match(tags, /sourceReady \? totalRows : "no disponible"/);
  assert.match(tags, /tags-source-unavailable/);
  assert.match(tags, /este estado no representa inventario cero/);
  assert.match(tags, /sourceReady \? Number\(totals\.minted_tags/);
});

test("consumer CRM reports partial sources and withholds false zero metrics and heatmaps", () => {
  assert.match(consumerOverview, /type SourceAvailability/);
  assert.match(consumerOverview, /consumer-network-partial-sources/);
  assert.match(consumerOverview, /overviewReady \? Number\(overview\.activityWithoutActor/);
  assert.match(consumerOverview, /Unidades reconocidas/);
  assert.match(consumerOverview, /un UID nunca se interpreta como una persona/);
  assert.doesNotMatch(consumerOverview, /Anonymous tappers|Tap → registration|Registration → membership/);
  assert.match(consumerOverview, /Heatmap no disponible/);
  assert.match(consumerOverview, /Members source unavailable; this is not a confirmed zero/);
  assert.match(consumerOverview, /Taps source unavailable; this is not a confirmed zero/);
});

test("batch operations distinguish unavailable sources from confirmed empty inventory", () => {
  assert.match(batches, /type SourceAvailability/);
  assert.match(batches, /batches-source-unavailable/);
  assert.match(batches, /no convierte una falla del backend en inventario cero/);
  assert.match(batches, /batchesReady \? batchProductReady/);
  assert.match(batches, /assetsReady \? realPhotoRows/);
  assert.match(batches, /this is not a confirmed zero/);
  assert.doesNotMatch(batches, /if \(!response\.ok\) return \[\]/);
});
