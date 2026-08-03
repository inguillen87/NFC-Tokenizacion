import type { AppLocale } from "@product/config";

export type DemoLabScenarioMode = "demo" | "simulated" | "configured" | "live";

export const DEMO_LAB_SCENARIO_IDS = [
  "qr-gs1",
  "nfc-424",
  "offline-verifier",
  "polygon-ownership",
  "iota-proof",
  "dual-proof",
  "sensor-evidence",
  "authorized-network",
  "supplier-batch-factory",
] as const;

export type DemoLabScenarioId = (typeof DEMO_LAB_SCENARIO_IDS)[number];

type LocalizedText = Record<AppLocale, string>;

type DemoLabScenarioDefinition = {
  title: string;
  mode: DemoLabScenarioMode;
  enterprise: boolean;
  statusDetail: LocalizedText;
};

export const DEMO_LAB_SCENARIO_CATALOG: Record<DemoLabScenarioId, DemoLabScenarioDefinition> = {
  "qr-gs1": {
    title: "QR / GS1 Digital Link",
    mode: "demo",
    enterprise: false,
    statusDetail: {
      "es-AR": "Recorrido interactivo de identidad declarada; no verifica el producto fisico.",
      "pt-BR": "Jornada interativa de identidade declarada; nao verifica o produto fisico.",
      en: "Interactive declared-identity journey; it does not verify the physical product.",
    },
  },
  "nfc-424": {
    title: "NTAG 424 DNA",
    mode: "demo",
    enterprise: false,
    statusDetail: {
      "es-AR": "Recorrido de mensaje NFC; un veredicto fisico requiere el tag y la verificacion runtime.",
      "pt-BR": "Jornada de mensagem NFC; um veredito fisico exige a tag e a verificacao em runtime.",
      en: "NFC-message journey; a physical verdict requires the tag and runtime verification.",
    },
  },
  "offline-verifier": {
    title: "Offline Field Scan Demo",
    mode: "demo",
    enterprise: true,
    statusDetail: {
      "es-AR": "Captura y decision local provisionales; el backend decide al sincronizar.",
      "pt-BR": "Captura e decisao local provisorias; o backend decide ao sincronizar.",
      en: "Provisional local capture and decision; the backend decides after synchronization.",
    },
  },
  "polygon-ownership": {
    title: "Polygon Ownership Demo",
    mode: "configured",
    enterprise: true,
    statusDetail: {
      "es-AR": "Integracion testnet configurada; el certificado runtime determina si la evidencia esta verificada.",
      "pt-BR": "Integracao testnet configurada; o certificado em runtime determina se a evidencia foi verificada.",
      en: "Testnet integration configured; the runtime certificate determines whether evidence is verified.",
    },
  },
  "iota-proof": {
    title: "IOTA Proof Layer Demo",
    mode: "configured",
    enterprise: true,
    statusDetail: {
      "es-AR": "Integracion testnet configurada; cada recibo debe confirmar su estado runtime.",
      "pt-BR": "Integracao testnet configurada; cada recibo deve confirmar seu estado em runtime.",
      en: "Testnet integration configured; every receipt must confirm its runtime state.",
    },
  },
  "dual-proof": {
    title: "Dual Proof DPP",
    mode: "simulated",
    enterprise: true,
    statusDetail: {
      "es-AR": "Orquestacion ilustrativa de DPP, Polygon e IOTA; no escribe cada tap on-chain.",
      "pt-BR": "Orquestracao ilustrativa de DPP, Polygon e IOTA; nao grava cada tap on-chain.",
      en: "Illustrative DPP, Polygon and IOTA orchestration; it does not write every tap on-chain.",
    },
  },
  "sensor-evidence": {
    title: "Sensor Evidence Demo",
    mode: "simulated",
    enterprise: true,
    statusDetail: {
      "es-AR": "Hitos de sensor reportados e ilustrativos; los intervalos sin evidencia siguen desconocidos.",
      "pt-BR": "Marcos de sensor reportados e ilustrativos; intervalos sem evidencia continuam desconhecidos.",
      en: "Illustrative reported sensor milestones; intervals without evidence remain unknown.",
    },
  },
  "authorized-network": {
    title: "Authorized Network Demo",
    mode: "simulated",
    enterprise: true,
    statusDetail: {
      "es-AR": "Recorrido RBAC ilustrativo; no afirma partnership ni entrega secretos NFC.",
      "pt-BR": "Jornada RBAC ilustrativa; nao afirma parceria nem entrega segredos NFC.",
      en: "Illustrative RBAC journey; it claims no partnership and exposes no NFC secrets.",
    },
  },
  "supplier-batch-factory": {
    title: "Supplier Batch Factory Demo",
    mode: "simulated",
    enterprise: true,
    statusDetail: {
      "es-AR": "Plan de orden, sub-batches y QA ilustrativo; no crea pedidos ni exporta packs seguros.",
      "pt-BR": "Plano ilustrativo de pedido, sub-batches e QA; nao cria pedidos nem exporta packs seguros.",
      en: "Illustrative order, sub-batch and QA plan; it creates no orders and exports no secure packs.",
    },
  },
};

const MODE_LABELS: Record<AppLocale, Record<DemoLabScenarioMode, string>> = {
  "es-AR": { demo: "Demo", simulated: "Simulado", configured: "Configurado", live: "Live" },
  "pt-BR": { demo: "Demo", simulated: "Simulado", configured: "Configurado", live: "Live" },
  en: { demo: "Demo", simulated: "Simulated", configured: "Configured", live: "Live" },
};

const MODE_EXPLANATIONS: Record<AppLocale, Record<DemoLabScenarioMode, string>> = {
  "es-AR": {
    demo: "Recorrido interactivo identificado como demo.",
    simulated: "Datos y decisiones ilustrativos; no ejecutados en produccion.",
    configured: "Integracion disponible; no equivale a evidencia live.",
    live: "Reservado para evidencia verificable devuelta por una fuente runtime.",
  },
  "pt-BR": {
    demo: "Jornada interativa identificada como demo.",
    simulated: "Dados e decisoes ilustrativos; nao executados em producao.",
    configured: "Integracao disponivel; nao equivale a evidencia live.",
    live: "Reservado para evidencia verificavel devolvida por uma fonte em runtime.",
  },
  en: {
    demo: "Interactive journey explicitly identified as a demo.",
    simulated: "Illustrative data and decisions; not executed in production.",
    configured: "Integration available; this is not the same as live evidence.",
    live: "Reserved for verifiable evidence returned by a runtime source.",
  },
};

export const DEMO_LAB_MODE_ORDER: readonly DemoLabScenarioMode[] = [
  "demo",
  "simulated",
  "configured",
  "live",
];

export function isDemoLabScenarioId(value: string): value is DemoLabScenarioId {
  return (DEMO_LAB_SCENARIO_IDS as readonly string[]).includes(value);
}

export function getDemoLabModeCopy(mode: DemoLabScenarioMode, locale: AppLocale) {
  return {
    mode,
    label: MODE_LABELS[locale][mode],
    explanation: MODE_EXPLANATIONS[locale][mode],
  };
}

export function getDemoLabScenarioStatus(id: DemoLabScenarioId, locale: AppLocale) {
  const scenario = DEMO_LAB_SCENARIO_CATALOG[id];
  return {
    ...getDemoLabModeCopy(scenario.mode, locale),
    detail: scenario.statusDetail[locale],
  };
}
