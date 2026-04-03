"use client";

import { useMemo, useState } from "react";
import { Card } from "@product/ui";
import { Gauge } from "lucide-react";

type Props = {
  locale: "es-AR" | "pt-BR" | "en";
};

type ChecklistItem = { id: string; label: string };

const copyByLocale: Record<Props["locale"], { title: string; lead: string; readyLabel: string; pendingLabel: string; items: ChecklistItem[] }> = {
  "es-AR": {
    title: "Readiness board del piloto",
    lead: "Checklist visual para mostrar qué tan listo está el piloto antes de presentar o escalar.",
    readyLabel: "Listo para demo enterprise",
    pendingLabel: "Ajustar antes de escalar",
    items: [
      { id: "batch", label: "Batch registrado con keys y perfil correcto" },
      { id: "manifest", label: "Manifest importado y validado sin duplicados" },
      { id: "activation", label: "Tags activadas para pruebas reales" },
      { id: "sun", label: "SUN URL validada en backend" },
      { id: "ux", label: "Flujo demo claro para usuario no técnico" },
      { id: "ops", label: "Runbook operativo definido para llegada física" },
    ],
  },
  "pt-BR": {
    title: "Readiness board do piloto",
    lead: "Checklist visual para mostrar o nível de prontidão antes de apresentar ou escalar.",
    readyLabel: "Pronto para demo enterprise",
    pendingLabel: "Ajustar antes de escalar",
    items: [
      { id: "batch", label: "Lote registrado com chaves e perfil corretos" },
      { id: "manifest", label: "Manifest importado e validado sem duplicados" },
      { id: "activation", label: "Tags ativadas para testes reais" },
      { id: "sun", label: "SUN URL validada no backend" },
      { id: "ux", label: "Fluxo demo claro para público não técnico" },
      { id: "ops", label: "Runbook operacional definido para chegada física" },
    ],
  },
  en: {
    title: "Pilot readiness board",
    lead: "Visual checklist to communicate how ready the pilot is before presenting or scaling.",
    readyLabel: "Ready for enterprise demo",
    pendingLabel: "Needs alignment before scale",
    items: [
      { id: "batch", label: "Batch registered with correct keys/profile" },
      { id: "manifest", label: "Manifest imported and validated with no duplicates" },
      { id: "activation", label: "Tags activated for real scans" },
      { id: "sun", label: "SUN URL validated in backend" },
      { id: "ux", label: "Demo journey clear for non-technical audience" },
      { id: "ops", label: "Operational runbook defined for physical arrival" },
    ],
  },
};

export function DemoReadinessBoard({ locale }: Props) {
  const copy = copyByLocale[locale];
  const [checked, setChecked] = useState<string[]>([]);

  const progress = useMemo(() => Math.round((checked.length / copy.items.length) * 100), [checked.length, copy.items.length]);
  const isReady = progress >= 80;

  return (
    <Card className="p-6">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
        <Gauge className="h-4 w-4" />
        {copy.title}
      </p>
      <p className="mt-2 text-sm text-slate-300">{copy.lead}</p>

      <div className="mt-4 h-2 w-full rounded-full bg-white/10">
        <div className={`h-2 rounded-full transition-all duration-500 ${isReady ? "bg-emerald-400" : "bg-cyan-400"}`} style={{ width: `${progress}%` }} />
      </div>
      <p className={`mt-2 text-sm font-semibold ${isReady ? "text-emerald-300" : "text-amber-300"}`}>
        {progress}% · {isReady ? copy.readyLabel : copy.pendingLabel}
      </p>

      <div className="mt-4 grid gap-2">
        {copy.items.map((item) => {
          const active = checked.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setChecked((current) => (current.includes(item.id) ? current.filter((value) => value !== item.id) : [...current, item.id]))}
              className={`rounded-xl border px-3 py-2 text-left text-sm transition ${active ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100"}`}
            >
              <span className="font-semibold">{active ? "✓" : "○"}</span> {item.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
