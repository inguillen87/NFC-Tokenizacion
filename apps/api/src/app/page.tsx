export default function Home() {
  return (
    <main style={{ fontFamily: "Inter, system-ui, sans-serif", minHeight: "100vh", background: "#020617", color: "#e2e8f0", padding: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, background: "rgba(15,23,42,.7)", padding: 24 }}>
        <p style={{ fontSize: 12, letterSpacing: ".2em", textTransform: "uppercase", color: "#22d3ee" }}>Inmovar Identity Rail · API Gateway</p>
        <h1 style={{ marginTop: 8, fontSize: 32, color: "#fff" }}>Authentication backend online</h1>
        <p style={{ marginTop: 8, color: "#94a3b8" }}>
          This domain exposes API surfaces for SUN validation, batch lifecycle and admin operations. For the full product platform and investor-grade landing use the web app.
        </p>

        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="/health/" style={{ border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, padding: "10px 14px", color: "#fff", textDecoration: "none" }}>/health/</a>
          <a href="/sun/" style={{ border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, padding: "10px 14px", color: "#fff", textDecoration: "none" }}>/sun/</a>
          <a href="https://dashboard.tudominio.com" style={{ border: "1px solid rgba(34,211,238,.4)", borderRadius: 10, padding: "10px 14px", color: "#22d3ee", textDecoration: "none" }}>Dashboard</a>
          <a href="https://www.tudominio.com" style={{ border: "1px solid rgba(34,211,238,.4)", borderRadius: 10, padding: "10px 14px", color: "#22d3ee", textDecoration: "none" }}>Landing</a>
        </div>

        <ul style={{ marginTop: 18, color: "#94a3b8", lineHeight: 1.7 }}>
          <li>• /admin/tenants/</li>
          <li>• /admin/batches/</li>
          <li>• /admin/batches/:bid/import-manifest/</li>
          <li>• /admin/tags/activate/</li>
          <li>• /admin/batches/:bid/revoke/</li>
        </ul>

        <p style={{ marginTop: 14, fontSize: 13, color: "#64748b" }}>
          Tip: in Vercel, set your primary project root to <strong>apps/web</strong> for public experience and keep this API in a dedicated project rooted at <strong>apps/api</strong>.
        </p>
      </div>
    </main>
  );
}
