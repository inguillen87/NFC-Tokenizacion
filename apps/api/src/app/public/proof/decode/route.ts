export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { json } from "../../../../lib/http";
import { decodePublicProofInput } from "../../../../lib/public-proof-decoder";

function readText(value: unknown) {
  return String(value || "").trim();
}

function decode(input: string) {
  const decoded = decodePublicProofInput(input);
  return json(decoded, decoded.ok ? 200 : 400);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const input = readText(
    url.searchParams.get("input")
      || url.searchParams.get("raw_input")
      || url.searchParams.get("rawInput")
      || url.searchParams.get("memo")
      || url.searchParams.get("data"),
  );
  return decode(input);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = readText(body.input || body.raw_input || body.rawInput || body.memo || body.data);
  return decode(input);
}
