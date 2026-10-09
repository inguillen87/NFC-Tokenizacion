import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { sql, type SqlExecutor } from "./db";
import { consumerSessionTokenFromRequest, isConsumerSessionAccountActive } from "./consumer-auth";
import { readCurrentPassportEditorialCollection } from "./current-passport-editorial";
import { ACTIONS_VERSION } from "./tenant-loyalty-configuration";
import { resolveRequestClientIp } from "./request-meta";
import type { SommelierContext, SommelierLocale, SommelierDemoProfile } from "./sommelier-contract";
export type SommelierEnv = Record<string, string | undefined>;
export const DEMO_GRANT_SECONDS = 900;
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
export const productionSommelier = (env: SommelierEnv) => env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
function pepper(env: SommelierEnv) {
  const key = env.RATE_LIMIT_KEY_PEPPER;
  if (!key || Buffer.byteLength(key, "utf8") < 32 || Buffer.byteLength(key, "utf8") > 4096) throw new Error("sommelier_signing_unavailable");
  return key;
}
function hmac(env: SommelierEnv, purpose: string, data: string) {
  const subkey = createHmac("sha256", pepper(env)).update(`nexid.sommelier.${purpose}.v1`).digest();
  return createHmac("sha256", subkey).update(data).digest("hex");
}
export function allowedSommelierOrigin(req: Request, env: SommelierEnv): string | null {
  const provided = req.headers.get("origin");
  if (!provided) return null;
  let origin: URL;
  try { origin = new URL(provided); } catch { return null; }
  if (origin.origin !== provided || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") return null;
  const defaults = ["https://nexid.lat", "https://www.nexid.lat", "https://nexid.com.ar", "https://www.nexid.com.ar", "https://nexid.ar", "https://www.nexid.ar"];
  const configured = String(env.NEXID_SOMMELIER_ALLOWED_ORIGINS || "").split(",").filter(Boolean).map(v => v.trim());
  // Exact origins only; an invalid configuration fails closed, never wildcards.
  for (const value of configured) {
    try { const url = new URL(value); if (url.origin !== value || url.protocol !== "https:" || !/^[a-z0-9.-]+$/i.test(url.hostname) || url.username || url.password || url.search || url.hash) return null; } catch { return null; }
  }
  if ([...defaults, ...configured].includes(provided)) return provided;
  if (!productionSommelier(env) && origin.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)) return provided;
  return null;
}
export function sommelierCallerHash(req: Request, env: SommelierEnv): string | null {
  const ua = req.headers.get("user-agent");
  if (!ua || ua.length > 512) return null;
  // Public demo browser binding, not phone identity. API egress IP may change
  // between BFF calls; it is used only for conservative issuance admission.
  try { return hmac(env, "demo-browser", ua); } catch { return null; }
}
export function sommelierIssuanceHash(req: Request, env: SommelierEnv): string | null {
  const ip = resolveRequestClientIp(req, env);
  if (!ip) return null;
  try { return hmac(env, "issuance-ip", ip); } catch { return null; }
}
export type SommelierDemoGrant = { purpose: "nexid.sommelier.demo.v1"; profile: SommelierDemoProfile; origin: string; caller: string; jti: string; iat: number; exp: number };
export function issueSommelierDemoGrant(origin: string, caller: string, env: SommelierEnv, now = Math.floor(Date.now() / 1000), id = randomUUID(), profile: SommelierDemoProfile = "valle-secreto") {
  if (!HASH.test(caller) || !UUID.test(id) || !Number.isSafeInteger(now)) throw new Error("sommelier_grant_input_invalid");
  if (profile !== "valle-secreto" && profile !== "syngenta") throw new Error("sommelier_grant_input_invalid");
  const grant: SommelierDemoGrant = { purpose: "nexid.sommelier.demo.v1", profile, origin, caller, jti: id, iat: now, exp: now + DEMO_GRANT_SECONDS };
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
  return `${payload}.${hmac(env, "grant", payload)}`;
}
export function verifySommelierDemoGrant(token: unknown, origin: string, caller: string, env: SommelierEnv, now = Math.floor(Date.now() / 1000), profile: SommelierDemoProfile = "valle-secreto"): SommelierDemoGrant | null {
  if (profile !== "valle-secreto" && profile !== "syngenta") return null;
  if (typeof token !== "string" || token.length > 1600 || !HASH.test(caller)) return null;
  const match = /^([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/.exec(token);
  if (!match) return null;
  try {
    const expected = hmac(env, "grant", match[1]);
    if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(match[2], "hex"))) return null;
    const grant = JSON.parse(Buffer.from(match[1], "base64url").toString("utf8")) as SommelierDemoGrant;
    if (Object.keys(grant).sort().join() !== "caller,exp,iat,jti,origin,profile,purpose" || grant.purpose !== "nexid.sommelier.demo.v1" || grant.profile !== profile || grant.origin !== origin || grant.caller !== caller || !UUID.test(grant.jti) || !Number.isSafeInteger(grant.iat) || !Number.isSafeInteger(grant.exp) || grant.iat > now || grant.exp <= now || grant.exp - grant.iat !== DEMO_GRANT_SECONDS) return null;
    return grant;
  } catch { return null; }
}
export const sommelierDemoCookieName = (env: SommelierEnv, profile: SommelierDemoProfile = "valle-secreto") => `${productionSommelier(env) ? "__Host-" : ""}nexid_${profile === "syngenta" ? "syngenta" : "sommelier"}_demo`;
export function readSommelierDemoCookie(req: Request, env: SommelierEnv, profile: SommelierDemoProfile = "valle-secreto") {
  const parts = (req.headers.get("cookie") || "").split(";").map(s => s.trim()).filter(s => s.startsWith(`${sommelierDemoCookieName(env, profile)}=`));
  if (parts.length !== 1) return null;
  return parts[0].slice(sommelierDemoCookieName(env, profile).length + 1);
}
export function sommelierDemoCookie(token: string, env: SommelierEnv, profile: SommelierDemoProfile = "valle-secreto") {
  return `${sommelierDemoCookieName(env, profile)}=${token}; Path=/; Max-Age=${DEMO_GRANT_SECONDS}; HttpOnly; SameSite=Lax${productionSommelier(env) ? "; Secure" : ""}`;
}
/** Same normal consumer cookie/hash/status/expiry rules, with SELECTs only.
 * Missing tables, revoked accounts and unresolved/foreign events fail closed.
 */
export async function resolveConsumerSommelierContext(req: Request, eventId: string | undefined, locale: SommelierLocale, query: SqlExecutor = sql): Promise<{ context: SommelierContext; consumerId: string } | null> {
  const token = consumerSessionTokenFromRequest(req);
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  if (eventId === undefined) {
    const sessions = await query`SELECT c.id::text AS consumer_id,c.status AS consumer_status FROM consumer_sessions s JOIN consumers c ON c.id=s.consumer_id
      WHERE s.session_token_hash=${tokenHash} AND s.expires_at>=now() AND s.revoked_at IS NULL AND c.status IN ('anonymous','registered','verified') LIMIT 2`;
    if (sessions.length !== 1 || !UUID.test(String(sessions[0].consumer_id)) || !isConsumerSessionAccountActive(sessions[0].consumer_status)) return null;
    return { consumerId: String(sessions[0].consumer_id), context: { source: "general_guidance", tenantId: "consumer-general", demo: false, facts: [] } };
  }
  const rows = await query`
    SELECT c.id::text AS consumer_id, c.status AS consumer_status, e.tenant_id::text AS tenant_id, p.metadata
    FROM consumer_sessions s JOIN consumers c ON c.id=s.consumer_id
    JOIN events e ON e.id=${eventId}::bigint
    JOIN tenant_sun_profiles p ON p.tenant_id=e.tenant_id
    WHERE s.session_token_hash=${tokenHash} AND s.expires_at>=now() AND s.revoked_at IS NULL
      AND c.status IN ('anonymous','registered','verified') AND (
        EXISTS(SELECT 1 FROM consumer_tap_history h WHERE h.consumer_id=c.id AND h.tenant_id=e.tenant_id AND h.tap_event_id=e.id)
        OR EXISTS(SELECT 1 FROM consumer_products cp WHERE cp.consumer_id=c.id AND cp.tenant_id=e.tenant_id AND (cp.first_tap_event_id=e.id OR cp.latest_tap_event_id=e.id))
      ) LIMIT 2`;
  if (rows.length !== 1 || !UUID.test(String(rows[0].consumer_id)) || !UUID.test(String(rows[0].tenant_id)) || !isConsumerSessionAccountActive(rows[0].consumer_status)) return null;
  const metadata = rows[0].metadata;
  const rawSettings = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>).postTap : null;
  const settings = rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings) ? rawSettings as Record<string, unknown> : null;
  if (!settings || settings.version !== ACTIONS_VERSION || settings.status !== "published" || !Array.isArray(settings.allowedActions) || !settings.allowedActions.includes("sommelier")) return null;
  const [editorial] = await readCurrentPassportEditorialCollection([{ eventId, tenantId: String(rows[0].tenant_id) }], query);
  if (editorial.state !== "published" || editorial.document.template !== "general") return null;
  const identity = editorial.document.identity;
  const labels = { "es-AR": ["Producto", "Bodega", "Región publicada"], en: ["Product", "Producer", "Published region"], "pt-BR": ["Produto", "Vinícola", "Região publicada"] }[locale];
  const values = [identity.product_name, identity.winery, identity.region];
  const facts = values.flatMap((value, i) => typeof value === "string" && value ? [{ id: ["product", "producer", "region"][i], label: labels[i], text: value, url: null }] : []);
  if (!facts.some(f => f.id === "product")) return null;
  return { consumerId: String(rows[0].consumer_id), context: { source: "published_editorial", tenantId: String(rows[0].tenant_id), demo: false, facts } };
}
