import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage({
  searchParams,
}: {
  searchParams?: { locale?: string };
}) {
  const locale = String(searchParams?.locale || "es-AR");
  const title =
    locale === "en"
      ? "Tap · Verify · Trust"
      : locale === "pt-BR"
      ? "Toque · Verifique · Confie"
      : "Tocá · Verificá · Confiá";
  const subtitle =
    locale === "en"
      ? "NFC anti-fraud + premium traceability for brands."
      : locale === "pt-BR"
      ? "Antifraude NFC + rastreabilidade premium para marcas."
      : "Antifraude NFC + trazabilidad premium para marcas.";

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
          background: "radial-gradient(circle at 18% 16%, rgba(34,211,238,.22), transparent 42%), linear-gradient(160deg,#020617,#0b1e47)",
          color: "#e2e8f0",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 2, textTransform: "uppercase", color: "#67e8f9" }}>nexID Web</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.02 }}>{title}</div>
          <p style={{ marginTop: 18, fontSize: 32, color: "#cbd5e1" }}>{subtitle}</p>
        </div>
        <div style={{ fontSize: 24, color: "#94a3b8" }}>nexid.lat</div>
      </div>
    ),
    { ...size }
  );
}
