import assert from "node:assert/strict";
import test from "node:test";

import { runExternalExecutor } from "../src/lib/tokenization-engine.ts";

const VALID_TX_HASH = `0x${"ab".repeat(32)}`;

function source(overrides = {}) {
  return {
    NODE_ENV: "production",
    VERCEL_ENV: "production",
    TOKENIZATION_EXECUTOR_URL: "https://executor.example.test/mint",
    TOKENIZATION_EXECUTOR_SECRET: "test-executor-secret-32-bytes-minimum",
    ...overrides,
  };
}

function jsonResponse(value, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  return new Response(typeof value === "string" ? value : JSON.stringify(value), { ...init, headers });
}

async function rejectsCode(promise, expected) {
  await assert.rejects(promise, (error) => {
    assert.equal(error?.name, "ExecutorClientError");
    assert.equal(error?.message, expected);
    return true;
  });
}

test("production executor requires HTTPS and a secret while development keeps local HTTP", async () => {
  let fetchCalls = 0;
  const shouldNotFetch = async () => {
    fetchCalls += 1;
    throw new Error("unexpected_fetch");
  };

  await rejectsCode(runExternalExecutor({}, {
    source: source({ TOKENIZATION_EXECUTOR_URL: "http://executor.example.test/mint" }),
    fetchImpl: shouldNotFetch,
  }), "executor_https_required_in_production");
  await rejectsCode(runExternalExecutor({}, {
    source: source({ TOKENIZATION_EXECUTOR_SECRET: "" }),
    fetchImpl: shouldNotFetch,
  }), "executor_secret_required_in_production");
  await rejectsCode(runExternalExecutor({}, {
    source: source({ TOKENIZATION_EXECUTOR_SECRET: "too-short" }),
    fetchImpl: shouldNotFetch,
  }), "executor_secret_too_short_in_production");
  await rejectsCode(runExternalExecutor({}, {
    source: source({ TOKENIZATION_EXECUTOR_URL: "" }),
    fetchImpl: shouldNotFetch,
  }), "executor_required_in_production");
  assert.equal(fetchCalls, 0);

  const noDevExecutor = await runExternalExecutor({}, {
    source: source({ NODE_ENV: "development", VERCEL_ENV: "development", TOKENIZATION_EXECUTOR_URL: "", TOKENIZATION_EXECUTOR_SECRET: "" }),
    fetchImpl: shouldNotFetch,
  });
  assert.equal(noDevExecutor, null);

  let observedRequest;
  const devResult = await runExternalExecutor({ request_id: "dev-request" }, {
    source: source({
      NODE_ENV: "development",
      VERCEL_ENV: "development",
      TOKENIZATION_EXECUTOR_URL: "http://127.0.0.1:8787/mint",
    }),
    fetchImpl: async (url, init) => {
      observedRequest = { url: String(url), init };
      return jsonResponse({ ok: true, tx_hash: VALID_TX_HASH, token_id: "42" });
    },
  });
  assert.equal(devResult?.tx_hash, VALID_TX_HASH);
  assert.equal(devResult?.token_id, "42");
  assert.equal(observedRequest.url, "http://127.0.0.1:8787/mint");
  assert.equal(observedRequest.init.redirect, "error");
  assert.equal(observedRequest.init.headers["x-tokenization-secret"], "test-executor-secret-32-bytes-minimum");
  assert.equal(observedRequest.init.headers["idempotency-key"], "dev-request");
  assert.ok(observedRequest.init.signal instanceof AbortSignal);
});

test("executor request is cancelled at a bounded timeout", async () => {
  const neverCompletes = async (_url, init) => await new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error("https://sensitive.internal/body=secret")), { once: true });
  });

  await rejectsCode(runExternalExecutor({}, {
    source: source(),
    fetchImpl: neverCompletes,
    timeoutMs: 100,
  }), "executor_request_timeout");
});

test("executor response is bounded to 64 KiB and must be JSON", async () => {
  await rejectsCode(runExternalExecutor({}, {
    source: source(),
    fetchImpl: async () => jsonResponse("x".repeat((64 * 1024) + 1)),
  }), "executor_response_too_large");

  await rejectsCode(runExternalExecutor({}, {
    source: source(),
    fetchImpl: async () => new Response("not-json", { headers: { "content-type": "text/plain" } }),
  }), "executor_content_type_invalid");

  await rejectsCode(runExternalExecutor({}, {
    source: source(),
    fetchImpl: async () => jsonResponse("{not-json"),
  }), "executor_json_invalid");
});

test("executor accepts only successful, well-formed Polygon evidence", async () => {
  const response = (value) => runExternalExecutor({}, {
    source: source(),
    fetchImpl: async () => jsonResponse(value),
  });

  await rejectsCode(response({ ok: false, tx_hash: VALID_TX_HASH, token_id: "42" }), "executor_response_unsuccessful");
  await rejectsCode(response({ ok: true, tx_hash: "0x1234", token_id: "42" }), "executor_tx_hash_invalid");
  await rejectsCode(response({ ok: true, tx_hash: VALID_TX_HASH, token_id: 42 }), "executor_token_id_invalid");
  await rejectsCode(response({ ok: true, tx_hash: null, token_id: "0" }), "executor_token_id_invalid");
  await rejectsCode(response({ ok: true, tx_hash: null, token_id: null }), "executor_evidence_missing");

  const result = await response({ ok: true, tx_hash: VALID_TX_HASH, token_id: "42" });
  assert.equal(result?.tx_hash, VALID_TX_HASH);
  assert.equal(result?.token_id, "42");
});

test("executor errors never expose URL, secret, or response body", async () => {
  const sensitive = "https://executor.example.test/mint?secret=top-secret body=private";
  await rejectsCode(runExternalExecutor({}, {
    source: source(),
    fetchImpl: async () => { throw new Error(sensitive); },
  }), "executor_request_failed");

  await rejectsCode(runExternalExecutor({}, {
    source: source(),
    fetchImpl: async () => jsonResponse({ secret: sensitive }, { status: 502 }),
  }), "executor_http_502");
});
