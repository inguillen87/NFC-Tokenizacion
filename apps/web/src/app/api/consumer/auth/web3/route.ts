export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { productUrls } from "@product/config";
import { isClerkConfiguredForRuntime } from "../../../../../lib/clerk-env";

type ClerkWalletLike = {
  id?: string | null;
  web3Wallet?: string | null;
  walletAddress?: string | null;
  identifier?: string | null;
  verification?: { status?: string | null; strategy?: string | null } | null;
};

function getSetCookies(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const one = response.headers.get("set-cookie");
  return one ? [one] : [];
}

function rewriteApiCookie(cookie: string, req: Request) {
  const host = req.headers.get("host") || "";
  const isLocalHttp = new URL(req.url).protocol === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
  let nextCookie = cookie.replace(/;\s*Domain=[^;]+/gi, "");
  if (isLocalHttp) nextCookie = nextCookie.replace(/;\s*Secure/gi, "");
  return nextCookie;
}

function firstWalletAddress(user: unknown) {
  const web3Wallets = Array.isArray((user as { web3Wallets?: unknown[] } | null)?.web3Wallets)
    ? ((user as { web3Wallets: ClerkWalletLike[] }).web3Wallets)
    : [];
  const wallet = web3Wallets.find((item) => item.web3Wallet || item.walletAddress || item.identifier);
  return {
    address: String(wallet?.web3Wallet || wallet?.walletAddress || wallet?.identifier || "").trim(),
    provider: String(wallet?.verification?.strategy || "clerk_web3_metamask").trim(),
  };
}

export async function POST(req: Request) {
  if (!isClerkConfiguredForRuntime()) {
    return NextResponse.json({ ok: false, error: "clerk_not_configured" }, { status: 503 });
  }
  const user = await currentUser().catch(() => null);
  if (!user) return NextResponse.json({ ok: false, error: "clerk_session_required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const wallet = firstWalletAddress(user);
  const email = user.emailAddresses?.[0]?.emailAddress || "";
  const phone = user.phoneNumbers?.[0]?.phoneNumber || "";
  const fullName = user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Usuario Web3 nexID";
  const chainId = String(body.chainId || "").trim();
  const response = await fetch(`${productUrls.api}/consumer/auth/web3`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}`,
      cookie: req.headers.get("cookie") || "",
      "user-agent": req.headers.get("user-agent") || "nexid-web3-bridge",
      "x-forwarded-for": req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "",
    },
    body: JSON.stringify({
      externalUserId: user.id,
      email,
      phone,
      fullName,
      walletAddress: wallet.address,
      chainId,
      provider: wallet.provider,
    }),
  }).catch((error) => {
    const message = error instanceof Error ? error.message : "api_unavailable";
    return Response.json({ ok: false, error: "api_unavailable", detail: message }, { status: 503 });
  });

  const text = await response.text();
  const next = new NextResponse(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  });
  for (const cookie of getSetCookies(response)) {
    next.headers.append("set-cookie", rewriteApiCookie(cookie, req));
  }
  return next;
}
