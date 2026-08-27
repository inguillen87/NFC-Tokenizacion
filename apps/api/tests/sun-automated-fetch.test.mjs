import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  classifySunAutomatedFetch,
  sunAutomatedFetchResponse,
} from "../src/lib/sun-automated-fetch.ts";

const route = await readFile(new URL("../src/app/sun/route.ts", import.meta.url), "utf8");

test("Google Read Aloud, crawlers and explicit prefetches cannot consume a SUN scan", () => {
  assert.deepEqual(classifySunAutomatedFetch(new Headers({
    "user-agent": "Mozilla/5.0 (Linux; Android 15) Google-Read-Aloud",
  })), { automated: true, reason: "google_read_aloud" });
  assert.deepEqual(classifySunAutomatedFetch(new Headers({
    "user-agent": "Mozilla/5.0 AppleWebKit/537.36 (compatible; Googlebot/2.1)",
  })), { automated: true, reason: "crawler" });
  assert.deepEqual(classifySunAutomatedFetch(new Headers({
    "user-agent": "Mozilla/5.0",
    "sec-purpose": "prefetch",
  })), { automated: true, reason: "prefetch_header" });
});

test("human Android Chrome and ordinary mobile Safari remain eligible", () => {
  for (const userAgent of [
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/152.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  ]) {
    assert.deepEqual(classifySunAutomatedFetch(new Headers({ "user-agent": userAgent })), {
      automated: false,
      reason: null,
    });
  }
});

test("ignored automated fetches are observable, informative and uncacheable", async () => {
  const response = sunAutomatedFetchResponse({
    traceId: "nexid_test_trace",
    reason: "google_read_aloud",
    wantsHtml: false,
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  assert.equal(response.headers.get("x-nexid-automated-fetch"), "ignored");
  assert.equal(response.headers.get("x-nexid-trace-id"), "nexid_test_trace");
  assert.deepEqual(await response.json(), {
    ok: true,
    processed: false,
    result: "AUTOMATED_FETCH_IGNORED",
    reason: "google_read_aloud",
    request_id: "nexid_test_trace",
  });
});

test("the SUN route returns the guard before rate limits, crypto persistence or map data", () => {
  const classify = route.indexOf("classifySunAutomatedFetch(req.headers)");
  const guardReturn = route.indexOf("return sunAutomatedFetchResponse", classify);
  const rateLimit = route.indexOf("safeHitSunRateLimit('ip'", classify);
  const process = route.indexOf("processSunScan(sunScanInput)", classify);
  assert.ok(classify >= 0 && guardReturn > classify && rateLimit > guardReturn && process > rateLimit);
  assert.match(route.slice(classify, guardReturn), /\[sun_automated_fetch_ignored\]/);
});
