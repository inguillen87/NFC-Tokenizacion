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

function pickParam(url: URL, body: ValidateBody, key: "bid" | "picc_data" | "enc" | "cmac") {
  return (url.searchParams.get(key) || String(body[key] || "")).trim();
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
    return json({ ok: false, reason: "invalid URL format" }, 400);
  }

  const bid = pickParam(parsed, body, "bid");
  const picc_data = pickParam(parsed, body, "picc_data");
  const enc = pickParam(parsed, body, "enc");
  const cmac = pickParam(parsed, body, "cmac");

  if (!bid || !picc_data || !enc || !cmac) {
    return json({ ok: false, reason: "missing sun params", need: ["bid", "picc_data", "enc", "cmac"] }, 400);
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

  return json(
    {
      ...result.body,
      human_status: (() => {
        if (result.body.result) return result.body.result;
        const reason = String(result.body.reason || "").toLowerCase();
        if (reason.includes("unknown batch")) return "UNKNOWN_BATCH";
        if (reason.includes("batch revoked")) return "INVALID";
        return result.body.ok ? "VALID" : "INVALID";
      })(),
      replay_hint:
        result.body.result === "REPLAY_SUSPECT"
          ? "Counter did not increase versus previous scan for this UID."
          : undefined,
    },
    result.status,
  );
}
