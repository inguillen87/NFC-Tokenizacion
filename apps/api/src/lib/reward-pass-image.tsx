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
    margin: 4,
    width: 720,
    color: { dark: "#020617", light: "#ffffff" },
  });
  const customerName = firstName(input.consumerName);
  const rewardTitle = truncate(input.rewardTitle, 62);
  const brandName = truncate(input.brandName || "nexID Partner", 34);
  const state = statusLabel(input.status);
  const phoneLabel = input.phoneLast4 ? `**** ${input.phoneLast4}` : "teléfono verificado";
  const panel = "linear-gradient(135deg, rgba(8,28,49,.96), rgba(4,13,29,.92))";
  const border = "1px solid rgba(103,232,249,.22)";

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
            "radial-gradient(circle at 12% 0%, rgba(34,211,238,.26), transparent 34%), radial-gradient(circle at 96% 12%, rgba(45,212,191,.18), transparent 30%), linear-gradient(145deg, #010712 0%, #071426 48%, #030712 100%)",
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
              "linear-gradient(180deg, rgba(15,23,42,.68), rgba(2,6,23,.94)), radial-gradient(circle at 50% -5%, rgba(34,211,238,.12), transparent 44%)",
            boxShadow: "0 36px 120px rgba(0,0,0,.46)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 76,
            right: 76,
            top: 70,
            height: 2,
            background: "linear-gradient(90deg, transparent, rgba(103,232,249,.78), rgba(45,212,191,.78), transparent)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -120,
            top: 12,
            width: 480,
            height: 480,
            borderRadius: 999,
            border: "1px solid rgba(34,211,238,.15)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -46,
            top: 94,
            width: 340,
            height: 340,
            borderRadius: 999,
            border: "1px solid rgba(34,211,238,.11)",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: "80px 72px 56px",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              minHeight: 170,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "24px 28px",
              borderRadius: 34,
              border: "1px solid rgba(148,163,184,.18)",
              background:
                "linear-gradient(135deg, rgba(15,23,42,.88), rgba(8,47,73,.52)), radial-gradient(circle at 0% 0%, rgba(34,211,238,.14), transparent 46%)",
              boxShadow: "0 24px 80px rgba(0,0,0,.22)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <div
                style={{
                  width: 116,
                  height: 116,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 28,
                  border: "1px solid rgba(103,232,249,.30)",
                  background: "rgba(2,6,23,.30)",
                  overflow: "hidden",
                }}
              >
                <img src={input.logoUrl} width="104" height="104" alt="nexID" style={{ objectFit: "contain" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: 7, color: "#2dd4bf" }}>NEXID VERIFIED CRM</span>
                <span style={{ marginTop: 8, fontSize: 36, fontWeight: 900, lineHeight: 1 }}>Reward Pass</span>
                <span style={{ marginTop: 8, fontSize: 20, color: "#67e8f9", fontWeight: 800 }}>{brandName}</span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 22px",
                borderRadius: 999,
                border: "1px solid rgba(45,212,191,.38)",
                background: "rgba(5,46,22,.42)",
                color: "#99f6e4",
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              <span style={{ width: 13, height: 13, borderRadius: 999, background: "#34d399" }} />
              {state}
            </div>
          </div>

          <div style={{ marginTop: 42, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <div style={{ width: 112, height: 1, background: "linear-gradient(90deg, transparent, #22d3ee)" }} />
              <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: 8, color: "#2dd4bf" }}>BENEFICIO ACTIVADO</span>
              <div style={{ width: 112, height: 1, background: "linear-gradient(90deg, #22d3ee, transparent)" }} />
            </div>
            <span style={{ marginTop: 26, textAlign: "center", fontSize: 52, fontWeight: 900, lineHeight: 1.02, letterSpacing: -1.2 }}>
              {customerName}, tu premio esta listo.
            </span>
            <span style={{ marginTop: 16, width: 590, textAlign: "center", fontSize: 21, lineHeight: 1.32, color: "#cbd5e1" }}>
              Mostrá este pase al llegar. El staff valida QR, código y sello nexID.
            </span>
          </div>

          <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                minHeight: 138,
                padding: "25px 26px",
                borderRadius: 30,
                border,
                background: panel,
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
                  fontSize: 34,
                  fontWeight: 900,
                }}
              >
                %
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: 6, color: "#2dd4bf" }}>BENEFICIO RESERVADO</span>
                <span style={{ marginTop: 8, fontSize: 34, fontWeight: 900, lineHeight: 1.08 }}>{rewardTitle}</span>
                <span style={{ marginTop: 10, fontSize: 20, color: "#94a3b8" }}>Emitido por tap verificado post-compra</span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 24,
              minHeight: 170,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 32,
              border: "1px solid rgba(34,211,238,.52)",
              background: "linear-gradient(135deg, rgba(3,7,18,.98), rgba(8,47,73,.70))",
              boxShadow: "0 20px 70px rgba(8,145,178,.12)",
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: 8, color: "#94a3b8" }}>CODIGO DE CANJE</span>
            <span style={{ marginTop: 18, fontSize: 64, fontWeight: 900, letterSpacing: 11, color: "#67e8f9" }}>
              {formatCode(input.code)}
            </span>
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 15, color: "#94a3b8", fontWeight: 800 }}>Sello nexID</span>
              <span style={{ fontSize: 17, color: "#f8fafc", fontWeight: 900, letterSpacing: 2 }}>{input.seal || "NEXID"}</span>
            </div>
          </div>

          <div
            style={{
              marginTop: 28,
              display: "flex",
              alignItems: "stretch",
              justifyContent: "center",
              gap: 28,
            }}
          >
            <div
              style={{
                width: 326,
                minHeight: 386,
                display: "flex",
                alignItems: "center",
                flexDirection: "column",
                justifyContent: "space-between",
                borderRadius: 34,
                background: "#ffffff",
                border: "10px solid #67e8f9",
                boxShadow: "0 22px 70px rgba(34,211,238,.20)",
                padding: "20px 20px 18px",
              }}
            >
              <img src={qrDataUrl} width="268" height="268" alt="QR voucher nexID" />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#020617", letterSpacing: 3 }}>VALIDAR STAFF</span>
                <span style={{ marginTop: 5, fontSize: 15, color: "#334155", fontWeight: 800 }}>nexid.lat/s/...</span>
              </div>
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "24px 24px",
                  borderRadius: 28,
                  border,
                  background: "rgba(15,23,42,.78)",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: 5, color: "#94a3b8" }}>VALIDACION EN COMERCIO</span>
                <span style={{ marginTop: 10, fontSize: 28, fontWeight: 900, lineHeight: 1.08 }}>QR staff o código manual</span>
                <span style={{ marginTop: 12, width: 370, fontSize: 17, lineHeight: 1.34, color: "#cbd5e1" }}>
                  Confirma teléfono {phoneLabel}, código y sello antes de entregar la experiencia.
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "22px 24px",
                  borderRadius: 28,
                  border: "1px solid rgba(52,211,153,.28)",
                  background: "rgba(6,78,59,.34)",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: 5, color: "#86efac" }}>VALIDO HASTA</span>
                <span style={{ marginTop: 10, fontSize: 26, fontWeight: 900 }}>{input.expiresAt}</span>
                <span style={{ marginTop: 8, fontSize: 17, lineHeight: 1.25, color: "#bbf7d0" }}>Recomendado: mostrar WhatsApp o email al staff.</span>
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
            <span>nexID Reward Pass</span>
            <span>Trust - Experience - CRM</span>
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
