export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../../lib/auth";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import { summarizeBatchSdmConfig } from "../../../../../lib/sun-service";

const STANDARD_TTSTATUS_CONFIG = {
  tagtamper_enabled: true,
  tamper_status_enabled: true,
  tamper_status_source: "enc_decrypted",
  tamper_status_offset: 0,
  tamper_status_length: 2,
  tamper_closed_values: ["4343"],
  tamper_open_values: ["4F4F", "4F43"],
  tamper_invalid_values: ["4949"],
  tamper_unknown_policy: "UNKNOWN",
  ttstatus_enabled: true,
  ttstatus_source: "enc_decrypted",
  ttstatus_offset: 0,
  ttstatus_length: 2,
  ttstatus_closed_values: ["4343"],
  ttstatus_opened_values: ["4F4F", "4F43"],
  ttstatus_invalid_values: ["4949"],
  ttstatus_plain_or_encrypted: "encrypted",
  carrier_profile_code: "ntag424_dna_tt",
};

function asConfig(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input) ? { ...(input as Record<string, unknown>) } : {};
}

function buildDiff(previous: Record<string, unknown>, next: Record<string, unknown>) {
  return Object.entries(next)
    .filter(([key, value]) => JSON.stringify(previous[key]) !== JSON.stringify(value))
    .map(([key, value]) => ({ key, previous: previous[key] ?? null, next: value }));
}

export async function POST(req: Request, context: { params: Promise<{ bid: string }> }) {
  const auth = checkAdmin(req, ["super_admin"]);
  if (auth) return auth;

  const { bid: rawBid } = await context.params;
  const bid = decodeURIComponent(String(rawBid || "")).trim();
  if (!bid) return json({ ok: false, reason: "bid required" }, 400);

  const rows = await sql/*sql*/`
    SELECT bid, sdm_config
    FROM batches
    WHERE bid = ${bid}
    LIMIT 1
  `;
  const batch = rows[0] as Record<string, unknown> | undefined;
  if (!batch) return json({ ok: false, reason: "batch not found", bid }, 404);

  const previousConfig = asConfig(batch.sdm_config);
  const nextConfig = { ...previousConfig, ...STANDARD_TTSTATUS_CONFIG };
  const diff = buildDiff(previousConfig, nextConfig);

  const updated = await sql/*sql*/`
    UPDATE batches
    SET sdm_config = ${JSON.stringify(nextConfig)}::jsonb,
        carrier_profile_code = 'ntag424_dna_tt'
    WHERE bid = ${bid}
    RETURNING bid, sdm_config
  `;

  return json({
    ok: true,
    bid: updated[0]?.bid || bid,
    previous_summary: summarizeBatchSdmConfig(previousConfig),
    new_summary: summarizeBatchSdmConfig(updated[0]?.sdm_config || nextConfig),
    diff,
  });
}
