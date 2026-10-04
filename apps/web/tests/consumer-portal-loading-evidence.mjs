// Read only numeric diagnostic identifiers from the initial synthetic document.
export function numericDigest(value) {
  return typeof value === "string" && /^\d{1,20}$/.test(value) ? value : null;
}

export const REACT_419_MESSAGE = "Minified React error #419; visit https://react.dev/errors/419 for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
const SESSION_FAILURES = {
  "session-headers-stall": { failure: "stalled-headers", status: null, closedBeforeEnd: true },
  "session-body-stall": { failure: "stalled-body", status: 200, closedBeforeEnd: true },
  "session-500": { failure: "http-500", status: 500, closedBeforeEnd: false },
  "session-malformed": { failure: "invalid-json", status: 200, closedBeforeEnd: false },
};
const READY_PATHS = ["/consumer/session", "/consumer/me", "/consumer/products", "/consumer/taps", "/consumer/brands"];

/** Narrow evidence rule for the native notice from an intentionally failed SSR boundary. */
export function classifyPortalLoadingErrors(report) {
  const result = { expectedFrameworkRecoveries: [], unexpectedClientErrors: [], unexpectedNativeWindowErrors: [], rejectedCases: [] };
  const clientErrors = report.clientErrors || [], nativeErrors = report.nativeWindowErrors || [];
  const caseIds = new Set([...clientErrors, ...nativeErrors].map((event) => event.caseId));
  for (const caseId of caseIds) {
    const pageEvents = clientErrors.filter((event) => event.caseId === caseId);
    const browserEvents = nativeErrors.filter((event) => event.caseId === caseId);
    const cases = (report.cases || []).filter((item) => item.caseId === caseId);
    const state = cases.length === 1 ? cases[0] : null;
    const page = pageEvents[0], native = browserEvents[0];
    const reasons = [];
    if (!state || typeof caseId !== "string" || !caseId) reasons.push("missing-or-ambiguous-case");
    if (pageEvents.length !== 1 || browserEvents.length !== 1) reasons.push("requires-one-page-and-one-native-event");
    if (page?.message !== REACT_419_MESSAGE || native?.message !== REACT_419_MESSAGE) reasons.push("message-not-exact-react-419");
    if (native?.mainFrame !== true) reasons.push("native-event-not-main-frame");
    const digest = numericDigest(native?.digest);
    if (!digest) reasons.push("missing-numeric-native-digest");
    const failure = state && Object.hasOwn(SESSION_FAILURES, state.scenario) ? SESSION_FAILURES[state.scenario] : null;
    if (!failure || page?.scenario !== state?.scenario || native?.scenario !== state?.scenario) reasons.push("not-matching-injected-session-failure");
    if (page?.width !== state?.width || page?.theme !== state?.theme) reasons.push("page-event-not-matching-case-view");
    const initial = state?.initialSessionFailure;
    if (!initial || initial.method !== "GET" || initial.path !== "/consumer/session" || initial.scenario !== state?.scenario || initial.injectedFailure !== failure?.failure || initial.responseStatus !== failure?.status || initial.closedBeforeEnd !== failure?.closedBeforeEnd) reasons.push("initial-session-failure-not-proven");
    if (state?.initialPrivateReadCount !== 0 || state?.privateDenialConfirmed !== true) reasons.push("private-denial-not-proven");
    const document = state?.initialDocument;
    if (document?.path !== "/me" || !/^[\da-f]{64}$/.test(document?.sha256 || "") || document?.readFailed || ![200, 500].includes(document?.responseStatus)) reasons.push("initial-document-not-proven");
    const hasDigest = (values) => Array.isArray(values) && values.every((value) => numericDigest(value) !== null) && values.includes(digest);
    if (!digest || !hasDigest(document?.streamedSuspenseDigests) || !hasDigest(document?.rscErrorDigests) || !hasDigest(state?.initialDomTemplateDigests)) reasons.push("native-digest-not-bound-to-all-initial-boundary-receipts");
    if (state?.expectedBoundaryWasVisible !== true || page?.expectedBoundaryWasVisible !== true || native?.expectedBoundaryWasVisible !== true) reasons.push("error-ui-not-visible-before-event");
    for (const event of [page, native]) {
      if (!["error-visible", "retry-requested"].includes(event?.phase) || !Number.isFinite(event?.elapsedMs) || event.elapsedMs < 0 || event.elapsedMs > 11_000 || !Number.isFinite(state?.boundaryVisibleElapsedMs) || event.elapsedMs < state.boundaryVisibleElapsedMs) reasons.push("event-outside-proven-boundary-or-bounded-retry-transition");
    }
    const readyReads = state?.retryReadyReads;
    if (state?.retrySucceeded !== true || !Array.isArray(readyReads) || readyReads.length !== 5 || !READY_PATHS.every((path) => readyReads.filter((read) => read.path === path && read.method === "GET" && read.scenario === "ready" && read.responseStatus === 200 && read.injectedFailure === null).length === 1)) reasons.push("retry-not-confirmed-by-five-distinct-ready-reads");
    if (reasons.length) {
      result.unexpectedClientErrors.push(...pageEvents);
      result.unexpectedNativeWindowErrors.push(...browserEvents);
      result.rejectedCases.push({ caseId, reasons: [...new Set(reasons)] });
    } else {
      result.expectedFrameworkRecoveries.push({ caseId, digest, source: "initial SSR $RX + RSC:E + observed DOM data-dgst", initialDocumentSha256: document.sha256, pagePhase: page.phase, nativePhase: native.phase, pageElapsedMs: page.elapsedMs, nativeElapsedMs: native.elapsedMs, errorUiObserved: true, privateDenialConfirmed: true, readyReadsConfirmed: 5 });
    }
  }
  return result;
}

export function extractInitialDocumentDigests(html) {
  const templateDigests = [...html.matchAll(/<template\b[^>]*\bdata-dgst=["'](\d{1,20})["']/g)].map((match) => match[1]);
  const streamedSuspenseDigests = [...html.matchAll(/\$RX\(["'][^"']+["'],["'](\d{1,20})["']/g)].map((match) => match[1]);
  const rscErrorDigests = [];
  const marker = "self.__next_f.push(";
  let offset = 0;
  while ((offset = html.indexOf(marker, offset)) !== -1) {
    const start = offset + marker.length;
    let end = start, depth = 1, quoted = false, escaped = false;
    for (; end < html.length; end += 1) {
      const character = html[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === "(") depth += 1;
      else if (character === ")" && --depth === 0) break;
    }
    try {
      const push = JSON.parse(html.slice(start, end));
      if (Array.isArray(push) && push[0] === 1 && typeof push[1] === "string") {
        for (const line of push[1].split("\n")) {
          const errorRecord = /^[\da-f]+:E(\{.*\})$/.exec(line);
          if (!errorRecord) continue;
          const digest = numericDigest(JSON.parse(errorRecord[1]).digest);
          if (digest) rscErrorDigests.push(digest);
        }
      }
    } catch { /* No execution or general document-string digest matching. */ }
    offset = end + 1;
  }
  return {
    templateDigests: [...new Set(templateDigests)],
    streamedSuspenseDigests: [...new Set(streamedSuspenseDigests)],
    rscErrorDigests: [...new Set(rscErrorDigests)],
  };
}
