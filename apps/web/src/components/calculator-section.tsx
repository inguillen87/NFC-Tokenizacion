"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, SectionHeading } from "@product/ui";

import type { LandingContent } from "../lib/landing-content";
import type { AppLocale } from "@product/config";

type CalculatorCopy = LandingContent["calculator"];

const volumeOptions = [10000, 25000, 50000, 100000] as const;
const currencies = ["USD", "ARS", "BRL"] as const;

type ProductType = "wine" | "cosmetics" | "events" | "pharma";
type SecurityLevel = "basic" | "secure" | "enterprise";
type ChannelType = "direct" | "reseller";
type Currency = (typeof currencies)[number];

const productMultiplier: Record<ProductType, number> = {
  wine: 1.2,
  cosmetics: 1,
  events: 0.78,
  pharma: 1.42,
};

const protectedUnitValue: Record<ProductType, number> = {
  wine: 18,
  cosmetics: 14,
  events: 7,
  pharma: 28,
};

const securityCosts: Record<SecurityLevel, { hardware: number; encoding: number; monthlySaas: number; setup: number; scope: "base" | "extended" | "advanced"; plan: string }> = {
  basic: { hardware: 0.18, encoding: 0.03, monthlySaas: 249, setup: 900, scope: "base", plan: "BASIC" },
  secure: { hardware: 0.42, encoding: 0.08, monthlySaas: 790, setup: 2600, scope: "extended", plan: "SECURE" },
  enterprise: { hardware: 0.55, encoding: 0.12, monthlySaas: 1800, setup: 6200, scope: "advanced", plan: "ENTERPRISE / RESELLER" },
};

const currencyRate: Record<Currency, number> = {
  USD: 1,
  ARS: 1050,
  BRL: 5,
};

const presets: Record<ProductType, { volume: (typeof volumeOptions)[number]; security: SecurityLevel; channel: ChannelType }> = {
  wine: { volume: 50000, security: "secure", channel: "direct" },
  cosmetics: { volume: 25000, security: "secure", channel: "direct" },
  pharma: { volume: 100000, security: "enterprise", channel: "direct" },
  events: { volume: 10000, security: "basic", channel: "reseller" },
};

const investmentCopy: Record<AppLocale, {
  explain: string;
  enterpriseTitle: string;
  enterpriseBody: string;
  resellerTitle: string;
  resellerBody: string;
  preset: string;
  currency: string;
  share: string;
  copied: string;
  disclaimer: string;
  firstYearInvestment: string;
  costPerUnit: string;
  protectedRevenue: string;
  costRatio: string;
  resellerSale: string;
  resellerProfit: string;
  resellerMargin: string;
  resellerMrr: string;
  hardwareEncoding: string;
  setup: string;
  annualSaas: string;
  activationScope: string;
  assumptions: string;
  assumptionsBody: string;
  investorTitle: string;
  investorBody: string;
  askBot: string;
  askCeo: string;
  scenarios: string;
  modeLabel: string;
  decisionTitle: string;
  directDecision: string;
  resellerDecision: string;
  breakEvenUnits: string;
  activeCoverage: string;
  marginModel: string;
  buyerValue: string;
  formulaTitle: string;
  directFormula: string;
  resellerFormula: string;
}> = {
  "es-AR": {
    explain: "Elegis vertical, volumen, seguridad y canal. El modelo separa costo real del programa, valor protegido y margen posible para venderlo sin una planilla.",
    enterpriseTitle: "Cliente empresa",
    enterpriseBody: "Ideal para bodegas, cosmetica, pharma o eventos que quieren proteger producto, capturar datos y activar beneficios post-tap.",
    resellerTitle: "Revendedor / white-label",
    resellerBody: "Modela venta al cliente final, utilidad bruta y MRR bruto para partners que revenden tags + SaaS + onboarding.",
    preset: "Preset industria",
    currency: "Moneda",
    share: "Copiar link",
    copied: "Link copiado",
    disclaimer: "Estimacion comercial. No reemplaza cotizacion formal, impuestos, logistica ni descuentos por compra real.",
    firstYearInvestment: "Inversion primer ano",
    costPerUnit: "Costo total por unidad",
    protectedRevenue: "Valor de producto protegido",
    costRatio: "Costo sobre valor protegido",
    resellerSale: "Venta estimada primer ano",
    resellerProfit: "Utilidad bruta estimada",
    resellerMargin: "Margen bruto",
    resellerMrr: "MRR bruto estimado",
    hardwareEncoding: "Hardware + encoding",
    setup: "Setup / go-live",
    annualSaas: "SaaS anual",
    activationScope: "Tags activables",
    assumptions: "Supuestos",
    assumptionsBody: "Incluye tag fisico, encoding, SaaS anual y setup. El valor protegido usa ticket promedio por vertical para explicar el ROI.",
    investorTitle: "Fast lane inversores",
    investorBody: "Podemos modelar USD 25k o USD 50k en chips, encoding o software-only con escenarios de margen y rollout.",
    askBot: "Hablar con IA",
    askCeo: "WhatsApp CEO",
    scenarios: "Escenarios rapidos",
    modeLabel: "Que queres calcular?",
    decisionTitle: "Lectura simple",
    directDecision: "Para cliente empresa, el numero clave es cuanto cuesta proteger cada unidad contra el valor del producto y que datos comerciales quedan disponibles despues del tap.",
    resellerDecision: "Para reseller, el numero clave es venta facturable, margen bruto y MRR bruto estimado por operar hardware + SaaS + onboarding.",
    breakEvenUnits: "Unidades para recuperar inversion",
    activeCoverage: "Cobertura activa estimada",
    marginModel: "Modelo de margen",
    buyerValue: "Valor promedio por unidad",
    formulaTitle: "Como leer el calculo",
    directFormula: "Inversion anual = tags + encoding + setup + SaaS. ROI se lee contra valor protegido, reduccion de fraude y ventas post-tap.",
    resellerFormula: "Venta reseller = hardware + setup + SaaS con margen. MRR bruto muestra la parte recurrente despues del costo SaaS base.",
  },
  "pt-BR": {
    explain: "Escolha vertical, volume, seguranca e canal. O modelo separa custo do programa, valor protegido e margem possivel para vender sem planilha.",
    enterpriseTitle: "Cliente empresa",
    enterpriseBody: "Ideal para marcas que querem proteger produto, capturar dados e ativar beneficios pos-toque.",
    resellerTitle: "Revendedor / white-label",
    resellerBody: "Modela venda ao cliente final, lucro bruto e MRR bruto para parceiros que revendem tags + SaaS + onboarding.",
    preset: "Preset da industria",
    currency: "Moeda",
    share: "Copiar link",
    copied: "Link copiado",
    disclaimer: "Estimativa comercial. Nao substitui proposta formal, impostos, logistica nem descontos de compra real.",
    firstYearInvestment: "Investimento primeiro ano",
    costPerUnit: "Custo total por unidade",
    protectedRevenue: "Valor de produto protegido",
    costRatio: "Custo sobre valor protegido",
    resellerSale: "Venda estimada primeiro ano",
    resellerProfit: "Lucro bruto estimado",
    resellerMargin: "Margem bruta",
    resellerMrr: "MRR bruto estimado",
    hardwareEncoding: "Hardware + encoding",
    setup: "Setup / go-live",
    annualSaas: "SaaS anual",
    activationScope: "Tags ativaveis",
    assumptions: "Premissas",
    assumptionsBody: "Inclui tag fisica, encoding, SaaS anual e setup. O valor protegido usa ticket medio por vertical.",
    investorTitle: "Fast lane investidores",
    investorBody: "Podemos modelar USD 25k ou USD 50k em chips, encoding ou software-only com cenarios de margem.",
    askBot: "Falar com IA",
    askCeo: "WhatsApp CEO",
    scenarios: "Cenarios rapidos",
    modeLabel: "O que voce quer calcular?",
    decisionTitle: "Leitura simples",
    directDecision: "Para cliente empresa, o numero chave e quanto custa proteger cada unidade contra o valor do produto e quais dados comerciais ficam depois do toque.",
    resellerDecision: "Para reseller, o numero chave e venda faturavel, margem bruta e MRR bruto estimado para operar hardware + SaaS + onboarding.",
    breakEvenUnits: "Unidades para recuperar investimento",
    activeCoverage: "Cobertura ativa estimada",
    marginModel: "Modelo de margem",
    buyerValue: "Valor medio por unidade",
    formulaTitle: "Como ler o calculo",
    directFormula: "Investimento anual = tags + encoding + setup + SaaS. ROI e lido contra valor protegido, reducao de fraude e vendas pos-toque.",
    resellerFormula: "Venda reseller = hardware + setup + SaaS com margem. MRR bruto mostra a parte recorrente depois do custo SaaS base.",
  },
  en: {
    explain: "Choose vertical, volume, security and channel. The model separates program cost, protected product value and possible margin without forcing a spreadsheet.",
    enterpriseTitle: "Enterprise client",
    enterpriseBody: "For brands that want product protection, scan data and post-tap loyalty, warranty or marketplace flows.",
    resellerTitle: "Reseller / white-label",
    resellerBody: "Models client resale, gross profit and gross MRR for partners selling tags + SaaS + onboarding.",
    preset: "Industry preset",
    currency: "Currency",
    share: "Copy link",
    copied: "Link copied",
    disclaimer: "Commercial estimate. It excludes formal quote terms, taxes, logistics and real purchase discounts.",
    firstYearInvestment: "First-year investment",
    costPerUnit: "Total cost per unit",
    protectedRevenue: "Protected product value",
    costRatio: "Cost over protected value",
    resellerSale: "Estimated first-year sale",
    resellerProfit: "Estimated gross profit",
    resellerMargin: "Gross margin",
    resellerMrr: "Estimated gross MRR",
    hardwareEncoding: "Hardware + encoding",
    setup: "Setup / go-live",
    annualSaas: "Annual SaaS",
    activationScope: "Activatable tags",
    assumptions: "Assumptions",
    assumptionsBody: "Includes physical tag, encoding, annual SaaS and setup. Protected value uses an average ticket by vertical.",
    investorTitle: "Investor fast lane",
    investorBody: "We can model USD 25k or USD 50k across chips, encoding or software-only with margin and rollout scenarios.",
    askBot: "Talk to AI",
    askCeo: "WhatsApp CEO",
    scenarios: "Quick scenarios",
    modeLabel: "What are you modelling?",
    decisionTitle: "Simple read",
    directDecision: "For an enterprise client, the key number is protection cost per unit against product value and the commercial data unlocked after the tap.",
    resellerDecision: "For a reseller, the key number is billable sale, gross margin and estimated gross MRR for hardware + SaaS + onboarding.",
    breakEvenUnits: "Units to recover investment",
    activeCoverage: "Estimated active coverage",
    marginModel: "Margin model",
    buyerValue: "Average value per unit",
    formulaTitle: "How to read it",
    directFormula: "Annual investment = tags + encoding + setup + SaaS. ROI is read against protected value, fraud reduction and post-tap sales.",
    resellerFormula: "Reseller sale = hardware + setup + SaaS with margin. Gross MRR shows the recurring part after base SaaS cost.",
  },
};

function volumeScale(volume: number) {
  if (volume >= 100000) return 2.6;
  if (volume >= 50000) return 1.85;
  if (volume >= 25000) return 1.3;
  return 1;
}

function localeName(locale: AppLocale) {
  if (locale === "pt-BR") return "pt-BR";
  if (locale === "en") return "en-US";
  return "es-AR";
}

export function CalculatorSection({ calculator, locale }: { calculator: CalculatorCopy; locale: AppLocale }) {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [volume, setVolume] = useState<(typeof volumeOptions)[number]>(25000);
  const [product, setProduct] = useState<ProductType>("wine");
  const [security, setSecurity] = useState<SecurityLevel>("secure");
  const [channel, setChannel] = useState<ChannelType>("direct");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [copied, setCopied] = useState(false);
  const txt = investmentCopy[locale] || investmentCopy["es-AR"];
  const numberLocale = localeName(locale);

  useEffect(() => {
    const p = search.get("p") as ProductType | null;
    const v = Number(search.get("v") || "");
    const s = search.get("s") as SecurityLevel | null;
    const ch = search.get("ch") as ChannelType | null;
    const c = search.get("cur") as Currency | null;

    if (p && ["wine", "cosmetics", "events", "pharma"].includes(p)) setProduct(p);
    if (volumeOptions.includes(v as (typeof volumeOptions)[number])) setVolume(v as (typeof volumeOptions)[number]);
    if (s && ["basic", "secure", "enterprise"].includes(s)) setSecurity(s);
    if (ch && ["direct", "reseller"].includes(ch)) setChannel(ch);
    if (c && ["USD", "ARS", "BRL"].includes(c)) setCurrency(c);
  }, [search]);

  const estimate = useMemo(() => {
    const base = securityCosts[security];
    const unitProgramCost = (base.hardware + base.encoding) * productMultiplier[product];
    const hardwareEncoding = Math.round(volume * unitProgramCost);
    const setup = Math.round(base.setup * (channel === "reseller" ? 1.12 : 1));
    const annualSaas = Math.round(base.monthlySaas * 12 * volumeScale(volume));
    const firstYearCost = hardwareEncoding + setup + annualSaas;
    const activation = Math.round(volume * (security === "basic" ? 0.78 : 0.92));
    const protectedRevenue = Math.round(volume * protectedUnitValue[product]);
    const costRatio = Number(((firstYearCost / Math.max(1, protectedRevenue)) * 100).toFixed(1));

    const resellerHardwareSale = Math.round(hardwareEncoding * 1.42);
    const resellerSetupSale = Math.round(setup * 1.55);
    const resellerSaasSale = Math.round(annualSaas * 1.32);
    const resellerSale = resellerHardwareSale + resellerSetupSale + resellerSaasSale;
    const resellerProfit = resellerSale - firstYearCost;
    const resellerMargin = Math.round((resellerProfit / Math.max(1, resellerSale)) * 100);
    const resellerMrr = Math.round((resellerSaasSale - annualSaas) / 12);
    const protectedValuePerUnit = protectedUnitValue[product];
    const breakEvenUnits = Math.ceil(firstYearCost / Math.max(1, protectedValuePerUnit));
    const activationRate = Math.round((activation / Math.max(1, volume)) * 100);
    const rate = currencyRate[currency];

    const money = (amount: number, decimals = 0) => {
      const converted = amount * rate;
      return `${currency} ${converted.toLocaleString(numberLocale, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`;
    };

    return {
      activation,
      annualSaas,
      costPerUnit: firstYearCost / volume,
      costRatio,
      firstYearCost,
      hardwareEncoding,
      money,
      plan: base.plan,
      activationRate,
      breakEvenUnits,
      protectedValuePerUnit,
      protectedRevenue,
      resellerMargin,
      resellerMrr,
      resellerProfit,
      resellerSale,
      scope: base.scope,
      setup,
    };
  }, [channel, currency, numberLocale, product, security, volume]);

  const shareHref = `${pathname}?p=${product}&v=${volume}&s=${security}&ch=${channel}&cur=${currency}#calculator`;

  const applyPreset = (next: ProductType) => {
    const preset = presets[next];
    setProduct(next);
    setVolume(preset.volume);
    setSecurity(preset.security);
    setChannel(preset.channel);
  };

  const copyShare = async () => {
    const baseUrl = window.location.origin;
    const full = `${baseUrl}${shareHref}`;
    await navigator.clipboard.writeText(full).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 1300);
    router.replace(shareHref, { scroll: false });
  };

  const primaryMetrics = channel === "reseller"
    ? [
      { label: txt.resellerSale, value: estimate.money(estimate.resellerSale) },
      { label: txt.resellerProfit, value: estimate.money(estimate.resellerProfit) },
      { label: txt.resellerMargin, value: `${estimate.resellerMargin}%` },
      { label: txt.resellerMrr, value: estimate.money(estimate.resellerMrr) },
    ]
    : [
      { label: txt.firstYearInvestment, value: estimate.money(estimate.firstYearCost) },
      { label: txt.costPerUnit, value: estimate.money(estimate.costPerUnit, 2) },
      { label: txt.protectedRevenue, value: estimate.money(estimate.protectedRevenue) },
      { label: txt.costRatio, value: `${estimate.costRatio}%` },
    ];
  const quickReadCards = channel === "reseller"
    ? [
      { label: txt.marginModel, value: `${estimate.resellerMargin}%`, detail: `${txt.resellerProfit}: ${estimate.money(estimate.resellerProfit)}` },
      { label: txt.activeCoverage, value: `${estimate.activationRate}%`, detail: `${estimate.activation.toLocaleString(numberLocale)} ${calculator.tagsUnitLabel}` },
      { label: txt.buyerValue, value: estimate.money(estimate.protectedValuePerUnit, 2), detail: `${txt.protectedRevenue}: ${estimate.money(estimate.protectedRevenue)}` },
    ]
    : [
      { label: txt.breakEvenUnits, value: estimate.breakEvenUnits.toLocaleString(numberLocale), detail: `${txt.buyerValue}: ${estimate.money(estimate.protectedValuePerUnit, 2)}` },
      { label: txt.activeCoverage, value: `${estimate.activationRate}%`, detail: `${estimate.activation.toLocaleString(numberLocale)} ${calculator.tagsUnitLabel}` },
      { label: txt.buyerValue, value: estimate.money(estimate.protectedValuePerUnit, 2), detail: `${txt.protectedRevenue}: ${estimate.money(estimate.protectedRevenue)}` },
    ];

  return (
    <section id="calculator" className="container-shell py-16">
      <Card className="p-5 md:p-8">
        <SectionHeading eyebrow={calculator.eyebrow} title={calculator.title} description={calculator.description} />

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">{txt.modeLabel}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                { key: "direct", title: txt.enterpriseTitle, body: txt.enterpriseBody },
                { key: "reseller", title: txt.resellerTitle, body: txt.resellerBody },
              ].map((item) => (
                <button suppressHydrationWarning
                  key={item.key}
                  type="button"
                  onClick={() => setChannel(item.key as ChannelType)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    channel === item.key
                      ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-50"
                      : "border-white/10 bg-slate-950/45 text-slate-300 hover:border-white/20 hover:bg-white/5"
                  }`}
                >
                  <span className="text-sm font-black">{item.title}</span>
                  <span className="mt-2 block text-xs leading-5 opacity-80">{item.body}</span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">{txt.explain}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Selector label={txt.preset} value={product} onChange={(next) => applyPreset(next as ProductType)} options={calculator.options.product.map((item) => ({ label: item.label, value: item.value }))} />
            <Selector label={calculator.volumeLabel} value={String(volume)} onChange={(next) => setVolume(Number(next) as (typeof volumeOptions)[number])} options={volumeOptions.map((item) => ({ label: `${(item / 1000).toLocaleString(numberLocale)}k`, value: String(item) }))} />
            <Selector label={calculator.securityLabel} value={security} onChange={(next) => setSecurity(next as SecurityLevel)} options={calculator.options.security.map((item) => ({ label: item.label, value: item.value }))} />
            <Selector label={txt.currency} value={currency} onChange={(next) => setCurrency(next as Currency)} options={currencies.map((item) => ({ label: item, value: item }))} />
          </div>
        </div>

        <div className="mt-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{txt.disclaimer}</span>
              <button suppressHydrationWarning type="button" onClick={copyShare} className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-300/10">{copied ? txt.copied : txt.share}</button>
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {primaryMetrics.map((metric) => (
            <Metric key={metric.label} label={metric.label} value={metric.value} featured />
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.76fr]">
          <div className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">{txt.decisionTitle}</p>
            <p className="mt-2 text-sm leading-6 text-cyan-50">{channel === "reseller" ? txt.resellerDecision : txt.directDecision}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {quickReadCards.map((item) => (
                <div key={item.label} className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">{item.label}</p>
                  <p className="mt-2 text-xl font-black text-white">{item.value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-50">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">{txt.formulaTitle}</p>
            <p className="mt-2 leading-6">{channel === "reseller" ? txt.resellerFormula : txt.directFormula}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label={txt.hardwareEncoding} value={estimate.money(estimate.hardwareEncoding)} />
          <Metric label={txt.setup} value={estimate.money(estimate.setup)} />
          <Metric label={txt.annualSaas} value={`${estimate.money(estimate.annualSaas)}${calculator.perYearLabel}`} />
          <Metric label={txt.activationScope} value={`${estimate.activation.toLocaleString(numberLocale)} ${calculator.tagsUnitLabel}`} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-4 text-sm text-cyan-100">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">{txt.assumptions}</p>
            <p className="mt-2 leading-6">{txt.assumptionsBody}</p>
            <p className="mt-3 text-xs text-cyan-200">{calculator.analyticsScopeLabel}: {calculator.scopeLabels[estimate.scope]} / {calculator.recommendationLabel}: {estimate.plan}</p>
          </div>

          <div className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200">{txt.investorTitle}</p>
            <p className="mt-2 text-sm leading-6 text-violet-100">{txt.investorBody}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="/?assistant=open" className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100">{txt.askBot}</a>
              <a href="/?contact=quote&intent=investor25#contact-modal" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-slate-100">{txt.scenarios}: USD 25k</a>
              <a href="/?contact=quote&intent=investor50#contact-modal" className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-slate-100">{txt.scenarios}: USD 50k</a>
              <a href="https://wa.me/5492613168608?text=Hola%20quiero%20presupuesto%20nexID" target="_blank" rel="noreferrer" className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100">{txt.askCeo}</a>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
          <span>{calculator.analyticsScopeLabel}: {calculator.scopeLabels[estimate.scope]}</span>
          <a href="/?contact=quote#contact-modal" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-100">{calculator.cta}</a>
        </div>
      </Card>
    </section>
  );
}

function Selector({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }> }) {
  return (
    <label className="flex flex-col gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
      <span className="flex items-center gap-2">{label}<span className="rounded-full border border-cyan-300/30 px-1.5 text-[10px] text-cyan-300">i</span></span>
      <select suppressHydrationWarning value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/60">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value, featured = false }: { label: string; value: string; featured?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${featured ? "border-cyan-300/25 bg-cyan-500/10" : "border-white/10 bg-white/5"}`}>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-300">{label}</p>
      <p className="mt-2 break-words text-2xl font-black text-white">{value}</p>
    </div>
  );
}
