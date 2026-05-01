"use client";

import { useMemo, useState } from "react";
import type { AppLocale } from "@product/config";

type Vertical = "wine" | "events" | "cosmetics" | "agro";

type Scene = {
  label: string;
  profile: string;
  action: string;
  result: string;
  details: string[];
  objectClass: string;
  phoneTag: string;
};

const labels: Record<AppLocale, {
  selectorTitle: string;
  microcopy: string;
  ctaBands: string[];
  phoneLabel: string;
  items: Record<Vertical, Scene>;
}> = {
  "es-AR": {
    selectorTitle: "Elegí vertical",
    microcopy: "Una acción física real genera verificación, evento y trazabilidad en segundos.",
    ctaBands: ["Para bodegas", "Para eventos", "Para cosmética", "Para agro", "Para pharma"],
    phoneLabel: "Resultado mobile",
    items: {
      wine: { label: "Vino", profile: "NTAG 424 DNA TT", action: "Descorche: sello fiscal abierto + SUN validado", result: "Auténtico, sello abierto", details: ["Gran Reserva Malbec", "Origen: Valle de Uco, Mendoza", "Tap actual: Zurich, Suiza", "Distancia: 11.300 km aprox."], objectClass: "hero-bottle scanning tampered", phoneTag: "VINO · AUTH_OK" },
      events: { label: "Eventos", profile: "NTAG215", action: "Pulsera VIP escaneada en puerta", result: "Acceso VIP aprobado", details: ["Pase backstage", "Ticket de un solo uso", "Córdoba, Argentina", "Puerta A-3 · UID serializado"], objectClass: "wristband-demo scanning", phoneTag: "EVENTOS · ENTRY_OK" },
      cosmetics: { label: "Cosmética", profile: "NTAG 424 DNA", action: "Sello de tapa validado", result: "Producto genuino", details: ["Sérum facial", "Lote CS-442", "Santiago, Chile", "SUN dinámico contra replay"], objectClass: "cosmetic-demo scanning", phoneTag: "COSMÉTICA · VERIFIED" },
      agro: { label: "Agro", profile: "QR + NFC UID", action: "Apertura de bolsa detectada", result: "Lote y origen verificados", details: ["Semilla premium", "Lote AG-903", "Rosario, Argentina", "Cadena logística conforme"], objectClass: "agro-demo tampered scanning", phoneTag: "AGRO · LOT_OK" },
    },
  },
  "pt-BR": {
    selectorTitle: "Escolha o vertical",
    microcopy: "Uma ação física real gera verificação, evento e rastreabilidade em segundos.",
    ctaBands: ["Para vinícolas", "Para eventos", "Para cosméticos", "Para agro", "Para pharma"],
    phoneLabel: "Resultado mobile",
    items: {
      wine: { label: "Vinho", profile: "NTAG 424 DNA TT", action: "Rolha aberta: lacre + SUN validado", result: "Autêntico, lacre aberto", details: ["Gran Reserva Malbec", "Origem: Valle de Uco, Mendoza", "Tap atual: Zurique, Suica", "Distancia: 11.300 km aprox."], objectClass: "hero-bottle scanning tampered", phoneTag: "VINHO · AUTH_OK" },
      events: { label: "Eventos", profile: "NTAG215", action: "Pulseira VIP escaneada", result: "Acesso VIP liberado", details: ["Passe backstage", "Ingresso de uso único", "Córdoba, Argentina", "Portão A-3 · UID serializado"], objectClass: "wristband-demo scanning", phoneTag: "EVENTOS · ENTRY_OK" },
      cosmetics: { label: "Cosméticos", profile: "NTAG 424 DNA", action: "Lacre da tampa validado", result: "Produto genuíno", details: ["Sérum facial", "Lote CS-442", "Santiago, Chile", "SUN dinâmico contra replay"], objectClass: "cosmetic-demo scanning", phoneTag: "COSMÉTICOS · VERIFIED" },
      agro: { label: "Agro", profile: "QR + NFC UID", action: "Rasgo de saco detectado", result: "Lote e origem verificados", details: ["Semente premium", "Lote AG-903", "Rosario, Argentina", "Cadeia logística conforme"], objectClass: "agro-demo tampered scanning", phoneTag: "AGRO · LOT_OK" },
    },
  },
  en: {
    selectorTitle: "Choose vertical",
    microcopy: "A real physical action triggers verification, event logging and traceability in seconds.",
    ctaBands: ["For wineries", "For events", "For cosmetics", "For agro", "For pharma"],
    phoneLabel: "Mobile output",
    items: {
      wine: { label: "Wine", profile: "NTAG 424 DNA TT", action: "Uncork: tax seal opened + SUN validated", result: "Authentic, opened seal", details: ["Gran Reserva Malbec", "Origin: Uco Valley, Mendoza", "Current tap: Zurich, Switzerland", "Distance: approx. 11,300 km"], objectClass: "hero-bottle scanning tampered", phoneTag: "WINE · AUTH_OK" },
      events: { label: "Events", profile: "NTAG215", action: "VIP wristband scanned", result: "VIP access granted", details: ["Backstage pass", "Single-use ticket", "Córdoba, Argentina", "Gate A-3 · serialized UID"], objectClass: "wristband-demo scanning", phoneTag: "EVENTS · ENTRY_OK" },
      cosmetics: { label: "Cosmetics", profile: "NTAG 424 DNA", action: "Cap seal validated", result: "Genuine product", details: ["Skin serum", "Batch CS-442", "Santiago, Chile", "Dynamic SUN anti-replay"], objectClass: "cosmetic-demo scanning", phoneTag: "COSMETICS · VERIFIED" },
      agro: { label: "Agro", profile: "QR + NFC UID", action: "Bag tear detected", result: "Lot + origin verified", details: ["Premium seed", "Batch AG-903", "Rosario, Argentina", "Compliant logistics chain"], objectClass: "agro-demo tampered scanning", phoneTag: "AGRO · LOT_OK" },
    },
  },
};

export function HeroScene({ locale }: { locale: AppLocale }) {
  const [active, setActive] = useState<Vertical>("wine");
  const txt = labels[locale] || labels["es-AR"];
  const data = useMemo(() => txt.items[active], [txt, active]);

  return (
    <div>
      <div className="hero-scene rounded-2xl border border-white/10 p-4 md:p-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-300">{txt.selectorTitle}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["wine", "events", "cosmetics", "agro"] as const).map((key) => (
            <button key={key} type="button" onClick={() => setActive(key)} className={`hero-vertical-pill ${active === key ? "hero-vertical-pill--active" : ""}`}>
              {txt.items[key].label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hero-scene-stage-card rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="hero-scene-action text-xs text-slate-300">{data.action}</p>
              <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100">{data.profile}</span>
            </div>
            <div className={`hero-product-stage hero-product-stage--${active} mt-3`}>
              <div className="hero-object-frame">
                <div className={data.objectClass} />
                <div className="hero-cork-pop" />
                <div className="hero-tamper-strip" />
                <div className="hero-nfc-beam" />
              </div>
              <div className="hero-scene-phone">
                <span />
                <em>{data.phoneTag}</em>
                <strong>{data.result}</strong>
              </div>
            </div>
          </div>

          <div className="hero-scene-result-card rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
            <p className="hero-scene-result-label text-[11px] uppercase tracking-[0.14em] text-cyan-200">{txt.phoneLabel}</p>
            <p className="hero-scene-result-state mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-300">{data.result}</p>
            <ul className="mt-2 space-y-2 text-xs text-slate-200">
              {data.details.map((item) => (
                <li key={item} className="hero-scene-detail rounded-md border border-white/10 bg-slate-900/60 px-2 py-1.5">{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <p className="hero-scene-microcopy mt-3 text-xs text-slate-300">{txt.microcopy}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {txt.ctaBands.map((item) => (
          <span key={item} className="hero-scene-band rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">{item}</span>
        ))}
      </div>
    </div>
  );
}
