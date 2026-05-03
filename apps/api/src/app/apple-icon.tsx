import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(145deg,#050816,#0f172a 55%,#12304f)",
          borderRadius: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 22,
            borderRadius: 30,
            background: "linear-gradient(145deg,rgba(47,225,195,.20),rgba(96,165,250,.14))",
            border: "1px solid rgba(255,255,255,.12)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 43,
            top: 38,
            width: 15,
            height: 15,
            borderRadius: 999,
            background: "#2fe1c3",
            boxShadow: "0 0 22px rgba(47,225,195,.75)",
          }}
        />
        <div style={{ display: "flex", alignItems: "baseline", color: "#e2e8f0", fontSize: 38, fontWeight: 900, letterSpacing: -1 }}>
          nex<span style={{ color: "#2fe1c3" }}>ID</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
