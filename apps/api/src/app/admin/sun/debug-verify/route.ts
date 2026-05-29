export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { verifySun } from "../../../../lib/crypto/sdm";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { decryptKey16 } from "../../../../lib/keys";
import { parseTTStatusFromDecryptedPayload } from "../../../../lib/ttstatus";
import { resolveTamperProfile, summarizeBatchSdmConfig } from "../../../../lib/sun-service";

type DebugVerifyBody = {
  url?: string;
};

function readSunParams(rawUrl: string) {
  const parsed = new URL(rawUrl);
  return {
    parsed,
    bid: String(parsed.searchParams.get("bid") || "").trim(),
    piccDataHex: String(parsed.searchParams.get("picc_data") || "").trim(),
    encHex: String(parsed.searchParams.get("enc") || "").trim(),
    cmacHex: String(parsed.searchParams.get("cmac") || "").trim(),
  };
}

function debugRecommendation(input: {
  keysPresent: boolean;
  ok: boolean;
  reason: string | null;
  uidDecoded: boolean;
  ttRaw: string | null;
}) {
  if (!input.keysPresent) return "Batch found, but encrypted K_META/K_FILE are missing. Register batch keys before testing SUN.";
  if (!input.ok && !input.uidDecoded) return "SUN failed before UID decode. Review K_META, PICCData layout, SDM offsets, and supplier ChangeFileSet.";
  if (!input.ok && /cmac/i.test(input.reason || "")) return "UID decoded but CMAC failed. Review K_FILE, MAC input, SDMMACInputOffset, and ChangeFileSet.";
  if (!input.ok) return `SUN crypto failed: ${input.reason || "unknown reason"}. Review keys and SDM profile for this batch.`;
  if (!input.ttRaw) return "SUN validates. If this is a TagTamper batch, review ttstatus_enabled/source/offset/length.";
  return "SUN validates and TTStatus was parsed from the configured batch profile.";
}

export async function POST(req: Request) {
  const auth = checkAdmin(req, ["super_admin"]);
  if (auth) return auth;

  const body = (await req.json().catch(() => ({}))) as DebugVerifyBody;
  const rawUrl = String(body.url || "").trim();
  if (!rawUrl) return json({ ok: false, reason: "url required" }, 400);

  let params: ReturnType<typeof readSunParams>;
  try {
    params = readSunParams(rawUrl);
  } catch {
    return json({ ok: false, reason: "invalid URL format" }, 400);
  }

  const { bid, piccDataHex, encHex, cmacHex } = params;
  if (!bid || !piccDataHex || !encHex || !cmacHex) {
    return json({ ok: false, reason: "missing sun params", need: ["bid", "picc_data", "enc", "cmac"] }, 400);
  }

  const rows = await sql/*sql*/`
    SELECT
      b.bid,
      b.meta_key_ct,
      b.file_key_ct,
      b.sdm_config,
      t.slug AS tenant_slug
    FROM batches b
    LEFT JOIN tenants t ON t.id = b.tenant_id
    WHERE b.bid = ${bid}
    LIMIT 1
  `;
  const batch = rows[0] as Record<string, unknown> | undefined;

  if (!batch) {
    return json({
      ok: false,
      bid,
      batch_found: false,
      tenant_slug: null,
      keys_present: false,
      verifySun: null,
      batch_sdm_config: null,
      recommendation: "Batch not found. Create/import the supplier batch before validating this URL.",
    }, 404);
  }

  const keysPresent = Boolean(batch.meta_key_ct && batch.file_key_ct);
  if (!keysPresent) {
    return json({
      ok: false,
      bid,
      batch_found: true,
      tenant_slug: batch.tenant_slug || null,
      keys_present: false,
      verifySun: null,
      batch_sdm_config: summarizeBatchSdmConfig(batch.sdm_config),
      recommendation: debugRecommendation({ keysPresent, ok: false, reason: "missing encrypted keys", uidDecoded: false, ttRaw: null }),
    }, 409);
  }

  let kMetaHex = "";
  let kFileHex = "";
  try {
    kMetaHex = decryptKey16(String(batch.meta_key_ct)).toString("hex").toUpperCase();
    kFileHex = decryptKey16(String(batch.file_key_ct)).toString("hex").toUpperCase();
  } catch (error) {
    return json({
      ok: false,
      bid,
      batch_found: true,
      tenant_slug: batch.tenant_slug || null,
      keys_present: true,
      verifySun: null,
      batch_sdm_config: summarizeBatchSdmConfig(batch.sdm_config),
      recommendation: `Encrypted batch keys could not be opened with current KMS master: ${error instanceof Error ? error.message : "unknown KMS error"}.`,
    }, 500);
  }

  const verification = verifySun({ kMetaHex, kFileHex, piccDataHex, encHex, cmacHex });
  const tamperProfile = resolveTamperProfile(batch.sdm_config);
  const encPlainHex = verification.encPlainHex || "";
  const ttStatus = verification.ok && encPlainHex
    ? parseTTStatusFromDecryptedPayload(encPlainHex, tamperProfile.ttstatus_offset ?? 0, {
      closedValues: tamperProfile.ttstatus_closed_values,
      openedValues: tamperProfile.ttstatus_opened_values,
      invalidValues: tamperProfile.ttstatus_invalid_values,
    })
    : null;
  const uidDecoded = verification.uidDecoded === true || Boolean(verification.uidHex);
  const reason = verification.ok ? null : verification.reason;

  return json({
    ok: true,
    bid,
    batch_found: true,
    tenant_slug: batch.tenant_slug || null,
    keys_present: true,
    verifySun: {
      ok: verification.ok,
      reason,
      cmac_valid: verification.cmacValid ?? null,
      sdm_decryption_ok: verification.sdmDecryptionOk ?? null,
      uid_decoded: uidDecoded,
      uid_hex: verification.uidHex || null,
      read_counter: verification.ctr ?? null,
      picc_plain_hex: verification.piccPlainHex || null,
      enc_plain_hex: verification.encPlainHex || null,
      enc_plain_hex_length: verification.encPlainHex ? verification.encPlainHex.length / 2 : null,
      expected_cmac_hex: verification.expectedCmacHex || null,
      actual_cmac_hex: verification.actualCmacHex || null,
      tt_raw: ttStatus?.raw || null,
      tt_perm_status: ttStatus?.perm || null,
      tt_curr_status: ttStatus?.current || null,
      tamper_status: ttStatus?.tamper_status || null,
      product_state: ttStatus?.product_state || null,
    },
    batch_sdm_config: summarizeBatchSdmConfig(batch.sdm_config),
    recommendation: debugRecommendation({
      keysPresent: true,
      ok: verification.ok,
      reason,
      uidDecoded,
      ttRaw: ttStatus?.raw || null,
    }),
  });
}
