import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return NextResponse.redirect(new URL("/logo-mark.svg", req.url), 307);
}
