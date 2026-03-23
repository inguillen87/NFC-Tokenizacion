export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE } from "../../lib/session";

export async function GET(req: Request) {
  const response = NextResponse.redirect(new URL("/login", req.url));
  response.cookies.set(DASHBOARD_SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
