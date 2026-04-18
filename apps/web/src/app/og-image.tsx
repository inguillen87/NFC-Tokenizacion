import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage({
  searchParams,
}: {
  searchParams?: { locale?: string; surface?: string; campaign?: string };
}) {
  const locale = String(searchParams?.locale || "es-AR");
  const surface = String(searchParams?.surface || "home");
  const campaign = String(searchParams?.campaign || "default");
  const campaignBadge =
    campaign === "reseller"
      ? "Campaign · Reseller"
      : campaign === "investor"
      ? "Campaign · Investor"
      : campaign === "enterprise"
      ? "Campaign · Enterprise"
      : "Campaign · Core";
  const background =
    campaign === "reseller"
      ? "radial-gradient(circle at 18% 16%, rgba(168,85,247,.24), transparent 42%), linear-gradient(160deg,#020617,#1e1b4b)"
      : campaign === "investor"
      ? "radial-gradient(circle at 18% 16%, rgba(251,191,36,.22), transparent 42%), linear-gradient(160deg,#020617,#1f2937)"
      : campaign === "enterprise"
      ? "radial-gradient(circle at 18% 16%, rgba(34,197,94,.22), transparent 42%), linear-gradient(160deg,#020617,#0f172a)"
      : "radial-gradient(circle at 18% 16%, rgba(34,211,238,.22), transparent 42%), linear-gradient(160deg,#020617,#0b1e47)";
  const copy =
    surface === "sun"
      ? locale === "en"
        ? { title: "SUN Product Passport", subtitle: "Verify authenticity, provenance and lifecycle in one tap." }
        : locale === "pt-BR"
        ? { title: "Passaporte SUN", subtitle: "Verifique autenticidade, proveniência e ciclo de vida em um toque." }
        : { title: "Passport SUN", subtitle: "Verificá autenticidad, provenance y lifecycle en un toque." }
      : surface === "pricing"
      ? locale === "en"
        ? { title: "Pricing by Risk", subtitle: "Basic vs Secure vs Enterprise with clear rollout economics." }
        : locale === "pt-BR"
        ? { title: "Pricing por Risco", subtitle: "Basic vs Secure vs Enterprise com economia clara de rollout." }
        : { title: "Pricing por Riesgo", subtitle: "Basic vs Secure vs Enterprise con economía clara de rollout." }
      : surface === "demo-lab"
      ? locale === "en"
        ? { title: "Demo Lab", subtitle: "Live storytelling for operators, buyers and investors." }
        : locale === "pt-BR"
        ? { title: "Demo Lab", subtitle: "Storytelling ao vivo para operadores, compradores e investidores." }
        : { title: "Demo Lab", subtitle: "Storytelling en vivo para operadores, buyers e inversores." }
      : locale === "en"
      ? { title: "Tap · Verify · Trust", subtitle: "NFC anti-fraud + premium traceability for brands." }
      : locale === "pt-BR"
      ? { title: "Toque · Verifique · Confie", subtitle: "Antifraude NFC + rastreabilidade premium para marcas." }
      : { title: "Tocá · Verificá · Confiá", subtitle: "Antifraude NFC + trazabilidad premium para marcas." };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px 64px",
          background,
          color: "#e2e8f0",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 28, letterSpacing: 2, textTransform: "uppercase", color: "#67e8f9" }}>nexID Web</div>
          <div style={{ fontSize: 20, color: "#cbd5e1" }}>{campaignBadge}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.02 }}>{copy.title}</div>
          <p style={{ marginTop: 18, fontSize: 32, color: "#cbd5e1" }}>{copy.subtitle}</p>
        </div>
        <div style={{ fontSize: 24, color: "#94a3b8" }}>nexid.lat</div>
      </div>
    ),
    { ...size }
  );
}
