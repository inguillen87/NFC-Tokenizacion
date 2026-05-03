import { headers } from "next/headers";
import { redirect } from "next/navigation";

const configuredWebUrl = process.env.WEB_APP_URL || process.env.NEXT_PUBLIC_WEB_APP_URL || "https://nexid.lat";

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function shouldAutoRedirect(hostname: string | null) {
  if (!hostname) return false;
  return hostname.toLowerCase().startsWith("api.");
}

const linkStyle = {
  alignItems: "center",
  border: "1px solid rgba(103,232,249,.28)",
  borderRadius: 14,
  color: "#e2faff",
  display: "inline-flex",
  fontSize: 14,
  fontWeight: 800,
  justifyContent: "center",
  minHeight: 44,
  padding: "0 16px",
  textDecoration: "none",
} as const;

const cardStyle = {
  background: "rgba(15,23,42,.68)",
  border: "1px solid rgba(148,163,184,.18)",
  borderRadius: 18,
  padding: 18,
} as const;

export default async function Home() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") || "https";
  const currentOrigin = host ? `${protocol}://${host}` : null;

  const targetOrigin = normalizeOrigin(configuredWebUrl);
  const currentHostOnly = host?.split(":")[0] || null;

  if (shouldAutoRedirect(currentHostOnly) && targetOrigin && currentOrigin && targetOrigin !== currentOrigin) {
    redirect(configuredWebUrl);
  }

  return (
    <main
      style={{
        background:
          "radial-gradient(circle at 20% 0%, rgba(47,225,195,.22), transparent 34%), radial-gradient(circle at 86% 18%, rgba(96,165,250,.22), transparent 36%), linear-gradient(145deg,#020617,#07111f 46%,#0b1328)",
        color: "#e2e8f0",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <section
        style={{
          border: "1px solid rgba(148,163,184,.20)",
          borderRadius: 28,
          boxShadow: "0 24px 90px rgba(0,0,0,.32)",
          margin: "0 auto",
          maxWidth: 1060,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "rgba(2,6,23,.72)",
            borderBottom: "1px solid rgba(148,163,184,.18)",
            display: "flex",
            justifyContent: "space-between",
            padding: "20px 24px",
          }}
        >
          <img alt="nexID" src="/nexid-lockup-horizontal.svg" style={{ height: 54, maxWidth: "min(320px, 70vw)", objectFit: "contain" }} />
          <span
            style={{
              border: "1px solid rgba(45,212,191,.28)",
              borderRadius: 999,
              color: "#67e8f9",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: ".16em",
              padding: "8px 12px",
              textTransform: "uppercase",
            }}
          >
            Online
          </span>
        </div>

        <div style={{ background: "rgba(15,23,42,.52)", display: "grid", gap: 24, padding: "34px 24px 28px" }}>
          <div style={{ maxWidth: 760 }}>
            <p style={{ color: "#67e8f9", fontSize: 12, fontWeight: 900, letterSpacing: ".22em", margin: 0, textTransform: "uppercase" }}>
              API Gateway
            </p>
            <h1 style={{ color: "#f8fafc", fontSize: "clamp(38px, 7vw, 78px)", lineHeight: 1, margin: "14px 0 0" }}>
              nexID validation layer is live.
            </h1>
            <p style={{ color: "#b6c7db", fontSize: 17, lineHeight: 1.7, margin: "18px 0 0", maxWidth: 720 }}>
              Backend for SUN validation, anti-replay diagnostics, tenant operations, loyalty events and Polygon Amoy tokenization.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <a href="/health/" style={{ ...linkStyle, background: "rgba(45,212,191,.14)" }}>
              Health check
            </a>
            <a href="/sun/" style={{ ...linkStyle, background: "rgba(14,165,233,.13)" }}>
              SUN endpoint
            </a>
            <a href="/admin/polygon/wallet" style={{ ...linkStyle, background: "rgba(139,92,246,.13)" }}>
              Polygon readiness
            </a>
            <a href={configuredWebUrl} style={{ ...linkStyle, background: "#22d3ee", borderColor: "#22d3ee", color: "#03131f" }}>
              Open platform
            </a>
          </div>

          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            <article style={cardStyle}>
              <p style={{ color: "#67e8f9", fontSize: 11, fontWeight: 900, letterSpacing: ".18em", margin: 0, textTransform: "uppercase" }}>SUN</p>
              <h2 style={{ color: "#f8fafc", fontSize: 20, margin: "10px 0 0" }}>NTAG 424 DNA TT validation</h2>
              <p style={{ color: "#9fb1c6", fontSize: 14, lineHeight: 1.6, margin: "10px 0 0" }}>Valid, opened, replay and tamper signals are logged as auditable product events.</p>
            </article>
            <article style={cardStyle}>
              <p style={{ color: "#67e8f9", fontSize: 11, fontWeight: 900, letterSpacing: ".18em", margin: 0, textTransform: "uppercase" }}>Tenants</p>
              <h2 style={{ color: "#f8fafc", fontSize: 20, margin: "10px 0 0" }}>Manifest-driven onboarding</h2>
              <p style={{ color: "#9fb1c6", fontSize: 14, lineHeight: 1.6, margin: "10px 0 0" }}>Supplier CSV/TXT imports, batch governance and reseller-ready tenant operations.</p>
            </article>
            <article style={cardStyle}>
              <p style={{ color: "#67e8f9", fontSize: 11, fontWeight: 900, letterSpacing: ".18em", margin: 0, textTransform: "uppercase" }}>Tokenization</p>
              <h2 style={{ color: "#f8fafc", fontSize: 20, margin: "10px 0 0" }}>Polygon Amoy ready</h2>
              <p style={{ color: "#9fb1c6", fontSize: 14, lineHeight: 1.6, margin: "10px 0 0" }}>Minting uses hashed chip identity, explicit claim flows and contract readiness checks.</p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
