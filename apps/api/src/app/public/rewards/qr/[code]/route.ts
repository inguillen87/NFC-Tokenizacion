export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import QRCode from "qrcode";

function clean(value: unknown) {
  return String(value || "").trim();
}

function validCode(value: string) {
  return /^\d{6,10}$/.test(value);
}

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalizedCode = clean(code).replace(/[^\d]/g, "");
  if (!validCode(normalizedCode)) {
    return new Response("Invalid voucher code", { status: 400 });
  }

  const url = new URL(req.url);
  const seal = clean(url.searchParams.get("seal")).replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 24);
  const tenant = clean(url.searchParams.get("tenant")).replace(/[^a-z0-9-]/gi, "").toLowerCase().slice(0, 60) || "demobodega";
  const payload = `nexid:voucher:${tenant}:${normalizedCode}${seal ? `:${seal}` : ""}`;
  const svg = await QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 720,
    color: {
      dark: "#020617",
      light: "#ffffff",
    },
  });

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
