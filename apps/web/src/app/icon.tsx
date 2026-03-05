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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg,#0b1220,#111b30)",
          borderRadius: 120,
        }}
      >
        <div style={{ position: "relative", width: 320, height: 320, borderRadius: 72, background: "rgba(47,225,195,.10)", border: "1px solid rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="320" height="320" viewBox="0 0 160 160" fill="none">
            <path d="M48 102V58H58L85 91V58H96V102H86L59 69V102H48Z" fill="#E2E8F0" />
            <path d="M107 58H118V102H107V58Z" fill="#2FE1C3" />
          </svg>
          <div style={{ position: "absolute", right: 56, top: 44, width: 22, height: 22, borderRadius: 999, background: "#2FE1C3", boxShadow: "0 0 30px rgba(47,225,195,.7)" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
