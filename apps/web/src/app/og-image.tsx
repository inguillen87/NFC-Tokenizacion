import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Copy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  badge: string;
  proof: string;
};

function copyFor(input: { locale: string; surface: string; campaign: string }): Copy {
  const locale = input.locale === "en" ? "en" : input.locale === "pt-BR" ? "pt-BR" : "es-AR";

  if (input.surface === "sun") {
    if (locale === "en") {
      return {
        eyebrow: "Product Passport",
        title: "Verify the physical product before the next action.",
        subtitle: "SUN validation, tamper status, provenance and ownership in one mobile flow.",
        badge: "Fresh tap required",
        proof: "NFC + batch + UID",
      };
    }
    if (locale === "pt-BR") {
      return {
        eyebrow: "Passaporte do produto",
        title: "Valide o produto físico antes da próxima ação.",
        subtitle: "SUN, estado do selo, origem e ownership em um fluxo mobile.",
        badge: "Tap fresco obrigatório",
        proof: "NFC + lote + UID",
      };
    }
    return {
      eyebrow: "Pasaporte del producto",
      title: "Validá el producto físico antes de activar beneficios.",
      subtitle: "SUN, estado del sello, origen, garantía, ownership y marketplace en un flujo mobile.",
      badge: "Tap físico fresco",
      proof: "NFC + lote + UID",
    };
  }

  if (input.surface === "pricing") {
    return locale === "en"
      ? {
          eyebrow: "Commercial rollout",
          title: "Security packaging by risk, volume and channel.",
          subtitle: "Basic, Secure and Enterprise plans for brands, resellers and operators.",
          badge: "Pilot to rollout",
          proof: "Hardware + SaaS",
        }
      : {
          eyebrow: "Rollout comercial",
          title: "Paquetes por riesgo, volumen y canal.",
          subtitle: "Planes Basic, Secure y Enterprise para marcas, resellers y operadores.",
          badge: "Piloto a rollout",
          proof: "Hardware + SaaS",
        };
  }

  if (input.surface === "demo-lab") {
    return locale === "en"
      ? {
          eyebrow: "Live demo lab",
          title: "Show the complete tap-to-portal experience.",
          subtitle: "Product passport, validation states, consumer portal, certificates and marketplace.",
          badge: "Demo-ready",
          proof: "Operator view",
        }
      : {
          eyebrow: "Demo lab en vivo",
          title: "Mostrá la experiencia completa después del tap.",
          subtitle: "Pasaporte, estados de validación, portal consumidor, certificados y marketplace.",
          badge: "Listo para demo",
          proof: "Vista operador",
        };
  }

  if (locale === "en") {
    return {
      eyebrow: "Secure product identity",
      title: "NFC authenticity for premium products.",
      subtitle: "A mobile passport that connects every physical unit with trust, provenance, warranty and post-purchase sales.",
      badge: "NFC Secure",
      proof: "Passport + Marketplace",
    };
  }
  if (locale === "pt-BR") {
    return {
      eyebrow: "Identidade segura de produto",
      title: "Autenticidade NFC para produtos premium.",
      subtitle: "Um passaporte mobile que conecta cada unidade física com confiança, origem, garantia e venda pós-compra.",
      badge: "NFC Secure",
      proof: "PASSAPORTE + MARKETPLACE",
    };
  }
  return {
    eyebrow: "Identidad segura de producto",
    title: "Autenticidad NFC para productos premium.",
    subtitle: "Un pasaporte mobile que conecta cada unidad física con confianza, origen, garantía y ventas post-compra.",
    badge: "NFC Secure",
    proof: "PASAPORTE + MARKETPLACE",
  };
}

export default function OgImage({
  searchParams,
}: {
  searchParams?: { locale?: string; surface?: string; campaign?: string };
}) {
  const locale = String(searchParams?.locale || "es-AR");
  const surface = String(searchParams?.surface || "home");
  const campaign = String(searchParams?.campaign || "default");
  const copy = copyFor({ locale, surface, campaign });
  const labels =
    locale === "en"
      ? {
          chips: ["NFC Secure", "Traceability", "Ownership"],
          checks: ["VALID", "CLOSED", "REPLAY SAFE"],
          passport: "Verified Passport",
          trusted: "TRUSTED",
          phoneTitle: "Product authenticity confirmed.",
        }
      : locale === "pt-BR"
      ? {
          chips: ["NFC Secure", "Rastreabilidade", "Ownership"],
          checks: ["VÁLIDO", "FECHADO", "ANTI-REPLAY"],
          passport: "Passaporte verificado",
          trusted: "CONFIÁVEL",
          phoneTitle: "Autenticidade confirmada.",
        }
      : {
          chips: ["NFC Secure", "Trazabilidad", "Ownership"],
          checks: ["VÁLIDO", "CERRADO", "ANTI-REPLAY"],
          passport: "Pasaporte verificado",
          trusted: "CONFIABLE",
          phoneTitle: "Autenticidad confirmada.",
        };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily: "Inter, Arial, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(6,182,212,.18), transparent 36%), linear-gradient(220deg, rgba(16,185,129,.14), transparent 42%)",
          }}
        />
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            padding: "54px 64px",
            gap: 44,
            position: "relative",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 650 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 22,
                  background: "linear-gradient(135deg,#ecfeff,#0891b2)",
                  border: "1px solid rgba(14,116,144,.28)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#083344",
                  fontSize: 30,
                  fontWeight: 900,
                  letterSpacing: -2,
                }}
              >
                NX
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1 }}>nexID</div>
                <div style={{ fontSize: 18, color: "#0f766e", fontWeight: 800, letterSpacing: 4, textTransform: "uppercase" }}>
                  {copy.eyebrow}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "flex", gap: 12 }}>
                {[copy.badge, ...labels.chips.slice(1)].map((item) => (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      padding: "10px 16px",
                      borderRadius: 999,
                      background: "#0f172a",
                      color: "#e0f2fe",
                      fontSize: 18,
                      fontWeight: 800,
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 68, lineHeight: 0.98, fontWeight: 950, letterSpacing: -3, maxWidth: 640 }}>
                {copy.title}
              </div>
              <div style={{ fontSize: 28, lineHeight: 1.25, color: "#334155", maxWidth: 650 }}>{copy.subtitle}</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: 600 }}>
              <div style={{ display: "flex", gap: 12 }}>
                {labels.checks.map((item) => (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      padding: "9px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(15,23,42,.12)",
                      background: "rgba(255,255,255,.72)",
                      color: "#0f172a",
                      fontSize: 16,
                      fontWeight: 900,
                      letterSpacing: 1.5,
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0f766e" }}>nexid.lat</div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                width: 385,
                height: 508,
                borderRadius: 46,
                background: "#020617",
                border: "10px solid #0f172a",
                padding: 22,
                display: "flex",
                flexDirection: "column",
                gap: 18,
                color: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{labels.passport}</div>
                <div style={{ padding: "8px 12px", borderRadius: 999, background: "#064e3b", color: "#a7f3d0", fontSize: 15, fontWeight: 900 }}>
                  {labels.trusted}
                </div>
              </div>
              <div
                style={{
                  height: 244,
                  borderRadius: 30,
                  background:
                    "linear-gradient(135deg,#111827,#312e81 52%,#0e7490)",
                  border: "1px solid rgba(255,255,255,.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ position: "absolute", width: 88, height: 260, left: 82, bottom: -26, borderRadius: 28, background: "#111827", border: "7px solid #f8fafc" }} />
                <div style={{ position: "absolute", width: 56, height: 82, left: 98, top: 52, borderRadius: 14, background: "#f8fafc" }} />
                <div style={{ position: "absolute", width: 114, height: 114, right: 70, top: 66, borderRadius: 999, border: "8px solid rgba(255,255,255,.85)" }} />
                <div style={{ position: "absolute", right: 22, bottom: 22, padding: "12px 16px", borderRadius: 18, background: "#ecfeff", color: "#0f172a", fontSize: 17, fontWeight: 900 }}>
                  NFC TAP
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 16, color: "#67e8f9", fontWeight: 900, letterSpacing: 4, textTransform: "uppercase" }}>
                  {copy.proof}
                </div>
                <div style={{ fontSize: 34, lineHeight: 1.04, fontWeight: 950 }}>{labels.phoneTitle}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
