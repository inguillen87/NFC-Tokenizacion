import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ gtin: string; serial: string }> }) {
  const { gtin, serial } = await context.params;
  const url = new URL(req.url);
  const target = new URL("/sun", url.origin);
  target.searchParams.set("qr", "1");
  target.searchParams.set("carrier", "gs1_digital_link");
  target.searchParams.set("gtin", decodeURIComponent(gtin || ""));
  target.searchParams.set("serial", decodeURIComponent(serial || ""));
  target.searchParams.set("source", "gs1");
  for (const key of ["tenant", "bid", "product", "winery", "api"]) {
    const value = url.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target);
}
