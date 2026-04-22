import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirect = new URL("/opengraph-image", url.origin);
  url.searchParams.forEach((value, key) => redirect.searchParams.set(key, value));
  return NextResponse.redirect(redirect, 307);
}
