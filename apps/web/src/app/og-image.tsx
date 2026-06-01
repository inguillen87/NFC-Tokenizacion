import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Copy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  badge: string;
  proof: string;
  status: string;
  route: string;
  action: string;
};

function copyFor(input: { locale: string; surface: string; campaign: string }): Copy {
  const locale = input.locale === "en" ? "en" : input.locale === "pt-BR" ? "pt-BR" : "es-AR";

  if (input.surface === "sun") {
    if (locale === "en") {
      return {
        eyebrow: "Product passport",
        title: "Verify the physical product before the next action.",
        subtitle: "SUN validation, tamper status, provenance and ownership in one mobile flow.",
        badge: "Fresh tap required",
        proof: "NFC + batch + UID",
        status: "SUN OK",
        route: "Origin -> tap -> passport",
        action: "Claim warranty",
      };
    }
    if (locale === "pt-BR") {
      return {
        eyebrow: "Passaporte do produto",
        title: "Valide o produto físico antes da próxima ação.",
        subtitle: "SUN, estado do selo, origem e ownership em um fluxo mobile.",
        badge: "Tap fresco obrigatório",
        proof: "NFC + lote + UID",
        status: "SUN OK",
        route: "Origem -> tap -> passaporte",
        action: "Ativar garantia",
      };
    }
    return {
      eyebrow: "Pasaporte del producto",
      title: "Validá el producto físico antes de activar beneficios.",
      subtitle: "SUN, estado del sello, origen, garantía, ownership y marketplace en un flujo mobile.",
      badge: "Tap físico fresco",
      proof: "NFC + lote + UID",
      status: "SUN OK",
      route: "Origen -> tap -> pasaporte",
      action: "Activar garantía",
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
          status: "Plan ready",
          route: "Risk -> carrier -> rollout",
          action: "Quote rollout",
        }
      : {
          eyebrow: "Rollout comercial",
          title: "Paquetes por riesgo, volumen y canal.",
          subtitle: "Planes Basic, Secure y Enterprise para marcas, resellers y operadores.",
          badge: "Piloto a rollout",
          proof: "Hardware + SaaS",
          status: "Plan listo",
          route: "Riesgo -> carrier -> rollout",
          action: "Cotizar rollout",
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
          status: "Demo live",
          route: "Tap -> proof -> portal",
          action: "Open Demo Lab",
        }
      : {
          eyebrow: "Demo lab en vivo",
          title: "Mostrá la experiencia completa después del tap.",
          subtitle: "Pasaporte, estados de validación, portal consumidor, certificados y marketplace.",
          badge: "Listo para demo",
          proof: "Vista operador",
          status: "Demo live",
          route: "Tap -> prueba -> portal",
          action: "Abrir Demo Lab",
        };
  }

  if (locale === "en") {
    return {
      eyebrow: "Secure product identity",
      title: "NFC authenticity for premium products.",
      subtitle: "A mobile passport that connects every physical unit with trust, provenance, warranty and post-purchase sales.",
      badge: "NFC Secure",
      proof: "Passport + Marketplace",
      status: "Trusted product",
      route: "Factory -> store -> customer",
      action: "Verify product",
    };
  }
  if (locale === "pt-BR") {
    return {
      eyebrow: "Identidade segura de produto",
      title: "Autenticidade NFC para produtos premium.",
      subtitle: "Um passaporte mobile que conecta cada unidade física com confiança, origem, garantia e venda pós-compra.",
      badge: "NFC seguro",
      proof: "Passaporte + Marketplace",
      status: "Produto confiável",
      route: "Fábrica -> loja -> cliente",
      action: "Verificar produto",
    };
  }
  return {
    eyebrow: "Identidad segura de producto",
    title: "Autenticidad NFC para productos premium.",
    subtitle: "Un pasaporte mobile que conecta cada unidad física con confianza, origen, garantía y ventas post-compra.",
    badge: "NFC seguro",
    proof: "Pasaporte + Marketplace",
    status: "Producto confiable",
    route: "Fábrica -> tienda -> cliente",
    action: "Verificar producto",
  };
}

function labelsFor(locale: string) {
  if (locale === "en") {
    return {
      nav: ["Product", "Pricing", "Docs"],
      cockpit: "Live verification cockpit",
      map: "Trace route",
      passport: "Verified passport",
      scan: "Fresh tap",
      seal: "Seal closed",
      risk: "Replay safe",
      buyer: "Buyer portal",
      rows: ["SUN signature", "Batch policy", "Warranty flow"],
      ok: "OK",
      event: "Validated scan",
      unit: "Premium unit",
    };
  }
  if (locale === "pt-BR") {
    return {
      nav: ["Produto", "Planos", "Docs"],
      cockpit: "Cockpit de verificação",
      map: "Rota de rastreio",
      passport: "Passaporte verificado",
      scan: "Tap fresco",
      seal: "Selo fechado",
      risk: "Anti-replay",
      buyer: "Portal comprador",
      rows: ["Assinatura SUN", "Política de lote", "Fluxo garantia"],
      ok: "OK",
      event: "Scan validado",
      unit: "Unidade premium",
    };
  }
  return {
    nav: ["Producto", "Planes", "Docs"],
    cockpit: "Cockpit de verificación",
    map: "Ruta trazable",
    passport: "Pasaporte verificado",
    scan: "Tap fresco",
    seal: "Sello cerrado",
    risk: "Anti-replay",
    buyer: "Portal comprador",
    rows: ["Firma SUN", "Política de lote", "Flujo garantía"],
    ok: "OK",
    event: "Scan validado",
    unit: "Unidad premium",
  };
}

function StatusPill({ children, tone = "cyan" }: { children: string; tone?: "cyan" | "emerald" | "violet" }) {
  const color = tone === "emerald" ? "#34d399" : tone === "violet" ? "#a78bfa" : "#67e8f9";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        border: `1px solid ${color}55`,
        background: `${color}16`,
        color,
        fontSize: 14,
        fontWeight: 850,
        letterSpacing: 0.4,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, boxShadow: `0 0 16px ${color}` }} />
      {children}
    </div>
  );
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
  const labels = labelsFor(locale);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#020617",
          color: "#f8fafc",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(103,232,249,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(103,232,249,.07) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(115deg, rgba(8,47,73,.82) 0%, rgba(2,6,23,.2) 44%, rgba(49,46,129,.42) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            height: 8,
            background: "linear-gradient(90deg, #2fe1c3 0%, #67e8f9 36%, #a78bfa 70%, #f6c85f 100%)",
          }}
        />

        <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "34px 46px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 17,
                  border: "1px solid rgba(103,232,249,.38)",
                  background: "linear-gradient(145deg, rgba(47,225,195,.24), rgba(15,23,42,.96))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#a7fff2",
                  fontSize: 24,
                  fontWeight: 950,
                  boxShadow: "0 20px 50px rgba(34,211,238,.18)",
                }}
              >
                Ni
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 34, fontWeight: 950, letterSpacing: -1.4, color: "#f8fafc" }}>nex</span>
                <span style={{ fontSize: 32, fontWeight: 950, letterSpacing: -1.2, color: "#2fe1c3" }}>ID</span>
              </div>
              <div style={{ display: "flex", gap: 9, marginLeft: 16 }}>
                {labels.nav.map((item) => (
                  <span key={item} style={{ color: "#93a4ba", fontSize: 15, fontWeight: 700 }}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <StatusPill tone="emerald">{copy.status}</StatusPill>
          </div>

          <div style={{ display: "flex", flex: 1, gap: 40, alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", width: 520, gap: 22 }}>
              <div style={{ color: "#67e8f9", fontSize: 15, fontWeight: 900, letterSpacing: 4, textTransform: "uppercase" }}>{copy.eyebrow}</div>
              <div style={{ fontSize: 64, fontWeight: 950, lineHeight: 0.98, letterSpacing: -2.4 }}>{copy.title}</div>
              <div style={{ color: "#b8c8d8", fontSize: 25, lineHeight: 1.28, maxWidth: 500 }}>{copy.subtitle}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, paddingTop: 4 }}>
                <StatusPill>{copy.badge}</StatusPill>
                <StatusPill tone="violet">{copy.proof}</StatusPill>
                <StatusPill tone="emerald">{copy.action}</StatusPill>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                position: "relative",
                flex: 1,
                height: 452,
                borderRadius: 28,
                border: "1px solid rgba(148,163,184,.2)",
                background: "linear-gradient(145deg, rgba(15,23,42,.94), rgba(2,6,23,.9))",
                boxShadow: "0 34px 90px rgba(0,0,0,.46)",
                padding: 18,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ color: "#67e8f9", fontSize: 13, fontWeight: 900, letterSpacing: 3, textTransform: "uppercase" }}>{labels.cockpit}</span>
                    <span style={{ color: "#e2e8f0", fontSize: 21, fontWeight: 900 }}>{copy.route}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["01", "02", "03"].map((item) => (
                      <span
                        key={item}
                        style={{
                          width: 34,
                          height: 28,
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,.11)",
                          background: item === "02" ? "rgba(47,225,195,.16)" : "rgba(255,255,255,.05)",
                          color: item === "02" ? "#99f6e4" : "#94a3b8",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 14, height: 248 }}>
                  <div
                    style={{
                      display: "flex",
                      position: "relative",
                      width: 250,
                      borderRadius: 20,
                      border: "1px solid rgba(103,232,249,.18)",
                      background: "linear-gradient(150deg, rgba(8,47,73,.72), rgba(15,23,42,.78))",
                      overflow: "hidden",
                      padding: 16,
                    }}
                  >
                    <span style={{ color: "#8bd9e9", fontSize: 12, fontWeight: 900, letterSpacing: 2.4, textTransform: "uppercase" }}>{labels.map}</span>
                    <div style={{ position: "absolute", left: 22, top: 74, width: 190, height: 92, border: "2px solid rgba(103,232,249,.3)", borderRadius: "55% 42% 48% 38%" }} />
                    <div style={{ position: "absolute", left: 42, top: 146, width: 150, height: 2, background: "linear-gradient(90deg,#2fe1c3,#a78bfa)", transform: "rotate(-18deg)" }} />
                    <div style={{ position: "absolute", left: 46, top: 142, width: 15, height: 15, borderRadius: 999, background: "#2fe1c3", boxShadow: "0 0 20px #2fe1c3" }} />
                    <div style={{ position: "absolute", right: 50, top: 96, width: 15, height: 15, borderRadius: 999, background: "#a78bfa", boxShadow: "0 0 20px #a78bfa" }} />
                    <div
                      style={{
                        position: "absolute",
                        left: 16,
                        right: 16,
                        bottom: 16,
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,.1)",
                        background: "rgba(2,6,23,.58)",
                        padding: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ color: "#f8fafc", fontSize: 15, fontWeight: 900 }}>{labels.event}</span>
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>UID 424-DNA-TT</span>
                      </div>
                      <span style={{ color: "#34d399", fontSize: 14, fontWeight: 950 }}>{labels.ok}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      position: "relative",
                      flex: 1,
                      borderRadius: 20,
                      border: "1px solid rgba(255,255,255,.1)",
                      background: "linear-gradient(145deg, rgba(30,41,59,.82), rgba(2,6,23,.76))",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ position: "absolute", left: 42, bottom: 22, width: 95, height: 178, borderRadius: "34px 34px 14px 14px", background: "linear-gradient(180deg,#1f2937,#020617)", border: "7px solid #e2e8f0" }} />
                    <div style={{ position: "absolute", left: 59, top: 66, width: 58, height: 74, borderRadius: 16, background: "#e2e8f0" }} />
                    <div style={{ position: "absolute", left: 130, top: 86, width: 114, height: 114, borderRadius: 999, border: "7px solid rgba(103,232,249,.82)" }} />
                    <div style={{ position: "absolute", right: 22, top: 22, borderRadius: 999, border: "1px solid rgba(47,225,195,.36)", background: "rgba(47,225,195,.13)", color: "#99f6e4", padding: "8px 12px", fontSize: 13, fontWeight: 900 }}>{labels.unit}</div>
                    <div style={{ position: "absolute", right: 24, bottom: 24, borderRadius: 14, background: "#ecfeff", color: "#0f172a", padding: "11px 14px", fontSize: 15, fontWeight: 950 }}>NFC TAP</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 14, height: 128 }}>
                  <div
                    style={{
                      width: 232,
                      borderRadius: 18,
                      border: "1px solid rgba(52,211,153,.18)",
                      background: "rgba(6,78,59,.24)",
                      padding: 14,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ color: "#99f6e4", fontSize: 12, fontWeight: 900, letterSpacing: 2.3, textTransform: "uppercase" }}>{labels.passport}</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[labels.scan, labels.seal, labels.risk].map((item) => (
                        <div key={item} style={{ display: "flex", justifyContent: "space-between", color: "#dbeafe", fontSize: 14, fontWeight: 800 }}>
                          <span>{item}</span>
                          <span style={{ color: "#34d399" }}>{labels.ok}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      borderRadius: 18,
                      border: "1px solid rgba(167,139,250,.18)",
                      background: "rgba(49,46,129,.2)",
                      padding: 14,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#c4b5fd", fontSize: 12, fontWeight: 900, letterSpacing: 2.3, textTransform: "uppercase" }}>{labels.buyer}</span>
                      <span style={{ color: "#f6c85f", fontSize: 13, fontWeight: 950 }}>{copy.action}</span>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      {labels.rows.map((item, index) => (
                        <div
                          key={item}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            flex: 1,
                            borderRadius: 14,
                            border: "1px solid rgba(255,255,255,.1)",
                            background: "rgba(255,255,255,.045)",
                            padding: 10,
                          }}
                        >
                          <span style={{ width: `${index === 0 ? 70 : index === 1 ? 54 : 82}%`, height: 5, borderRadius: 999, background: index === 0 ? "#2fe1c3" : index === 1 ? "#67e8f9" : "#a78bfa" }} />
                          <span style={{ color: "#dbeafe", fontSize: 13, fontWeight: 800 }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
