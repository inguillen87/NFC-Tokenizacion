import type { AppLocale } from "@product/config";

export type DemoLabStoryBeat = 0 | 1 | 2 | 3;

export type DemoLabStoryLocation = {
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  label: string;
};

type DemoLabStoryScenario = {
  headline: string;
  body: string;
  stateLabel: string;
  allowed: string[];
  blocked: string[];
  chain: string;
  primaryAction: "origin" | "tap" | "join" | "warranty" | "tokenize" | "report";
  primaryLabel: string;
};

type DemoLabStoryBeatCopy = {
  title: string;
  body: string;
  event: string;
  status: string;
  cta: string;
};

export type DemoLabVerticalStory = {
  id: "agro-seeds";
  leadVertical: "agro";
  displayAccount: string;
  origin: DemoLabStoryLocation;
  destinations: Record<DemoLabStoryBeat, DemoLabStoryLocation>;
  beats: Record<DemoLabStoryBeat, DemoLabStoryBeatCopy>;
  scenarios: Record<DemoLabStoryBeat, DemoLabStoryScenario>;
  controls: {
    syncing: string;
    synced: string;
    unavailable: string;
    sendingScan: string;
    registeredScan: string;
    failedScan: string;
    valid: string;
    tamper: string;
    replay: string;
    joinClub: string;
    warranty: string;
    tokenize: string;
    mapTitle: string;
    mapSubtitle: string;
    adminKey: string;
  };
};

const AGRO_ORIGIN: DemoLabStoryLocation = {
  city: "Córdoba",
  country: "Argentina",
  countryCode: "AR",
  lat: -31.4201,
  lng: -64.1888,
  label: "Declared demo origin",
};

const AGRO_FIELD_READING: DemoLabStoryLocation = {
  city: "Santa Fe",
  country: "Argentina",
  countryCode: "AR",
  lat: -31.6333,
  lng: -60.7,
  label: "Reported demo reading",
};

const AGRO_DESTINATIONS: Record<DemoLabStoryBeat, DemoLabStoryLocation> = {
  0: AGRO_ORIGIN,
  1: AGRO_FIELD_READING,
  2: AGRO_FIELD_READING,
  3: AGRO_FIELD_READING,
};

export const DEMO_LAB_SEEDS_STORY: Record<AppLocale, DemoLabVerticalStory> = {
  "es-AR": {
    id: "agro-seeds",
    leadVertical: "agro",
    displayAccount: "Entorno demo nexID Agro",
    origin: AGRO_ORIGIN,
    destinations: AGRO_DESTINATIONS,
    beats: {
      0: {
        title: "1. Se prepara el lote demo",
        body: "La organización declara lote, variedad o formulación y canal autorizado.",
        event: "Lote agro ilustrativo preparado con datos declarados.",
        status: "LOTE_DEMO_PREPARADO",
        cta: "Ver origen declarado",
      },
      1: {
        title: "2. Se consulta el identificador",
        body: "El productor o aplicador revisa el resultado digital y la información autorizada.",
        event: "Lectura agro simulada en Santa Fe; no representa una venta ni una aplicación física.",
        status: "MENSAJE_ACEPTADO_DEMO",
        cta: "Abrir soporte técnico",
      },
      2: {
        title: "3. Se bloquea una repetición",
        body: "Una señal compatible con replay queda marcada para revisión.",
        event: "Lectura repetida simulada; no determina por sí sola qué ocurrió con el envase.",
        status: "REPETICION_BLOQUEADA",
        cta: "Reportar lectura",
      },
      3: {
        title: "4. Se reporta un cambio",
        body: "La demo registra una señal digital de cambio y abre una revisión técnica.",
        event: "Cambio de estado simulado; no prueba apertura, contenido ni custodia física.",
        status: "CAMBIO_REPORTADO_DEMO",
        cta: "Solicitar revisión",
      },
    },
    scenarios: {
      0: {
        headline: "Lote agro de demostración preparado",
        body: "La organización declara lote, variedad o formulación y canal autorizado. Estos datos no prueban por sí solos el contenido, el origen físico ni la custodia.",
        stateLabel: "LOTE DEMO PREPARADO",
        allowed: ["Consultar ficha autorizada", "Revisar lote declarado", "Preparar QR o NFC"],
        blocked: ["Inferir autenticidad física", "Confirmar custodia no observada"],
        chain: "Escenario de demostración: todavía no existe una lectura persistida ni evidencia pública verificada para este paso.",
        primaryAction: "origin",
        primaryLabel: "Ver origen declarado",
      },
      1: {
        headline: "Mensaje digital aceptado en la demo",
        body: "El identificador superó los controles configurados para este escenario. El resultado habilita información y soporte; no autentica por sí solo el insumo físico ni su contenido.",
        stateLabel: "MENSAJE ACEPTADO · DEMO",
        allowed: ["Abrir ficha autorizada", "Consultar soporte técnico", "Registrar señal de canal"],
        blocked: ["Afirmar autenticidad física", "Inferir venta o ubicación no reportada"],
        chain: "La evidencia visible pertenece a una simulación con fuente declarada. Una prueba pública sólo se muestra cuando una fuente runtime la confirma.",
        primaryAction: "join",
        primaryLabel: "Abrir soporte técnico",
      },
      2: {
        headline: "Lectura repetida marcada para revisión",
        body: "La política detectó una señal compatible con replay y bloquea acciones sensibles. La señal digital no diagnostica por sí sola el estado físico del envase o del producto.",
        stateLabel: "REPETICIÓN BLOQUEADA · DEMO",
        allowed: ["Revisar lote declarado", "Reportar incidente"],
        blocked: ["Habilitar beneficios", "Confirmar producto físico"],
        chain: "No se genera una acción pública mientras la lectura permanezca bloqueada por la política del escenario.",
        primaryAction: "report",
        primaryLabel: "Reportar lectura repetida",
      },
      3: {
        headline: "Cambio de estado reportado en la demo",
        body: "El circuito reporta una variación digital para revisión técnica. No demuestra por sí sola apertura, composición, aplicación ni custodia física.",
        stateLabel: "CAMBIO REPORTADO · DEMO",
        allowed: ["Abrir soporte técnico", "Registrar seguimiento", "Revisar datos declarados"],
        blocked: ["Certificar contenido", "Afirmar una aplicación no observada"],
        chain: "El siguiente paso depende de política y evidencia adicional; esta simulación no ejecuta una operación en cadena.",
        primaryAction: "warranty",
        primaryLabel: "Solicitar revisión técnica",
      },
    },
    controls: {
      syncing: "Consultando la evidencia disponible para la demo agro...",
      synced: "Fuente disponible para la demo agro.",
      unavailable: "La fuente operativa no está disponible; se mantiene una vista simulada.",
      sendingScan: "Enviando lectura de demostración",
      registeredScan: "Lectura de demostración registrada.",
      failedScan: "No se pudo ejecutar la lectura de demostración.",
      valid: "Simular lectura agro en Santa Fe",
      tamper: "Simular cambio de estado reportado",
      replay: "Simular lectura repetida",
      joinClub: "Abrir soporte técnico",
      warranty: "Solicitar revisión técnica",
      tokenize: "Evaluar siguiente acción",
      mapTitle: "Origen y lectura reportados · demo agro",
      mapSubtitle: "La línea ilustra datos declarados o reportados; no prueba recorrido, contenido ni custodia física.",
      adminKey: "Modo demo: los datos ilustrativos y la evidencia runtime permanecen diferenciados.",
    },
  },
  "pt-BR": {
    id: "agro-seeds",
    leadVertical: "agro",
    displayAccount: "Ambiente demo nexID Agro",
    origin: AGRO_ORIGIN,
    destinations: AGRO_DESTINATIONS,
    beats: {
      0: { title: "1. O lote demo é preparado", body: "A organização declara lote, variedade ou formulação e canal autorizado.", event: "Lote agro ilustrativo preparado com dados declarados.", status: "LOTE_DEMO_PREPARADO", cta: "Ver origem declarada" },
      1: { title: "2. O identificador é consultado", body: "O produtor ou aplicador revisa o resultado digital e a informação autorizada.", event: "Leitura agro simulada em Santa Fe; não representa venda nem aplicação física.", status: "MENSAGEM_ACEITA_DEMO", cta: "Abrir suporte técnico" },
      2: { title: "3. Uma repetição é bloqueada", body: "Um sinal compatível com replay fica marcado para revisão.", event: "Leitura repetida simulada; não determina sozinha o que ocorreu com a embalagem.", status: "REPETICAO_BLOQUEADA", cta: "Reportar leitura" },
      3: { title: "4. Uma mudança é reportada", body: "A demo registra um sinal digital de mudança e abre uma revisão técnica.", event: "Mudança de estado simulada; não prova abertura, conteúdo nem custódia física.", status: "MUDANCA_REPORTADA_DEMO", cta: "Solicitar revisão" },
    },
    scenarios: {
      0: { headline: "Lote agro de demonstração preparado", body: "A organização declara lote, variedade ou formulação e canal autorizado. Esses dados não provam sozinhos conteúdo, origem física nem custódia.", stateLabel: "LOTE DEMO PREPARADO", allowed: ["Consultar ficha autorizada", "Revisar lote declarado", "Preparar QR ou NFC"], blocked: ["Inferir autenticidade física", "Confirmar custódia não observada"], chain: "Cenário de demonstração: ainda não existe leitura persistida nem evidência pública verificada neste passo.", primaryAction: "origin", primaryLabel: "Ver origem declarada" },
      1: { headline: "Mensagem digital aceita na demo", body: "O identificador passou pelos controles configurados para este cenário. O resultado libera informação e suporte; não autentica sozinho o insumo físico nem seu conteúdo.", stateLabel: "MENSAGEM ACEITA · DEMO", allowed: ["Abrir ficha autorizada", "Consultar suporte técnico", "Registrar sinal de canal"], blocked: ["Afirmar autenticidade física", "Inferir venda ou local não reportado"], chain: "A evidência visível pertence a uma simulação com fonte declarada. Uma prova pública só aparece quando uma fonte runtime confirma.", primaryAction: "join", primaryLabel: "Abrir suporte técnico" },
      2: { headline: "Leitura repetida marcada para revisão", body: "A política detectou um sinal compatível com replay e bloqueia ações sensíveis. O sinal digital não diagnostica sozinho o estado físico da embalagem ou do produto.", stateLabel: "REPETIÇÃO BLOQUEADA · DEMO", allowed: ["Revisar lote declarado", "Reportar incidente"], blocked: ["Liberar benefícios", "Confirmar produto físico"], chain: "Nenhuma ação pública é gerada enquanto a leitura permanecer bloqueada pela política do cenário.", primaryAction: "report", primaryLabel: "Reportar leitura repetida" },
      3: { headline: "Mudança de estado reportada na demo", body: "O circuito reporta uma variação digital para revisão técnica. Não demonstra sozinho abertura, composição, aplicação nem custódia física.", stateLabel: "MUDANÇA REPORTADA · DEMO", allowed: ["Abrir suporte técnico", "Registrar acompanhamento", "Revisar dados declarados"], blocked: ["Certificar conteúdo", "Afirmar aplicação não observada"], chain: "O próximo passo depende de política e evidência adicional; esta simulação não executa operação em blockchain.", primaryAction: "warranty", primaryLabel: "Solicitar revisão técnica" },
    },
    controls: {
      syncing: "Consultando a evidência disponível para a demo agro...",
      synced: "Fonte disponível para a demo agro.",
      unavailable: "A fonte operacional não está disponível; a vista continua simulada.",
      sendingScan: "Enviando leitura de demonstração",
      registeredScan: "Leitura de demonstração registrada.",
      failedScan: "Não foi possível executar a leitura de demonstração.",
      valid: "Simular leitura agro em Santa Fe",
      tamper: "Simular mudança de estado reportada",
      replay: "Simular leitura repetida",
      joinClub: "Abrir suporte técnico",
      warranty: "Solicitar revisão técnica",
      tokenize: "Avaliar próxima ação",
      mapTitle: "Origem e leitura reportadas · demo agro",
      mapSubtitle: "A linha ilustra dados declarados ou reportados; não prova trajeto, conteúdo nem custódia física.",
      adminKey: "Modo demo: dados ilustrativos e evidência runtime permanecem diferenciados.",
    },
  },
  en: {
    id: "agro-seeds",
    leadVertical: "agro",
    displayAccount: "nexID Agro demo environment",
    origin: AGRO_ORIGIN,
    destinations: AGRO_DESTINATIONS,
    beats: {
      0: { title: "1. Prepare the demo lot", body: "The organization declares the lot, variety or formulation and authorized channel.", event: "Illustrative agro lot prepared with declared data.", status: "DEMO_LOT_READY", cta: "View declared origin" },
      1: { title: "2. Read the identifier", body: "The grower or applicator reviews the digital result and authorized information.", event: "Simulated agro read in Santa Fe; it represents neither a sale nor a physical application.", status: "MESSAGE_ACCEPTED_DEMO", cta: "Open technical support" },
      2: { title: "3. Block a repeated read", body: "A replay-compatible signal is marked for review.", event: "Simulated repeated read; it does not determine what happened to the package.", status: "REPEATED_READ_BLOCKED", cta: "Report read" },
      3: { title: "4. Report a state change", body: "The demo records a digital change signal and opens a technical review.", event: "Simulated state change; it proves neither opening, contents nor physical custody.", status: "STATE_CHANGE_REPORTED_DEMO", cta: "Request review" },
    },
    scenarios: {
      0: { headline: "Agro demo lot prepared", body: "The organization declares the lot, variety or formulation and authorized channel. These data do not prove contents, physical origin or custody by themselves.", stateLabel: "DEMO LOT READY", allowed: ["Open authorized sheet", "Review declared lot", "Prepare QR or NFC"], blocked: ["Infer physical authenticity", "Confirm unobserved custody"], chain: "Demo scenario: this step has no persisted read or verified public evidence yet.", primaryAction: "origin", primaryLabel: "View declared origin" },
      1: { headline: "Digital message accepted in the demo", body: "The identifier passed the checks configured for this scenario. The result enables information and support; it does not authenticate the physical input or its contents by itself.", stateLabel: "MESSAGE ACCEPTED · DEMO", allowed: ["Open authorized sheet", "Contact technical support", "Record a channel signal"], blocked: ["Claim physical authenticity", "Infer an unreported sale or location"], chain: "The visible evidence belongs to a source-labelled simulation. Public proof appears only when a runtime source confirms it.", primaryAction: "join", primaryLabel: "Open technical support" },
      2: { headline: "Repeated read marked for review", body: "Policy detected a replay-compatible signal and blocks sensitive actions. The digital signal does not diagnose the physical condition of the package or product by itself.", stateLabel: "REPEATED READ BLOCKED · DEMO", allowed: ["Review declared lot", "Report incident"], blocked: ["Enable benefits", "Confirm the physical product"], chain: "No public action is generated while policy keeps the read blocked.", primaryAction: "report", primaryLabel: "Report repeated read" },
      3: { headline: "State change reported in the demo", body: "The circuit reports a digital variation for technical review. It does not demonstrate opening, composition, application or physical custody by itself.", stateLabel: "STATE CHANGE REPORTED · DEMO", allowed: ["Open technical support", "Record follow-up", "Review declared data"], blocked: ["Certify contents", "Claim an unobserved application"], chain: "The next step depends on policy and additional evidence; this simulation performs no blockchain operation.", primaryAction: "warranty", primaryLabel: "Request technical review" },
    },
    controls: {
      syncing: "Checking evidence available to the agro demo...",
      synced: "Source available to the agro demo.",
      unavailable: "The operational source is unavailable; the view remains simulated.",
      sendingScan: "Sending demo read",
      registeredScan: "Demo read recorded.",
      failedScan: "The demo read could not be completed.",
      valid: "Simulate agro read in Santa Fe",
      tamper: "Simulate reported state change",
      replay: "Simulate repeated read",
      joinClub: "Open technical support",
      warranty: "Request technical review",
      tokenize: "Evaluate next action",
      mapTitle: "Declared origin and reported read · agro demo",
      mapSubtitle: "The line illustrates declared or reported data; it proves neither route, contents nor physical custody.",
      adminKey: "Demo mode: illustrative data remains separate from runtime evidence.",
    },
  },
};

export function getDemoLabVerticalStory(vertical: string, locale: AppLocale): DemoLabVerticalStory | null {
  return vertical === "seeds" ? DEMO_LAB_SEEDS_STORY[locale] : null;
}

export function normalizeCommercialVertical(value: string | null | undefined) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["seed", "seeds", "agro", "agrochemical", "agrochemicals", "agroquimico", "agroquimicos"].includes(normalized)) {
    return "agro";
  }
  return raw;
}

export function buildDemoContactHref(vertical?: string | null) {
  const query = new URLSearchParams({ contact: "demo" });
  const safeVertical = String(vertical || "").trim();
  if (safeVertical) query.set("vertical", safeVertical);
  return `/?${query.toString()}#contact-modal`;
}
