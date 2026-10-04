import assert from "node:assert/strict";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import ts from "typescript";

// Only local synthetic credentials and an injected SQL executor are used.
export const EMAIL = "single-use@consumer-auth.invalid";
export const PHONE = "+12025550123";
export const CODE = "654321";
export const MAGIC = `nxa_${Buffer.alloc(24, 0xac).toString("base64url")}`;
export const sha = value => createHash("sha256").update(value).digest("hex");
const compiled = ts.transpileModule(readFileSync(new URL("../src/lib/consumer-auth.ts", import.meta.url), "utf8"), {
  fileName: "consumer-auth.ts",
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

export function loadConsumerVerification(sql, options = {}) {
  const rates = [], logs = [];
  const require = name => {
    if (name === "node:crypto") return { createHash, randomBytes, randomInt };
    if (name === "node:net") return { isIP };
    if (name === "./db") return { sql };
    if (name === "./commercial-runtime-schema") return { ensureConsumerAuthSchema: async () => {} };
    if (name === "./consumer-auth-continuation") return { normalizeConsumerAuthReturnPath: () => "/me" };
    if (name === "./consumer-auth-provider") return { resolveConsumerOtpProvider: () => { throw new Error("fixture_delivery_forbidden"); } };
    if (name === "./sun-rate-limit-store") return {
      hitSunRateLimit: async (...args) => { rates.push(args); return options.rateResult || { limited: false }; },
      shouldFailClosedSunRateLimit: () => true,
    };
    throw new Error(`unexpected_verification_dependency:${name}`);
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", "console", "fetch", "Date", compiled)(
    require, module, module.exports, { env: { NODE_ENV: "test" } },
    { log: (...args) => logs.push(args), warn: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    () => { throw new Error("fixture_network_forbidden"); }, options.Date || Date,
  );
  return { auth: module.exports, rates, logs };
}

export function verificationHarness(options = {}) {
  const state = {
    now: Date.now(), consumer: null, accountReads: 0, accountWrites: 0,
    identityWrites: 0, sessionAttempts: 0, sessions: 0, claims: 0, queries: [],
    rows: [EMAIL, PHONE].slice(0, options.contacts || 2).map((contact, index) => ({
      id: String(index + 1), contact, code_hash: sha(CODE), magic_token_hash: options.legacy ? null : sha(MAGIC),
      created_at: index + 1, used_at: null, expires_at: new Date(Date.now() + 60_000).toISOString(),
      locked_until: null, attempts: 0, max_attempts: 5,
    })),
  };
  class FixtureDate extends Date {
    constructor(...args) { super(...(args.length ? args : [state.now])); }
    static now() { return state.now; }
  }
  let selections = 0, releaseSelections;
  const allSelected = new Promise(resolve => { releaseSelections = resolve; });
  const sql = async (parts, ...values) => {
    const text = parts.join("?").replace(/\s+/g, " ").trim();
    state.queries.push({ text, values });
    if (text.startsWith("SELECT") && text.includes("FROM consumer_auth_challenges")) {
      const rows = state.rows.filter(row => row.used_at === null && (text.includes("WHERE contact") ? row.contact === values[0] : row.magic_token_hash === values[0]));
      const snapshot = structuredClone(rows.sort((a, b) => b.created_at - a.created_at).slice(0, text.includes("LIMIT 1") ? 1 : undefined));
      if (options.selectionParticipants) { if (++selections >= options.selectionParticipants) releaseSelections(); await allSelected; }
      return snapshot;
    }
    if (text.startsWith("WITH locked_challenges AS MATERIALIZED")) {
      state.claims++;
      if (options.beforeClaim) await options.beforeClaim(state, values);
      const [tokenHash, , , challengeId, , codeHash] = values;
      const rows = state.rows.filter(row => tokenHash ? row.magic_token_hash === tokenHash : row.id === String(challengeId));
      // Models the SQL lock winner. Real PostgreSQL QA separately exercises
      // these same statements and the actual wait/recheck behavior.
      if (!rows.length || rows.some(row => row.used_at !== null) || (challengeId !== null && !rows.some(row => row.id === String(challengeId) && row.code_hash === codeHash))) return [{ contact: null, error: "invalid_code" }];
      if (rows.some(row => row.locked_until && Date.parse(row.locked_until) > state.now)) return [{ contact: null, error: "locked" }];
      if (rows.some(row => !row.expires_at || Date.parse(row.expires_at) <= state.now)) return [{ contact: null, error: "expired" }];
      for (const row of rows) row.used_at = new Date(state.now).toISOString();
      return rows.map(row => ({ contact: row.contact, error: null }));
    }
    if (text.startsWith("UPDATE consumer_auth_challenges")) {
      const row = state.rows.find(row => row.id === String(values[2]) && row.used_at === null);
      if (!row) return [];
      row.attempts++;
      if (row.attempts >= values[0]) row.locked_until = new Date(state.now + values[1] * 60_000).toISOString();
      return [{ attempts: row.attempts, locked_until: row.locked_until }];
    }
    if (text.startsWith("SELECT * FROM consumers")) { state.accountReads++; return state.consumer ? [structuredClone(state.consumer)] : []; }
    if (text.startsWith("INSERT INTO consumers") || text.startsWith("UPDATE consumers")) {
      assert(state.rows.every(row => row.used_at !== null), "challenge group must be consumed before account effects");
      if (options.failAt === "account") throw new Error("fixture_account_failure");
      state.accountWrites++;
      state.consumer ||= { id: "101", email: values[0], phone: values[1], status: "registered" };
      return [structuredClone(state.consumer)];
    }
    if (text.startsWith("INSERT INTO consumer_identities")) { state.identityWrites++; return []; }
    if (text.startsWith("INSERT INTO consumer_sessions")) {
      assert(state.rows.every(row => row.used_at !== null), "challenge group must be consumed before sessions");
      state.sessionAttempts++;
      if (options.failAt === "session") throw new Error("fixture_session_failure");
      state.sessions++; return [];
    }
    throw new Error(`unexpected_verification_sql:${text}`);
  };
  return { ...loadConsumerVerification(sql, { ...options, Date: FixtureDate }), state };
}
