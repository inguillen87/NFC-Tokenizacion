import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { resolveRequestClientIp } from "../src/lib/request-meta.ts";

test("Cloudflare client IP is trusted only after the origin guard injects its internal marker", () => {
  const unverified = new Request("https://api.example.test/sun", {
    headers: {
      "cf-connecting-ip": "203.0.113.9",
      "x-vercel-forwarded-for": "198.51.100.20",
    },
  });
  assert.equal(
    resolveRequestClientIp(unverified, { VERCEL_ENV: "preview", NODE_ENV: "production" }),
    "198.51.100.20",
  );

  const verified = new Request("https://api.example.test/sun", {
    headers: {
      "x-nexid-edge-verified": "1",
      "cf-connecting-ip": "203.0.113.9",
      "x-vercel-forwarded-for": "198.51.100.20",
    },
  });
  assert.equal(
    resolveRequestClientIp(verified, { VERCEL_ENV: "production", NODE_ENV: "production" }),
    "203.0.113.9",
  );
});

test("spoofable multi-hop XFF and malformed edge IPs are rejected", () => {
  const spoofed = new Request("https://api.example.test/sun", {
    headers: { "x-forwarded-for": "192.0.2.66, 203.0.113.9" },
  });
  assert.equal(resolveRequestClientIp(spoofed, { NODE_ENV: "development" }), null);

  const malformedVerified = new Request("https://api.example.test/sun", {
    headers: {
      "x-nexid-edge-verified": "1",
      "cf-connecting-ip": "attacker-controlled",
      "x-vercel-forwarded-for": "198.51.100.20",
    },
  });
  assert.equal(
    resolveRequestClientIp(malformedVerified, { VERCEL_ENV: "production", NODE_ENV: "production" }),
    null,
  );
});

test("single local proxy addresses preserve development compatibility", () => {
  const local = new Request("http://localhost/sun", {
    headers: { "x-forwarded-for": "127.0.0.1" },
  });
  assert.equal(resolveRequestClientIp(local, { NODE_ENV: "development" }), "127.0.0.1");
});

test("self-hosted production rejects legacy forwarding headers without an authenticated edge signal", () => {
  const request = new Request("https://api.example.test/auth/login", {
    headers: { "x-forwarded-for": "203.0.113.9", "x-real-ip": "203.0.113.9" },
  });
  assert.equal(resolveRequestClientIp(request, { NODE_ENV: "production" }), null);
});

test("consumer Web3 sessions persist only centrally resolved request metadata", async () => {
  const route = await readFile(new URL("../src/app/consumer/auth/web3/route.ts", import.meta.url), "utf8");
  assert.match(route, /getRequestMeta\(req\)/);
  assert.doesNotMatch(route, /req\.headers\.get\("x-forwarded-for"\)/);
});
