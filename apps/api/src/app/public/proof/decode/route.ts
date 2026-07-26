export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { decodePublicProofInput, publicProofBusinessMeaning } from "../../../../lib/public-proof-decoder";
import { verifyIotaMemoPublication } from "../../../../lib/iota-evm-proof";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";

const MAX_PROOF_DECODE_BODY_BYTES = 16 * 1024;
const MAX_PROOF_INPUT_CHARS = 4_096;

function readText(value: unknown) {
  return String(value || "").trim();
}

async function decode(input: string) {
  const decoded = decodePublicProofInput(input);
  if (
    decoded.ok
    && decoded.matching_demo_case
    && decoded.publication_tx_hash
    && decoded.decoded_memo
  ) {
    const network = await verifyIotaMemoPublication(decoded.publication_tx_hash, decoded.decoded_memo);
    const warnings = (decoded.warnings || []).filter((warning) => ![
      "receipt_network_check_required",
      "receipt_not_verified",
    ].includes(warning));
    if (!network.verified) warnings.push(`receipt_network_verification_failed:${network.reason || "unknown"}`);
    const { input_hex: _inputHex, ...publicNetwork } = network;
    return json({
      ...decoded,
      receipt_verified: network.verified,
      verification_status: network.verified ? "verified_demo_receipt" : "matched_demo_receipt",
      executive_summary: network.verified
        ? `${decoded.matching_demo_case.title}: RPC confirmo el receipt y el Raw input coincide exactamente con el memo esperado.`
        : decoded.executive_summary,
      business_meaning: network.verified
        ? publicProofBusinessMeaning(decoded.fields || {})
        : decoded.business_meaning,
      network_verification: publicNetwork,
      warnings,
    }, 200);
  }
  return json(decoded, decoded.ok ? 200 : 400);
}

export async function GET(req: Request) {
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    tenantId: "public-proof",
    subjectId: "proof-decode:public",
  });
  if (limited) return limited;
  const url = new URL(req.url);
  const input = readText(
    url.searchParams.get("input")
      || url.searchParams.get("raw_input")
      || url.searchParams.get("rawInput")
      || url.searchParams.get("memo")
      || url.searchParams.get("data"),
  );
  if (input.length > MAX_PROOF_INPUT_CHARS) {
    return json({ ok: false, reason: "proof_input_too_large" }, 413);
  }
  return decode(input);
}

export async function POST(req: Request) {
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    tenantId: "public-proof",
    subjectId: "proof-decode:public",
  });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_PROOF_DECODE_BODY_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }
  const input = readText(body.input || body.raw_input || body.rawInput || body.memo || body.data);
  if (input.length > MAX_PROOF_INPUT_CHARS) {
    return json({ ok: false, reason: "proof_input_too_large" }, 413);
  }
  return decode(input);
}
