import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
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
          background: "radial-gradient(circle at 10% 10%, rgba(47,225,195,.28), transparent 40%), linear-gradient(160deg,#020617,#0b1e47)",
          color: "#e2e8f0",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 2, textTransform: "uppercase", color: "#67e8f9" }}>nexID API</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02 }}>SUN Validation</div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02 }}>+ Tokenization</div>
          <p style={{ marginTop: 18, fontSize: 32, color: "#cbd5e1" }}>Identity Gateway · Polygon-ready traceability.</p>
        </div>
        <div style={{ fontSize: 24, color: "#94a3b8" }}>api.nexid.lat</div>
      </div>
    ),
    { ...size }
  );
}
