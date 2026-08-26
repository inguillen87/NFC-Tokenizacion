"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Calculator,
  CircleDollarSign,
  Database,
  FlaskConical,
  Grape,
  Layers3,
  Package,
  PlayCircle,
  Shield,
  Sprout,
  TrendingUp,
  Truck,
} from "lucide-react";
import {
  modelPricingScenario,
  normalizePricingInput,
  parsePricingDraftInput,
  type PricingScenarioInputs,
} from "./pricing-roi-model";

type PricingLocale = "en" | "pt-BR" | "es-AR";
type ScenarioKey = "wine" | "pharma" | "agro" | "chemicals" | "logistics";

type ScenarioPreset = PricingScenarioInputs & {
  key: ScenarioKey;
  demoScenario: "qr-gs1" | "nfc-424" | "sensor-evidence";
};

const SCENARIO_KEYS: ScenarioKey[] = ["wine", "pharma", "agro", "chemicals", "logistics"];

const PRESETS: Record<ScenarioKey, ScenarioPreset> = {
  wine: {
    key: "wine",
    demoScenario: "nfc-424",
    annualUnits: 120_000,
    tagUnitCost: 0.72,
    platformBudget: 7_500,
    incidentRate: 1.2,
    incidentCost: 18,
    addressableRate: 45,
    traceEventsPerUnit: 0.35,
    iotaAnchorEvery: 50,
    polygonActionRate: 0.5,
  },
  pharma: {
    key: "pharma",
    demoScenario: "nfc-424",
    annualUnits: 400_000,
    tagUnitCost: 0.55,
    platformBudget: 15_000,
    incidentRate: 0.65,
    incidentCost: 42,
    addressableRate: 55,
    traceEventsPerUnit: 0.2,
    iotaAnchorEvery: 100,
    polygonActionRate: 0,
  },
  agro: {
    key: "agro",
    demoScenario: "sensor-evidence",
    annualUnits: 180_000,
    tagUnitCost: 0.65,
    platformBudget: 12_500,
    incidentRate: 0.9,
    incidentCost: 65,
    addressableRate: 40,
    traceEventsPerUnit: 0.25,
    iotaAnchorEvery: 50,
    polygonActionRate: 0,
  },
  chemicals: {
    key: "chemicals",
    demoScenario: "nfc-424",
    annualUnits: 100_000,
    tagUnitCost: 1.05,
    platformBudget: 15_000,
    incidentRate: 0.8,
    incidentCost: 95,
    addressableRate: 50,
    traceEventsPerUnit: 0.5,
    iotaAnchorEvery: 40,
    polygonActionRate: 0.1,
  },
  logistics: {
    key: "logistics",
    demoScenario: "sensor-evidence",
    annualUnits: 25_000,
    tagUnitCost: 0.45,
    platformBudget: 18_000,
    incidentRate: 1.5,
    incidentCost: 180,
    addressableRate: 35,
    traceEventsPerUnit: 6,
    iotaAnchorEvery: 100,
    polygonActionRate: 0,
  },
};

const COPY = {
  en: {
    eyebrow: "Transparent decision model",
    title: "Model rollout economics and chain usage separately.",
    body: "NFC verification is not a blockchain transaction. Change buyer assumptions, then see the commercial case and the operating footprint without hiding tag cost or inventing network fees.",
    scenarios: { wine: "Wine", pharma: "Pharma", agro: "Seeds", chemicals: "Chemicals", logistics: "Pallets" },
    controls: {
      annualUnits: ["Units in annual scope", "Individual products, containers or logistics units."],
      tagUnitCost: ["Encoded carrier cost", "Estimated tag plus encoding cost per unit, in USD."],
      platformBudget: ["Platform and deployment", "First-year software, setup and controlled rollout budget."],
      incidentRate: ["Current incident rate", "Suspected fraud, claims, recalls or custody exceptions."],
      incidentCost: ["Cost per affected unit", "Editable commercial or operating impact, in USD."],
      addressableRate: ["Addressable share", "Share the pilot should test as preventable or recoverable."],
      traceEventsPerUnit: ["Trace events per unit", "Expected API, custody, IoT or post-tap events per unit."],
      iotaAnchorEvery: ["Events per IOTA proof", "Use 0 to disable IOTA; 1 means one proof per event; higher values group event hashes."],
      polygonActionRate: ["Polygon ownership actions", "Share of units expected to trigger an optional claim, NFT or ownership action; 0 disables it."],
    },
    advanced: "Blockchain and event cadence",
    advancedHelp: "Model IOTA integrity proofs and Polygon ownership actions independently. Zero disables a network.",
    presetNotice: "Illustrative, editable preset — not a quote or price list.",
    resultsEyebrow: "Modeled business case",
    resultsTitle: "A reviewable hypothesis, not a sales promise",
    investment: "Modeled first-year subtotal",
    unitCost: "Modeled subtotal per unit",
    addressable: "Addressable value",
    net: "Net modeled value",
    roi: "Hypothetical ROI",
    payback: "Modeled payback",
    months: "months",
    noPayback: "Not reached in modeled year 1",
    architectureEyebrow: "Operating footprint",
    architectureTitle: "Operational events and public proofs are separate",
    architectureBody: "Set either network to zero, model one write per action or group IOTA event hashes. A normal NFC verification remains off-chain.",
    events: "API / trace events per year",
    iotaAnchors: "Estimated IOTA proofs per year",
    polygonActions: "Estimated Polygon actions per year",
    cadence: "IOTA aggregation cadence",
    cadenceValue: (value: number) => value === 0 ? "Disabled" : `1 proof / ${value} events`,
    offChain: "Trace events without a dedicated transaction",
    formula: "Commercial formula",
    formulaBody: "addressable incident value − modeled subtotal (encoded tags + platform/deployment)",
    disclaimer: "Planning aid only. The subtotal excludes tax, freight, financing, live-network gas and any item not entered above. Gas is quoted as pass-through because it varies; testnet activity is not a production cost. Presets are illustrative and every assumption must be validated during discovery and the pilot.",
    primary: "Take this scenario to a meeting",
    secondary: "Open the related Demo Lab",
  },
  "pt-BR": {
    eyebrow: "Modelo de decisao transparente",
    title: "Modele economia do rollout e uso de blockchain separadamente.",
    body: "Validar NFC nao e fazer uma transacao blockchain. Ajuste as premissas e veja o caso comercial e a carga operacional sem esconder o custo das tags nem inventar gas.",
    scenarios: { wine: "Vinhos", pharma: "Pharma", agro: "Sementes", chemicals: "Quimicos", logistics: "Pallets" },
    controls: {
      annualUnits: ["Unidades no escopo anual", "Produtos, recipientes ou unidades logisticas."],
      tagUnitCost: ["Custo do carrier codificado", "Tag mais encoding estimado por unidade, em USD."],
      platformBudget: ["Plataforma e implantacao", "Software, setup e rollout controlado no primeiro ano."],
      incidentRate: ["Taxa atual de incidentes", "Fraude suspeita, claims, recalls ou excecoes de custodia."],
      incidentCost: ["Custo por unidade afetada", "Impacto comercial ou operacional editavel, em USD."],
      addressableRate: ["Parcela enderecavel", "Parte que o piloto deve testar como evitavel ou recuperavel."],
      traceEventsPerUnit: ["Eventos por unidade", "Eventos API, custodia, IoT ou pos-tap esperados por unidade."],
      iotaAnchorEvery: ["Eventos por prova IOTA", "Use 0 para desligar IOTA; 1 cria uma prova por evento; valores maiores agrupam hashes."],
      polygonActionRate: ["Acoes de ownership Polygon", "Parcela de unidades com claim, NFT ou ownership opcional; 0 desliga a rede."],
    },
    advanced: "Blockchain e cadencia de eventos",
    advancedHelp: "Modele provas de integridade IOTA e ownership Polygon separadamente. Zero desliga uma rede.",
    presetNotice: "Preset ilustrativo e editavel — nao e proposta nem tabela de preco.",
    resultsEyebrow: "Caso de negocio modelado",
    resultsTitle: "Uma hipotese revisavel, nao uma promessa comercial",
    investment: "Subtotal modelado do primeiro ano",
    unitCost: "Subtotal modelado por unidade",
    addressable: "Valor enderecavel",
    net: "Valor liquido modelado",
    roi: "ROI hipotetico",
    payback: "Payback modelado",
    months: "meses",
    noPayback: "Nao atingido no ano 1 modelado",
    architectureEyebrow: "Carga operacional",
    architectureTitle: "Eventos operacionais e provas publicas sao separados",
    architectureBody: "Use zero para desligar uma rede, modele uma escrita por acao ou agrupe hashes IOTA. A validacao NFC normal continua off-chain.",
    events: "Eventos API / trace por ano",
    iotaAnchors: "Provas IOTA estimadas por ano",
    polygonActions: "Acoes Polygon estimadas por ano",
    cadence: "Cadencia de agregacao IOTA",
    cadenceValue: (value: number) => value === 0 ? "Desligado" : `1 prova / ${value} eventos`,
    offChain: "Eventos de trace sem transacao dedicada",
    formula: "Formula comercial",
    formulaBody: "valor enderecavel − subtotal modelado (tags + plataforma/implantacao)",
    disclaimer: "Ferramenta de planejamento. O subtotal exclui impostos, frete, financiamento, gas de rede real e itens nao informados acima. O gas e repassado porque varia; testnet nao e custo de producao. Presets sao ilustrativos e cada premissa deve ser validada no discovery e no piloto.",
    primary: "Levar cenario para uma reuniao",
    secondary: "Abrir Demo Lab relacionado",
  },
  "es-AR": {
    eyebrow: "Modelo de decision transparente",
    title: "Modela el rollout y el uso de blockchain por separado.",
    body: "Validar un NFC no es hacer una transaccion blockchain. Cambia los supuestos y mira el caso comercial y la carga operativa sin esconder el costo de tags ni inventar gas.",
    scenarios: { wine: "Vinos", pharma: "Pharma", agro: "Semillas", chemicals: "Quimicos", logistics: "Pallets" },
    controls: {
      annualUnits: ["Unidades en alcance anual", "Productos, envases o unidades logisticas individuales."],
      tagUnitCost: ["Costo del carrier codificado", "Tag mas encoding estimado por unidad, en USD."],
      platformBudget: ["Plataforma e implementacion", "Software, setup y rollout controlado del primer ano."],
      incidentRate: ["Tasa actual de incidentes", "Fraude sospechado, reclamos, recalls o excepciones de custodia."],
      incidentCost: ["Costo por unidad afectada", "Impacto comercial u operativo editable, en USD."],
      addressableRate: ["Porcion direccionable", "Parte que el piloto debe probar como evitable o recuperable."],
      traceEventsPerUnit: ["Eventos por unidad", "Eventos API, custodia, IoT o post-tap esperados por unidad."],
      iotaAnchorEvery: ["Eventos por prueba IOTA", "Usa 0 para apagar IOTA; 1 crea una prueba por evento; valores mayores agrupan hashes."],
      polygonActionRate: ["Acciones de ownership Polygon", "Porcion de unidades con claim, NFT u ownership opcional; 0 apaga esa red."],
    },
    advanced: "Blockchain y cadencia de eventos",
    advancedHelp: "Modela pruebas de integridad IOTA y ownership Polygon por separado. Cero apaga una red.",
    presetNotice: "Preset ilustrativo y editable — no es cotizacion ni lista de precios.",
    resultsEyebrow: "Caso de negocio modelado",
    resultsTitle: "Una hipotesis revisable, no una promesa comercial",
    investment: "Subtotal modelado del primer ano",
    unitCost: "Subtotal modelado por unidad",
    addressable: "Valor direccionable",
    net: "Valor neto modelado",
    roi: "ROI hipotetico",
    payback: "Repago modelado",
    months: "meses",
    noPayback: "No alcanzado en el ano 1 modelado",
    architectureEyebrow: "Carga operativa",
    architectureTitle: "Los eventos operativos y las pruebas publicas se separan",
    architectureBody: "Usa cero para apagar una red, modela una escritura por accion o agrupa hashes IOTA. La validacion NFC normal sigue off-chain.",
    events: "Eventos API / trazabilidad por ano",
    iotaAnchors: "Pruebas IOTA estimadas por ano",
    polygonActions: "Acciones Polygon estimadas por ano",
    cadence: "Cadencia de agregacion IOTA",
    cadenceValue: (value: number) => value === 0 ? "Apagado" : `1 prueba / ${value} eventos`,
    offChain: "Eventos de trazabilidad sin transaccion dedicada",
    formula: "Formula comercial",
    formulaBody: "valor direccionable − subtotal modelado (tags + plataforma/implementacion)",
    disclaimer: "Herramienta de planificacion. El subtotal excluye impuestos, flete, financiamiento, gas de red real y cualquier item no cargado arriba. El gas se cotiza como pass-through porque varia; testnet no es costo productivo. Los presets son ilustrativos y cada supuesto debe validarse durante discovery y el piloto.",
    primary: "Llevar escenario a una reunion",
    secondary: "Abrir el Demo Lab relacionado",
  },
} as const;

function ScenarioIcon({ scenario }: { scenario: ScenarioKey }) {
  if (scenario === "wine") return <Grape className="h-4 w-4" aria-hidden="true" />;
  if (scenario === "pharma") return <FlaskConical className="h-4 w-4" aria-hidden="true" />;
  if (scenario === "agro") return <Sprout className="h-4 w-4" aria-hidden="true" />;
  if (scenario === "chemicals") return <Shield className="h-4 w-4" aria-hidden="true" />;
  return <Truck className="h-4 w-4" aria-hidden="true" />;
}

export function PricingRoiCalculator({ locale }: { locale: PricingLocale }) {
  const copy = COPY[locale];
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("agro");
  const [inputs, setInputs] = useState<PricingScenarioInputs>(PRESETS.agro);
  const [draftInputs, setDraftInputs] = useState<Partial<Record<keyof PricingScenarioInputs, string>>>({});
  const modeled = useMemo(() => modelPricingScenario(inputs), [inputs]);
  const currency = useMemo(() => new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }), [locale]);
  const decimalCurrency = useMemo(() => new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }), [locale]);
  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);
  const integer = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const activePreset = PRESETS[activeScenario];
  const leadPrefix = locale === "en" ? "Illustrative model" : locale === "pt-BR" ? "Modelo ilustrativo" : "Modelo ilustrativo";
  const leadMessage = `${leadPrefix} ${copy.scenarios[activeScenario]}: units=${Math.round(inputs.annualUnits)}; encoded_tag_usd=${inputs.tagUnitCost.toFixed(2)}; platform_deployment_usd=${Math.round(inputs.platformBudget)}; incident_rate_pct=${inputs.incidentRate}; incident_cost_usd=${inputs.incidentCost}; addressable_pct=${inputs.addressableRate}; modeled_subtotal_usd=${Math.round(modeled.totalFirstYearInvestment)}; addressable_value_usd=${Math.round(modeled.addressableValue)}; net_year_1_usd=${Math.round(modeled.netModeledValue)}; roi_year_1_pct=${modeled.roi.toFixed(1)}; payback_year_1_months=${modeled.paybackMonths == null ? "not_reached" : modeled.paybackMonths.toFixed(1)}; trace_events=${modeled.annualTraceEvents}; iota_events_per_proof=${inputs.iotaAnchorEvery}; iota_proofs=${modeled.annualIotaAnchors}; polygon_action_rate_pct=${inputs.polygonActionRate}; polygon_actions=${modeled.annualPolygonActions}.`;
  const leadHref = `/?contact=quote&intent=pricing_roi&vertical=${activeScenario}&volume=${Math.round(inputs.annualUnits)}&message=${encodeURIComponent(leadMessage)}#contact-modal`;
  const demoHref = `/demo-lab?scenario=${activePreset.demoScenario}`;

  function selectScenario(key: ScenarioKey) {
    setActiveScenario(key);
    setInputs(PRESETS[key]);
    setDraftInputs({});
  }

  function updateInput(key: keyof PricingScenarioInputs, value: number, min: number, max: number) {
    setInputs((current) => ({ ...current, [key]: normalizePricingInput(key, value, min, max) }));
    clearDraftInput(key);
  }

  function clearDraftInput(key: keyof PricingScenarioInputs) {
    setDraftInputs((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function updateDraftInput(
    key: keyof PricingScenarioInputs,
    rawValue: string,
    min: number,
    max: number,
  ) {
    setDraftInputs((current) => ({ ...current, [key]: rawValue }));
    const nextValue = parsePricingDraftInput(key, rawValue, min, max);
    if (nextValue == null) return;
    setInputs((current) => ({ ...current, [key]: nextValue }));
  }

  function commitDraftInput(
    key: keyof PricingScenarioInputs,
    rawValue: string,
    min: number,
    max: number,
  ) {
    const nextValue = parsePricingDraftInput(key, rawValue, min, max);
    if (nextValue == null) {
      clearDraftInput(key);
      return;
    }
    updateInput(key, nextValue, min, max);
  }

  const commercialControls: Array<{ key: keyof PricingScenarioInputs; min: number; max: number; step: number; suffix: string }> = [
    { key: "annualUnits", min: 1_000, max: 2_000_000, step: 1_000, suffix: "" },
    { key: "tagUnitCost", min: 0.01, max: 2.5, step: 0.01, suffix: " USD" },
    { key: "platformBudget", min: 2_500, max: 250_000, step: 2_500, suffix: " USD" },
    { key: "incidentRate", min: 0.1, max: 10, step: 0.05, suffix: "%" },
    { key: "incidentCost", min: 1, max: 1_000, step: 1, suffix: " USD" },
    { key: "addressableRate", min: 5, max: 90, step: 5, suffix: "%" },
  ];
  const architectureControls: Array<{ key: keyof PricingScenarioInputs; min: number; max: number; step: number; suffix: string }> = [
    { key: "traceEventsPerUnit", min: 0, max: 20, step: 0.05, suffix: "" },
    { key: "iotaAnchorEvery", min: 0, max: 1_000, step: 1, suffix: " events" },
    { key: "polygonActionRate", min: 0, max: 100, step: 0.1, suffix: "%" },
  ];

  function renderControl(control: { key: keyof PricingScenarioInputs; min: number; max: number; step: number; suffix: string }) {
    const [label, helper] = copy.controls[control.key];
    const value = inputs[control.key];
    const labelId = `pricing-${control.key}-label`;
    const helpId = `pricing-${control.key}-help`;
    return (
      <div key={control.key} className="nexid-pricing-roi__control">
        <span className="nexid-pricing-roi__control-copy">
          <strong id={labelId}>{label}</strong>
          <small id={helpId}>{helper}</small>
        </span>
        <span className="nexid-pricing-roi__control-value">
          <input
            type="number"
            inputMode="decimal"
            min={control.min}
            max={control.max}
            step={control.step}
            value={draftInputs[control.key] ?? String(value)}
            aria-labelledby={labelId}
            aria-describedby={helpId}
            onChange={(event) => updateDraftInput(control.key, event.currentTarget.value, control.min, control.max)}
            onBlur={(event) => commitDraftInput(control.key, event.currentTarget.value, control.min, control.max)}
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
          aria-describedby={helpId}
          onChange={(event) => updateInput(control.key, event.currentTarget.valueAsNumber, control.min, control.max)}
        />
      </div>
    );
  }

  return (
    <section id="roi" className="nexid-pricing-roi scroll-mt-24" aria-labelledby="pricing-roi-title">
      <header className="nexid-pricing-roi__header">
        <div>
          <span>{copy.eyebrow}</span>
          <h2 id="pricing-roi-title">{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
        <div className="nexid-pricing-roi__scenarios" role="group" aria-label={copy.eyebrow}>
          {SCENARIO_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={activeScenario === key}
              className={activeScenario === key ? "is-active" : undefined}
              onClick={() => selectScenario(key)}
            >
              <ScenarioIcon scenario={key} />
              <span>{copy.scenarios[key]}</span>
            </button>
          ))}
        </div>
        <p className="nexid-pricing-roi__preset-notice">{copy.presetNotice}</p>
      </header>

      <div className="nexid-pricing-roi__workspace">
        <div className="nexid-pricing-roi__inputs" aria-label={copy.eyebrow}>
          {commercialControls.map(renderControl)}
          <details className="nexid-pricing-roi__advanced">
            <summary>
              <span><Layers3 className="h-4 w-4" aria-hidden="true" />{copy.advanced}</span>
              <small>{copy.advancedHelp}</small>
            </summary>
            <div>{architectureControls.map(renderControl)}</div>
          </details>
        </div>

        <aside className="nexid-pricing-roi__results" aria-label={copy.resultsEyebrow}>
          <div className="nexid-pricing-roi__results-heading">
            <Calculator className="h-5 w-5" aria-hidden="true" />
            <span>{copy.resultsEyebrow}</span>
            <h3>{copy.resultsTitle}</h3>
          </div>
          <dl className="nexid-pricing-roi__metrics">
            <div>
              <dt><CircleDollarSign className="h-4 w-4" aria-hidden="true" />{copy.investment}</dt>
              <dd>{currency.format(modeled.totalFirstYearInvestment)}</dd>
            </div>
            <div>
              <dt><Package className="h-4 w-4" aria-hidden="true" />{copy.unitCost}</dt>
              <dd>{decimalCurrency.format(modeled.costPerUnit)}</dd>
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
              <dt>{copy.payback}</dt>
              <dd>{modeled.paybackMonths != null ? `${number.format(modeled.paybackMonths)} ${copy.months}` : copy.noPayback}</dd>
            </div>
          </dl>

          <section className="nexid-pricing-roi__architecture" aria-labelledby="pricing-architecture-title">
            <header>
              <Database className="h-5 w-5" aria-hidden="true" />
              <span>{copy.architectureEyebrow}</span>
              <h4 id="pricing-architecture-title">{copy.architectureTitle}</h4>
              <p>{copy.architectureBody}</p>
            </header>
            <dl>
              <div><dt>{copy.events}</dt><dd>{integer.format(modeled.annualTraceEvents)}</dd></div>
              <div><dt>{copy.iotaAnchors}</dt><dd>{integer.format(modeled.annualIotaAnchors)}</dd></div>
              <div><dt>{copy.polygonActions}</dt><dd>{integer.format(modeled.annualPolygonActions)}</dd></div>
              <div><dt>{copy.cadence}</dt><dd>{copy.cadenceValue(inputs.iotaAnchorEvery)}</dd></div>
              <div><dt>{copy.offChain}</dt><dd>{integer.format(modeled.offChainEvents)}</dd></div>
            </dl>
          </section>

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
