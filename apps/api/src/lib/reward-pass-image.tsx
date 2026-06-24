import { ImageResponse } from "next/og";
import QRCode from "qrcode";

function clean(value: unknown) {
  return String(value || "").trim();
}

function firstName(value: unknown) {
  const name = clean(value);
  return name ? name.split(/\s+/)[0] : "Cliente";
}

function truncate(value: unknown, max: number) {
  const text = clean(value);
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function formatCode(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function statusLabel(value: string) {
  const status = clean(value).toLowerCase();
  if (status === "redeemed") return "Canjeado";
  if (status === "expired") return "Vencido";
  if (status === "cancelled") return "Pausado";
  return "Activo";
}

export async function renderRewardPassImage(input: {
  code: string;
  seal: string;
  brandName: string;
  rewardTitle: string;
  consumerName: string;
  phoneLast4: string;
  expiresAt: string;
  status: string;
  validationUrl: string;
  logoUrl: string;
}) {
  const qrDataUrl = await QRCode.toDataURL(input.validationUrl, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 620,
    color: { dark: "#020617", light: "#ffffff" },
  });
  const customerName = firstName(input.consumerName);
  const rewardTitle = truncate(input.rewardTitle, 58);
  const brandName = truncate(input.brandName || "nexID Partner", 34);
  const state = statusLabel(input.status);
  const phoneLabel = input.phoneLast4 ? `**** ${input.phoneLast4}` : "telefono verificado";

  const subtlePanel = "linear-gradient(135deg, rgba(8,28,49,.96), rgba(4,13,29,.92))";
  const glassBorder = "1px solid rgba(103,232,249,.22)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "900px",
          height: "1400px",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          color: "#f8fafc",
          background:
            "radial-gradient(circle at 15% 3%, rgba(34,211,238,.22), transparent 34%), radial-gradient(circle at 95% 18%, rgba(45,212,191,.16), transparent 28%), linear-gradient(145deg, #010712 0%, #061226 45%, #030712 100%)",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 30,
            borderRadius: 54,
            border: "1px solid rgba(148,163,184,.20)",
            background:
              "linear-gradient(180deg, rgba(15,23,42,.70), rgba(2,6,23,.94)), radial-gradient(circle at 50% -5%, rgba(34,211,238,.12), transparent 44%)",
            boxShadow: "0 36px 120px rgba(0,0,0,.46)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -110,
            top: 20,
            width: 470,
            height: 470,
            borderRadius: 999,
            border: "1px solid rgba(34,211,238,.18)",
            opacity: 0.85,
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -50,
            top: 92,
            width: 350,
            height: 350,
            borderRadius: 999,
            border: "1px solid rgba(34,211,238,.13)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 345,
            right: 0,
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(34,211,238,.55), transparent)",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: "68px 72px 52px",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: 164,
                height: 164,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 42,
                border: "1px solid rgba(103,232,249,.38)",
                background: "linear-gradient(145deg, rgba(8,47,73,.98), rgba(15,23,42,.94))",
                boxShadow: "0 20px 70px rgba(34,211,238,.16)",
                overflow: "hidden",
              }}
            >
              <img src={input.logoUrl} width="164" height="164" alt="nexID" style={{ objectFit: "cover" }} />
            </div>
            <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 22 }}>
              <div style={{ width: 120, height: 1, background: "linear-gradient(90deg, transparent, #22d3ee)" }} />
              <span style={{ fontSize: 19, fontWeight: 900, letterSpacing: 9, color: "#2dd4bf" }}>REWARD PASS</span>
              <div style={{ width: 120, height: 1, background: "linear-gradient(90deg, #22d3ee, transparent)" }} />
            </div>
            <span style={{ marginTop: 28, fontSize: 68, fontWeight: 950, lineHeight: 0.98, letterSpacing: -2 }}>
              Beneficio activado
            </span>
            <div
              style={{
                marginTop: 24,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 24px",
                borderRadius: 999,
                border: "1px solid rgba(45,212,191,.38)",
                background: "rgba(5,46,22,.42)",
                color: "#99f6e4",
                fontSize: 20,
                fontWeight: 950,
                letterSpacing: 4,
                textTransform: "uppercase",
              }}
            >
              <span style={{ width: 13, height: 13, borderRadius: 999, background: "#34d399" }} />
              {state}
            </div>
          </div>

          <div style={{ marginTop: 46, display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 26,
                minHeight: 118,
                padding: "24px 26px",
                borderRadius: 28,
                border: glassBorder,
                background: subtlePanel,
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(45,212,191,.42)",
                  color: "#67e8f9",
                  fontSize: 40,
                  fontWeight: 900,
                }}
              >
                +
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: 6, color: "#2dd4bf" }}>PARA</span>
                <span style={{ marginTop: 7, fontSize: 38, fontWeight: 950 }}>{customerName}</span>
                <span style={{ marginTop: 4, fontSize: 20, color: "#cbd5e1" }}>Miembro verificado nexID</span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 26,
                minHeight: 134,
                padding: "24px 26px",
                borderRadius: 28,
                border: glassBorder,
                background: subtlePanel,
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(45,212,191,.42)",
                  color: "#67e8f9",
                  fontSize: 42,
                  fontWeight: 900,
                }}
              >
                ◇
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: 6, color: "#2dd4bf" }}>TU BENEFICIO</span>
                <span style={{ marginTop: 8, fontSize: 34, fontWeight: 950, lineHeight: 1.05 }}>{rewardTitle}</span>
                <span style={{ marginTop: 10, fontSize: 21, color: "#67e8f9" }}>{brandName}</span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 24,
              minHeight: 164,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 30,
              border: "1px solid rgba(34,211,238,.48)",
              background: "linear-gradient(135deg, rgba(3,7,18,.98), rgba(8,47,73,.66))",
              boxShadow: "0 20px 70px rgba(8,145,178,.10)",
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: 8, color: "#94a3b8" }}>CODIGO DE CANJE</span>
            <span style={{ marginTop: 18, fontSize: 61, fontWeight: 950, letterSpacing: 10, color: "#67e8f9" }}>
              {formatCode(input.code)}
            </span>
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 15, color: "#94a3b8", fontWeight: 800 }}>Sello de seguridad</span>
              <span style={{ fontSize: 17, color: "#f8fafc", fontWeight: 950, letterSpacing: 2 }}>{input.seal || "NEXID"}</span>
            </div>
          </div>

          <div
            style={{
              marginTop: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 34,
            }}
          >
            <div
              style={{
                width: 276,
                height: 276,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 31,
                background: "#ffffff",
                border: "8px solid #67e8f9",
                boxShadow: "0 20px 60px rgba(34,211,238,.18)",
              }}
            >
              <img src={qrDataUrl} width="238" height="238" alt="QR voucher nexID" />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "20px 22px",
                  borderRadius: 24,
                  border: glassBorder,
                  background: "rgba(15,23,42,.78)",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: 5, color: "#94a3b8" }}>VALIDACION</span>
                <span style={{ marginTop: 7, fontSize: 24, fontWeight: 950, lineHeight: 1.08 }}>Escanear QR o mostrar codigo</span>
                <span style={{ marginTop: 10, fontSize: 17, lineHeight: 1.25, color: "#cbd5e1" }}>
                  El comercio valida telefono {phoneLabel}, codigo y sello en nexID CRM.
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "18px 20px",
                  borderRadius: 24,
                  border: "1px solid rgba(52,211,153,.28)",
                  background: "rgba(6,78,59,.34)",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: 5, color: "#86efac" }}>VALIDO HASTA</span>
                <span style={{ marginTop: 8, fontSize: 22, fontWeight: 950 }}>{input.expiresAt}</span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#94a3b8",
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            <span>nexID Loyalty</span>
            <span>Trust · Experience · CRM</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 900,
      height: 1400,
    },
  );
}
