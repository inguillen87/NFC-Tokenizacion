"use client";

import { useMemo, useState } from "react";
import { Button, Card, SectionHeading } from "@product/ui";

import type { LandingContent } from "../lib/landing-content";

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

export function CalculatorSection({ calculator }: { calculator: CalculatorCopy }) {
  const [volume, setVolume] = useState<(typeof volumeOptions)[number]>(10000);
  const [product, setProduct] = useState<ProductType>("wine");
  const [security, setSecurity] = useState<SecurityLevel>("secure");
  const [channel, setChannel] = useState<ChannelType>("direct");

  const estimate = useMemo(() => {
    const base = securityCosts[security];
    const multiplier = productMultiplier[product] * (channel === "reseller" ? 1.12 : 1);
    const hardware = Math.round(volume * base.hardware * multiplier);
    const saas = Math.round(base.saas * (volume / 10000) * (channel === "reseller" ? 1.15 : 1));
    const activation = Math.round(volume * 0.9);
    return { hardware, saas, activation, plan: base.plan, scope: base.scope };
  }, [volume, product, security, channel]);

  return (
    <section className="container-shell py-16">
      <Card className="p-8">
        <SectionHeading eyebrow={calculator.eyebrow} title={calculator.title} description={calculator.description} />

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

        <div className="mt-6 flex items-center justify-between rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
          <span>{calculator.analyticsScopeLabel}: {calculator.scopeLabels[estimate.scope]}</span>
          <Button variant="secondary">{calculator.cta}</Button>
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
