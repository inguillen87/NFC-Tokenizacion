"use client";

import { Card } from "@product/ui";
import { useAudienceMode } from "./audience-mode";

type AudienceCopy = {
  eyebrow: string;
  summary: string;
  decision: string;
  cta: string;
};

export function ModuleAudienceHero({
  ceo,
  operator,
  buyer,
}: {
  ceo: AudienceCopy;
  operator: AudienceCopy;
  buyer: AudienceCopy;
}) {
  const { mode } = useAudienceMode();
  const content = mode === "ceo" ? ceo : mode === "operator" ? operator : buyer;

  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">{content.eyebrow}</p>
      <p className="mt-2 text-sm text-slate-300">{content.summary}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
          <p className="font-semibold text-white">Qué decisión tomás acá</p>
          <p className="mt-2">{content.decision}</p>
        </div>
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
          <p className="font-semibold">CTA / lectura recomendada</p>
          <p className="mt-2">{content.cta}</p>
        </div>
      </div>
    </Card>
  );
}
