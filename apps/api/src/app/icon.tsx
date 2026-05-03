import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(145deg,#050816,#0f172a 55%,#12304f)",
          borderRadius: 116,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 62,
            borderRadius: 84,
            background: "linear-gradient(145deg,rgba(47,225,195,.20),rgba(96,165,250,.14))",
            border: "2px solid rgba(255,255,255,.10)",
            boxShadow: "0 38px 90px rgba(0,0,0,.42)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 128,
            top: 116,
            width: 44,
            height: 44,
            borderRadius: 999,
            background: "#2fe1c3",
            boxShadow: "0 0 54px rgba(47,225,195,.75)",
          }}
        />
        <div style={{ display: "flex", alignItems: "baseline", color: "#e2e8f0", fontSize: 116, fontWeight: 900, letterSpacing: -5 }}>
          nex<span style={{ color: "#2fe1c3" }}>ID</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
