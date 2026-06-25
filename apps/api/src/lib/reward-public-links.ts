import { randomBytes } from "node:crypto";
import { sql } from "./db";

export type PublicRewardClaim = Record<string, any>;

export function cleanPublicRewardToken(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 96);
}

export function createPublicRewardToken() {
  return `nxr_${randomBytes(18).toString("base64url")}`;
}

export function publicApiBase(req: Request) {
  const clean = (value: unknown) => String(value || "").trim();
  const forwardedHost = clean(req.headers.get("x-forwarded-host")).split(",")[0]?.trim();
  const forwardedProto = clean(req.headers.get("x-forwarded-proto")).split(",")[0]?.trim();
  if (forwardedHost) {
    const proto = forwardedProto === "http" ? "http" : "https";
    return `${proto}://${forwardedHost.replace(/\/$/, "")}`;
  }
  const host = clean(req.headers.get("host"));
  if (host && !/localhost|127\.0\.0\.1|\[::1\]/i.test(host)) return `https://${host.replace(/\/$/, "")}`;
  return new URL(req.url).origin;
}

export function publicWebBase() {
  const names = [
    "CONSUMER_PORTAL_URL",
    "NEXID_PUBLIC_WEB_URL",
    "NEXT_PUBLIC_WEB_URL",
    "NEXT_PUBLIC_WEB_BASE_URL",
    "WEB_BASE_URL",
    "VERCEL_URL",
  ];
  for (const name of names) {
    const value = String(process.env[name] || "")
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .trim();
    if (!value) continue;
    const raw = value.startsWith("http") ? value : `https://${value}`;
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:") continue;
      if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(url.hostname)) continue;
      return url.origin;
    } catch {
      continue;
    }
  }
  return "https://nexid.lat";
}

export function publicRewardUrl(token: string) {
  return `${publicWebBase()}/r/${encodeURIComponent(token)}`;
}

export function publicRewardStaffUrl(token: string) {
  return `${publicWebBase()}/s/${encodeURIComponent(token)}`;
}

export function publicRewardPassUrl(req: Request, token: string) {
  return `${publicApiBase(req)}/p/${encodeURIComponent(token)}`;
}

export async function ensureRewardPublicToken(claimId: string, metadata?: Record<string, any> | null) {
  const existing = cleanPublicRewardToken(metadata?.public_token);
  if (existing) return existing;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const token = createPublicRewardToken();
    const collision = await sql/*sql*/`
      SELECT id
      FROM consumer_reward_claims
      WHERE metadata_json->>'public_token' = ${token}
      LIMIT 1
    `;
    if (collision[0]) continue;
    const rows = await sql/*sql*/`
      UPDATE consumer_reward_claims
      SET metadata_json = COALESCE(metadata_json, '{}'::jsonb) || ${JSON.stringify({
        public_token: token,
        public_token_created_at: new Date().toISOString(),
      })}::jsonb,
          updated_at = now()
      WHERE id = ${claimId}
      RETURNING metadata_json->>'public_token' AS public_token
    `;
    const saved = cleanPublicRewardToken(rows[0]?.public_token);
    if (saved) return saved;
  }
  throw new Error("public_reward_token_failed");
}

export async function getPublicRewardClaimByCode(code: string) {
  const rows = await sql/*sql*/`
    SELECT
      c.id,
      c.consumer_id,
      c.tenant_id,
      c.reward_id,
      c.tap_event_id,
      c.redemption_code,
      c.status,
      c.metadata_json,
      c.created_at,
      c.updated_at,
      r.title AS reward_title,
      r.code AS reward_code,
      r.description AS reward_description,
      con.display_name,
      con.phone,
      con.email,
      t.slug AS tenant_slug,
      t.name AS tenant_name,
      COALESCE((c.metadata_json->>'expires_at')::timestamptz, c.created_at + interval '48 hours') AS expires_at
    FROM consumer_reward_claims c
    JOIN rewards r ON r.id = c.reward_id
    JOIN consumers con ON con.id = c.consumer_id
    JOIN tenants t ON t.id = c.tenant_id
    WHERE c.redemption_code = ${code}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getPublicRewardClaimByToken(token: string) {
  const safeToken = cleanPublicRewardToken(token);
  if (!safeToken) return null;
  const rows = await sql/*sql*/`
    SELECT
      c.id,
      c.consumer_id,
      c.tenant_id,
      c.reward_id,
      c.tap_event_id,
      c.redemption_code,
      c.status,
      c.metadata_json,
      c.created_at,
      c.updated_at,
      r.title AS reward_title,
      r.code AS reward_code,
      r.description AS reward_description,
      con.display_name,
      con.phone,
      con.email,
      t.slug AS tenant_slug,
      t.name AS tenant_name,
      COALESCE((c.metadata_json->>'expires_at')::timestamptz, c.created_at + interval '48 hours') AS expires_at
    FROM consumer_reward_claims c
    JOIN rewards r ON r.id = c.reward_id
    JOIN consumers con ON con.id = c.consumer_id
    JOIN tenants t ON t.id = c.tenant_id
    WHERE c.metadata_json->>'public_token' = ${safeToken}
    LIMIT 1
  `;
  if (rows[0]) return rows[0];

  const fallbackRows = await sql/*sql*/`
    SELECT
      c.id,
      c.consumer_id,
      c.tenant_id,
      c.reward_id,
      c.tap_event_id,
      c.redemption_code,
      c.status,
      c.metadata_json,
      c.created_at,
      c.updated_at,
      r.title AS reward_title,
      r.code AS reward_code,
      r.description AS reward_description,
      con.display_name,
      con.phone,
      con.email,
      t.slug AS tenant_slug,
      t.name AS tenant_name,
      COALESCE((c.metadata_json->>'expires_at')::timestamptz, c.created_at + interval '48 hours') AS expires_at
    FROM consumer_reward_claims c
    LEFT JOIN rewards r ON r.id = c.reward_id
    LEFT JOIN consumers con ON con.id = c.consumer_id
    LEFT JOIN tenants t ON t.id = c.tenant_id
    WHERE c.metadata_json::text LIKE ${`%${safeToken}%`}
    ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
    LIMIT 1
  `;
  return fallbackRows[0] || null;
}

export function formatPublicRewardClaim(row: PublicRewardClaim | null) {
  if (!row) return null;
  const metadata = row.metadata_json || {};
  const expiresAt = metadata.expires_at || row.expires_at || null;
  const expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
  const phone = String(row.phone || "");
  const email = String(row.email || "");
  return {
    code: row.redemption_code,
    status: expired && row.status === "claimed" ? "expired" : row.status,
    seal: metadata.verification_seal || null,
    expiresAt,
    createdAt: row.created_at,
    reward: {
      title: row.reward_title || "Beneficio nexID",
      description: row.reward_description || null,
    },
    tenant: {
      name: row.tenant_name || "nexID Partner",
    },
    consumer: {
      name: row.display_name || "Consumidor nexID",
      phoneLast4: phone.replace(/[^\d]/g, "").slice(-4),
      phoneMasked: phone ? `${phone.slice(0, 5)}***${phone.slice(-3)}` : null,
      emailMasked: email ? `${email.slice(0, 2)}***@${email.split("@")[1] || "mail"}` : null,
    },
    staffInstruction: metadata.staff_instruction || "Validar codigo, telefono y sello nexID antes de entregar beneficio.",
  };
}
