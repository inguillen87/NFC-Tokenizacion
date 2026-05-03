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
          background:
            "radial-gradient(circle at 12% 12%, rgba(47,225,195,.32), transparent 34%), radial-gradient(circle at 88% 20%, rgba(96,165,250,.30), transparent 34%), linear-gradient(145deg,#020617,#081526 46%,#111827)",
          color: "#e2e8f0",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          justifyContent: "space-between",
          padding: "56px 68px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "baseline", color: "#e2e8f0", fontSize: 48, fontWeight: 900, letterSpacing: -1 }}>
            nex<span style={{ color: "#2fe1c3" }}>ID</span>
          </div>
          <div
            style={{
              border: "1px solid rgba(103,232,249,.35)",
              borderRadius: 999,
              color: "#67e8f9",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 3,
              padding: "12px 18px",
              textTransform: "uppercase",
            }}
          >
            API Gateway
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 930 }}>
          <div style={{ color: "#f8fafc", fontSize: 88, fontWeight: 900, letterSpacing: -4, lineHeight: 0.98 }}>
            SUN validation and tokenization for physical products.
          </div>
          <p style={{ color: "#b6c7db", fontSize: 31, lineHeight: 1.35, margin: "26px 0 0" }}>
            NFC anti-replay diagnostics, tenant operations and Polygon-ready digital product passports.
          </p>
        </div>

        <div style={{ color: "#94a3b8", display: "flex", fontSize: 24, justifyContent: "space-between" }}>
          <span>api.nexid.lat</span>
          <span>NTAG 424 DNA TT - Polygon Amoy - Tenant API</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
