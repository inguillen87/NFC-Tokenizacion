"use client";

import { Card } from "@product/ui";
import { useAudienceMode } from "./audience-mode";

const MODE_CONTENT = {
  ceo: {
    title: "Modo CEO / inversor",
    summary: "Leé la plataforma como una historia de escala, riesgo controlado y monetización enterprise.",
    modules: [
      "Overview + Analytics = salud del negocio, adopción y fraude evitado.",
      "Resellers + Plans = expansión white-label, canal y revenue.",
      "Demo Lab = por qué la experiencia se convierte en ventas e inversión.",
    ],
  },
  operator: {
    title: "Modo operator / engineer",
    summary: "Leé la plataforma como un sistema operativo de emisión, autenticación, monitoreo y control.",
    modules: [
      "Batches + Tags = cómo nacen y se activan los activos físicos/digitales.",
      "Events + Analytics + API Keys = cómo se observa, integra y gobierna el sistema.",
      "Demo Lab = sandbox controlado para validar flujos end-to-end.",
    ],
  },
  buyer: {
    title: "Modo buyer / client",
    summary: "Leé la plataforma como una promesa de confianza, experiencia simple y activación postventa.",
    modules: [
      "Demo Control + Demo Lab + Mobile = qué ve y siente el usuario final.",
      "Analytics = prueba de que la solución genera adopción y reduce riesgo.",
      "Resellers / White-label = cómo esta experiencia se distribuye a múltiples marcas y mercados.",
    ],
  },
} as const;

export function AudienceOverviewExplainer() {
  const { mode } = useAudienceMode();
  const content = MODE_CONTENT[mode];

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">{content.title}</h2>
      <p className="mt-2 text-sm text-slate-400">{content.summary}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {content.modules.map((item) => (
          <div key={item} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
            {item}
          </div>
        ))}
      </div>
    </Card>
  );
}
