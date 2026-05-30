export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
import { processSunScan } from "../../../../lib/sun-service";

type ValidateBody = {
  url?: string;
  sampleUrl?: string;
  bid?: string;
  picc_data?: string;
  enc?: string;
  cmac?: string;
};

type ValidationDecisionCode =
  | "MALFORMED_URL"
  | "UNKNOWN_BATCH"
  | "INVALID"
  | "SUN_BATCH_DUPLICATE_CONFIG"
  | "SUN_PROFILE_MISMATCH"
  | "NOT_REGISTERED"
  | "NOT_ACTIVE"
  | "REPLAY_SUSPECT"
  | "VALID_CLOSED"
  | "VALID_OPENED"
  | "VALID_OPENED_PREVIOUSLY"
  | "VALID_UNKNOWN_TAMPER";

type ValidationDecision = {
  code: ValidationDecisionCode;
  note: string;
  uid_decoded: boolean;
  uid_hex: string | null;
  crypto_error_reason: string | null;
  tt_raw: string | null;
};

function pickParam(url: URL, body: ValidateBody, key: "bid" | "picc_data" | "enc" | "cmac") {
  return (url.searchParams.get(key) || String(body[key] || "")).trim();
}

function nested(input: unknown, path: string[]) {
  let current = input;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function asString(input: unknown) {
  return input === null || input === undefined ? "" : String(input);
}

function buildValidationDecision(body: Record<string, unknown>, status: number): ValidationDecision {
  const resultName = asString(body.result).toUpperCase();
  const statusCode = asString(nested(body, ["status", "code"])).toUpperCase();
  const productState = asString(nested(body, ["status", "productState"])).toUpperCase();
  const reason = asString(body.reason || nested(body, ["status", "reason"])).toLowerCase();
  const diagnostics = (body.sun_diagnostics && typeof body.sun_diagnostics === "object"
    ? body.sun_diagnostics
    : {}) as Record<string, unknown>;
  const cryptoErrorReason = asString(
    diagnostics.crypto_error_reason ||
      body.crypto_error_reason ||
      nested(body, ["technical", "crypto_error_reason"]) ||
      nested(body, ["status", "cryptoErrorReason"]),
  );
  const verificationMethod = asString(diagnostics.verification_method || body.verification_method).toLowerCase();
  const uidHex = asString(diagnostics.uid_hex || nested(body, ["identity", "uid"]) || body.uid_hex) || null;
  const uidDecoded = diagnostics.uid_decoded === true || Boolean(uidHex);
  const ttRaw = asString(diagnostics.tt_raw || nested(body, ["tag_tamper", "raw"]) || body.tamper_raw_value).toUpperCase() || null;

  const cryptoFailedBeforeUid = !uidDecoded && (
    resultName === "SUN_PROFILE_MISMATCH" ||
    statusCode === "SUN_PROFILE_MISMATCH" ||
    verificationMethod === "sun_crypto_failed" ||
    /cmac|uid length|picc_data|crypto|decrypt|sun profile|sun_crypto|bad length/.test(cryptoErrorReason.toLowerCase() || reason)
  );

  if (statusCode === "SUN_BATCH_DUPLICATE_CONFIG" || resultName === "SUN_BATCH_DUPLICATE_CONFIG" || reason.includes("duplicate batch")) {
    return {
      code: "SUN_BATCH_DUPLICATE_CONFIG",
      note: "Hay mas de un batch con el mismo BID. Corregir duplicados antes de validar SUN.",
      uid_decoded: uidDecoded,
      uid_hex: uidHex,
      crypto_error_reason: cryptoErrorReason || null,
      tt_raw: ttRaw,
    };
  }
  if (statusCode === "UNKNOWN_BATCH" || resultName === "UNKNOWN_BATCH" || reason.includes("unknown batch")) {
    return {
      code: "UNKNOWN_BATCH",
      note: "No existe un batch activo para ese BID.",
      uid_decoded: uidDecoded,
      uid_hex: uidHex,
      crypto_error_reason: cryptoErrorReason || null,
      tt_raw: ttRaw,
    };
  }
  if (statusCode === "INVALID" && !cryptoFailedBeforeUid && (reason.includes("revoked") || reason.includes("disabled"))) {
    return {
      code: "INVALID",
      note: "El batch existe pero esta revocado o deshabilitado.",
      uid_decoded: uidDecoded,
      uid_hex: uidHex,
      crypto_error_reason: cryptoErrorReason || null,
      tt_raw: ttRaw,
    };
  }
  if (cryptoFailedBeforeUid) {
    return {
      code: "SUN_PROFILE_MISMATCH",
      note: "El batch existe, pero el payload SUN no descifra UID. Revisar keys/layout antes de revisar manifest.",
      uid_decoded: false,
      uid_hex: null,
      crypto_error_reason: cryptoErrorReason || reason || null,
      tt_raw: ttRaw,
    };
  }
  if (uidDecoded && (statusCode === "NOT_REGISTERED" || resultName === "NOT_REGISTERED" || reason.includes("not registered"))) {
    return {
      code: "NOT_REGISTERED",
      note: "El SUN descifra UID, pero esa UID no esta en el manifest del batch.",
      uid_decoded: true,
      uid_hex: uidHex,
      crypto_error_reason: cryptoErrorReason || null,
      tt_raw: ttRaw,
    };
  }
  if (uidDecoded && (statusCode === "NOT_ACTIVE" || resultName === "NOT_ACTIVE" || reason.includes("not active"))) {
    return {
      code: "NOT_ACTIVE",
      note: "La UID existe en el manifest, pero no esta activa para venta/uso.",
      uid_decoded: true,
      uid_hex: uidHex,
      crypto_error_reason: cryptoErrorReason || null,
      tt_raw: ttRaw,
    };
  }
  if (statusCode === "REPLAY_SUSPECT" || resultName === "REPLAY_SUSPECT" || reason.includes("replay") || reason.includes("copied url")) {
    return {
      code: "REPLAY_SUSPECT",
      note: "La URL/SUN ya fue usada. Se necesita un nuevo tap fisico para acciones comerciales.",
      uid_decoded: uidDecoded,
      uid_hex: uidHex,
      crypto_error_reason: cryptoErrorReason || null,
      tt_raw: ttRaw,
    };
  }
  if (ttRaw === "4343" || productState === "VALID_CLOSED") {
    return {
      code: "VALID_CLOSED",
      note: "SUN valido y TTStatus cerrado.",
      uid_decoded: uidDecoded,
      uid_hex: uidHex,
      crypto_error_reason: cryptoErrorReason || null,
      tt_raw: ttRaw,
    };
  }
  if (ttRaw === "4F4F" || productState === "VALID_OPENED") {
    return {
      code: "VALID_OPENED",
      note: "SUN valido y TTStatus abierto.",
      uid_decoded: uidDecoded,
      uid_hex: uidHex,
      crypto_error_reason: cryptoErrorReason || null,
      tt_raw: ttRaw,
    };
  }
  if (ttRaw === "4F43" || productState === "VALID_OPENED_PREVIOUSLY") {
    return {
      code: "VALID_OPENED_PREVIOUSLY",
      note: "SUN valido y TTStatus abierto previamente.",
      uid_decoded: uidDecoded,
      uid_hex: uidHex,
      crypto_error_reason: cryptoErrorReason || null,
      tt_raw: ttRaw,
    };
  }
  if (body.ok === true || (status >= 200 && status < 300 && ["VALID", "AUTH_OK"].includes(statusCode))) {
    return {
      code: "VALID_UNKNOWN_TAMPER",
      note: "SUN valido. Estado de apertura no disponible para este lote.",
      uid_decoded: uidDecoded,
      uid_hex: uidHex,
      crypto_error_reason: cryptoErrorReason || null,
      tt_raw: ttRaw,
    };
  }
  return {
    code: "INVALID",
    note: "La lectura no cumple una regla de validacion del servidor.",
    uid_decoded: uidDecoded,
    uid_hex: uidHex,
    crypto_error_reason: cryptoErrorReason || reason || null,
    tt_raw: ttRaw,
  };
}

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body = (await req.json().catch(() => ({}))) as ValidateBody;
  const rawUrl = String(body.url || body.sampleUrl || "").trim();

  let parsed: URL;
  try {
    parsed = rawUrl ? new URL(rawUrl) : new URL("https://placeholder.local/");
  } catch {
    return json({
      ok: false,
      reason: "invalid URL format",
      validation_decision: {
        code: "MALFORMED_URL",
        note: "La URL no tiene formato valido.",
        uid_decoded: false,
        uid_hex: null,
        crypto_error_reason: null,
        tt_raw: null,
      } satisfies ValidationDecision,
    }, 400);
  }

  const bid = pickParam(parsed, body, "bid");
  const picc_data = pickParam(parsed, body, "picc_data");
  const enc = pickParam(parsed, body, "enc");
  const cmac = pickParam(parsed, body, "cmac");

  if (!bid || !picc_data || !enc || !cmac) {
    const validationDecision: ValidationDecision = {
      code: "MALFORMED_URL",
      note: "Faltan parametros SUN: bid, picc_data, enc o cmac.",
      uid_decoded: false,
      uid_hex: null,
      crypto_error_reason: null,
      tt_raw: null,
    };
    return json({
      ok: false,
      reason: "missing sun params",
      need: ["bid", "picc_data", "enc", "cmac"],
      validation_decision: validationDecision,
      decision_tree: validationDecision.code,
      operator_note: validationDecision.note,
    }, 400);
  }

  const result = await processSunScan({
    bid,
    piccDataHex: picc_data,
    encHex: enc,
    cmacHex: cmac,
    rawQuery: Object.fromEntries(parsed.searchParams.entries()),
    context: {
      source: "imported",
      deviceLabel: "admin_validate",
      meta: { validatedFrom: "admin.sun.validate" },
    },
  });

  const resultBody = result.body as Record<string, unknown>;
  const validationDecision = buildValidationDecision(resultBody, result.status);

  return json(
    {
      ...resultBody,
      human_status: validationDecision.code,
      validation_decision: validationDecision,
      decision_tree: validationDecision.code,
      operator_note: validationDecision.note,
      replay_hint:
        validationDecision.code === "REPLAY_SUSPECT"
          ? "Counter did not increase versus previous scan for this UID."
          : undefined,
    },
    result.status,
  );
}
