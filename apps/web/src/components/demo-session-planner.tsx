"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@product/ui";
import { Compass } from "lucide-react";

type Props = {
  locale: "es-AR" | "pt-BR" | "en";
};

type Intent = "enterprise" | "reseller" | "investor" | "technical";

const plannerByLocale: Record<Props["locale"], {
  title: string;
  lead: string;
  intents: Array<{ id: Intent; label: string }>;
  routes: Record<Intent, { title: string; body: string; href: string; cta: string }>;
}> = {
  "es-AR": {
    title: "Planificador de sesión demo",
    lead: "Elegí tu objetivo y te llevamos al siguiente paso recomendado sin perder tiempo.",
    intents: [
      { id: "enterprise", label: "Quiero pilotear en mi empresa" },
      { id: "reseller", label: "Quiero revender / canal" },
      { id: "investor", label: "Quiero analizar inversión" },
      { id: "technical", label: "Quiero revisar API/operación" },
    ],
    routes: {
      enterprise: { title: "Ruta enterprise", body: "Revisá rollout, lotes, perfiles y flujo comercial para desplegar piloto real.", href: "/audiences", cta: "Ir a audiences" },
      reseller: { title: "Ruta reseller", body: "Entendé el programa de canal, onboarding y escalamiento por partner.", href: "/resellers", cta: "Ir a resellers" },
      investor: { title: "Ruta inversor", body: "Mirá el snapshot para entender moat, narrativa y expansión del modelo.", href: "/investor-snapshot", cta: "Abrir investor snapshot" },
      technical: { title: "Ruta técnica", body: "Entrá a docs para validar API, manifests, batch governance y QA operativo.", href: "/docs", cta: "Ir a docs" },
    },
  },
  "pt-BR": {
    title: "Planejador de sessão demo",
    lead: "Escolha seu objetivo e siga para o próximo passo recomendado sem perder tempo.",
    intents: [
      { id: "enterprise", label: "Quero pilotar na minha empresa" },
      { id: "reseller", label: "Quero revender / canal" },
      { id: "investor", label: "Quero analisar investimento" },
      { id: "technical", label: "Quero revisar API/operação" },
    ],
    routes: {
      enterprise: { title: "Rota enterprise", body: "Revise rollout, lotes, perfis e fluxo comercial para ativar um piloto real.", href: "/audiences", cta: "Ir para audiences" },
      reseller: { title: "Rota reseller", body: "Entenda programa de canal, onboarding e escala por parceiro.", href: "/resellers", cta: "Ir para resellers" },
      investor: { title: "Rota investidor", body: "Abra o snapshot para entender moat, narrativa e expansão.", href: "/investor-snapshot", cta: "Abrir investor snapshot" },
      technical: { title: "Rota técnica", body: "Entre em docs para validar API, manifests, governança de lotes e QA.", href: "/docs", cta: "Ir para docs" },
    },
  },
  en: {
    title: "Demo session planner",
    lead: "Pick your goal and jump to the best next step with no friction.",
    intents: [
      { id: "enterprise", label: "I want to pilot in my company" },
      { id: "reseller", label: "I want to resell / partner" },
      { id: "investor", label: "I want investor view" },
      { id: "technical", label: "I want API/ops detail" },
    ],
    routes: {
      enterprise: { title: "Enterprise route", body: "Review rollout, batch governance, profiles and commercial framing for a real pilot.", href: "/audiences", cta: "Open audiences" },
      reseller: { title: "Reseller route", body: "Explore channel program, onboarding and partner scale model.", href: "/resellers", cta: "Open resellers" },
      investor: { title: "Investor route", body: "Open the snapshot to understand moat, platform narrative and expansion.", href: "/investor-snapshot", cta: "Open investor snapshot" },
      technical: { title: "Technical route", body: "Go to docs for API, manifests, batch governance and operational QA.", href: "/docs", cta: "Open docs" },
    },
  },
};

export function DemoSessionPlanner({ locale }: Props) {
  const copy = plannerByLocale[locale];
  const [intent, setIntent] = useState<Intent>("enterprise");
  const selected = copy.routes[intent];

  return (
    <Card className="p-6">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
        <Compass className="h-4 w-4" />
        {copy.title}
      </p>
      <p className="mt-2 text-sm text-slate-300">{copy.lead}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {copy.intents.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setIntent(option.id)}
            className={`rounded-full border px-3 py-1 text-xs transition ${intent === option.id ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/5 text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100"}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
        <p className="text-sm font-semibold text-white">{selected.title}</p>
        <p className="mt-2 text-sm text-slate-300">{selected.body}</p>
        <Link href={selected.href} className="mt-3 inline-flex rounded-full border border-cyan-300/40 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-100 transition hover:bg-cyan-500/20">
          {selected.cta}
        </Link>
      </div>
    </Card>
  );
}
