"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Calculator, CircleDollarSign, Clock3, FlaskConical, Grape, PlayCircle, Sprout, TrendingUp } from "lucide-react";

type PricingLocale = "en" | "pt-BR" | "es-AR";
type ScenarioKey = "wine" | "pharma" | "agro";

type ScenarioInputs = {
  annualUnits: number;
  incidentRate: number;
  incidentCost: number;
  addressableRate: number;
  firstYearBudget: number;
};

type ScenarioPreset = ScenarioInputs & {
  key: ScenarioKey;
  demoScenario: "qr-gs1" | "nfc-424" | "sensor-evidence";
};

const PRESETS: Record<ScenarioKey, ScenarioPreset> = {
  wine: {
    key: "wine",
    demoScenario: "qr-gs1",
    annualUnits: 120_000,
    incidentRate: 1.2,
    incidentCost: 18,
    addressableRate: 45,
    firstYearBudget: 7_500,
  },
  pharma: {
    key: "pharma",
    demoScenario: "nfc-424",
    annualUnits: 400_000,
    incidentRate: 0.65,
    incidentCost: 42,
    addressableRate: 55,
    firstYearBudget: 15_000,
  },
  agro: {
    key: "agro",
    demoScenario: "sensor-evidence",
    annualUnits: 180_000,
    incidentRate: 0.9,
    incidentCost: 65,
    addressableRate: 40,
    firstYearBudget: 12_500,
  },
};

const COPY = {
  en: {
    eyebrow: "Decision model",
    title: "Put your operating assumptions on the table.",
    body: "This calculator does not promise savings. It turns buyer-provided assumptions into a first-year scenario that can be validated in a controlled pilot.",
    scenarios: { wine: "Wine & spirits", pharma: "Pharma", agro: "Agro" },
    controls: {
      annualUnits: ["Units per year", "Products or packs inside the proposed scope."],
      incidentRate: ["Current incident rate", "Suspected fraud, claims, recalls or custody exceptions."],
      incidentCost: ["Average cost per affected unit", "Editable commercial or operating impact, in USD."],
      addressableRate: ["Addressable share", "Share of exposure you want the pilot to test as preventable or recoverable."],
      firstYearBudget: ["First-year budget", "Software, implementation and the initial controlled rollout."],
    },
    resultsEyebrow: "Modeled outcome",
    resultsTitle: "A hypothesis ready for procurement review",
    exposure: "Annual exposure in scope",
    addressable: "Addressable value",
    net: "Net modeled value",
    roi: "Hypothetical ROI",
    payback: "Modeled payback",
    months: "months",
    formula: "Formula",
    formulaBody: "units × incident rate × average cost × addressable share − first-year budget",
    disclaimer: "Planning aid only. It excludes tag unit cost, tax, financing and unvalidated operational effects. nexID must validate each assumption during discovery and the pilot.",
    primary: "Take this scenario to a meeting",
    secondary: "Open the related Demo Lab",
  },
  "pt-BR": {
    eyebrow: "Modelo de decisao",
    title: "Coloque as premissas operacionais na mesa.",
    body: "Esta calculadora nao promete economia. Converte premissas do comprador em um cenario de primeiro ano que deve ser validado em piloto controlado.",
    scenarios: { wine: "Vinhos e bebidas", pharma: "Pharma", agro: "Agro" },
    controls: {
      annualUnits: ["Unidades por ano", "Produtos ou packs dentro do escopo proposto."],
      incidentRate: ["Taxa atual de incidentes", "Fraude suspeita, claims, recalls ou excecoes de custodia."],
      incidentCost: ["Custo medio por unidade afetada", "Impacto comercial ou operacional editavel, em USD."],
      addressableRate: ["Parcela enderecavel", "Parte da exposicao que o piloto deve testar como evitavel ou recuperavel."],
      firstYearBudget: ["Budget do primeiro ano", "Software, implementacao e rollout inicial controlado."],
    },
    resultsEyebrow: "Resultado modelado",
    resultsTitle: "Uma hipotese pronta para procurement",
    exposure: "Exposicao anual no escopo",
    addressable: "Valor enderecavel",
    net: "Valor liquido modelado",
    roi: "ROI hipotetico",
    payback: "Payback modelado",
    months: "meses",
    formula: "Formula",
    formulaBody: "unidades × taxa de incidentes × custo medio × parcela enderecavel − budget do primeiro ano",
    disclaimer: "Ferramenta de planejamento. Exclui custo unitario da tag, impostos, financiamento e efeitos operacionais nao validados. A nexID valida cada premissa no discovery e no piloto.",
    primary: "Levar cenario para uma reuniao",
    secondary: "Abrir Demo Lab relacionado",
  },
  "es-AR": {
    eyebrow: "Modelo de decision",
    title: "Pone los supuestos operativos sobre la mesa.",
    body: "Esta calculadora no promete ahorros. Convierte supuestos del comprador en un escenario de primer ano que debe validarse con un piloto controlado.",
    scenarios: { wine: "Vinos y bebidas", pharma: "Pharma", agro: "Agro" },
    controls: {
      annualUnits: ["Unidades por ano", "Productos o packs dentro del alcance propuesto."],
      incidentRate: ["Tasa actual de incidentes", "Fraude sospechado, reclamos, recalls o excepciones de custodia."],
      incidentCost: ["Costo medio por unidad afectada", "Impacto comercial u operativo editable, en USD."],
      addressableRate: ["Porcion direccionable", "Parte de la exposicion que el piloto debe probar como evitable o recuperable."],
      firstYearBudget: ["Inversion del primer ano", "Software, implementacion y rollout inicial controlado."],
    },
    resultsEyebrow: "Resultado modelado",
    resultsTitle: "Una hipotesis lista para revisar con compras",
    exposure: "Exposicion anual dentro del alcance",
    addressable: "Valor direccionable",
    net: "Valor neto modelado",
    roi: "ROI hipotetico",
    payback: "Repago modelado",
    months: "meses",
    formula: "Formula",
    formulaBody: "unidades × tasa de incidentes × costo medio × porcion direccionable − inversion del primer ano",
    disclaimer: "Herramienta de planificacion. Excluye costo unitario de tags, impuestos, financiamiento y efectos operativos no validados. nexID valida cada supuesto durante discovery y piloto.",
    primary: "Llevar escenario a una reunion",
    secondary: "Abrir el Demo Lab relacionado",
  },
} as const;

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function modelScenario(inputs: ScenarioInputs) {
  const annualExposure = inputs.annualUnits * (inputs.incidentRate / 100) * inputs.incidentCost;
  const addressableValue = annualExposure * (inputs.addressableRate / 100);
  const netModeledValue = addressableValue - inputs.firstYearBudget;
  const roi = inputs.firstYearBudget > 0 ? (netModeledValue / inputs.firstYearBudget) * 100 : 0;
  const paybackMonths = addressableValue > 0 ? inputs.firstYearBudget / (addressableValue / 12) : Number.POSITIVE_INFINITY;
  return { annualExposure, addressableValue, netModeledValue, roi, paybackMonths };
}

export function PricingRoiCalculator({ locale }: { locale: PricingLocale }) {
  const copy = COPY[locale];
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("pharma");
  const [inputs, setInputs] = useState<ScenarioInputs>(PRESETS.pharma);
  const modeled = useMemo(() => modelScenario(inputs), [inputs]);
  const currency = useMemo(() => new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }), [locale]);
  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);
  const activePreset = PRESETS[activeScenario];
  const leadMessage = locale === "en"
    ? `Modeled ${activeScenario} scenario: ${Math.round(inputs.annualUnits)} units/year, ${inputs.incidentRate}% incident rate, USD ${inputs.incidentCost} per affected unit, ${inputs.addressableRate}% addressable share and USD ${Math.round(inputs.firstYearBudget)} first-year budget.`
    : locale === "pt-BR"
      ? `Cenario ${activeScenario}: ${Math.round(inputs.annualUnits)} unidades/ano, ${inputs.incidentRate}% de incidentes, USD ${inputs.incidentCost} por unidade afetada, ${inputs.addressableRate}% de parcela enderecavel e USD ${Math.round(inputs.firstYearBudget)} de budget no primeiro ano.`
      : `Escenario ${activeScenario}: ${Math.round(inputs.annualUnits)} unidades/ano, ${inputs.incidentRate}% de incidentes, USD ${inputs.incidentCost} por unidad afectada, ${inputs.addressableRate}% de porcion direccionable y USD ${Math.round(inputs.firstYearBudget)} de inversion del primer ano.`;
  const leadHref = `/?contact=quote&intent=pricing_roi&vertical=${activeScenario}&volume=${Math.round(inputs.annualUnits)}&message=${encodeURIComponent(leadMessage)}#contact-modal`;
  const demoHref = `/demo-lab?scenario=${activePreset.demoScenario}`;

  function selectScenario(key: ScenarioKey) {
    setActiveScenario(key);
    setInputs(PRESETS[key]);
  }

  function updateInput(key: keyof ScenarioInputs, value: number, min: number, max: number) {
    setInputs((current) => ({ ...current, [key]: clamp(value, min, max) }));
  }

  const controls: Array<{
    key: keyof ScenarioInputs;
    min: number;
    max: number;
    step: number;
    suffix: string;
  }> = [
    { key: "annualUnits", min: 10_000, max: 2_000_000, step: 10_000, suffix: "" },
    { key: "incidentRate", min: 0.1, max: 5, step: 0.05, suffix: "%" },
    { key: "incidentCost", min: 1, max: 250, step: 1, suffix: " USD" },
    { key: "addressableRate", min: 5, max: 90, step: 5, suffix: "%" },
    { key: "firstYearBudget", min: 2_500, max: 100_000, step: 2_500, suffix: " USD" },
  ];

  return (
    <section className="nexid-pricing-roi" aria-labelledby="pricing-roi-title">
      <header className="nexid-pricing-roi__header">
        <div>
          <span>{copy.eyebrow}</span>
          <h2 id="pricing-roi-title">{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
        <div className="nexid-pricing-roi__scenarios" role="group" aria-label={copy.eyebrow}>
          {(["wine", "pharma", "agro"] as ScenarioKey[]).map((key) => {
            const Icon = key === "wine" ? Grape : key === "pharma" ? FlaskConical : Sprout;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={activeScenario === key}
                className={activeScenario === key ? "is-active" : undefined}
                onClick={() => selectScenario(key)}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{copy.scenarios[key]}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="nexid-pricing-roi__workspace">
        <div className="nexid-pricing-roi__inputs" aria-label={copy.eyebrow}>
          {controls.map((control) => {
            const [label, helper] = copy.controls[control.key];
            const value = inputs[control.key];
            return (
              <label key={control.key} className="nexid-pricing-roi__control">
                <span className="nexid-pricing-roi__control-copy">
                  <strong>{label}</strong>
                  <small>{helper}</small>
                </span>
                <span className="nexid-pricing-roi__control-value">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={value}
                    aria-label={label}
                    onChange={(event) => updateInput(control.key, event.currentTarget.valueAsNumber, control.min, control.max)}
                  />
                  <small>{control.suffix}</small>
                </span>
                <input
                  className="nexid-pricing-roi__range"
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={value}
                  aria-label={`${label} slider`}
                  onChange={(event) => updateInput(control.key, event.currentTarget.valueAsNumber, control.min, control.max)}
                />
              </label>
            );
          })}
        </div>

        <aside className="nexid-pricing-roi__results" aria-live="polite">
          <div className="nexid-pricing-roi__results-heading">
            <Calculator className="h-5 w-5" aria-hidden="true" />
            <span>{copy.resultsEyebrow}</span>
            <h3>{copy.resultsTitle}</h3>
          </div>
          <dl className="nexid-pricing-roi__metrics">
            <div>
              <dt><CircleDollarSign className="h-4 w-4" aria-hidden="true" />{copy.exposure}</dt>
              <dd>{currency.format(modeled.annualExposure)}</dd>
            </div>
            <div>
              <dt><TrendingUp className="h-4 w-4" aria-hidden="true" />{copy.addressable}</dt>
              <dd>{currency.format(modeled.addressableValue)}</dd>
            </div>
            <div className={modeled.netModeledValue >= 0 ? "is-positive" : "is-negative"}>
              <dt>{copy.net}</dt>
              <dd>{currency.format(modeled.netModeledValue)}</dd>
            </div>
            <div className={modeled.roi >= 0 ? "is-positive" : "is-negative"}>
              <dt>{copy.roi}</dt>
              <dd>{number.format(modeled.roi)}%</dd>
            </div>
            <div>
              <dt><Clock3 className="h-4 w-4" aria-hidden="true" />{copy.payback}</dt>
              <dd>{Number.isFinite(modeled.paybackMonths) ? `${number.format(modeled.paybackMonths)} ${copy.months}` : "—"}</dd>
            </div>
          </dl>
          <div className="nexid-pricing-roi__formula">
            <strong>{copy.formula}</strong>
            <code>{copy.formulaBody}</code>
          </div>
          <p className="nexid-pricing-roi__disclaimer">{copy.disclaimer}</p>
          <div className="nexid-pricing-roi__actions">
            <a href={leadHref} className="is-primary">
              <span>{copy.primary}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <a href={demoHref}>
              <PlayCircle className="h-4 w-4" aria-hidden="true" />
              <span>{copy.secondary}</span>
            </a>
          </div>
        </aside>
      </div>
    </section>
  );
}
