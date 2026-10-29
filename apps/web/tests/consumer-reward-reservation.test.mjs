import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as boundedFetch from "../src/app/me/_components/consumer-bounded-fetch.ts";
import { rewardNextActions } from "../src/app/me/_components/consumer-reward-next-actions.ts";
import * as consumerLoginContinuation from "../src/app/login/consumer-login-continuation.ts";

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL("../src/app/me/" + path, import.meta.url), "utf8");
function compile(source, overrides = {}) {
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(name => Object.hasOwn(overrides, name) ? overrides[name] : require(name), loaded, loaded.exports);
  return loaded.exports;
}
const wallet = compile(read("_components/consumer-wallet-points-model.ts"));
const model = compile(read("_components/consumer-rewards-model.ts"), { "./consumer-wallet-points-model": wallet });
const reservation = compile(read("_components/consumer-reward-reservation.ts"), { "./consumer-bounded-fetch": boundedFetch, "./consumer-rewards-model": model });
const REWARD = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
const CLAIM = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = "2026-10-14T06:00:00.000Z";
const FUTURE = "2099-01-01T00:00:00.000Z";
const row = (extra = {}) => ({
  id: REWARD, title: "Visita a la bodega", tenant_slug: "bodega-a", tenant_name: "Bodega A",
  program_name: "Club A", program_points_balance: 100, points_cost: 40, state: "reported", catalog_state: "reported",
  claim_id: null, claim_status: null, claim_expires_at: null, redemption_code: null, points_spent: null,
  can_claim: true, claimIntent: "portal-first-reservation.v1", ...extra,
});
const payload = items => ({ ok: true, items, scope: "own_brands", limit: 100 });
const parsed = raw => model.buildConsumerRewardsModel(payload([raw]), NOW).items[0];
const quote = () => reservation.rewardReservationQuote(parsed(row()));
const ownClaim = (extra = {}) => row({ id: REWARD.toLowerCase(), claim_id: CLAIM, claim_status: "claimed", claim_expires_at: FUTURE,
  redemption_code: "NXR-OWNED", points_spent: 40, points_cost: 80, state: "claimed", can_claim: false, claimIntent: undefined, ...extra });
const response = data => new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
const ack = (extra = {}) => ({ ok: true, duplicate: false, claim: { id: CLAIM, reward_id: REWARD.toLowerCase(), redemption_code: "DO-NOT-DISPLAY", ...extra } });

test("only a complete explicit current advertisement arms a first reservation", () => {
  assert.equal(quote().pointsCost, 40);
  for (const extra of [
    { can_claim: false }, { can_claim: "true" }, { claimIntent: undefined }, { claimIntent: "other" },
    { state: "available" }, { catalog_state: "unknown" }, { claim_id: undefined }, { claim_status: undefined },
    { claim_id: CLAIM }, { claim_expires_at: FUTURE }, { redemption_code: "NXR-OTHER" }, { points_spent: 1 },
    { id: "legacy-reward" }, { points_cost: "40" }, { points_cost: 1.5 }, { points_cost: 2_147_483_648 },
    { program_name: null }, { program_points_balance: "100" },
  ]) assert.equal(reservation.rewardReservationQuote(parsed(row(extra))), null, JSON.stringify(extra));
});
test("an explicitly published free benefit still requires confirmation from its own zero balance", () => {
  const q = reservation.rewardReservationQuote(parsed(row({ points_cost: 0, program_points_balance: 0 })));
  assert.equal(q.pointsCost, 0); assert.equal(q.programBalance, 0);
});
test("brand and network balances cannot authorize a programme with unknown or insufficient points", () => {
  for (const balance of [null, undefined, 0, 39, -1, NaN, Infinity]) {
    const item = parsed(row({ program_points_balance: balance, points_balance: 540, network_points_balance: 999 }));
    assert.equal(reservation.rewardReservationQuote(item), null);
  }
});
test("a changed price or displayed programme invalidates the prepared confirmation", () => {
  const q = quote();
  assert.equal(reservation.sameReservationQuote(q, { ...q }), true);
  for (const extra of [{ pointsCost: 50 }, { tenant: "bodega-b" }, { program: "Club B" }, { programBalance: 99 }, { rewardId: REWARD.toLowerCase() }])
    assert.equal(reservation.sameReservationQuote(q, { ...q, ...extra }), false);
});
test("one request preserves supplied UUID text and sends only the exact additive intent and quoted cost", async () => {
  const calls = [];
  const result = await reservation.reserveConsumerReward(quote(), { fetchImpl: async (url, init) => { calls.push([url, init]); return response(ack()); } });
  assert.deepEqual(result, { status: "acknowledged", claimId: CLAIM, duplicate: false });
  assert.equal(calls.length, 1); assert.equal(calls[0][0], "/api/consumer/rewards/" + REWARD + "/claim");
  assert.equal(calls[0][1].method, "POST"); assert.equal(calls[0][1].credentials, "same-origin"); assert.equal(calls[0][1].cache, "no-store");
  assert.deepEqual(JSON.parse(calls[0][1].body), { claimIntent: "portal-first-reservation.v1", expectedPointsCost: 40, locale: "es-AR" });
  assert.doesNotMatch(JSON.stringify(result), /DO-NOT-DISPLAY|redemption_code|consumer_id/);
});
test("malformed price or reward identity is refused before transport", async () => {
  let calls = 0; const fetchImpl = async () => { calls++; throw Error("unexpected"); };
  for (const extra of [{ rewardId: "opaque" }, { pointsCost: -1 }, { pointsCost: 1.1 }, { pointsCost: NaN }, { pointsCost: 2_147_483_648 }])
    assert.equal((await reservation.reserveConsumerReward({ ...quote(), ...extra }, { fetchImpl })).status, "denied");
  assert.equal(calls, 0);
});
test("an invalid or unrelated acknowledgement never presents a voucher or triggers a GET", async () => {
  for (const body of [null, [], { ok: false }, { ...ack(), duplicate: "false" }, ack({ id: "opaque" }), ack({ reward_id: CLAIM })]) {
    let calls = 0;
    const result = await reservation.reserveConsumerReward(quote(), { fetchImpl: async () => { calls++; return response(body); } });
    assert.deepEqual(result, { status: "uncertain" }); assert.equal(calls, 1);
  }
});
test("HTTP failures are readable uncertainty or access states and never retry the mutation", async () => {
  for (const [status, expected] of [[401, "authentication-required"], [403, "denied"], [400, "uncertain"], [409, "uncertain"], [429, "uncertain"], [503, "uncertain"]]) {
    let calls = 0;
    const result = await reservation.reserveConsumerReward(quote(), { fetchImpl: async () => { calls++; return new Response("private server detail", { status }); } });
    assert.equal(result.status, expected); assert.equal(calls, 1);
  }
});
test("header timeout is bounded even when transport ignores abort and does not resend", async () => {
  let calls = 0;
  const result = await reservation.reserveConsumerReward(quote(), { timeoutMs: 5, fetchImpl: async () => { calls++; return await new Promise(() => {}); } });
  assert.equal(result.status, "uncertain"); assert.equal(calls, 1);
});
test("JSON body timeout shares the deadline without a second POST", async () => {
  let calls = 0;
  const result = await reservation.reserveConsumerReward(quote(), { timeoutMs: 5, fetchImpl: async () => { calls++; return { ok: true, json: () => new Promise(() => {}), body: { cancel: async () => {} } }; } });
  assert.equal(result.status, "uncertain"); assert.equal(calls, 1);
});
test("an already aborted context performs no request", async () => {
  const controller = new AbortController(); controller.abort(); let calls = 0;
  const result = await reservation.reserveConsumerReward(quote(), { signal: controller.signal, fetchImpl: async () => { calls++; return response(ack()); } });
  assert.equal(result.status, "uncertain"); assert.equal(calls, 0);
});
test("the received claim UUID is confirmed only through a private own-brand GET", async () => {
  const calls = [];
  const result = await reservation.readConsumerReservation(quote(), CLAIM.toUpperCase(), { now: NOW, fetchImpl: async (url, init) => { calls.push([url, init]); return response(payload([ownClaim()])); } });
  assert.equal(result.status, "confirmed"); assert.equal(result.claimKey, "claim-" + CLAIM);
  assert.equal(result.items[0].code, "NXR-OWNED"); assert.equal(result.items[0].cost, 40);
  assert.equal(calls.length, 1); assert.equal(calls[0][0], "/api/consumer/rewards"); assert.equal(calls[0][1].method, "GET");
  assert.equal(calls[0][1].body, undefined); assert.equal(calls[0][1].cache, "no-store");
});
test("different tenant or received claim identity does not confirm the requested receipt", async () => {
  for (const extra of [{ tenant_slug: "bodega-b" }, { claim_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }, { id: CLAIM }]) {
    const result = await reservation.readConsumerReservation(quote(), CLAIM, { now: NOW, fetchImpl: async () => response(payload([ownClaim(extra)])) });
    assert.equal(result.status, "not-confirmed");
  }
});
test("ambiguous own history is not chosen arbitrarily after an uncertain acknowledgement", async () => {
  const result = await reservation.readConsumerReservation(quote(), null, { now: NOW, fetchImpl: async () => response(payload([ownClaim(), ownClaim({ claim_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" })])) });
  assert.deepEqual(result, { status: "uncertain" });
});
test("malformed scope or envelope remains unavailable instead of becoming an empty successful read", async () => {
  for (const body of [null, {}, { ok: false, scope: "own_brands", limit: 100, items: [] }, { ...payload([]), scope: "network" }, { ...payload([]), limit: 101 }, payload(new Array(101).fill(row()))]) {
    const result = await reservation.readConsumerReservation(quote(), CLAIM, { now: NOW, fetchImpl: async () => response(body) });
    assert.deepEqual(result, { status: "uncertain" });
  }
});
test("terminal own receipt preserves historical spend and never presents an expired code", async () => {
  for (const extra of [{ claim_status: "redeemed" }, { claim_status: "cancelled" }, { claim_status: "claimed", claim_expires_at: "2026-10-14T05:00:00.000Z" }]) {
    const result = await reservation.readConsumerReservation(quote(), CLAIM, { now: NOW, fetchImpl: async () => response(payload([ownClaim(extra)])) });
    assert.equal(result.status, "confirmed"); assert.equal(result.items[0].cost, 40); assert.equal(result.items[0].code, null);
  }
});
test("a true empty private collection is a completed read with no confirmed receipt", async () => {
  const result = await reservation.readConsumerReservation(quote(), CLAIM, { now: NOW, fetchImpl: async () => response(payload([])) });
  assert.deepEqual(result, { status: "not-confirmed", items: [] });
});
test("SSR advertises an eligible button without requesting or reserving anything", () => {
  let calls = 0;
  const css = Object.fromEntries([...read("rewards/rewards.module.css").matchAll(/\.([a-zA-Z][\w-]*)/g)].map(match => [match[1], match[1]]));
  const client = compile(read("rewards/rewards-client.tsx"), {
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "./rewards.module.css": css, "../_components/consumer-rewards-model": model,
    "../_components/consumer-reward-next-actions": { rewardNextActions },
    "../../login/consumer-login-continuation": consumerLoginContinuation,
    "../_components/consumer-reward-reservation": { ...reservation, reserveConsumerReward: () => { calls++; throw Error("unexpected"); }, readConsumerReservation: () => { calls++; throw Error("unexpected"); } },
  });
  const html = renderToStaticMarkup(React.createElement(client.ConsumerRewardsClient, { items: [parsed(row())], initialTenant: "bodega-a", selectedVoucher: null }));
  assert.match(html, /Reservar beneficio/); assert.doesNotMatch(html, /Confirmar reserva por|Estamos preparando|Comprobar mi reserva/);
  assert.match(html, /Club A/); assert.match(html, /40/); assert.equal(calls, 0);
});
