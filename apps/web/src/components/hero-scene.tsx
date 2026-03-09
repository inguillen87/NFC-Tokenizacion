"use client";

import { useMemo, useState } from "react";
import type { AppLocale } from "@product/config";

type Vertical = "wine" | "events" | "cosmetics" | "agro";

type Scene = {
  label: string;
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
      wine: { label: "Vino", action: "Botella descorchada", result: "Auténtico", details: ["Varietal: Malbec", "Alcohol: 14.5%", "Barrica: 18 meses", "Región: Mendoza · Estado: Abierta auténtica"], objectClass: "hero-bottle", phoneTag: "VINO · AUTENTICADO" },
      events: { label: "Eventos", action: "Pulsera VIP escaneada", result: "Acceso VIP aprobado", details: ["Backstage pass", "Ticket un solo uso", "Córdoba, Argentina", "Puerta A-3"], objectClass: "wristband-demo scanning", phoneTag: "EVENTOS · ACCESO_OK" },
      cosmetics: { label: "Cosmética", action: "Sello de tapa abierto", result: "Evento de apertura detectado", details: ["Sérum facial", "Lote CS-442", "Santiago, Chile", "Tamper: limpio"], objectClass: "cosmetic-demo tampered scanning", phoneTag: "COSMÉTICA · VERIFICADO" },
      agro: { label: "Agro", action: "Apertura de bolsa detectada", result: "Lote y origen verificados", details: ["Semilla premium", "Lote AG-903", "Rosario, Argentina", "Almacenamiento: conforme"], objectClass: "agro-demo tampered scanning", phoneTag: "AGRO · LOTE_OK" },
    },
  },
  "pt-BR": {
    selectorTitle: "Escolha o vertical",
    microcopy: "Uma ação física real gera verificação, evento e rastreabilidade em segundos.",
    ctaBands: ["Para vinícolas", "Para eventos", "Para cosméticos", "Para agro", "Para pharma"],
    phoneLabel: "Resultado mobile",
    items: {
      wine: { label: "Vinho", action: "Garrafa aberta", result: "Autêntico", details: ["Varietal: Malbec", "Álcool: 14,5%", "Barrica: 18 meses", "Região: Mendoza · Estado: Aberta autêntica"], objectClass: "hero-bottle", phoneTag: "VINHO · AUTENTICADO" },
      events: { label: "Eventos", action: "Pulseira VIP escaneada", result: "Acesso VIP liberado", details: ["Backstage pass", "Ticket uso único", "Córdoba, Argentina", "Portão A-3"], objectClass: "wristband-demo scanning", phoneTag: "EVENTOS · ACESSO_OK" },
      cosmetics: { label: "Cosméticos", action: "Lacre da tampa aberto", result: "Evento de abertura detectado", details: ["Sérum facial", "Lote CS-442", "Santiago, Chile", "Tamper: limpo"], objectClass: "cosmetic-demo tampered scanning", phoneTag: "COSMÉTICOS · VERIFICADO" },
      agro: { label: "Agro", action: "Rasgo de saco detectado", result: "Lote e origem verificados", details: ["Semente premium", "Lote AG-903", "Rosario, Argentina", "Armazenamento: conforme"], objectClass: "agro-demo tampered scanning", phoneTag: "AGRO · LOTE_OK" },
    },
  },
  en: {
    selectorTitle: "Choose vertical",
    microcopy: "A real physical action triggers verification, event logging and traceability in seconds.",
    ctaBands: ["For wineries", "For events", "For cosmetics", "For agro", "For pharma"],
    phoneLabel: "Mobile output",
    items: {
      wine: { label: "Wine", action: "Bottle uncorked", result: "Authentic", details: ["Varietal: Malbec", "Alcohol: 14.5%", "Barrel aging: 18 months", "Region: Mendoza · State: Opened authentic"], objectClass: "hero-bottle", phoneTag: "WINE · AUTH_OK" },
      events: { label: "Events", action: "VIP wristband scanned", result: "VIP access granted", details: ["Backstage pass", "Single-use ticket", "Córdoba, Argentina", "Gate A-3"], objectClass: "wristband-demo scanning", phoneTag: "EVENTS · ENTRY_OK" },
      cosmetics: { label: "Cosmetics", action: "Cap seal opened", result: "Seal event detected", details: ["Skin serum", "Batch CS-442", "Santiago, Chile", "Tamper: clean"], objectClass: "cosmetic-demo tampered scanning", phoneTag: "COSMETICS · VERIFIED" },
      agro: { label: "Agro", action: "Bag tear detected", result: "Lot + origin verified", details: ["Premium seed", "Batch AG-903", "Rosario, Argentina", "Storage: compliant"], objectClass: "agro-demo tampered scanning", phoneTag: "AGRO · LOT_OK" },
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
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <p className="text-xs text-slate-300">{data.action}</p>
            <div className="hero-product-stage mt-3">
              <div className={data.objectClass} />
              <div className="hero-scene-phone">
                <span />
                <em>{data.phoneTag}</em>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-200">{txt.phoneLabel}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-300">{data.result}</p>
            <ul className="mt-2 space-y-2 text-xs text-slate-200">
              {data.details.map((item) => (
                <li key={item} className="rounded-md border border-white/10 bg-slate-900/60 px-2 py-1.5">{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-300">{txt.microcopy}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {txt.ctaBands.map((item) => (
          <span key={item} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">{item}</span>
        ))}
      </div>
    </div>
  );
}
