import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return NextResponse.redirect(new URL("/nexid-mark-64.png", req.url), 307);
}
