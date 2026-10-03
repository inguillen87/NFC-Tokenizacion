import assert from "node:assert/strict";
import test from "node:test";
import { classifyPortalLoadingErrors, extractInitialDocumentDigests, numericDigest, REACT_419_MESSAGE } from "./consumer-portal-loading-evidence.mjs";

test("diagnostic digest extraction preserves numeric strings and rejects unrelated values", () => {
  assert.equal(numericDigest("012345"), "012345");
  for (const value of [undefined, null, 12345, "", "error", "123-secret", "1".repeat(21)]) assert.equal(numericDigest(value), null);
});

test("initial document separates failed Suspense template and streamed boundary identifiers", () => {
  const html = '<template data-dgst="123456"></template><script>$RX("B:0","123456");$RX("B:1","987654")</script><p data-dgst="555555">digest 666666</p><template data-dgst="opaque-code"></template>';
  assert.deepEqual(extractInitialDocumentDigests(html), { templateDigests: ["123456"], streamedSuspenseDigests: ["123456", "987654"], rscErrorDigests: [] });
});

test("RSC digests require explicit error records and decoded inert JSON, not general document text", () => {
  const stream = 'a:E{"digest":"123456","message":"(synthetic)"}\nb:["digest","555555"]\nc:E{"digest":"opaque"}\n';
  const html = `<script>self.__next_f.push(${JSON.stringify([1, stream])})</script><script>self.__next_f.push([0])</script><div>"digest":"666666"</div>`;
  assert.deepEqual(extractInitialDocumentDigests(html), { templateDigests: [], streamedSuspenseDigests: [], rscErrorDigests: ["123456"] });
});

test("malformed or executable push expressions are not evaluated as document evidence", () => {
  const html = '<script>self.__next_f.push((globalThis.__qaUnexpected = true))</script><script>self.__next_f.push([1,"broken")</script>';
  assert.deepEqual(extractInitialDocumentDigests(html), { templateDigests: [], streamedSuspenseDigests: [], rscErrorDigests: [] });
  assert.equal(globalThis.__qaUnexpected, undefined);
});

function provenRecovery(scenario = "session-headers-stall") {
  const injected = {
    "session-headers-stall": ["stalled-headers", null, true],
    "session-body-stall": ["stalled-body", 200, true],
    "session-500": ["http-500", 500, false],
    "session-malformed": ["invalid-json", 200, false],
  }[scenario];
  const caseId = `${scenario}/390/light`, digest = "123456";
  const event = { caseId, scenario, message: REACT_419_MESSAGE, phase: "retry-requested", elapsedMs: 6100, expectedBoundaryWasVisible: true };
  return {
    clientErrors: [{ ...event, width: 390, theme: "light" }],
    nativeWindowErrors: [{ ...event, digest, mainFrame: true }],
    cases: [{
      caseId, scenario, width: 390, theme: "light", expectedBoundaryWasVisible: true, boundaryVisibleElapsedMs: 6050,
      privateDenialConfirmed: true, initialPrivateReadCount: 0, retrySucceeded: true,
      initialSessionFailure: { path: "/consumer/session", method: "GET", scenario, injectedFailure: injected[0], responseStatus: injected[1], closedBeforeEnd: injected[2] },
      initialDocument: { path: "/me", responseStatus: 200, sha256: "a".repeat(64), streamedSuspenseDigests: [digest], rscErrorDigests: [digest] },
      initialDomTemplateDigests: [digest],
      retryReadyReads: ["/consumer/session", "/consumer/me", "/consumer/products", "/consumer/taps", "/consumer/brands"].map((path) => ({ path, method: "GET", scenario: "ready", responseStatus: 200, injectedFailure: null })),
    }],
  };
}

test("prospective rule recognizes only the single native recovery bound to the initial failed boundary and completed retry", () => {
  for (const scenario of ["session-headers-stall", "session-body-stall", "session-500", "session-malformed"]) {
    const evidence = provenRecovery(scenario), original = JSON.stringify(evidence);
    const classified = classifyPortalLoadingErrors(evidence);
    assert.equal(classified.expectedFrameworkRecoveries.length, 1);
    assert.equal(classified.expectedFrameworkRecoveries[0].digest, "123456");
    assert.deepEqual(classified.unexpectedClientErrors, []);
    assert.deepEqual(classified.unexpectedNativeWindowErrors, []);
    assert.equal(JSON.stringify(evidence), original, "classification retains every original event and receipt");
  }
});

const negatives = [
  ["other React code", (r) => { r.clientErrors[0].message = r.clientErrors[0].message.replace("#419", "#418"); }],
  ["message with added suffix", (r) => { r.nativeWindowErrors[0].message += " extra"; }],
  ["missing native digest", (r) => { delete r.nativeWindowErrors[0].digest; }],
  ["empty native digest", (r) => { r.nativeWindowErrors[0].digest = ""; }],
  ["numeric value instead of original string", (r) => { r.nativeWindowErrors[0].digest = 123456; }],
  ["different initial digest", (r) => { r.nativeWindowErrors[0].digest = "987654"; }],
  ["RSC-only digest", (r) => { r.cases[0].initialDocument.streamedSuspenseDigests = []; }],
  ["missing RSC error record", (r) => { r.cases[0].initialDocument.rscErrorDigests = []; }],
  ["missing initial DOM template", (r) => { r.cases[0].initialDomTemplateDigests = []; }],
  ["untyped string receipt", (r) => { r.cases[0].initialDomTemplateDigests = "123456"; }],
  ["iframe event", (r) => { r.nativeWindowErrors[0].mainFrame = false; }],
  ["duplicate client events", (r) => { r.clientErrors.push({ ...r.clientErrors[0] }); }],
  ["duplicate native events", (r) => { r.nativeWindowErrors.push({ ...r.nativeWindowErrors[0] }); }],
  ["missing native counterpart", (r) => { r.nativeWindowErrors = []; }],
  ["missing page counterpart", (r) => { r.clientErrors = []; }],
  ["ambiguous case", (r) => { r.cases.push(structuredClone(r.cases[0])); }],
  ["different page view", (r) => { r.clientErrors[0].theme = "dark"; }],
  ["unmatched scenario", (r) => { r.nativeWindowErrors[0].scenario = "session-malformed"; }],
  ["ready request exception", (r) => { r.cases[0].scenario = "ready"; }],
  ["anonymous exception", (r) => { r.cases[0].scenario = "session-401"; }],
  ["partial collection exception", (r) => { r.cases[0].scenario = "products-body-stall"; }],
  ["initial failure missing", (r) => { delete r.cases[0].initialSessionFailure; }],
  ["initial wrong request", (r) => { r.cases[0].initialSessionFailure.path = "/consumer/products"; }],
  ["initial write", (r) => { r.cases[0].initialSessionFailure.method = "POST"; }],
  ["initial wrong injected cause", (r) => { r.cases[0].initialSessionFailure.injectedFailure = "invalid-json"; }],
  ["initial stall connection not closed", (r) => { r.cases[0].initialSessionFailure.closedBeforeEnd = false; }],
  ["initial private lookup", (r) => { r.cases[0].initialPrivateReadCount = 1; }],
  ["private denial not checked", (r) => { r.cases[0].privateDenialConfirmed = false; }],
  ["missing initial document hash", (r) => { delete r.cases[0].initialDocument.sha256; }],
  ["wrong initial document", (r) => { r.cases[0].initialDocument.path = "/login"; }],
  ["initial document read failed", (r) => { r.cases[0].initialDocument.readFailed = true; }],
  ["error UI not observed", (r) => { r.cases[0].expectedBoundaryWasVisible = false; }],
  ["native event before error UI", (r) => { r.nativeWindowErrors[0].expectedBoundaryWasVisible = false; }],
  ["event earlier than UI receipt", (r) => { r.nativeWindowErrors[0].elapsedMs = 6049; }],
  ["unbounded late recovery", (r) => { r.nativeWindowErrors[0].elapsedMs = 11_001; }],
  ["new error after ready UI", (r) => { r.clientErrors[0].phase = "retry-ready-visible"; }],
  ["error outside transition", (r) => { r.nativeWindowErrors[0].phase = "before-navigation"; }],
  ["retry not successful", (r) => { r.cases[0].retrySucceeded = false; }],
  ["missing ready source", (r) => { r.cases[0].retryReadyReads.pop(); }],
  ["duplicate ready source", (r) => { r.cases[0].retryReadyReads[4] = { ...r.cases[0].retryReadyReads[3] }; }],
  ["failed ready source", (r) => { r.cases[0].retryReadyReads[1].responseStatus = 503; }],
  ["ready source write", (r) => { r.cases[0].retryReadyReads[1].method = "POST"; }],
  ["ready source remains injected", (r) => { r.cases[0].retryReadyReads[1].injectedFailure = "stalled-body"; }],
];
for (const [name, alter] of negatives) test(`strict recovery rule rejects ${name}`, () => {
  const evidence = provenRecovery(); alter(evidence);
  const classified = classifyPortalLoadingErrors(evidence);
  assert.equal(classified.expectedFrameworkRecoveries.length, 0);
  assert.ok(classified.unexpectedClientErrors.length + classified.unexpectedNativeWindowErrors.length > 0);
  assert.ok(classified.rejectedCases.length > 0);
});

test("an additional application exception remains unexpected even beside a proven recovery", () => {
  const evidence = provenRecovery();
  evidence.clientErrors.push({ caseId: "independent-ready-page", message: "Application crashed", scenario: "ready" });
  const classified = classifyPortalLoadingErrors(evidence);
  assert.equal(classified.expectedFrameworkRecoveries.length, 1);
  assert.equal(classified.unexpectedClientErrors.length, 1);
});
