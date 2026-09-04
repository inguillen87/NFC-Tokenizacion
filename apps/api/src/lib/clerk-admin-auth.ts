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
type ClerkExternalAccount = {
  provider?: string | null;
  emailAddress?: string | null;
  verification?: { status?: string | null } | null;
};
type ClerkUser = {
  id: string;
  primaryEmailAddressId?: string | null;
  emailAddresses?: ClerkEmail[];
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  web3Wallets?: ClerkWeb3Wallet[];
  externalAccounts?: ClerkExternalAccount[];
};

export type VerifiedClerkIdentity = {
  externalUserId: string;
  email: string;
  fullName: string;
  verifiedOAuthProviders: string[];
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
  // Production must name every Clerk token origin explicitly. A public-web
  // URL alone is not sufficient because operator tokens are issued by the
  // separate dashboard origin (app.nexid.lat).
  const explicit = String(process.env.CLERK_AUTHORIZED_PARTIES || "")
    .split(",")
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
  if (process.env.NODE_ENV === "production") return [...new Set(explicit)];

  const developmentFallbacks = [
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
  return [...new Set([...explicit, ...developmentFallbacks])];
}

function clerkVerificationFailure(error: unknown): {
  status: 401 | 503;
  reason: string;
  diagnostic: string;
} {
  const diagnostic = String((error as { reason?: unknown } | null)?.reason || "").trim();
  switch (diagnostic) {
    case "token-invalid-authorized-parties":
      return { status: 401, reason: "clerk_authorized_party_invalid", diagnostic };
    case "token-expired":
    case "token-not-active-yet":
    case "token-iat-in-the-future":
      return { status: 401, reason: "clerk_session_expired", diagnostic };
    case "secret-key-invalid":
    case "jwk-local-missing":
    case "jwk-remote-failed-to-load":
    case "jwk-remote-invalid":
    case "jwk-remote-missing":
    case "jwk-failed-to-resolve":
    case "jwk-kid-mismatch":
      return { status: 503, reason: "clerk_verification_unavailable", diagnostic };
    default:
      return { status: 401, reason: "unauthorized", diagnostic: diagnostic || "unclassified" };
  }
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

function verifiedOAuthProviders(user: ClerkUser, primaryEmail: string) {
  return [...new Set(
    (Array.isArray(user.externalAccounts) ? user.externalAccounts : [])
      .filter((entry) => entry.verification?.status === "verified")
      .filter((entry) => {
        const externalEmail = String(entry.emailAddress || "").trim().toLowerCase();
        return !externalEmail || externalEmail === primaryEmail;
      })
      .map((entry) => String(entry.provider || "").trim().toLowerCase().replace(/^oauth_/, ""))
      .filter(Boolean),
  )];
}

const defaultDependencies: ClerkAdminAuthDependencies = {
  verify: (token, options) => verifyToken(token, options) as Promise<ClerkTokenPayload>,
  loadUser: async (userId, secretKey) => {
    const client = createClerkClient({ secretKey });
    return client.users.getUser(userId) as Promise<ClerkUser>;
  },
};

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
        verifiedOAuthProviders: verifiedOAuthProviders(user, email),
        verifiedWeb3Wallets: verifiedWeb3Wallets(user),
      },
    };
  } catch (error) {
    const failure = clerkVerificationFailure(error);
    if (process.env.NODE_ENV !== "test") {
      console.warn("[clerk_auth_audit]", JSON.stringify({
        event: "clerk_token_rejected",
        reason: failure.diagnostic,
        requestPath: (() => {
          try {
            return new URL(req.url).pathname;
          } catch {
            return "unknown";
          }
        })(),
        authorizedPartyCount: parties.length,
      }));
    }
    return { ok: false, status: failure.status, reason: failure.reason };
  }
}

export const resolveVerifiedClerkAdminIdentity = resolveVerifiedClerkIdentity;
