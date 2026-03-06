"use client";

import { useMemo, useState } from "react";
import { Button, Card, SectionHeading } from "@product/ui";

import type { LandingContent } from "../lib/landing-content";
import type { AppLocale } from "@product/config";

type CalculatorCopy = LandingContent["calculator"];

const volumeOptions = [10000, 25000, 50000, 100000] as const;

type ProductType = "wine" | "cosmetics" | "events" | "pharma";
type SecurityLevel = "basic" | "secure" | "enterprise";
type ChannelType = "direct" | "reseller";

const productMultiplier: Record<ProductType, number> = {
  wine: 1.2,
  cosmetics: 1.0,
  events: 0.8,
  pharma: 1.4,
};

const securityCosts: Record<SecurityLevel, { hardware: number; saas: number; scope: "base" | "extended" | "advanced"; plan: string }> = {
  basic: { hardware: 0.18, saas: 199, scope: "base", plan: "BASIC" },
  secure: { hardware: 0.42, saas: 690, scope: "extended", plan: "SECURE" },
  enterprise: { hardware: 0.55, saas: 1400, scope: "advanced", plan: "ENTERPRISE / RESELLER" },
};

const investmentCopy: Record<AppLocale, {
  unitCost: string;
  grossLabel: string;
  marginLabel: string;
  explain: string;
  investorTitle: string;
  investorBody: string;
  askBot: string;
  askCeo: string;
  scenarios: string;
}> = {
  "es-AR": {
    unitCost: "Costo estimado por unidad",
    grossLabel: "Revenue potencial",
    marginLabel: "Margen bruto estimado",
    explain: "Este simulador combina costo de chip + encoding + fee SaaS anual para explicar el impacto en margen por vertical.",
    investorTitle: "Fast lane inversores",
    investorBody: "¿Querés modelar inversión de USD 25k o USD 50k en chips, encoding o solo software? Hablalo directo con IA o CEO por WhatsApp.",
    askBot: "Hablar con IA",
    askCeo: "WhatsApp CEO",
    scenarios: "Escenarios rápidos",
  },
  "pt-BR": {
    unitCost: "Custo estimado por unidade",
    grossLabel: "Receita potencial",
    marginLabel: "Margem bruta estimada",
    explain: "Este simulador combina custo de chip + encoding + taxa SaaS anual para mostrar impacto de margem por vertical.",
    investorTitle: "Fast lane investidores",
    investorBody: "Quer modelar investimento de USD 25k ou USD 50k em chips, encoding ou somente software? Fale com IA ou CEO no WhatsApp.",
    askBot: "Falar com IA",
    askCeo: "WhatsApp CEO",
    scenarios: "Cenários rápidos",
  },
  en: {
    unitCost: "Estimated unit cost",
    grossLabel: "Potential revenue",
    marginLabel: "Estimated gross margin",
    explain: "This simulator combines chip + encoding + annual SaaS cost to show margin impact by vertical.",
    investorTitle: "Investor fast lane",
    investorBody: "Need a USD 25k / USD 50k model for chips, encoding, or software-only? Talk instantly with AI or the CEO on WhatsApp.",
    askBot: "Talk to AI",
    askCeo: "WhatsApp CEO",
    scenarios: "Quick scenarios",
  },
};

export function CalculatorSection({ calculator, locale }: { calculator: CalculatorCopy; locale: AppLocale }) {
  const [volume, setVolume] = useState<(typeof volumeOptions)[number]>(10000);
  const [product, setProduct] = useState<ProductType>("wine");
  const [security, setSecurity] = useState<SecurityLevel>("secure");
  const [channel, setChannel] = useState<ChannelType>("direct");
  const txt = investmentCopy[locale] || investmentCopy["es-AR"];

  const estimate = useMemo(() => {
    const base = securityCosts[security];
    const multiplier = productMultiplier[product] * (channel === "reseller" ? 1.12 : 1);
    const hardware = Math.round(volume * base.hardware * multiplier);
    const saas = Math.round(base.saas * (volume / 10000) * (channel === "reseller" ? 1.15 : 1));
    const activation = Math.round(volume * 0.9);
    const totalCost = hardware + saas;
    const suggestedPrice = Number((base.hardware * multiplier * 2.2).toFixed(2));
    const potentialRevenue = Math.round(activation * suggestedPrice + saas * 1.4);
    const grossMarginPct = Math.round(((potentialRevenue - totalCost) / Math.max(1, potentialRevenue)) * 100);
    return { hardware, saas, activation, plan: base.plan, scope: base.scope, totalCost, suggestedPrice, potentialRevenue, grossMarginPct };
  }, [volume, product, security, channel]);

  const waBase = "https://wa.me/5492613168608?text=";
  const scenario25 = encodeURIComponent("Hola! Quiero analizar inversión de USD 25k en chips + encoding + SaaS. ¿Revenue esperado?");
  const scenario50 = encodeURIComponent("Hola! Quiero analizar inversión de USD 50k y modelo reseller. ¿Revenue, margen y payback?");

  return (
    <section className="container-shell py-16">
      <Card className="p-8">
        <SectionHeading eyebrow={calculator.eyebrow} title={calculator.title} description={calculator.description} />

        <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">{txt.explain}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Selector label={calculator.volumeLabel} value={String(volume)} onChange={(next) => setVolume(Number(next) as (typeof volumeOptions)[number])} options={volumeOptions.map((item) => ({ label: `${item / 1000}k`, value: String(item) }))} />
          <Selector label={calculator.productLabel} value={product} onChange={(next) => setProduct(next as ProductType)} options={calculator.options.product.map((item) => ({ label: item.label, value: item.value }))} />
          <Selector label={calculator.securityLabel} value={security} onChange={(next) => setSecurity(next as SecurityLevel)} options={calculator.options.security.map((item) => ({ label: item.label, value: item.value }))} />
          <Selector label={calculator.channelLabel} value={channel} onChange={(next) => setChannel(next as ChannelType)} options={calculator.options.channel.map((item) => ({ label: item.label, value: item.value }))} />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label={calculator.hardwareSpendLabel} value={`USD ${estimate.hardware.toLocaleString()}`} />
          <Metric label={calculator.saasFeeLabel} value={`USD ${estimate.saas.toLocaleString()}${calculator.perYearLabel}`} />
          <Metric label={calculator.activationScopeLabel} value={`${estimate.activation.toLocaleString()} ${calculator.tagsUnitLabel}`} />
          <Metric label={calculator.recommendationLabel} value={estimate.plan} />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Metric label={txt.unitCost} value={`USD ${estimate.suggestedPrice}`} />
          <Metric label={txt.grossLabel} value={`USD ${estimate.potentialRevenue.toLocaleString()}`} />
          <Metric label={txt.marginLabel} value={`${estimate.grossMarginPct}%`} />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
          <span>{calculator.analyticsScopeLabel}: {calculator.scopeLabels[estimate.scope]}</span>
          <Button variant="secondary">{calculator.cta}</Button>
        </div>

        <div className="mt-6 rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-violet-200">{txt.investorTitle}</p>
          <p className="mt-2 text-sm text-violet-100">{txt.investorBody}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="/pricing" className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">{txt.askBot}</a>
            <a href={`${waBase}${scenario25}`} target="_blank" rel="noreferrer" className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-200">{txt.scenarios}: USD 25k</a>
            <a href={`${waBase}${scenario50}`} target="_blank" rel="noreferrer" className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-200">{txt.scenarios}: USD 50k</a>
            <a href="https://wa.me/5492613168608" target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{txt.askCeo}</a>
          </div>
        </div>
      </Card>
    </section>
  );
}

function Selector({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }> }) {
  return (
    <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
