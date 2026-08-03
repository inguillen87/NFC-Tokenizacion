"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Layers3,
  PackageCheck,
  RadioTower,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  buildQuoteRecommendation,
  DEFAULT_QUOTE_INPUT,
  normalizeQuoteQuantity,
  QUOTE_CARRIERS,
  QUOTE_INTEGRATIONS,
  QUOTE_MODULES,
  QUOTE_OFFLINE_LEVELS,
  QUOTE_PACKAGING,
  QUOTE_PROOF_LAYERS,
  QUOTE_SECURITY_LEVELS,
  QUOTE_VERTICALS,
  type QuoteCarrier,
  type QuoteConfiguratorInput,
  type QuoteIntegration,
  type QuoteModule,
  type QuoteOfflineLevel,
  type QuotePackaging,
  type QuoteProofLayer,
  type QuoteSecurityLevel,
  type QuoteVertical,
  type QuoteWarning,
} from "./pricing-quote-model";

type PricingLocale = "en" | "pt-BR" | "es-AR";

const COPY = {
  en: {
    eyebrow: "Enterprise scope configurator",
    title: "Turn an operating requirement into a reviewable rollout brief.",
    body: "Configure media, security, packaging and integrations together. The result is a budgetary range for discovery—not a public tag tariff, invoice or supplier commitment.",
    formLabel: "Rollout requirements",
    fields: {
      vertical: "Vertical",
      quantity: "Units in scope",
      carrier: "Preferred carrier",
      security: "Security level",
      packaging: "Printing / packaging",
      integration: "Integration",
      offline: "Offline operation",
      proof: "Optional proof layer",
      modules: "Platform modules",
    },
    verticals: { wine: "Wine & spirits", agro: "Agro / seeds", chemicals: "Crop protection / chemicals", pharma: "Pharma", logistics: "Logistics", hospitality: "Hospitality & events", circular: "Circular packaging" },
    carriers: { "qr-gs1": "QR / GS1", "ntag-basic": "Basic NFC · NTAG213/215/216", ntag424: "Secure NFC · NTAG 424 DNA", ntag424tt: "Secure Seal · NTAG 424 DNA TT", uhf: "UHF RFID", iot: "IoT / sensor · discovery placeholder" },
    securityLevels: { standard: "Public identity / standard", sun: "Dynamic SUN / SDM evidence", tamper: "SUN + reported tamper state", regulated: "Governed cryptographic rollout" },
    packaging: { "digital-only": "Digital identity only", "blank-inlay": "Blank inlay / customer conversion", "printed-roll": "Printed roll", "converted-label": "Converted label integrated to packaging", "tamper-seal": "Custom seal / tail conversion", "industrial-line": "Industrial line qualification" },
    integrations: { guided: "Guided import / no custom integration", "api-webhooks": "API + signed webhooks", "erp-crm": "ERP / CRM / WMS integration", managed: "Managed multi-system rollout" },
    offlineLevels: { online: "Online verification", "capture-sync": "Offline capture + later server validation", "public-certificate": "Signed public certificate", "field-bundle": "Managed field verifier bundle" },
    proofLayers: { none: "No public chain", iota: "IOTA integrity evidence", polygon: "Polygon ownership / certificate", both: "IOTA evidence + Polygon ownership" },
    moduleHint: "Core is always included. Select business modules; the recommendation may add modules required by the security architecture.",
    recommendation: "Recommended architecture",
    selectedCarrier: "Configured media",
    budgetTitle: "Budgetary range",
    hardware: "Hardware + converted media",
    setup: "Discovery + implementation",
    saas: "Monthly SaaS + operations",
    estimateBadge: "Estimate · configurable",
    pilot: "Recommended pilot",
    pilotText: (min: string, max: string, weeks: number) => `${min}–${max} units over ${weeks} weeks, with acceptance criteria agreed before encoding.`,
    modules: "Recommended modules",
    proofTitle: "Chain policy",
    proofNone: "Keep routine NFC/QR validation and trace events off-chain. Add a public proof only when the business case needs it.",
    proofIota: "IOTA is optional and event-driven: anchor grouped hashes at milestones or an agreed cadence—not on every tap.",
    proofPolygon: "Polygon is optional and event-driven: use it for approved ownership, warranty or certificate actions—not on every tap.",
    proofBoth: "IOTA anchors grouped integrity evidence; Polygon handles approved ownership or certificate actions. Neither network is called on every tap.",
    disclaimer: "USD planning bands only. Final pricing requires supplier quotes and technical discovery. Tax, freight, duties, financing, reader infrastructure, carrier certification, live-network fees and out-of-scope work are excluded unless the final proposal states otherwise.",
    cta: "Request a scoped quote",
    ctaHint: "The brief is carried into the enterprise contact flow.",
    compareEyebrow: "Carrier decision guide",
    compareTitle: "QR, NFC, TT, UHF and IoT solve different jobs.",
    compareBody: "Choose by threat model, read distance, packaging and operational workflow. A digital signal never proves physical contents or custody by itself.",
    compareHeaders: ["Carrier", "How it is read", "Evidence", "Best fit", "Boundary"],
    compareRows: [
      ["QR / GS1", "Any camera", "Public identifier; no anti-clone cryptography", "DPP, campaigns, high-volume identity", "A copied code can resolve too"],
      ["Basic NFC", "Consumer phone tap", "Static UID / NDEF experience", "Engagement, warranty and premium UX", "No dynamic SUN evidence"],
      ["NTAG 424 DNA", "Consumer phone tap", "Dynamic SUN / SDM message and replay signals", "Higher-risk product identity", "Valid message is not physical-content proof"],
      ["NTAG 424 DNA TT", "Consumer phone tap", "SUN plus reported TT state", "Seals, closures and controlled packaging", "TT meaning depends on mechanical integration"],
      ["UHF RFID", "UHF readers at range", "Bulk inventory identity and reported read events", "Cases, pallets, warehouses and gates", "Not a native consumer-phone flow"],
      ["IoT / sensor", "Gateway, cellular or device network", "Reported telemetry with device-specific trust", "Cold chain, assets and environmental evidence", "Requires sensor, calibration and connectivity discovery"],
    ],
    warnings: {
      "estimate-only": "This is a planning range, not an offer or supplier commitment.",
      "carrier-upgraded": "The preferred carrier was upgraded to meet the selected cryptographic security level.",
      "hybrid-carrier": "The recommendation uses an industrial carrier plus secure NFC because one medium does not cover both workflows.",
      "tamper-packaging-validation": "TT reports a tag state; packaging engineering must validate tail placement and the physical interpretation.",
      "offline-not-live-sun": "Offline capture is pending until server sync. A signed public certificate does not prove live SUN freshness, current tamper state or ownership.",
      "iota-event-driven": "IOTA is modeled for milestones or grouped hashes, never as a mandatory write per tap.",
      "polygon-event-driven": "Polygon is modeled for approved ownership/certificate actions, never as a mandatory write per tap.",
      "network-fees-excluded": "Live-network gas is variable and excluded from these planning bands.",
      "iot-discovery": "IoT is a discovery placeholder: sensor, enclosure, power, calibration and connectivity can materially change the range.",
    },
  },
  "pt-BR": {
    eyebrow: "Configurador de escopo enterprise",
    title: "Transforme a necessidade operacional em um brief revisavel.",
    body: "Configure midia, seguranca, packaging e integracoes em conjunto. O resultado e uma faixa orcamentaria para discovery, nao uma tarifa publica, fatura ou compromisso de fornecedor.",
    formLabel: "Requisitos do rollout",
    fields: { vertical: "Vertical", quantity: "Unidades no escopo", carrier: "Carrier preferido", security: "Nivel de seguranca", packaging: "Impressao / packaging", integration: "Integracao", offline: "Operacao offline", proof: "Proof layer opcional", modules: "Modulos da plataforma" },
    verticals: { wine: "Vinhos e bebidas", agro: "Agro / sementes", chemicals: "Defensivos / quimicos", pharma: "Pharma", logistics: "Logistica", hospitality: "Hospitality e eventos", circular: "Packaging circular" },
    carriers: { "qr-gs1": "QR / GS1", "ntag-basic": "NFC basico · NTAG213/215/216", ntag424: "NFC seguro · NTAG 424 DNA", ntag424tt: "Secure Seal · NTAG 424 DNA TT", uhf: "UHF RFID", iot: "IoT / sensor · placeholder de discovery" },
    securityLevels: { standard: "Identidade publica / standard", sun: "Evidencia dinamica SUN / SDM", tamper: "SUN + estado tamper reportado", regulated: "Rollout criptografico governado" },
    packaging: { "digital-only": "Somente identidade digital", "blank-inlay": "Inlay blank / conversao do cliente", "printed-roll": "Rolo impresso", "converted-label": "Etiqueta convertida integrada ao packaging", "tamper-seal": "Selo / tail custom", "industrial-line": "Qualificacao de linha industrial" },
    integrations: { guided: "Import guiado / sem integracao custom", "api-webhooks": "API + webhooks assinados", "erp-crm": "Integracao ERP / CRM / WMS", managed: "Rollout multi-sistema gerenciado" },
    offlineLevels: { online: "Verificacao online", "capture-sync": "Captura offline + validacao posterior", "public-certificate": "Certificado publico assinado", "field-bundle": "Bundle gerenciado para campo" },
    proofLayers: { none: "Sem blockchain publica", iota: "Evidencia de integridade IOTA", polygon: "Ownership / certificado Polygon", both: "Evidencia IOTA + ownership Polygon" },
    moduleHint: "Core esta sempre incluido. Selecione modulos de negocio; a recomendacao pode somar modulos exigidos pela arquitetura.",
    recommendation: "Arquitetura recomendada", selectedCarrier: "Midia configurada", budgetTitle: "Faixa orcamentaria", hardware: "Hardware + midia convertida", setup: "Discovery + implementacao", saas: "SaaS mensal + operacao", estimateBadge: "Estimativa · configuravel", pilot: "Piloto recomendado",
    pilotText: (min: string, max: string, weeks: number) => `${min}–${max} unidades durante ${weeks} semanas, com criterios de aceite acordados antes do encoding.`,
    modules: "Modulos recomendados", proofTitle: "Politica de blockchain",
    proofNone: "Mantenha validacoes NFC/QR e eventos de trace off-chain. Some prova publica apenas quando o caso de negocio exigir.",
    proofIota: "IOTA e opcional e event-driven: ancora hashes agrupados em marcos ou cadencia acordada, nao em cada tap.",
    proofPolygon: "Polygon e opcional e event-driven: use para ownership, garantia ou certificado aprovados, nao em cada tap.",
    proofBoth: "IOTA ancora evidencia de integridade agrupada; Polygon trata ownership ou certificados aprovados. Nenhuma rede e chamada em cada tap.",
    disclaimer: "Faixas de planejamento em USD. O preco final exige cotacao de fornecedores e discovery tecnico. Impostos, frete, taxas, financiamento, leitores, certificacao do carrier, gas de rede real e trabalho fora do escopo ficam excluidos salvo indicacao expressa na proposta.",
    cta: "Solicitar cotacao por escopo", ctaHint: "O brief segue para o contato enterprise.",
    compareEyebrow: "Guia de decisao", compareTitle: "QR, NFC, TT, UHF e IoT resolvem trabalhos diferentes.", compareBody: "Escolha por threat model, distancia de leitura, packaging e operacao. Um sinal digital nao prova sozinho conteudo fisico ou custodia.",
    compareHeaders: ["Carrier", "Leitura", "Evidencia", "Melhor uso", "Limite"],
    compareRows: [
      ["QR / GS1", "Qualquer camera", "Identificador publico; sem criptografia anti-clone", "DPP, campanhas e identidade de volume", "Uma copia tambem pode resolver"],
      ["NFC basico", "Tap com celular", "UID / NDEF estatico", "Engagement, garantia e UX premium", "Sem evidencia SUN dinamica"],
      ["NTAG 424 DNA", "Tap com celular", "Mensagem SUN / SDM dinamica e sinais de replay", "Identidade de maior risco", "Mensagem valida nao prova conteudo fisico"],
      ["NTAG 424 DNA TT", "Tap com celular", "SUN mais estado TT reportado", "Selos e packaging controlado", "O sentido de TT depende da integracao mecanica"],
      ["UHF RFID", "Leitores UHF a distancia", "Identidade de inventario e leituras reportadas", "Caixas, pallets, armazens e portais", "Nao e fluxo nativo de celular"],
      ["IoT / sensor", "Gateway, celular ou rede do device", "Telemetria reportada com trust especifico", "Cold chain, ativos e ambiente", "Exige discovery de sensor, calibracao e conectividade"],
    ],
    warnings: {
      "estimate-only": "Esta e uma faixa de planejamento, nao oferta nem compromisso do fornecedor.",
      "carrier-upgraded": "O carrier foi elevado para cumprir o nivel criptografico selecionado.",
      "hybrid-carrier": "A recomendacao combina carrier industrial com NFC seguro porque uma unica midia nao cobre os dois fluxos.",
      "tamper-packaging-validation": "TT reporta um estado da tag; engenharia de packaging deve validar tail e interpretacao fisica.",
      "offline-not-live-sun": "A captura offline fica pendente ate sincronizar. Certificado publico nao prova SUN ao vivo, tamper atual ou ownership.",
      "iota-event-driven": "IOTA e modelado para marcos ou hashes agrupados, nunca como escrita obrigatoria por tap.",
      "polygon-event-driven": "Polygon e modelado para ownership/certificado aprovado, nunca como escrita obrigatoria por tap.",
      "network-fees-excluded": "Gas de rede real e variavel e esta excluido destas faixas.",
      "iot-discovery": "IoT e placeholder de discovery: sensor, enclosure, energia, calibracao e conectividade podem mudar a faixa.",
    },
  },
  "es-AR": {
    eyebrow: "Configurador de alcance enterprise",
    title: "Convertí una necesidad operativa en un brief revisable.",
    body: "Configurá soporte, seguridad, packaging e integraciones en conjunto. El resultado es una banda presupuestaria para discovery: no es una tarifa pública de tags, una factura ni un compromiso de proveedor.",
    formLabel: "Requisitos del rollout",
    fields: { vertical: "Vertical", quantity: "Unidades en alcance", carrier: "Carrier preferido", security: "Nivel de seguridad", packaging: "Impresión / packaging", integration: "Integración", offline: "Operación offline", proof: "Proof layer opcional", modules: "Módulos de plataforma" },
    verticals: { wine: "Vinos y bebidas", agro: "Agro / semillas", chemicals: "Agroquímicos", pharma: "Pharma", logistics: "Logística", hospitality: "Hospitality y eventos", circular: "Packaging circular" },
    carriers: { "qr-gs1": "QR / GS1", "ntag-basic": "NFC básico · NTAG213/215/216", ntag424: "NFC seguro · NTAG 424 DNA", ntag424tt: "Secure Seal · NTAG 424 DNA TT", uhf: "UHF RFID", iot: "IoT / sensor · placeholder de discovery" },
    securityLevels: { standard: "Identidad pública / estándar", sun: "Evidencia dinámica SUN / SDM", tamper: "SUN + estado tamper reportado", regulated: "Rollout criptográfico gobernado" },
    packaging: { "digital-only": "Solo identidad digital", "blank-inlay": "Inlay blank / conversión del cliente", "printed-roll": "Rollo impreso", "converted-label": "Etiqueta convertida integrada al packaging", "tamper-seal": "Sello / tail a medida", "industrial-line": "Calificación de línea industrial" },
    integrations: { guided: "Importación guiada / sin integración custom", "api-webhooks": "API + webhooks firmados", "erp-crm": "Integración ERP / CRM / WMS", managed: "Rollout multi-sistema gestionado" },
    offlineLevels: { online: "Verificación online", "capture-sync": "Captura offline + validación posterior", "public-certificate": "Certificado público firmado", "field-bundle": "Bundle gestionado para campo" },
    proofLayers: { none: "Sin blockchain pública", iota: "Evidencia de integridad IOTA", polygon: "Ownership / certificado Polygon", both: "Evidencia IOTA + ownership Polygon" },
    moduleHint: "Core siempre está incluido. Elegí módulos de negocio; la recomendación puede sumar los módulos exigidos por la arquitectura de seguridad.",
    recommendation: "Arquitectura recomendada", selectedCarrier: "Soporte configurado", budgetTitle: "Banda presupuestaria", hardware: "Hardware + soporte convertido", setup: "Discovery + implementación", saas: "SaaS mensual + operación", estimateBadge: "Estimación · configurable", pilot: "Piloto recomendado",
    pilotText: (min: string, max: string, weeks: number) => `${min}–${max} unidades durante ${weeks} semanas, con criterios de aceptación acordados antes del encoding.`,
    modules: "Módulos recomendados", proofTitle: "Política blockchain",
    proofNone: "Mantené las validaciones NFC/QR y los eventos de trazabilidad off-chain. Sumá una prueba pública solo cuando el caso de negocio lo necesite.",
    proofIota: "IOTA es opcional y event-driven: ancla hashes agrupados en hitos o con una cadencia acordada, no en cada tap.",
    proofPolygon: "Polygon es opcional y event-driven: usalo para ownership, garantía o certificados aprobados, no en cada tap.",
    proofBoth: "IOTA ancla evidencia de integridad agrupada; Polygon gestiona ownership o certificados aprobados. Ninguna red se invoca en cada tap.",
    disclaimer: "Bandas de planificación en USD. El precio final requiere cotizaciones de proveedor y discovery técnico. Impuestos, flete, aranceles, financiación, lectores, certificación del carrier, gas de red real y trabajo fuera de alcance quedan excluidos salvo indicación expresa de la propuesta.",
    cta: "Solicitar cotización por alcance", ctaHint: "El brief se transfiere al contacto enterprise.",
    compareEyebrow: "Guía de decisión", compareTitle: "QR, NFC, TT, UHF e IoT resuelven trabajos distintos.", compareBody: "Elegí por threat model, distancia de lectura, packaging y operación. Una señal digital nunca prueba por sí sola el contenido físico ni la custodia.",
    compareHeaders: ["Carrier", "Cómo se lee", "Evidencia", "Mejor uso", "Límite"],
    compareRows: [
      ["QR / GS1", "Cualquier cámara", "Identificador público; sin criptografía anti-copia", "DPP, campañas e identidad de alto volumen", "Un código copiado también puede resolver"],
      ["NFC básico", "Tap con celular", "UID / NDEF estático", "Engagement, garantía y UX premium", "Sin evidencia SUN dinámica"],
      ["NTAG 424 DNA", "Tap con celular", "Mensaje SUN / SDM dinámico y señales de replay", "Identidad de producto de mayor riesgo", "Mensaje válido no prueba contenido físico"],
      ["NTAG 424 DNA TT", "Tap con celular", "SUN más estado TT reportado", "Sellos, cierres y packaging controlado", "El significado TT depende de la integración mecánica"],
      ["UHF RFID", "Lectores UHF a distancia", "Identidad de inventario y lecturas reportadas", "Cajas, pallets, depósitos y portales", "No es un flujo nativo de celular"],
      ["IoT / sensor", "Gateway, celular o red del dispositivo", "Telemetría reportada con trust específico", "Cold chain, activos y evidencia ambiental", "Exige discovery de sensor, calibración y conectividad"],
    ],
    warnings: {
      "estimate-only": "Esta es una banda de planificación, no una oferta ni un compromiso de proveedor.",
      "carrier-upgraded": "El carrier preferido fue elevado para cumplir el nivel criptográfico seleccionado.",
      "hybrid-carrier": "La recomendación combina carrier industrial con NFC seguro porque un solo medio no cubre ambos flujos.",
      "tamper-packaging-validation": "TT reporta un estado de la tag; ingeniería de packaging debe validar el tail y su interpretación física.",
      "offline-not-live-sun": "La captura offline queda pendiente hasta sincronizar. Un certificado público no prueba SUN en vivo, tamper actual ni ownership.",
      "iota-event-driven": "IOTA se modela para hitos o hashes agrupados, nunca como escritura obligatoria por tap.",
      "polygon-event-driven": "Polygon se modela para ownership/certificados aprobados, nunca como escritura obligatoria por tap.",
      "network-fees-excluded": "El gas de red real es variable y queda fuera de estas bandas.",
      "iot-discovery": "IoT es un placeholder de discovery: sensor, enclosure, energía, calibración y conectividad pueden cambiar la banda.",
    },
  },
} as const;

const MODULE_LABELS: Record<QuoteModule, string> = {
  core: "nexID Core",
  secure: "nexID Secure",
  seal: "nexID Seal",
  ownership: "nexID Ownership",
  proof: "nexID Proof Layer",
  industrial: "nexID Industrial Trace",
  events: "nexID Events",
  hospitality: "nexID Hospitality",
  agro: "nexID Agro",
};

function SelectField({
  id,
  label,
  value,
  values,
  labels,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  values: readonly string[];
  labels: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-black text-slate-800" htmlFor={id}>
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100"
      >
        {values.map((option) => <option key={option} value={option}>{labels[option]}</option>)}
      </select>
    </label>
  );
}

export function PricingQuoteConfigurator({ locale }: { locale: PricingLocale }) {
  const copy = COPY[locale];
  const [input, setInput] = useState<QuoteConfiguratorInput>(DEFAULT_QUOTE_INPUT);
  const [quantityDraft, setQuantityDraft] = useState(String(DEFAULT_QUOTE_INPUT.quantity));
  const recommendation = useMemo(() => buildQuoteRecommendation(input), [input]);
  const currency = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }), [locale]);
  const integer = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);

  function updateInput(next: Partial<QuoteConfiguratorInput>) {
    setInput((current) => ({ ...current, ...next }));
  }

  function updateQuantity(raw: string) {
    setQuantityDraft(raw);
    if (raw.trim() === "") return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) updateInput({ quantity: normalizeQuoteQuantity(parsed) });
  }

  function commitQuantity() {
    const normalized = normalizeQuoteQuantity(Number(quantityDraft));
    setQuantityDraft(String(normalized));
    updateInput({ quantity: normalized });
  }

  function toggleModule(module: QuoteModule) {
    if (module === "core") return;
    const modules = input.modules.includes(module)
      ? input.modules.filter((item) => item !== module)
      : [...input.modules, module];
    updateInput({ modules });
  }

  const carrierSummary = recommendation.effectiveCarriers.map((carrier) => copy.carriers[carrier]).join(" + ");
  const range = (value: { min: number; max: number }) => `${currency.format(value.min)} – ${currency.format(value.max)}`;
  const proofCopy = input.proof === "both" ? copy.proofBoth : input.proof === "iota" ? copy.proofIota : input.proof === "polygon" ? copy.proofPolygon : copy.proofNone;
  const leadMessage = [
    "nexID budgetary scope configurator (not a quote)",
    `vertical=${input.vertical}`,
    `quantity=${input.quantity}`,
    `preferred_carrier=${input.carrier}`,
    `effective_carriers=${recommendation.effectiveCarriers.join("+")}`,
    `security=${input.security}`,
    `packaging=${input.packaging}`,
    `modules=${recommendation.modules.join(",")}`,
    `integration=${input.integration}`,
    `offline=${input.offline}`,
    `proof=${input.proof}`,
    `hardware_budget_usd=${recommendation.hardware.min}-${recommendation.hardware.max}`,
    `setup_budget_usd=${recommendation.setup.min}-${recommendation.setup.max}`,
    `monthly_saas_budget_usd=${recommendation.monthlySaas.min}-${recommendation.monthlySaas.max}`,
    "polygon_iota_event_driven=true",
  ].join("; ");
  const leadHref = `/?contact=quote&intent=pricing_enterprise&vertical=${input.vertical}&volume=${input.quantity}&message=${encodeURIComponent(leadMessage)}#contact-modal`;

  return (
    <section className="my-6 grid gap-8" aria-labelledby="quote-configurator-title">
      <div className="overflow-hidden rounded-[2rem] border border-cyan-200 bg-white shadow-2xl shadow-cyan-100/70">
        <header className="grid gap-4 border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 text-white md:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-3xl">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">{copy.eyebrow}</span>
            <h2 id="quote-configurator-title" className="mt-3 text-3xl font-black leading-tight md:text-4xl">{copy.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">{copy.body}</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-amber-200">
            <Sparkles className="h-4 w-4" aria-hidden="true" />{copy.estimateBadge}
          </span>
        </header>

        <div className="grid min-w-0 gap-0 xl:grid-cols-[minmax(0,1.08fr)_minmax(24rem,0.92fr)]">
          <form className="grid content-start gap-5 p-5 md:p-8" aria-label={copy.formLabel} onSubmit={(event) => event.preventDefault()}>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField id="quote-vertical" label={copy.fields.vertical} value={input.vertical} values={QUOTE_VERTICALS} labels={copy.verticals} onChange={(value) => updateInput({ vertical: value as QuoteVertical })} />
              <label className="grid gap-2 text-sm font-black text-slate-800" htmlFor="quote-quantity">
                {copy.fields.quantity}
                <input
                  id="quote-quantity"
                  type="number"
                  inputMode="numeric"
                  min={100}
                  max={5_000_000}
                  step={100}
                  value={quantityDraft}
                  onChange={(event) => updateQuantity(event.currentTarget.value)}
                  onBlur={commitQuantity}
                  className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100"
                />
              </label>
              <SelectField id="quote-carrier" label={copy.fields.carrier} value={input.carrier} values={QUOTE_CARRIERS} labels={copy.carriers} onChange={(value) => updateInput({ carrier: value as QuoteCarrier })} />
              <SelectField id="quote-security" label={copy.fields.security} value={input.security} values={QUOTE_SECURITY_LEVELS} labels={copy.securityLevels} onChange={(value) => updateInput({ security: value as QuoteSecurityLevel })} />
              <SelectField id="quote-packaging" label={copy.fields.packaging} value={input.packaging} values={QUOTE_PACKAGING} labels={copy.packaging} onChange={(value) => updateInput({ packaging: value as QuotePackaging })} />
              <SelectField id="quote-integration" label={copy.fields.integration} value={input.integration} values={QUOTE_INTEGRATIONS} labels={copy.integrations} onChange={(value) => updateInput({ integration: value as QuoteIntegration })} />
              <SelectField id="quote-offline" label={copy.fields.offline} value={input.offline} values={QUOTE_OFFLINE_LEVELS} labels={copy.offlineLevels} onChange={(value) => updateInput({ offline: value as QuoteOfflineLevel })} />
              <SelectField id="quote-proof" label={copy.fields.proof} value={input.proof} values={QUOTE_PROOF_LAYERS} labels={copy.proofLayers} onChange={(value) => updateInput({ proof: value as QuoteProofLayer })} />
            </div>

            <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <legend className="px-2 text-sm font-black text-slate-900">{copy.fields.modules}</legend>
              <p className="mb-4 text-xs leading-5 text-slate-600">{copy.moduleHint}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {QUOTE_MODULES.map((module) => {
                  const checked = module === "core" || input.modules.includes(module);
                  return (
                    <label key={module} className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition ${checked ? "border-cyan-300 bg-cyan-50 text-cyan-950" : "border-slate-200 bg-white text-slate-600"}`}>
                      <input type="checkbox" checked={checked} disabled={module === "core"} onChange={() => toggleModule(module)} className="h-4 w-4 accent-cyan-700" />
                      {MODULE_LABELS[module]}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </form>

          <aside className="grid content-start gap-5 border-t border-slate-200 bg-slate-950 p-5 text-white md:p-8 xl:border-l xl:border-t-0" aria-labelledby="quote-recommendation-title">
            <p className="sr-only" role="status" aria-live="polite">
              {recommendation.packageName}. {copy.hardware}: {range(recommendation.hardware)}. {copy.setup}: {range(recommendation.setup)}. {copy.saas}: {range(recommendation.monthlySaas)}.
            </p>
            <div>
              <span className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{copy.recommendation}</span>
              <h3 id="quote-recommendation-title" className="mt-2 text-3xl font-black">{recommendation.packageName}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300"><strong className="text-white">{copy.selectedCarrier}:</strong> {carrierSummary}</p>
            </div>

            <section aria-labelledby="quote-budget-title">
              <div className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                <h4 id="quote-budget-title" className="text-sm font-black uppercase tracking-wider text-slate-200">{copy.budgetTitle}</h4>
              </div>
              <dl className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                {[
                  [copy.hardware, range(recommendation.hardware)],
                  [copy.setup, range(recommendation.setup)],
                  [copy.saas, range(recommendation.monthlySaas)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <dt className="text-[0.65rem] font-black uppercase tracking-wider text-slate-400">{label}</dt>
                    <dd className="mt-2 text-lg font-black text-white">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4" aria-labelledby="quote-pilot-title">
              <div className="flex items-center gap-2 text-emerald-200"><ClipboardCheck className="h-5 w-5" aria-hidden="true" /><h4 id="quote-pilot-title" className="text-sm font-black">{copy.pilot}</h4></div>
              <p className="mt-2 text-sm leading-6 text-emerald-50">{copy.pilotText(integer.format(recommendation.pilot.minUnits), integer.format(recommendation.pilot.maxUnits), recommendation.pilot.weeks)}</p>
            </section>

            <section aria-labelledby="quote-modules-title">
              <div className="flex items-center gap-2 text-cyan-200"><Layers3 className="h-5 w-5" aria-hidden="true" /><h4 id="quote-modules-title" className="text-sm font-black">{copy.modules}</h4></div>
              <div className="mt-3 flex flex-wrap gap-2">
                {recommendation.modules.map((module) => <span key={module} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-black text-cyan-100">{MODULE_LABELS[module]}</span>)}
              </div>
            </section>

            <section className="rounded-2xl border border-violet-300/20 bg-violet-300/10 p-4" aria-labelledby="quote-proof-title">
              <div className="flex items-center gap-2 text-violet-200"><RadioTower className="h-5 w-5" aria-hidden="true" /><h4 id="quote-proof-title" className="text-sm font-black">{copy.proofTitle}</h4></div>
              <p className="mt-2 text-sm leading-6 text-violet-50">{proofCopy}</p>
            </section>

            <ul className="grid gap-2">
              {recommendation.warnings.map((warning: QuoteWarning) => (
                <li key={warning} className="flex gap-2 text-xs leading-5 text-slate-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />{copy.warnings[warning]}</li>
              ))}
            </ul>
            <p className="border-l-2 border-amber-300 pl-3 text-xs leading-5 text-slate-400">{copy.disclaimer}</p>
            <a href={leadHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-4 focus:ring-cyan-200">
              {copy.cta}<ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <p className="-mt-3 text-center text-[0.68rem] text-slate-500">{copy.ctaHint}</p>
          </aside>
        </div>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60" aria-labelledby="carrier-comparison-title">
        <header className="grid gap-3 border-b border-slate-200 p-6 md:p-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"><Boxes className="h-6 w-6" aria-hidden="true" /></div>
          <div>
            <span className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">{copy.compareEyebrow}</span>
            <h2 id="carrier-comparison-title" className="mt-1 text-2xl font-black text-slate-950 md:text-3xl">{copy.compareTitle}</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{copy.compareBody}</p>
          </div>
        </header>
        <div className="grid gap-3 p-4 md:hidden">
          {copy.compareRows.map((row) => (
            <article key={`mobile-${row[0]}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-base font-black text-cyan-800">{row[0]}</h3>
              <dl className="mt-3 grid gap-3">
                {row.slice(1).map((cell, index) => (
                  <div key={`${row[0]}-mobile-${index}`}>
                    <dt className="text-[0.62rem] font-black uppercase tracking-wider text-slate-500">{copy.compareHeaders[index + 1]}</dt>
                    <dd className={`mt-1 text-sm leading-5 ${index === 3 ? "font-bold text-amber-800" : "text-slate-700"}`}>{cell}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
        <div className="hidden max-w-full overflow-x-auto md:block">
          <table className="w-full min-w-[920px] border-collapse">
            <thead className="bg-slate-50">
              <tr>{copy.compareHeaders.map((header) => <th key={header} className="border-b border-slate-200 p-4 text-left text-[0.68rem] font-black uppercase tracking-wider text-slate-700">{header}</th>)}</tr>
            </thead>
            <tbody>
              {copy.compareRows.map((row) => (
                <tr key={row[0]} className="odd:bg-white even:bg-slate-50/60">
                  {row.map((cell, index) => <td key={`${row[0]}-${index}`} className={`border-b border-slate-100 p-4 align-top text-sm leading-6 ${index === 0 ? "font-black text-cyan-800" : index === 4 ? "font-bold text-amber-800" : "text-slate-600"}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-start gap-2 bg-amber-50 p-4 text-xs leading-5 text-amber-950 md:px-8">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{copy.compareBody}
        </div>
      </section>
    </section>
  );
}
