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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg,#0b1220,#111b30)",
          borderRadius: 40,
        }}
      >
        <svg width="126" height="126" viewBox="0 0 160 160" fill="none">
          <path d="M48 102V58H58L85 91V58H96V102H86L59 69V102H48Z" fill="#E2E8F0" />
          <path d="M107 58H118V102H107V58Z" fill="#2FE1C3" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
