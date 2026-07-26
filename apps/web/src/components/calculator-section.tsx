"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, SectionHeading } from "@product/ui";

import type { LandingContent } from "../lib/landing-content";
import { pricingPlans, type AppLocale } from "@product/config";

type CalculatorCopy = LandingContent["calculator"];

const volumeOptions = [10000, 25000, 50000, 100000] as const;

type ProductType = "wine" | "cosmetics" | "events" | "pharma";
type SecurityLevel = "basic" | "secure" | "enterprise";
type ChannelType = "direct" | "reseller";
type CarrierProfile = {
  name: string;
  unit: string;
  fit: string;
  unlocks: string;
  policy: string;
  suggestedFor: SecurityLevel[];
};

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

const defaultContributionPerActiveUnit: Record<ProductType, number> = {
  wine: 2,
  cosmetics: 1.5,
  events: 0.75,
  pharma: 3,
};

const defaultCoveragePct: Record<SecurityLevel, number> = {
  basic: 78,
  secure: 92,
  enterprise: 92,
};

const resellerMarkupPct = {
  hardware: 42,
  setup: 55,
  saas: 32,
} as const;

const monthlySoftwareUsd: Record<SecurityLevel, number> = {
  basic: pricingPlans.find((plan) => plan.slug === "basic")?.monthlyUsd ?? 99,
  secure: pricingPlans.find((plan) => plan.slug === "secure")?.monthlyUsd ?? 249,
  enterprise: pricingPlans.find((plan) => plan.slug === "enterprise")?.monthlyUsd ?? 499,
};

const securityCosts: Record<SecurityLevel, { hardware: number; encoding: number; monthlySoftwareBaseUsd: number; setup: number; scope: "base" | "extended" | "advanced"; plan: string }> = {
  basic: { hardware: 0.06, encoding: 0.02, monthlySoftwareBaseUsd: monthlySoftwareUsd.basic, setup: 650, scope: "base", plan: "BASIC QR/NTAG213" },
  secure: { hardware: 0.34, encoding: 0.07, monthlySoftwareBaseUsd: monthlySoftwareUsd.secure, setup: 2200, scope: "extended", plan: "SECURE NTAG215/424 DNA" },
  enterprise: { hardware: 1.0, encoding: 0.14, monthlySoftwareBaseUsd: monthlySoftwareUsd.enterprise, setup: 5600, scope: "advanced", plan: "ENTERPRISE 424 DNA TT + TOKEN" },
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
  pricingBasis: string;
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
  contributionPerUnit: string;
  contributionHelp: string;
  coverageInput: string;
  modeledContribution: string;
  resellerAssumptions: string;
  marginModel: string;
  buyerValue: string;
  formulaTitle: string;
  directFormula: string;
  resellerFormula: string;
  carrierTitle: string;
  carrierBody: string;
  carrierUnit: string;
  carrierFit: string;
  carrierUnlocks: string;
  carrierPolicy: string;
  carrierRecommended: string;
}> = {
  "es-AR": {
    explain: "Elegis vertical, volumen, seguridad y canal. El modelo separa costo indicativo, valor retail de contexto, contribucion incremental editable y margen hipotetico.",
    enterpriseTitle: "Cliente empresa",
    enterpriseBody: "Ideal para bodegas, cosmetica, pharma o eventos que quieren evidencia digital, datos consentidos y beneficios post-tap.",
    resellerTitle: "Revendedor / white-label",
    resellerBody: "Modela venta al cliente final, utilidad bruta y MRR bruto para partners que revenden tags + SaaS + onboarding.",
    preset: "Preset industria",
    currency: "Moneda",
    pricingBasis: "Modelo únicamente en USD. El software parte de la misma tarifa pública desde USD 99 / 249 / 499 por mes y aplica un supuesto visible de escala por volumen. Hardware, encoding, setup, impuestos, logística y SLA se cotizan aparte; no es tipo de cambio ni factura.",
    share: "Copiar link",
    copied: "Link copiado",
    disclaimer: "Escenario comercial editable. No es una promesa de ROI, recupero, cobertura, margen ni resultado; no reemplaza cotizacion formal, impuestos, logistica ni datos medidos del piloto.",
    firstYearInvestment: "Inversion primer ano",
    costPerUnit: "Costo total por unidad",
    protectedRevenue: "Valor retail modelado (solo contexto)",
    costRatio: "Costo / contribucion modelada",
    resellerSale: "Venta estimada primer ano",
    resellerProfit: "Utilidad bruta estimada",
    resellerMargin: "Margen bruto",
    resellerMrr: "MRR bruto estimado",
    hardwareEncoding: "Hardware + encoding",
    setup: "Setup / go-live",
    annualSaas: "SaaS anual",
    activationScope: "Tags activables",
    assumptions: "Supuestos",
    assumptionsBody: "Incluye costos indicativos de etiqueta, encoding, SaaS anual y setup. Cobertura y contribucion incremental son supuestos editables: deben reemplazarse con datos del piloto. El valor retail es solo contexto y no equivale a ganancia recuperable.",
    investorTitle: "Fast lane inversores",
    investorBody: "Podemos modelar USD 25k o USD 50k en chips, encoding o software-only con escenarios de margen y rollout.",
    askBot: "Hablar con IA",
    askCeo: "WhatsApp CEO",
    scenarios: "Escenarios rapidos",
    modeLabel: "Que queres calcular?",
    decisionTitle: "Lectura simple",
    directDecision: "Para cliente empresa, el numero clave es el costo por unidad frente a la contribucion incremental medida que el programa realmente genera; el valor retail es solo contexto.",
    resellerDecision: "Para reseller, el numero clave es venta facturable, margen bruto y MRR bruto estimado por operar hardware + SaaS + onboarding.",
    breakEvenUnits: "Unidades activas para igualar costo modelado",
    activeCoverage: "Cobertura activa modelada",
    contributionPerUnit: "Contribucion incremental por unidad activa (USD)",
    contributionHelp: "Ganancia/contribucion adicional atribuible y medida por unidad activa; no uses precio retail ni valor protegido.",
    coverageInput: "Cobertura/activacion modelada (%)",
    modeledContribution: "Contribucion incremental modelada",
    resellerAssumptions: "Markups del modelo: hardware 42%, setup 55%, SaaS 32%. Son supuestos editables en una propuesta, no margenes garantizados.",
    marginModel: "Modelo de margen",
    buyerValue: "Supuesto de valor retail por unidad",
    formulaTitle: "Como leer el calculo",
    directFormula: "Punto de equilibrio modelado = inversion anual / contribucion incremental por unidad activa. La cobertura estima cuantas unidades se activan. Es una hipotesis, no garantia de recupero; el valor retail no entra en esa division.",
    resellerFormula: "Venta reseller aplica markups modelados de 42% hardware, 55% setup y 32% SaaS. Margen y MRR son escenarios, no compromisos comerciales.",
    carrierTitle: "Perfiles de etiqueta por presupuesto y riesgo",
    carrierBody: "La tecnologia se elige por objetivo comercial: contenido, serializacion, evidencia SUN/anti-replay, estado TT reportado o tokenizacion. El plan puede combinar QR/GS1 visible con NFC para que el rollout sea economico y escalable.",
    carrierUnit: "Costo etiqueta",
    carrierFit: "Uso ideal",
    carrierUnlocks: "Desbloquea",
    carrierPolicy: "Politica segura",
    carrierRecommended: "Recomendado para este calculo",
  },
  "pt-BR": {
    explain: "Escolha vertical, volume, seguranca e canal. O modelo separa custo indicativo, valor retail de contexto, contribuicao incremental editavel e margem hipotetica.",
    enterpriseTitle: "Cliente empresa",
    enterpriseBody: "Ideal para marcas que querem evidencia digital, dados consentidos e beneficios pos-toque.",
    resellerTitle: "Revendedor / white-label",
    resellerBody: "Modela venda ao cliente final, lucro bruto e MRR bruto para parceiros que revendem tags + SaaS + onboarding.",
    preset: "Preset da industria",
    currency: "Moeda",
    pricingBasis: "Modelo somente em USD. O software parte da mesma tarifa pública de USD 99 / 249 / 499 por mês e aplica uma premissa visível de escala por volume. Hardware, encoding, setup, impostos, logística e SLA são cotados separadamente; não é câmbio nem fatura.",
    share: "Copiar link",
    copied: "Link copiado",
    disclaimer: "Cenario comercial editavel. Nao promete ROI, retorno, cobertura, margem ou resultado; nao substitui proposta formal, impostos, logistica nem dados medidos do piloto.",
    firstYearInvestment: "Investimento primeiro ano",
    costPerUnit: "Custo total por unidade",
    protectedRevenue: "Valor retail modelado (somente contexto)",
    costRatio: "Custo / contribuicao modelada",
    resellerSale: "Venda estimada primeiro ano",
    resellerProfit: "Lucro bruto estimado",
    resellerMargin: "Margem bruta",
    resellerMrr: "MRR bruto estimado",
    hardwareEncoding: "Hardware + encoding",
    setup: "Setup / go-live",
    annualSaas: "SaaS anual",
    activationScope: "Tags ativaveis",
    assumptions: "Premissas",
    assumptionsBody: "Inclui custos indicativos de etiqueta, encoding, SaaS anual e setup. Cobertura e contribuicao incremental sao premissas editaveis que devem ser trocadas por dados do piloto. Valor retail e apenas contexto, nao lucro recuperavel.",
    investorTitle: "Fast lane investidores",
    investorBody: "Podemos modelar USD 25k ou USD 50k em chips, encoding ou software-only com cenarios de margem.",
    askBot: "Falar com IA",
    askCeo: "WhatsApp CEO",
    scenarios: "Cenarios rapidos",
    modeLabel: "O que voce quer calcular?",
    decisionTitle: "Leitura simples",
    directDecision: "Para cliente empresa, o numero chave e o custo por unidade frente a contribuicao incremental medida que o programa realmente gera; valor retail e apenas contexto.",
    resellerDecision: "Para reseller, o numero chave e venda faturavel, margem bruta e MRR bruto estimado para operar hardware + SaaS + onboarding.",
    breakEvenUnits: "Unidades ativas para igualar custo modelado",
    activeCoverage: "Cobertura ativa modelada",
    contributionPerUnit: "Contribuicao incremental por unidade ativa (USD)",
    contributionHelp: "Lucro/contribuicao adicional atribuivel e medido por unidade ativa; nao use preco retail nem valor protegido.",
    coverageInput: "Cobertura/ativacao modelada (%)",
    modeledContribution: "Contribuicao incremental modelada",
    resellerAssumptions: "Markups do modelo: hardware 42%, setup 55%, SaaS 32%. Sao premissas de proposta, nao margens garantidas.",
    marginModel: "Modelo de margem",
    buyerValue: "Premissa de valor retail por unidade",
    formulaTitle: "Como ler o calculo",
    directFormula: "Ponto de equilibrio modelado = investimento anual / contribuicao incremental por unidade ativa. A cobertura estima unidades ativadas. E hipotese, nao garantia de retorno; valor retail nao entra nessa divisao.",
    resellerFormula: "Venda reseller aplica markups modelados de 42% hardware, 55% setup e 32% SaaS. Margem e MRR sao cenarios, nao compromissos.",
    carrierTitle: "Perfis de etiqueta por orcamento e risco",
    carrierBody: "A tecnologia e escolhida pelo objetivo comercial: conteudo, serializacao, evidencia SUN/anti-replay, estado TT informado ou tokenizacao. O plano pode combinar QR/GS1 visivel com NFC para escalar com custo controlado.",
    carrierUnit: "Custo etiqueta",
    carrierFit: "Uso ideal",
    carrierUnlocks: "Desbloqueia",
    carrierPolicy: "Politica segura",
    carrierRecommended: "Recomendado neste calculo",
  },
  en: {
    explain: "Choose vertical, volume, security and channel. The model separates indicative cost, contextual retail value, editable incremental contribution and hypothetical margin.",
    enterpriseTitle: "Enterprise client",
    enterpriseBody: "For brands that want digital evidence, consented scan data and post-tap loyalty, warranty or marketplace flows.",
    resellerTitle: "Reseller / white-label",
    resellerBody: "Models client resale, gross profit and gross MRR for partners selling tags + SaaS + onboarding.",
    preset: "Industry preset",
    currency: "Currency",
    pricingBasis: "USD-only model. Software starts from the same public USD 99 / 249 / 499 monthly base and applies a visible volume-scale assumption. Hardware, encoding, setup, taxes, logistics and SLA are quoted separately; this is not settlement FX or an invoice.",
    share: "Copy link",
    copied: "Link copied",
    disclaimer: "Editable commercial scenario. It does not promise ROI, payback, coverage, margin or outcomes, and it does not replace a formal quote or measured pilot data.",
    firstYearInvestment: "First-year investment",
    costPerUnit: "Total cost per unit",
    protectedRevenue: "Modeled retail value (context only)",
    costRatio: "Cost / modeled contribution",
    resellerSale: "Estimated first-year sale",
    resellerProfit: "Estimated gross profit",
    resellerMargin: "Gross margin",
    resellerMrr: "Estimated gross MRR",
    hardwareEncoding: "Hardware + encoding",
    setup: "Setup / go-live",
    annualSaas: "Annual SaaS",
    activationScope: "Activatable tags",
    assumptions: "Assumptions",
    assumptionsBody: "Includes indicative tag, encoding, annual SaaS and setup costs. Coverage and incremental contribution are editable assumptions that must be replaced with pilot data. Retail value is context only, not recoverable profit.",
    investorTitle: "Investor fast lane",
    investorBody: "We can model USD 25k or USD 50k across chips, encoding or software-only with margin and rollout scenarios.",
    askBot: "Talk to AI",
    askCeo: "WhatsApp CEO",
    scenarios: "Quick scenarios",
    modeLabel: "What are you modelling?",
    decisionTitle: "Simple read",
    directDecision: "For an enterprise client, the key number is cost per unit against measured incremental contribution actually generated by the program; retail value is context only.",
    resellerDecision: "For a reseller, the key number is billable sale, gross margin and estimated gross MRR for hardware + SaaS + onboarding.",
    breakEvenUnits: "Active units to equal modeled cost",
    activeCoverage: "Modeled active coverage",
    contributionPerUnit: "Incremental contribution per active unit (USD)",
    contributionHelp: "Measured attributable incremental profit/contribution per active unit; do not use retail or protected value.",
    coverageInput: "Modeled coverage/activation (%)",
    modeledContribution: "Modeled incremental contribution",
    resellerAssumptions: "Model markups: hardware 42%, setup 55%, SaaS 32%. These are proposal assumptions, not guaranteed margins.",
    marginModel: "Margin model",
    buyerValue: "Retail value assumption per unit",
    formulaTitle: "How to read it",
    directFormula: "Modeled break-even = annual investment / incremental contribution per active unit. Coverage estimates activated units. This is a hypothesis, not a payback guarantee; retail value is not used in the division.",
    resellerFormula: "Reseller sale applies modeled markups of 42% hardware, 55% setup and 32% SaaS. Margin and MRR are scenarios, not commitments.",
    carrierTitle: "Tag profiles by budget and risk",
    carrierBody: "Technology is selected by business goal: content, serialization, SUN/anti-replay evidence, reported TT state or tokenization. A rollout can combine visible QR/GS1 with NFC so it stays affordable and scalable.",
    carrierUnit: "Tag cost",
    carrierFit: "Best fit",
    carrierUnlocks: "Unlocks",
    carrierPolicy: "Secure policy",
    carrierRecommended: "Recommended for this estimate",
  },
};

const carrierProfiles: Record<AppLocale, CarrierProfile[]> = {
  "es-AR": [
    {
      name: "QR / GS1 Digital Link",
      unit: "USD 0.01-0.04 aprox.",
      fit: "Contenido, recall, lote, landing, manuales y trazabilidad inicial para volumen alto.",
      unlocks: "Analytics, garantia simple, lead post-scan y marketplace visible con bajo costo.",
      policy: "No habilita propiedad digital ni token premium por si solo: se copia con screenshot o reenvio.",
      suggestedFor: ["basic"],
    },
    {
      name: "NTAG213 / NTAG215",
      unit: "USD 0.08-0.22 aprox.",
      fit: "Eventos, credenciales, pulseras, activaciones masivas y productos de ticket medio.",
      unlocks: "UID fisico, reglas server-side, puntos, club y control de duplicados por lote.",
      policy: "Permite fidelizacion y serializacion, pero sin SUN no aporta evidencia criptografica dinamica del mensaje ni prueba del producto fisico.",
      suggestedFor: ["basic", "secure"],
    },
    {
      name: "NTAG 424 DNA",
      unit: "USD 0.45-0.75 aprox.",
      fit: "Productos premium, cosmetica, documentos, agro selecto y operaciones con riesgo real de copia.",
      unlocks: "SUN dinamico, CMAC, replay detection, passport y evidencias tecnicas auditables.",
      policy: "Claim y tokenizacion requieren tap fresco, sesion de consumidor y politica comercial del tenant.",
      suggestedFor: ["secure"],
    },
    {
      name: "NTAG 424 DNA TT",
      unit: "USD 0.90-1.20 puesto AR",
      fit: "Vino, lujo, pharma, sellos, tapas y packaging donde apertura o manipulacion importa.",
      unlocks: "Estado del circuito TT reportado, ciclo de vida, garantia, marketplace, ownership digital y token Polygon/Amoy.",
      policy: "TT no prueba apertura fisica. Ownership se solicita solo con mensaje fresco aceptado + evidencia/politica de compra; replay o vista guardada bloquean acciones.",
      suggestedFor: ["enterprise"],
    },
  ],
  "pt-BR": [
    {
      name: "QR / GS1 Digital Link",
      unit: "USD 0.01-0.04 aprox.",
      fit: "Conteudo, recall, lote, landing pages, manuais e rastreabilidade inicial em alto volume.",
      unlocks: "Analytics, garantia simples, lead pos-scan e marketplace visivel com baixo custo.",
      policy: "Nao libera propriedade nem token premium sozinho: pode ser copiado por screenshot ou link.",
      suggestedFor: ["basic"],
    },
    {
      name: "NTAG213 / NTAG215",
      unit: "USD 0.08-0.22 aprox.",
      fit: "Eventos, credenciais, pulseiras, ativacoes massivas e produtos de ticket medio.",
      unlocks: "UID fisico, regras server-side, pontos, clube e controle de duplicados por lote.",
      policy: "Boa fidelizacao e serializacao, mas sem SUN nao oferece evidencia criptografica dinamica da mensagem nem prova do produto fisico.",
      suggestedFor: ["basic", "secure"],
    },
    {
      name: "NTAG 424 DNA",
      unit: "USD 0.45-0.75 aprox.",
      fit: "Produtos premium, cosmeticos, documentos, agro seleto e operacoes com risco de copia.",
      unlocks: "SUN dinamico, CMAC, replay detection, passport e evidencias tecnicas auditaveis.",
      policy: "Claim e tokenizacao exigem toque fresco, sessao do consumidor e politica comercial do tenant.",
      suggestedFor: ["secure"],
    },
    {
      name: "NTAG 424 DNA TT",
      unit: "USD 0.90-1.20 landed AR",
      fit: "Vinho, luxo, pharma, lacres, tampas e packaging onde abertura ou violacao importa.",
      unlocks: "Estado do circuito TT informado, ciclo de vida, garantia, marketplace, ownership digital e token Polygon/Amoy.",
      policy: "TT nao prova abertura fisica. Ownership e solicitado somente com mensagem fresca aceita + evidencia/politica de compra; replay ou vista salva bloqueiam acoes.",
      suggestedFor: ["enterprise"],
    },
  ],
  en: [
    {
      name: "QR / GS1 Digital Link",
      unit: "USD 0.01-0.04 approx.",
      fit: "Content, recall, batch, landing pages, manuals and entry-level traceability at high volume.",
      unlocks: "Analytics, simple warranty, post-scan lead capture and low-cost marketplace visibility.",
      policy: "Does not unlock premium ownership or tokenization by itself: it can be copied or forwarded.",
      suggestedFor: ["basic"],
    },
    {
      name: "NTAG213 / NTAG215",
      unit: "USD 0.08-0.22 approx.",
      fit: "Events, credentials, wristbands, mass activations and mid-ticket products.",
      unlocks: "Physical UID, server-side rules, points, clubs and duplicate control by batch.",
      policy: "Good for loyalty and serialization, but without SUN it provides no dynamic cryptographic message evidence or physical-product proof.",
      suggestedFor: ["basic", "secure"],
    },
    {
      name: "NTAG 424 DNA",
      unit: "USD 0.45-0.75 approx.",
      fit: "Premium products, cosmetics, documents, selected agro and operations with real copy risk.",
      unlocks: "Dynamic SUN, CMAC, replay detection, passport and auditable technical evidence.",
      policy: "Claim and tokenization require a fresh tap, consumer session and tenant commercial policy.",
      suggestedFor: ["secure"],
    },
    {
      name: "NTAG 424 DNA TT",
      unit: "USD 0.90-1.20 landed AR",
      fit: "Wine, luxury, pharma, seals, caps and packaging where opening or tamper state matters.",
      unlocks: "Reported TT circuit state, lifecycle, warranty, marketplace, digital ownership and Polygon/Amoy token.",
      policy: "TT does not prove physical opening. Ownership is requested only with an accepted fresh message + purchase evidence/policy; replay or a saved view blocks actions.",
      suggestedFor: ["enterprise"],
    },
  ],
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
  const [contributionPerActiveUnit, setContributionPerActiveUnit] = useState(defaultContributionPerActiveUnit.wine);
  const [modeledCoveragePct, setModeledCoveragePct] = useState(defaultCoveragePct.secure);
  const [copied, setCopied] = useState(false);
  const txt = investmentCopy[locale] || investmentCopy["es-AR"];
  const numberLocale = localeName(locale);
  const carrierCopy = carrierProfiles[locale] || carrierProfiles["es-AR"];

  useEffect(() => {
    const p = search.get("p") as ProductType | null;
    const v = Number(search.get("v") || "");
    const s = search.get("s") as SecurityLevel | null;
    const ch = search.get("ch") as ChannelType | null;
    const contribution = Number(search.get("contrib") || "");
    const coverage = Number(search.get("coverage") || "");

    if (p && ["wine", "cosmetics", "events", "pharma"].includes(p)) {
      setProduct(p);
      if (!(Number.isFinite(contribution) && contribution > 0)) setContributionPerActiveUnit(defaultContributionPerActiveUnit[p]);
    }
    if (volumeOptions.includes(v as (typeof volumeOptions)[number])) setVolume(v as (typeof volumeOptions)[number]);
    if (s && ["basic", "secure", "enterprise"].includes(s)) {
      setSecurity(s);
      if (!(Number.isFinite(coverage) && coverage > 0)) setModeledCoveragePct(defaultCoveragePct[s]);
    }
    if (ch && ["direct", "reseller"].includes(ch)) setChannel(ch);
    if (Number.isFinite(contribution) && contribution > 0 && contribution <= 100_000) setContributionPerActiveUnit(contribution);
    if (Number.isFinite(coverage) && coverage > 0 && coverage <= 100) setModeledCoveragePct(coverage);
  }, [search]);

  const estimate = useMemo(() => {
    const base = securityCosts[security];
    const unitProgramCost = (base.hardware + base.encoding) * productMultiplier[product];
    const hardwareEncoding = Math.round(volume * unitProgramCost);
    const setup = Math.round(base.setup * (channel === "reseller" ? 1.12 : 1));
    const annualSaas = Math.round(base.monthlySoftwareBaseUsd * 12 * volumeScale(volume));
    const firstYearCost = hardwareEncoding + setup + annualSaas;
    const activation = Math.round(volume * (modeledCoveragePct / 100));
    const protectedRevenue = Math.round(volume * protectedUnitValue[product]);
    const modeledContribution = Math.round(activation * contributionPerActiveUnit);
    const costRatio = Number(((firstYearCost / Math.max(1, modeledContribution)) * 100).toFixed(1));

    const resellerHardwareSale = Math.round(hardwareEncoding * (1 + resellerMarkupPct.hardware / 100));
    const resellerSetupSale = Math.round(setup * (1 + resellerMarkupPct.setup / 100));
    const resellerSaasSale = Math.round(annualSaas * (1 + resellerMarkupPct.saas / 100));
    const resellerSale = resellerHardwareSale + resellerSetupSale + resellerSaasSale;
    const resellerProfit = resellerSale - firstYearCost;
    const resellerMargin = Math.round((resellerProfit / Math.max(1, resellerSale)) * 100);
    const resellerMrr = Math.round((resellerSaasSale - annualSaas) / 12);
    const protectedValuePerUnit = protectedUnitValue[product];
    const breakEvenUnits = Math.ceil(firstYearCost / Math.max(0.01, contributionPerActiveUnit));
    const activationRate = Math.round((activation / Math.max(1, volume)) * 100);
    const money = (amount: number, decimals = 0) => {
      return `USD ${amount.toLocaleString(numberLocale, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`;
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
      modeledContribution,
      protectedValuePerUnit,
      protectedRevenue,
      resellerMargin,
      resellerMrr,
      resellerProfit,
      resellerSale,
      scope: base.scope,
      setup,
    };
  }, [channel, contributionPerActiveUnit, modeledCoveragePct, numberLocale, product, security, volume]);

  const shareHref = `${pathname}?p=${product}&v=${volume}&s=${security}&ch=${channel}&contrib=${contributionPerActiveUnit}&coverage=${modeledCoveragePct}#calculator`;

  const applyPreset = (next: ProductType) => {
    const preset = presets[next];
    setProduct(next);
    setVolume(preset.volume);
    setSecurity(preset.security);
    setChannel(preset.channel);
    setContributionPerActiveUnit(defaultContributionPerActiveUnit[next]);
    setModeledCoveragePct(defaultCoveragePct[preset.security]);
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
      { label: txt.modeledContribution, value: estimate.money(estimate.modeledContribution) },
      { label: txt.costRatio, value: `${estimate.costRatio}%` },
    ];
  const quickReadCards = channel === "reseller"
    ? [
      { label: txt.marginModel, value: `${estimate.resellerMargin}%`, detail: `${txt.resellerProfit}: ${estimate.money(estimate.resellerProfit)}` },
      { label: txt.activeCoverage, value: `${estimate.activationRate}%`, detail: `${estimate.activation.toLocaleString(numberLocale)} ${calculator.tagsUnitLabel}` },
      { label: txt.buyerValue, value: estimate.money(estimate.protectedValuePerUnit, 2), detail: `${txt.protectedRevenue}: ${estimate.money(estimate.protectedRevenue)} (${txt.assumptions})` },
    ]
    : [
      { label: txt.breakEvenUnits, value: estimate.breakEvenUnits.toLocaleString(numberLocale), detail: `${txt.contributionPerUnit}: USD ${contributionPerActiveUnit.toLocaleString(numberLocale, { maximumFractionDigits: 2 })}` },
      { label: txt.activeCoverage, value: `${estimate.activationRate}%`, detail: `${estimate.activation.toLocaleString(numberLocale)} ${calculator.tagsUnitLabel}` },
      { label: txt.buyerValue, value: estimate.money(estimate.protectedValuePerUnit, 2), detail: `${txt.protectedRevenue}: ${estimate.money(estimate.protectedRevenue)} (${txt.assumptions})` },
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

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Selector label={txt.preset} value={product} onChange={(next) => applyPreset(next as ProductType)} options={calculator.options.product.map((item) => ({ label: item.label, value: item.value }))} />
            <Selector label={calculator.volumeLabel} value={String(volume)} onChange={(next) => setVolume(Number(next) as (typeof volumeOptions)[number])} options={volumeOptions.map((item) => ({ label: `${(item / 1000).toLocaleString(numberLocale)}k`, value: String(item) }))} />
            <Selector
              label={calculator.securityLabel}
              value={security}
              onChange={(next) => {
                const nextSecurity = next as SecurityLevel;
                setSecurity(nextSecurity);
                setModeledCoveragePct(defaultCoveragePct[nextSecurity]);
              }}
              options={calculator.options.security.map((item) => ({ label: item.label, value: item.value }))}
            />
          </div>
        </div>

        <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-50">
          {txt.pricingBasis}
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-xs font-bold text-amber-50">
            <span className="block uppercase tracking-[0.12em] text-amber-200">{txt.contributionPerUnit}</span>
            <input
              type="number"
              min="0.01"
              max="100000"
              step="0.25"
              value={contributionPerActiveUnit}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next) && next > 0 && next <= 100_000) setContributionPerActiveUnit(next);
              }}
              className="mt-3 w-full rounded-xl border border-amber-200/20 bg-slate-950/75 px-3 py-2 text-base font-black text-white outline-none focus:border-amber-200/60"
            />
            <span className="mt-2 block font-normal leading-5 text-amber-100/75">{txt.contributionHelp}</span>
          </label>
          <label className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4 text-xs font-bold text-violet-50">
            <span className="block uppercase tracking-[0.12em] text-violet-200">{txt.coverageInput}</span>
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={modeledCoveragePct}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next) && next > 0 && next <= 100) setModeledCoveragePct(next);
              }}
              className="mt-3 w-full rounded-xl border border-violet-200/20 bg-slate-950/75 px-3 py-2 text-base font-black text-white outline-none focus:border-violet-200/60"
            />
            <span className="mt-2 block font-normal leading-5 text-violet-100/75">{txt.activeCoverage}: {modeledCoveragePct}% · {estimate.activation.toLocaleString(numberLocale)} {calculator.tagsUnitLabel}</span>
          </label>
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
            {channel === "reseller" ? <p className="mt-3 text-xs leading-5 text-emerald-100/75">{txt.resellerAssumptions}</p> : null}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">{txt.carrierTitle}</p>
              <p className="mt-2 text-sm leading-6 text-cyan-50">{txt.carrierBody}</p>
            </div>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-100">{estimate.plan}</span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            {carrierCopy.map((profile) => {
              const active = profile.suggestedFor.includes(security);
              return (
                <article key={profile.name} className={`calculator-carrier-card rounded-2xl border p-4 ${active ? "calculator-carrier-card--active border-cyan-300/35 bg-cyan-300/10" : "border-white/10 bg-slate-950/45"}`}>
                  {active ? <p className="mb-3 inline-flex rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">{txt.carrierRecommended}</p> : null}
                  <h3 className="text-sm font-black text-white">{profile.name}</h3>
                  <dl className="mt-3 space-y-3 text-xs leading-5">
                    <div>
                      <dt className="font-black uppercase tracking-[0.12em] text-cyan-300">{txt.carrierUnit}</dt>
                      <dd className="mt-1 font-bold text-slate-100">{profile.unit}</dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase tracking-[0.12em] text-cyan-300">{txt.carrierFit}</dt>
                      <dd className="mt-1 text-slate-300">{profile.fit}</dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase tracking-[0.12em] text-cyan-300">{txt.carrierUnlocks}</dt>
                      <dd className="mt-1 text-slate-300">{profile.unlocks}</dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase tracking-[0.12em] text-amber-300">{txt.carrierPolicy}</dt>
                      <dd className="mt-1 text-amber-100">{profile.policy}</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
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
            <p className="mt-3 text-xs leading-5 text-cyan-100/75">{txt.resellerAssumptions}</p>
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
