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

export default async function Home() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") || "https";
  const currentOrigin = host ? `${protocol}://${host}` : null;

  const targetOrigin = normalizeOrigin(configuredWebUrl);

  if (targetOrigin && currentOrigin && targetOrigin !== currentOrigin) {
    redirect(configuredWebUrl);
  }

  return (
    <main style={{ fontFamily: "Inter, system-ui, sans-serif", minHeight: "100vh", background: "#020617", color: "#e2e8f0", padding: 24 }}>
      <div style={{ maxWidth: 920, margin: "0 auto", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, background: "rgba(15,23,42,.7)", padding: 24 }}>
        <p style={{ fontSize: 12, letterSpacing: ".2em", textTransform: "uppercase", color: "#22d3ee" }}>nexID · API Gateway</p>
        <h1 style={{ marginTop: 8, fontSize: 32, color: "#fff" }}>Authentication backend online</h1>
        <p style={{ marginTop: 8, color: "#94a3b8" }}>
          This deployment is the backend gateway for SUN validation and secure product authentication services.
        </p>

        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="/health/" style={{ border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, padding: "10px 14px", color: "#fff", textDecoration: "none" }}>/health/</a>
          <a href="/sun/" style={{ border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, padding: "10px 14px", color: "#fff", textDecoration: "none" }}>/sun/</a>
          <a href={configuredWebUrl} style={{ border: "1px solid rgba(34,211,238,.4)", borderRadius: 10, padding: "10px 14px", color: "#22d3ee", textDecoration: "none" }}>Open platform</a>
        </div>

        <p style={{ marginTop: 16, fontSize: 13, color: "#94a3b8" }}>
          Set <strong>WEB_APP_URL</strong> in Vercel to the public landing (for example <code>https://nexid.lat</code>) and this root will redirect there when the current host is different.
        </p>
      </div>
    </main>
  );
}
