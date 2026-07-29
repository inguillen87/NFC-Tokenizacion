export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "node:crypto";
import { checkAdmin } from "../../../../lib/auth";
import { SUN_MAC_INPUT_MODES, verifySun } from "../../../../lib/crypto/sdm";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { decryptKey16 } from "../../../../lib/keys";
import { parseTTStatusFromDecryptedPayload } from "../../../../lib/ttstatus";
import { resolveConfiguredMacInputModes, resolveSelectedMacInputModes, resolveTamperProfile, summarizeBatchSdmConfig } from "../../../../lib/sun-service";

type DebugVerifyBody = {
  url?: string;
  includeSensitiveDiagnostics?: boolean;
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

function keyFingerprint(hex: string) {
  return createHash("sha256").update(Buffer.from(hex, "hex")).digest("hex").slice(0, 16).toUpperCase();
}

function canReturnSensitiveDiagnostics(req: Request, body: DebugVerifyBody) {
  return body.includeSensitiveDiagnostics === true
    && req.headers.get("x-nexid-debug-sensitive") === "allow"
    && process.env.ALLOW_SENSITIVE_SUN_DEBUG === "true";
}

function batchSummary(row: Record<string, unknown>) {
  return {
    id: row.id,
    bid: row.bid,
    status: row.status || null,
    tenant_slug: row.tenant_slug || null,
    created_at: row.created_at || null,
    batch_sdm_config: summarizeBatchSdmConfig(row.sdm_config),
  };
}

function debugRecommendation(input: {
  duplicateBid: boolean;
  keysPresent: boolean;
  ok: boolean;
  reason: string | null;
  uidDecoded: boolean;
  uidCandidateCount: number;
  uidCandidateManifestMatch: boolean;
  cmacMatched: boolean;
  ttRaw: string | null;
}) {
  if (input.duplicateBid) return "BID is duplicated. /sun cannot safely choose keys/config until duplicate rows are merged, revoked, or renamed.";
  if (!input.keysPresent) return "Batch found, but encrypted K_META/K_FILE are missing. Register batch keys before testing SUN.";
  if (!input.ok && input.reason === "cmac mismatch" && input.uidCandidateCount > 0 && !input.cmacMatched && !input.uidCandidateManifestMatch) {
    return "PICCData produced diagnostic UID candidates, but none match the batch manifest and none are authenticated by CMAC. Review K_META, PICCData layout, and supplier ChangeFileSet before manifest/K_FILE.";
  }
  if (!input.ok && input.reason === "cmac mismatch" && input.uidCandidateCount > 0 && !input.cmacMatched) {
    return "A diagnostic UID candidate matches the manifest, but CMAC did not match any tested input. Review K_FILE, SDMMACInputOffset, MAC input mode, and supplier ChangeFileSet.";
  }
  if (!input.ok && !input.uidDecoded) return "SUN failed before UID decode. Review K_META, PICCData layout, SDM offsets, and supplier ChangeFileSet.";
  if (!input.ok && !input.cmacMatched) return "UID candidate exists but CMAC did not match any tested input. Review K_FILE, SDMMACInputOffset, MAC input mode, and supplier ChangeFileSet.";
  if (!input.ok) return `SUN crypto failed: ${input.reason || "unknown reason"}. Review keys and SDM profile for this batch.`;
  if (!input.ttRaw) return "SUN validates. If this is a TagTamper batch, review ttstatus_enabled/source/offset/length.";
  return "SUN validates and TTStatus was parsed from the configured batch profile.";
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req, ["super_admin"]);
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
      b.id,
      b.bid,
      b.tenant_id,
      b.meta_key_ct,
      b.file_key_ct,
      b.sdm_config,
      b.status,
      b.created_at,
      t.slug AS tenant_slug
    FROM batches b
    LEFT JOIN tenants t ON t.id = b.tenant_id
    WHERE b.bid = ${bid}
    ORDER BY b.created_at ASC, b.id ASC
  `;
  const batchRows = rows as Record<string, unknown>[];

  if (!batchRows.length) {
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

  if (batchRows.length > 1) {
    return json({
      ok: false,
      bid,
      batch_found: true,
      reason: "DUPLICATE_BID",
      message: "BID must be globally unique because /sun only receives bid.",
      batches: batchRows.map(batchSummary),
      recommendation: debugRecommendation({
        duplicateBid: true,
        keysPresent: false,
        ok: false,
        reason: "DUPLICATE_BID",
        uidDecoded: false,
        uidCandidateCount: 0,
        uidCandidateManifestMatch: false,
        cmacMatched: false,
        ttRaw: null,
      }),
    }, 409);
  }

  const batch = batchRows[0]!;
  const keysPresent = Boolean(batch.meta_key_ct && batch.file_key_ct);
  if (!keysPresent) {
    return json({
      ok: false,
      bid,
      batch_found: true,
      batch_id: batch.id,
      tenant_slug: batch.tenant_slug || null,
      keys_present: false,
      verifySun: null,
      batch_sdm_config: summarizeBatchSdmConfig(batch.sdm_config),
      recommendation: debugRecommendation({
        duplicateBid: false,
        keysPresent,
        ok: false,
        reason: "missing encrypted keys",
        uidDecoded: false,
        uidCandidateCount: 0,
        uidCandidateManifestMatch: false,
        cmacMatched: false,
        ttRaw: null,
      }),
    }, 409);
  }

  let kMetaHex = "";
  let kFileHex = "";
  try {
    const keyVersion = Number((batch.sdm_config as { key_version?: unknown } | null)?.key_version || 1);
    const keyContext = {
      tenantId: String(batch.tenant_id),
      bid,
      keyVersion: Number.isSafeInteger(keyVersion) && keyVersion > 0 ? keyVersion : 1,
    };
    kMetaHex = decryptKey16(String(batch.meta_key_ct), { ...keyContext, role: "K_META_BATCH" }).toString("hex").toUpperCase();
    kFileHex = decryptKey16(String(batch.file_key_ct), { ...keyContext, role: "K_FILE_BATCH" }).toString("hex").toUpperCase();
  } catch (error) {
    return json({
      ok: false,
      bid,
      batch_found: true,
      batch_id: batch.id,
      tenant_slug: batch.tenant_slug || null,
      keys_present: true,
      key_fingerprints: null,
      verifySun: null,
      batch_sdm_config: summarizeBatchSdmConfig(batch.sdm_config),
      recommendation: `Encrypted batch keys could not be opened with current KMS master: ${error instanceof Error ? error.message : "unknown KMS error"}.`,
    }, 500);
  }

  const selectedMacInputModes = resolveSelectedMacInputModes(batch.sdm_config);
  const configuredCandidateModes = resolveConfiguredMacInputModes(batch.sdm_config);
  const debugMacInputModes = Array.from(new Set([...configuredCandidateModes, ...SUN_MAC_INPUT_MODES]));
  const verification = verifySun({ kMetaHex, kFileHex, piccDataHex, encHex, cmacHex, macInputModes: debugMacInputModes });
  const includeSensitiveDiagnostics = canReturnSensitiveDiagnostics(req, body);
  const manifestRows = await sql/*sql*/`
    SELECT UPPER(uid_hex) AS uid_hex
    FROM tags
    WHERE batch_id = ${batch.id}
  `;
  const manifestUids = new Set(manifestRows.map((row: { uid_hex?: string | null }) => String(row.uid_hex || "").toUpperCase()).filter(Boolean));
  const piccCandidates = (verification.piccCandidates || []).map((candidate) => ({
    ...candidate,
    manifest_match: manifestUids.has(String(candidate.uidHex || "").toUpperCase()),
  }));
  const uidCandidateManifestMatch = piccCandidates.some((candidate) => candidate.manifest_match);
  const tamperProfile = resolveTamperProfile(batch.sdm_config);
  const encPlainHex = verification.encPlainHex || "";
  const ttStatus = verification.ok && encPlainHex
    ? parseTTStatusFromDecryptedPayload(encPlainHex, tamperProfile.ttstatus_offset ?? 0, {
      closedValues: tamperProfile.ttstatus_closed_values,
      openedValues: tamperProfile.ttstatus_opened_values,
      invalidValues: tamperProfile.ttstatus_invalid_values,
    })
    : null;
  const uidDecoded = verification.ok && (verification.uidDecoded === true || Boolean(verification.uidHex));
  const reason = verification.ok ? null : verification.reason;
  const cmacMatched = Boolean(verification.cmacCandidates?.some((candidate) => candidate.match));
  const sensitiveDiagnostics = includeSensitiveDiagnostics
    ? {
      sensitive_redacted: false,
      picc_plain_hex: verification.piccPlainHex || null,
      picc_plain_hex_prefix: verification.piccPlainHex ? verification.piccPlainHex.slice(0, 32) : null,
      enc_plain_hex: verification.encPlainHex || null,
      enc_plain_hex_prefix: verification.encPlainHex ? verification.encPlainHex.slice(0, 32) : null,
      expected_cmac_hex: verification.expectedCmacHex || null,
      actual_cmac_hex: verification.actualCmacHex || null,
      uid_candidate_hex: !verification.ok ? verification.uidCandidateHex || null : null,
      picc_candidates: piccCandidates,
      cmac_candidates: verification.cmacCandidates || [],
    }
    : {
      sensitive_redacted: true,
      sensitive_fields: [
        "picc_plain_hex",
        "enc_plain_hex",
        "expected_cmac_hex",
        "actual_cmac_hex",
        "picc_candidates",
        "cmac_candidates",
      ],
      picc_plain_hex: null,
      picc_plain_hex_prefix: null,
      enc_plain_hex: null,
      enc_plain_hex_prefix: null,
      expected_cmac_hex: null,
      actual_cmac_hex: null,
      uid_candidate_hex: null,
      picc_candidates: [],
      cmac_candidates: [],
    };

  return json({
    ok: true,
    bid,
    batch_found: true,
    batch_id: batch.id,
    tenant_slug: batch.tenant_slug || null,
    keys_present: true,
    key_fingerprints: {
      k_meta_sha256_prefix: keyFingerprint(kMetaHex),
      k_file_sha256_prefix: keyFingerprint(kFileHex),
    },
    verifySun: {
      ok: verification.ok,
      reason,
      cmac_valid: verification.cmacValid ?? null,
      sdm_decryption_ok: verification.sdmDecryptionOk ?? null,
      uid_decoded: uidDecoded,
      uid_hex: verification.ok ? verification.uidHex || null : null,
      uid_candidate_count: verification.piccCandidates?.length || 0,
      read_counter: verification.ok ? verification.ctr ?? null : null,
      enc_plain_hex_length: verification.encPlainHex ? verification.encPlainHex.length / 2 : null,
      picc_layout: verification.ok ? verification.piccLayout || null : null,
      selected_mac_input: verification.ok ? verification.macInputMode || null : null,
      selected_configured_mac_input_modes: selectedMacInputModes,
      configured_candidate_mac_input_modes: configuredCandidateModes,
      debug_mac_input_modes: debugMacInputModes,
      manifest_uid_count: manifestUids.size,
      uid_candidate_manifest_match: uidCandidateManifestMatch,
      ...sensitiveDiagnostics,
      tt_raw: ttStatus?.raw || null,
      tt_perm_status: ttStatus?.perm || null,
      tt_curr_status: ttStatus?.current || null,
      tamper_status: ttStatus?.tamper_status || null,
      product_state: ttStatus?.product_state || null,
    },
    batch_sdm_config: summarizeBatchSdmConfig(batch.sdm_config),
    recommendation: debugRecommendation({
      duplicateBid: false,
      keysPresent: true,
      ok: verification.ok,
      reason,
      uidDecoded,
      uidCandidateCount: verification.piccCandidates?.length || 0,
      uidCandidateManifestMatch,
      cmacMatched,
      ttRaw: ttStatus?.raw || null,
    }),
  });
}
