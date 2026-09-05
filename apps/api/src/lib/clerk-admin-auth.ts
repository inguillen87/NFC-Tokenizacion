import { createClerkClient, verifyToken } from "@clerk/backend";

type ClerkTokenPayload = { sub?: string | null };
type ClerkEmail = {
  id?: string | null;
  emailAddress?: string | null;
  verification?: { status?: string | null } | null;
};
type ClerkWeb3Wallet = {
  web3Wallet?: string | null;
  walletAddress?: string | null;
  identifier?: string | null;
  verification?: { status?: string | null; strategy?: string | null } | null;
};
type ClerkUser = {
  id: string;
  primaryEmailAddressId?: string | null;
  emailAddresses?: ClerkEmail[];
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  web3Wallets?: ClerkWeb3Wallet[];
};

export type VerifiedClerkIdentity = {
  externalUserId: string;
  email: string;
  fullName: string;
  verifiedWeb3Wallets: Array<{ address: string; provider: string }>;
};
export type VerifiedClerkAdminIdentity = VerifiedClerkIdentity;

export type ClerkAdminAuthDependencies = {
  verify: (token: string, options: {
    secretKey: string;
    jwtKey?: string;
    authorizedParties?: string[];
  }) => Promise<ClerkTokenPayload>;
  loadUser: (userId: string, secretKey: string) => Promise<ClerkUser>;
};

function configuredAuthorizedParties() {
  const candidates = [
    process.env.CLERK_AUTHORIZED_PARTIES,
    process.env.DASHBOARD_ORIGIN,
    process.env.NEXT_PUBLIC_DASHBOARD_URL,
    process.env.WEB_ORIGIN,
    process.env.NEXT_PUBLIC_WEB_URL,
  ]
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  return [...new Set(candidates)];
}

function verifiedWeb3Wallets(user: ClerkUser) {
  return (Array.isArray(user.web3Wallets) ? user.web3Wallets : [])
    .filter((entry) => entry.verification?.status === "verified")
    .map((entry) => ({
      address: String(entry.web3Wallet || entry.walletAddress || entry.identifier || "").trim(),
      provider: String(entry.verification?.strategy || "clerk_web3").trim().slice(0, 60),
    }))
    .filter((entry) => Boolean(entry.address));
}

function verifiedPrimaryEmail(user: ClerkUser) {
  const emails = Array.isArray(user.emailAddresses) ? user.emailAddresses : [];
  const primary = emails.find((entry) => entry.id === user.primaryEmailAddressId);
  if (primary?.verification?.status !== "verified") return "";
  return String(primary.emailAddress || "").trim().toLowerCase();
}

const defaultDependencies: ClerkAdminAuthDependencies = {
  verify: (token, options) => verifyToken(token, options) as Promise<ClerkTokenPayload>,
  loadUser: async (userId, secretKey) => {
    const client = createClerkClient({ secretKey });
    return client.users.getUser(userId) as Promise<ClerkUser>;
  },
};

const safeVerificationFailureReasons = new Set([
  "token-expired",
  "token-invalid",
  "token-invalid-algorithm",
  "token-invalid-authorized-parties",
  "token-invalid-signature",
  "token-not-active-yet",
  "token-iat-in-the-future",
  "token-verification-failed",
  "secret-key-invalid",
  "jwk-local-missing",
  "jwk-remote-failed-to-load",
  "jwk-remote-invalid",
  "jwk-remote-missing",
  "jwk-failed-to-resolve",
  "jwk-kid-mismatch",
]);

export async function resolveVerifiedClerkIdentity(
  req: Request,
  dependencies: ClerkAdminAuthDependencies = defaultDependencies,
): Promise<
  | { ok: true; identity: VerifiedClerkAdminIdentity }
  | { ok: false; status: 401 | 403 | 503; reason: string }
> {
  const secretKey = String(process.env.CLERK_SECRET_KEY || "").trim();
  if (!secretKey) return { ok: false, status: 503, reason: "clerk_verification_not_configured" };

  const parties = configuredAuthorizedParties();
  if (process.env.NODE_ENV === "production" && parties.length === 0) {
    return { ok: false, status: 503, reason: "clerk_authorized_parties_not_configured" };
  }

  const match = /^Bearer\s+([^\s]+)$/i.exec(req.headers.get("authorization") || "");
  const token = match?.[1] || "";
  if (!token) return { ok: false, status: 401, reason: "unauthorized" };

  let stage: "verify_token" | "load_user" = "verify_token";
  try {
    const payload = await dependencies.verify(token, {
      secretKey,
      ...(String(process.env.CLERK_JWT_KEY || "").trim()
        ? { jwtKey: String(process.env.CLERK_JWT_KEY).trim() }
        : {}),
      ...(parties.length ? { authorizedParties: parties } : {}),
    });
    const userId = String(payload.sub || "").trim();
    if (!userId) return { ok: false, status: 401, reason: "unauthorized" };

    stage = "load_user";
    const user = await dependencies.loadUser(userId, secretKey);
    if (!user || user.id !== userId) return { ok: false, status: 401, reason: "unauthorized" };
    const email = verifiedPrimaryEmail(user);
    if (!email) return { ok: false, status: 403, reason: "clerk_email_unverified" };
    const fullName = String(
      user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || email.split("@")[0],
    ).trim().slice(0, 160);
    return {
      ok: true,
      identity: {
        externalUserId: userId,
        email,
        fullName,
        verifiedWeb3Wallets: verifiedWeb3Wallets(user),
      },
    };
  } catch (error) {
    const candidateReason = error && typeof error === "object" && "reason" in error ? error.reason : undefined;
    const reason = typeof candidateReason === "string" && safeVerificationFailureReasons.has(candidateReason)
      ? candidateReason
      : "unknown";
    // Log only bounded diagnostic categories, never SDK messages, claims, identities, or credentials.
    console.warn("[clerk_verification_failed]", JSON.stringify({ stage, reason }));
    return { ok: false, status: 401, reason: "unauthorized" };
  }
}

export const resolveVerifiedClerkAdminIdentity = resolveVerifiedClerkIdentity;
