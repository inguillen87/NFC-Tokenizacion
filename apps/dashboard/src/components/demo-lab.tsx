"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@product/ui";
import { productUrls } from "@product/config";
import { DemoOpsMap } from "./demo-ops-map";
import { QuickOnboardingPanel } from "./quick-onboarding-panel";

type SummaryEvent = {
  id: number;
  result: string;
  uid_hex?: string;
  created_at?: string;
  city?: string;
  country_code?: string;
  lat?: number;
  lng?: number;
  product_name?: string;
  vertical?: string;
};

type Summary = {
  exists?: boolean;
  tenant?: { slug: string; name: string };
  batch?: { bid: string; status: string };
  tagCount?: number;
  crm?: { leads: number; tickets: number; orders: number };
  events?: SummaryEvent[];
};

type Locale = "es-AR" | "pt-BR" | "en";
type Pack = { key: string; icType: string; batchId: string; tenant?: string; itemId?: string; label?: string };
type DemoMode = "simulated" | "consumer_tap" | "live_nfc";
type LabSection = "setup" | "simulate" | "mobile" | "ops";

type ScanScenario = {
  label: string;
  description: string;
  eventType: "valid" | "tamper" | "replay" | "claim" | "redeem" | "checkin";
};

type PermissionStateLite = "unknown" | "granted" | "denied" | "prompt";
type VerticalKey = "wine" | "events" | "docs" | "cosmetics" | "agro" | "pharma";

type RunbookStep = {
  title: string;
  detail: string;
  kpi: string;
};

type AudienceMode = "ceo" | "operator" | "buyer";
type ExperiencePresetKey = "premium" | "event" | "credentials";
type StageBeat = { title: string; speaker: string; goal: string };
type CinematicCue = { beat: number; section: LabSection; durationSec: number; scenario?: ScanScenario["eventType"]; openMobile?: boolean; narration: string };

const COPY: Record<Locale, Record<string, string>> = {
  "es-AR": {
    intro: "Demo Lab emula lectura real de tags (botella, pulsera, etiqueta) con backend y geolocalización.",
    pick: "Paso 1 · Elegí un pack vertical",
  },
  "pt-BR": { intro: "Demo Lab emula leitura real de tags com backend e geolocalização.", pick: "Passo 1 · Escolha um pack vertical" },
  en: { intro: "Demo Lab emulates real tag reads with backend resolution and geolocation.", pick: "Step 1 · Pick a vertical pack" },
};

const SCENARIOS: ScanScenario[] = [
  { label: "AUTH OK", description: "Validación normal de autenticidad", eventType: "valid" },
  { label: "TAMPER RISK", description: "Producto abierto / sello alterado", eventType: "tamper" },
  { label: "DUPLICATE RISK", description: "Relectura sospechosa / posible clon", eventType: "replay" },
  { label: "CLAIMED", description: "Cambio de titularidad", eventType: "claim" },
  { label: "REDEEMED", description: "Canje o redención final", eventType: "redeem" },
  { label: "CHECK-IN", description: "Ingreso de pulsera/credencial a evento", eventType: "checkin" },
];

const DEMO_UIDS = [
  "0487856A0B1090",
  "048A876A0B1090",
  "0483846A0B1090",
  "047F846A0B1090",
  "047B846A0B1090",
  "0477846A0B1090",
  "0474856A0B1090",
  "0470856A0B1090",
  "0483826A0B1090",
  "0465846A0B1090",
];

const DEMO_EXPERIENCES: Record<ExperiencePresetKey, {
  label: string;
  description: string;
  packKey: string;
  mode: DemoMode;
  audience: AudienceMode;
  section: LabSection;
  playlist: Array<ScanScenario["eventType"]>;
}> = {
  premium: {
    label: "Premium product journey",
    description: "Autenticidad, tamper, ownership y postventa para vino, lujo, cosmética o pharma.",
    packKey: "wine-secure",
    mode: "consumer_tap",
    audience: "buyer",
    section: "mobile",
    playlist: ["valid", "tamper", "claim", "redeem"],
  },
  event: {
    label: "Live event control room",
    description: "Check-in, anti-passback, replay y activación en tiempo real para credenciales o pulseras.",
    packKey: "events-basic",
    mode: "live_nfc",
    audience: "ceo",
    section: "ops",
    playlist: ["checkin", "checkin", "replay", "claim"],
  },
  credentials: {
    label: "Credential / compliance proof",
    description: "Documentos, certificados y presencia auditables con ownership y evidence trail.",
    packKey: "docs-presence",
    mode: "consumer_tap",
    audience: "ceo",
    section: "mobile",
    playlist: ["valid", "claim", "redeem"],
  },
};

function inferPresetFromPack(pack: string): ExperiencePresetKey {
  if (pack.includes("events")) return "event";
  if (pack.includes("docs")) return "credentials";
  return "premium";
}

const DEMO_STAGE_BEATS: Record<ExperiencePresetKey, StageBeat[]> = {
  premium: [
    { title: "Open with product value", speaker: "Decí por qué este producto premium necesita autenticidad + UX.", goal: "Posicionar confianza y premium proof." },
    { title: "Show authentic scan", speaker: "Mostrá AUTH OK y el passport mobile como prueba tangible.", goal: "Conectar tag + mobile + backend." },
    { title: "Escalate to risk", speaker: "Corré tamper o replay para evidenciar defensa de marca.", goal: "Demostrar detección y protección." },
    { title: "Close with ownership", speaker: "Terminá con ownership, warranty o loyalty como next step.", goal: "Traducir seguridad en negocio repetible." },
  ],
  event: [
    { title: "Frame the venue", speaker: "Presentá el evento como operación con acceso, fraude y sponsors.", goal: "Definir el problema operativo." },
    { title: "Run live check-in", speaker: "Mostrá lectura rápida y validación instantánea del ingreso.", goal: "Probar throughput y UX." },
    { title: "Trigger replay risk", speaker: "Simulá anti-passback / replay para mostrar control real.", goal: "Mostrar seguridad y gobernanza." },
    { title: "Close from ops map", speaker: "Cerrá con evidencia geográfica y activación comercial post ingreso.", goal: "Unir operación con revenue." },
  ],
  credentials: [
    { title: "Introduce the credential", speaker: "Explicá el activo verificable y la necesidad de evidencia auditable.", goal: "Instalar el caso compliance." },
    { title: "Verify presence", speaker: "Mostrá AUTH OK como prueba pública/controlada.", goal: "Mostrar validación documental." },
    { title: "Activate ownership", speaker: "Corré CLAIMED o REDEEMED para enseñar lifecycle y titularidad.", goal: "Enseñar trazabilidad del documento." },
    { title: "Close with audit trail", speaker: "Llevá la conversación al timeline y a la evidencia backend-linked.", goal: "Cerrar con readiness regulatoria." },
  ],
};

const CINEMATIC_SCRIPTS: Record<ExperiencePresetKey, CinematicCue[]> = {
  premium: [
    { beat: 0, section: "setup", durationSec: 5, narration: "Abrimos con el valor del producto premium y preparamos el pack." },
    { beat: 1, section: "mobile", durationSec: 6, scenario: "valid", openMobile: true, narration: "Mostramos autenticidad real y experiencia mobile premium." },
    { beat: 2, section: "simulate", durationSec: 6, scenario: "tamper", narration: "Escalamos a riesgo para demostrar defensa de marca." },
    { beat: 3, section: "ops", durationSec: 6, scenario: "claim", narration: "Cerramos con ownership, trazabilidad y monetización postventa." },
  ],
  event: [
    { beat: 0, section: "setup", durationSec: 5, narration: "Enmarcamos la operación del evento y la necesidad de control en vivo." },
    { beat: 1, section: "simulate", durationSec: 5, scenario: "checkin", narration: "Corremos check-in instantáneo para mostrar throughput operativo." },
    { beat: 2, section: "simulate", durationSec: 6, scenario: "replay", narration: "Disparamos replay para enseñar anti-passback y seguridad." },
    { beat: 3, section: "ops", durationSec: 6, scenario: "claim", narration: "Cerramos desde Ops con evidencia, activación y revenue del venue." },
  ],
  credentials: [
    { beat: 0, section: "setup", durationSec: 5, narration: "Presentamos la credencial verificable y el problema de compliance." },
    { beat: 1, section: "mobile", durationSec: 6, scenario: "valid", openMobile: true, narration: "Mostramos verificación positiva y prueba documental controlada." },
    { beat: 2, section: "simulate", durationSec: 6, scenario: "claim", narration: "Activamos lifecycle del documento con titularidad y seguimiento." },
    { beat: 3, section: "ops", durationSec: 6, scenario: "redeem", narration: "Cerramos con audit trail y evidencia backend-linked." },
  ],
};

const RUNBOOKS: Record<VerticalKey, { headline: string; summary: string; proof: string; kpis: string[]; steps: RunbookStep[] }> = {
  wine: {
    headline: "Protegemos vino premium y mostramos autenticidad instantánea.",
    summary: "Ideal para bodegas, importadores y distribuidores que necesitan autenticidad + storytelling + ownership.",
    proof: "Mostrá botella auténtica, riesgo por tamper y trazabilidad de cada apertura.",
    kpis: ["Auth rate", "Tamper alerts", "Recompra / club", "Geo de consumo"],
    steps: [
      { title: "Abrí con valor de marca", detail: "Cargá wine-secure y destacá botella premium + passport móvil.", kpi: "Premium proof" },
      { title: "Mostrá fraude evitado", detail: "Corré AUTH OK seguido de TAMPER RISK para contrastar confianza vs. alerta.", kpi: "Tamper alerts" },
      { title: "Cerrá con CRM", detail: "Explicá cómo ownership, warranty y provenance empujan recompra y loyalty.", kpi: "Club / leads" },
    ],
  },
  events: {
    headline: "Aceleramos access control y engagement en eventos masivos.",
    summary: "Pensado para festivales, hospitality y credenciales con check-in más activaciones post-ingreso.",
    proof: "Mostrá check-in instantáneo, replay sospechoso y geografía de asistencia.",
    kpis: ["Check-ins/min", "Fraud blocks", "Attendee engagement", "Sponsor conversions"],
    steps: [
      { title: "Abrí con velocidad operativa", detail: "Cargá events-basic y enfatizá lectura rápida + validación en tiempo real.", kpi: "Check-ins/min" },
      { title: "Mostrá seguridad", detail: "Corré CHECK-IN y luego DUPLICATE RISK para explicar anti-passback / replay.", kpi: "Fraud blocks" },
      { title: "Cerrá con negocio", detail: "Mostrá CRM-lite y activaciones para sponsors o upsell VIP.", kpi: "Engagement" },
    ],
  },
  docs: {
    headline: "Validamos credenciales, certificados y presencia documentada.",
    summary: "Sirve para diplomas, compliance, onboarding y documentos con verificación pública controlada.",
    proof: "Mostrá emisión, ownership y evidencia de acceso desde backend.",
    kpis: ["Verified views", "Ownership claims", "Audit evidence", "Support reduction"],
    steps: [
      { title: "Abrí con confianza", detail: "Cargá docs-presence y mostrà el documento como activo verificable.", kpi: "Verified views" },
      { title: "Mostrá control", detail: "Corré AUTH OK y CLAIMED para explicar titularidad y auditoría.", kpi: "Claims" },
      { title: "Cerrá con compliance", detail: "Saltá a Ops para enseñar evidencia geolocalizada y registro histórico.", kpi: "Audit trail" },
    ],
  },
  cosmetics: {
    headline: "Transformamos packaging en un canal de autenticidad y postventa.",
    summary: "Útil para skincare, perfume y beauty retail con foco en fraude, loyalty y education.",
    proof: "Mostrá autenticidad, provenance y activación de garantía / soporte.",
    kpis: ["Auth scans", "Fake reduction", "Warranty activation", "Consumer education"],
    steps: [
      { title: "Abrí con confianza retail", detail: "Cargá cosmetics-secure y mostrà el passport del producto.", kpi: "Auth scans" },
      { title: "Mostrá defensa de marca", detail: "Corré TAMPER RISK para explicar detección temprana en góndola o reventa.", kpi: "Fake reduction" },
      { title: "Cerrá con postventa", detail: "Destacá garantía, soporte y contenido educativo mobile.", kpi: "Warranty" },
    ],
  },
  agro: {
    headline: "Digitalizamos trazabilidad agro y evidencia de origen.",
    summary: "Pensado para exportación, certificación y seguimiento de lotes en campo y distribución.",
    proof: "Mostrá provenance, lecturas por región y estado del lote en cada toque.",
    kpis: ["Traceability", "Origin proof", "Distributor compliance", "Incident response"],
    steps: [
      { title: "Abrí con origen", detail: "Cargá un pack agro y destacá lote + proveniencia verificable.", kpi: "Origin proof" },
      { title: "Mostrá observabilidad", detail: "Generá live stream para enseñar cobertura geográfica operativa.", kpi: "Traceability" },
      { title: "Cerrá con compliance", detail: "Explicá cómo la evidencia reduce disputas y acelera exportación.", kpi: "Compliance" },
    ],
  },
  pharma: {
    headline: "Protegemos producto sensible y elevamos confianza regulatoria.",
    summary: "Para pharma, wellness y supply chain con necesidad de autenticación y evidencia operacional.",
    proof: "Mostrá autenticidad, replay risk y timeline trazable para auditoría.",
    kpis: ["Verified units", "Replay detection", "Audit readiness", "Patient trust"],
    steps: [
      { title: "Abrí con riesgo alto", detail: "Cargá pharma y resaltá autenticación en producto sensible.", kpi: "Verified units" },
      { title: "Mostrá prevención", detail: "Corré DUPLICATE RISK para explicar potencial clon o desvío.", kpi: "Replay detection" },
      { title: "Cerrá con regulación", detail: "Llevá la conversación al timeline y evidence map.", kpi: "Audit readiness" },
    ],
  },
};


function detectLocale(): Locale {
  const value = (typeof document !== "undefined" ? document.cookie.match(/(?:^|; )locale=([^;]+)/)?.[1] || "es-AR" : "es-AR") as Locale;
  return value === "pt-BR" || value === "en" ? value : "es-AR";
}

async function call(path: string, method = "GET", payload?: unknown) {
  const res = await fetch(`/api/internal/demo/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await res.json().catch(() => ({ ok: false, reason: "Invalid JSON" }));
  if (!res.ok) throw new Error((data && (data.reason || data.error)) || `Request failed ${res.status}`);
  return data;
}

function mapScenarioToApiMode(eventType: ScanScenario["eventType"]) {
  if (eventType === "tamper") return "tamper";
  if (eventType === "replay") return "replay";
  return "valid";
}

function modeLabel(mode: DemoMode) {
  if (mode === "simulated") return "SIMULATED";
  if (mode === "consumer_tap") return "PRODUCTION-LIKE PREVIEW";
  return "LIVE NFC";
}

function createDemoMatrix(seed: string, size = 21) {
  let value = 0;
  for (let index = 0; index < seed.length; index += 1) value = (value * 131 + seed.charCodeAt(index)) >>> 0;

  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      const finderZone =
        (row < 7 && col < 7) ||
        (row < 7 && col >= size - 7) ||
        (row >= size - 7 && col < 7);
      if (finderZone) {
        const localRow = row < 7 ? row : row - (size - 7);
        const localCol = col < 7 ? col : col - (size - 7);
        const distance = Math.max(Math.abs(3 - localRow), Math.abs(3 - localCol));
        return distance === 3 || distance <= 1;
      }
      value = (value * 1664525 + 1013904223 + row * 17 + col * 31) >>> 0;
      return (value & 1) === 0;
    }),
  );
}

function demoMatrixDataUrl(value: string) {
  const matrix = createDemoMatrix(value);
  const cell = 8;
  const padding = 16;
  const size = matrix.length * cell + padding * 2;
  const cells = matrix
    .flatMap((row, rowIndex) =>
      row.map((filled, colIndex) =>
        filled
          ? `<rect x="${padding + colIndex * cell}" y="${padding + rowIndex * cell}" width="${cell}" height="${cell}" rx="1" fill="#0f172a" />`
          : "",
      ),
    )
    .join("");
  const safeLabel = value.replace(/[<&>"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size + 34}" role="img" aria-label="Demo mobile preview code"><rect width="100%" height="100%" rx="24" fill="#ffffff"/>${cells}<text x="${size / 2}" y="${size + 20}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#0f172a">Local scan card</text><text x="${size / 2}" y="${size + 32}" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#475569">${safeLabel}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function inferVerticalFromPack(pack: string): VerticalKey {
  if (pack.includes("events")) return "events";
  if (pack.includes("docs")) return "docs";
  if (pack.includes("cosmetics")) return "cosmetics";
  if (pack.includes("agro")) return "agro";
  if (pack.includes("pharma")) return "pharma";
  return "wine";
}

export function DemoLab() {
  const [out, setOut] = useState("Ready");
  const [summary, setSummary] = useState<Summary>({});
  const [packs, setPacks] = useState<Pack[]>([]);
  const [pack, setPack] = useState("wine-secure");
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<DemoMode>("simulated");
  const [activeSection, setActiveSection] = useState<LabSection>("setup");
  const [selectedScenario, setSelectedScenario] = useState<ScanScenario["eventType"]>("valid");
  const [presenterMode, setPresenterMode] = useState(false);
  const [presenterLock, setPresenterLock] = useState(false);
  const [nfcPermission, setNfcPermission] = useState<PermissionStateLite>("unknown");
  const [geoPermission, setGeoPermission] = useState<PermissionStateLite>("unknown");
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("buyer");
  const [selectedExperience, setSelectedExperience] = useState<ExperiencePresetKey>("premium");
  const [focusMode, setFocusMode] = useState(false);
  const [stageMode, setStageMode] = useState(false);
  const [stageBeatIndex, setStageBeatIndex] = useState(0);
  const [autoRunActive, setAutoRunActive] = useState(false);
  const [autoRunCueIndex, setAutoRunCueIndex] = useState(0);
  const [autoRunSecondsLeft, setAutoRunSecondsLeft] = useState(0);
  const [autoRunNarration, setAutoRunNarration] = useState("");
  const [autoRunLog, setAutoRunLog] = useState<string[]>([]);
  const [mobilePreviewOpened, setMobilePreviewOpened] = useState(false);
  const [lastTriggeredScenario, setLastTriggeredScenario] = useState<string>("none");
  const [readiness, setReadiness] = useState({
    packLoaded: false,
    manifestLoaded: false,
    scenarioRun: false,
    mobileOpened: false,
  });
  const [locale, setLocale] = useState<Locale>("es-AR");
  const [envSupport, setEnvSupport] = useState({ nfc: false, secure: false, geo: false });
  const webBase = productUrls.web;

  const nfcSupport = envSupport.nfc;
  const hasSecureContext = envSupport.secure;
  const hasGeo = envSupport.geo;
  const liveNfcReady = nfcSupport && hasSecureContext;
  const latestEvent = (summary.events || [])[0];
  const activeVertical = inferVerticalFromPack(pack);
  const runbook = RUNBOOKS[activeVertical];
  const experiencePreset = DEMO_EXPERIENCES[selectedExperience];
  const stageBeats = DEMO_STAGE_BEATS[selectedExperience];
  const activeStageBeat = stageBeats[stageBeatIndex] || stageBeats[0];
  const cinematicScript = CINEMATIC_SCRIPTS[selectedExperience];
  const activeCue = cinematicScript[autoRunCueIndex] || cinematicScript[0];
  const autoRunProgress = cinematicScript.length > 0 ? Math.round(((autoRunCueIndex + (autoRunActive ? 1 : 0)) / cinematicScript.length) * 100) : 0;
  const audienceCopy = audienceMode === "ceo"
    ? {
        title: "CEO / Ingeniero view",
        summary: "Mostramos qué API, qué vertical, qué riesgo y qué evidencia operacional sostienen la demo.",
        kpiFocus: "KPI: revenue expansion + risk containment",
        commercialNext: "Próximo paso: propuesta de rollout por país + plan enterprise.",
        bullets: [
          "Qué se está simulando o resolviendo en backend.",
          "Qué pack/vertical está activo y cómo impacta el flujo.",
          "Qué evidencia termina en mobile, timeline y ops map.",
        ],
      }
    : audienceMode === "operator"
      ? {
          title: "Operator / Engineer view",
          summary: "Mostramos controles operativos, estado por lote/tag y respuesta práctica ante alertas.",
          kpiFocus: "KPI: activación efectiva + excepción resuelta",
          commercialNext: "Próximo paso: cerrar lote READY TO SCAN y playbook de incidentes.",
          bullets: [
            "Qué pasos ejecutar: cargar pack, importar UIDs, activar, validar URL.",
            "Qué señales de riesgo importan: tamper, replay y no activo.",
            "Qué siguiente acción tomar para dejar el lote READY TO SCAN.",
          ],
        }
      : {
        title: "Client / Buyer view",
        summary: "Mostramos el valor de compra: confianza, UX simple, activación postventa y protección de marca.",
        kpiFocus: "KPI: confianza de compra + retención postventa",
        commercialNext: "Próximo paso: CTA ownership/garantía + demo comercial.",
        bullets: [
          "Qué gana el cliente final al escanear o tocar el producto.",
          "Qué riesgo evitamos con autenticidad, tamper y replay detection.",
          "Qué CTA comercial sigue después: ownership, garantía o soporte.",
        ],
      };

  const audienceAction = audienceMode === "ceo"
    ? { primary: "Run 90s board narrative", secondary: "Open investor snapshot" }
    : audienceMode === "operator"
      ? { primary: "Run supplier onboarding", secondary: "Open ops evidence" }
      : { primary: "Open public mobile preview", secondary: "Trigger CTA journey" };
  const opsReady = Boolean((summary.events || []).some((event) => Number.isFinite(Number(event.lat)) && Number.isFinite(Number(event.lng))));

  const roleState = audienceMode === "ceo"
    ? {
        map: opsReady ? "Rollout map active" : "Waiting first geo evidence",
        feed: lastTriggeredScenario !== "none" ? `Risk/revenue event: ${lastTriggeredScenario}` : "No event yet",
        mobile: mobilePreviewOpened ? "Consumer proof opened" : "Open mobile proof",
        cta: "Next: enterprise rollout proposal",
      }
    : audienceMode === "operator"
      ? {
          map: opsReady ? "Ops map with evidence points" : "No geodata yet",
          feed: lastTriggeredScenario !== "none" ? `Exception monitor: ${lastTriggeredScenario}` : "Run scenario for evidence",
          mobile: mobilePreviewOpened ? "Field preview verified" : "Preview pending",
          cta: "Next: leave batch READY TO SCAN",
        }
      : {
          map: opsReady ? "Brand trust map visible" : "Experience pre-scan",
          feed: lastTriggeredScenario !== "none" ? `Consumer moment: ${lastTriggeredScenario}` : "Tap pending",
          mobile: mobilePreviewOpened ? "Premium mobile UX live" : "Open mobile journey",
          cta: "Next: ownership / warranty / provenance",
        };

  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEnvSupport({
      nfc: "NDEFReader" in window,
      secure: window.isSecureContext,
      geo: typeof navigator !== "undefined" && "geolocation" in navigator,
    });
  }, []);

  async function runAction(action: () => Promise<unknown>) {
    setPending(true);
    try {
      const result = await action();
      setOut(JSON.stringify(result, null, 2));
      await refreshSummary();
    } catch (error) {
      setOut(error instanceof Error ? error.message : "Action failed");
    } finally {
      setPending(false);
    }
  }

  const refreshSummary = async () => {
    const data = await call("summary");
    setSummary(data || {});
  };

  useEffect(() => {
    void (async () => {
      const res = await call("packs");
      const list = Array.isArray(res?.packs) ? (res.packs as Pack[]) : [];
      setPacks(list);
      if (list.length > 0 && !list.find((item) => item.key === pack)) setPack(list[0].key);
      await refreshSummary();
    })();
  }, []);

  useEffect(() => {
    setSelectedExperience(inferPresetFromPack(pack));
  }, [pack]);

  useEffect(() => {
    void (async () => {
      if (typeof navigator === "undefined" || !("permissions" in navigator)) return;
      try {
        const geo = await navigator.permissions.query({ name: "geolocation" });
        setGeoPermission(geo.state);
      } catch {
        // ignore unsupported permissions implementations
      }
      try {
        const nfc = await navigator.permissions.query({ name: "nfc" as PermissionName });
        setNfcPermission(nfc.state);
      } catch {
        // ignore unsupported permissions implementations
      }
    })();
  }, []);

  const points = useMemo(
    () =>
      (summary.events || [])
        .filter((event) => Number.isFinite(Number(event.lat)) && Number.isFinite(Number(event.lng)))
        .map((event) => ({
          city: event.city || "Unknown",
          country: event.country_code || "--",
          lat: Number(event.lat),
          lng: Number(event.lng),
          scans: 1,
          risk: event.result === "VALID" ? 0 : 1,
          vertical: event.vertical,
          status: event.result,
          source: "demo-lab",
          lastSeen: event.created_at,
        })),
    [summary.events],
  );

  const readFile = async (file: File) => file.text();

  async function downloadPackFile(type: "manifest" | "seed") {
    await runAction(async () => {
      const extension = type === "seed" ? "json" : "csv";
      const response = await fetch(`/api/internal/demo/pack-file?pack=${encodeURIComponent(pack)}&type=${type}`);
      if (!response.ok) throw new Error(`Unable to download ${type}`);
      const content = await response.text();
      const blob = new Blob([content], { type: type === "seed" ? "application/json" : "text/csv" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${pack}.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      return { ok: true, downloaded: `${pack}.${extension}` };
    });
  }

  async function requestGeoForLive() {
    if (!hasGeo) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOut(
          JSON.stringify(
            {
              ok: true,
              source: "phone",
              note: "GPS only with explicit user permission.",
              geo: {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date(position.timestamp).toISOString(),
              },
            },
            null,
            2,
          ),
        );
      },
      (error) => {
        setOut(JSON.stringify({ ok: false, reason: error.message }, null, 2));
      },
    );
  }

  async function triggerScenario(scenario: ScanScenario["eventType"]) {
    setLastTriggeredScenario(scenario);
    setReadiness((state) => ({ ...state, scenarioRun: true }));
    await runAction(() => call("simulate-tap", "POST", { mode: mapScenarioToApiMode(scenario), scenario, source: mode, vertical: activeVertical }));
  }

  async function runAuto90SecondsDemo(playlistOverride?: Array<ScanScenario["eventType"]>) {
    const playlist: Array<ScanScenario["eventType"]> = playlistOverride || (activeVertical === "events"
      ? ["checkin", "replay", "claim"]
      : activeVertical === "docs"
        ? ["valid", "claim", "redeem"]
        : ["valid", "tamper", "replay", "claim"]);

    for (const scenario of playlist) {
      // eslint-disable-next-line no-await-in-loop
      await triggerScenario(scenario);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }



  async function waitWithCountdown(seconds: number) {
    setAutoRunSecondsLeft(seconds);
    for (let remaining = seconds; remaining > 0; remaining -= 1) {
      setAutoRunSecondsLeft(remaining);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    setAutoRunSecondsLeft(0);
  }

  async function runCinematicAutoRun() {
    if (autoRunActive) return;
    setAutoRunActive(true);
    setStageMode(true);
    setAutoRunCueIndex(0);
    setStageBeatIndex(0);
    setAutoRunLog([]);
    try {
      await runAction(() => call("use-pack", "POST", { pack: experiencePreset.packKey }));
      setAutoRunLog([`1) Pack ${experiencePreset.packKey} cargado.`]);
      let openedMobile = false;
      setMobilePreviewOpened(false);
      setLastTriggeredScenario("none");
      for (const [index, cue] of cinematicScript.entries()) {
        setAutoRunCueIndex(index);
        setStageBeatIndex(cue.beat);
        setActiveSection(cue.section);
        setAutoRunNarration(cue.narration);
        setAutoRunLog((prev) => [...prev, `${index + 1}) ${cue.narration}`].slice(-8));
        if (cue.openMobile && !openedMobile && typeof window !== "undefined") {
          window.open(openMobilePreviewHref, "_blank", "noopener,noreferrer");
          openedMobile = true;
          setMobilePreviewOpened(true);
          setAutoRunLog((prev) => [...prev, `${index + 1}) Mobile preview abierto (${openMobilePreviewHref}).`].slice(-8));
        }
        if (cue.scenario) {
          // eslint-disable-next-line no-await-in-loop
          await triggerScenario(cue.scenario);
          setAutoRunLog((prev) => [...prev, `${index + 1}) Escenario ejecutado: ${cue.scenario}.`].slice(-8));
        }
        // eslint-disable-next-line no-await-in-loop
        await waitWithCountdown(cue.durationSec);
      }
      setActiveSection("ops");
      setAutoRunNarration("Auto-run terminada. Cerrá mostrando evidencia, KPI y siguiente paso comercial.");
      setAutoRunLog((prev) => [...prev, "Cierre: mostrar KPI + siguiente acción comercial (ownership / warranty / provenance / tokenización)."].slice(-8));
    } finally {
      setAutoRunActive(false);
      setAutoRunSecondsLeft(0);
    }
  }

  async function runExperiencePreset(presetKey: ExperiencePresetKey) {
    const preset = DEMO_EXPERIENCES[presetKey];
    setSelectedExperience(presetKey);
    setStageMode(true);
    setAutoRunNarration("");
    setMobilePreviewOpened(false);
    setLastTriggeredScenario("none");
    setStageBeatIndex(0);
    setPack(preset.packKey);
    setMode(preset.mode);
    setAudienceMode(preset.audience);
    setActiveSection(preset.section);
    await runAction(() => call("use-pack", "POST", { pack: preset.packKey }));
    await runAuto90SecondsDemo(preset.playlist);
  }

  async function runSalesStory() {
    setStageMode(true);
    setStageBeatIndex(0);
    setMobilePreviewOpened(false);
    setLastTriggeredScenario("none");
    setActiveSection("simulate");
    await runAction(() => call("use-pack", "POST", { pack }));
    setReadiness((state) => ({ ...state, packLoaded: true }));
    if (typeof window !== "undefined") window.open(openMobilePreviewHref, "_blank", "noopener,noreferrer");
    setReadiness((state) => ({ ...state, mobileOpened: true }));
    await runAuto90SecondsDemo();
    setActiveSection("ops");
  }

  const selectedPack = packs.find((item) => item.key === pack);
  const previewTenant = selectedPack?.tenant || "demobodega";
  const previewItemId = selectedPack?.itemId || "demo-item-001";
  const activeBatchId = selectedPack?.batchId || "DEMO-2026-02";
  const mobileDemoMode = mode === "live_nfc" ? "consumer_opened" : "consumer_tap";
  const openMobilePreviewHref = `${webBase}/demo-lab/mobile/${previewTenant}/${previewItemId}?demoMode=${mobileDemoMode}&pack=${pack}`;
  const tagPreviewLinks = DEMO_UIDS.map((uid) => `${openMobilePreviewHref}&uid=${uid}`);
  const qrPreviewHref = useMemo(() => demoMatrixDataUrl(openMobilePreviewHref), [openMobilePreviewHref]);
  const textScale = presenterMode ? "text-base" : "text-sm";
  const canShowTechnical = !presenterLock;

  async function applyPackReadyFlow() {
    const csv = ["batch_id,uid_hex,roll_id,ic_type", ...DEMO_UIDS.map((uid, index) => `${activeBatchId},${uid},${String(index + 1).padStart(3, "0")},${selectedPack?.icType || "NTAG424DNA_TT"}`)].join("\n");
    await runAction(async () => {
      await call("use-pack", "POST", { pack });
      await call("upload-manifest", "POST", { bid: activeBatchId, csv });
      await call("generate-live-scans", "POST", { count: 10 });
      setReadiness({ packLoaded: true, manifestLoaded: true, scenarioRun: true, mobileOpened: false });
      return { ok: true, flow: "pack-ready", pack, batch: activeBatchId, tags: DEMO_UIDS.length };
    });
  }

  async function runMeetingStory(duration: "30s" | "90s") {
    setPresenterLock(true);
    setAutoRunLog([]);
    if (duration === "30s") {
      await runAction(() => call("use-pack", "POST", { pack }));
      setReadiness((state) => ({ ...state, packLoaded: true }));
      setActiveSection("mobile");
      if (typeof window !== "undefined") window.open(openMobilePreviewHref, "_blank", "noopener,noreferrer");
      setReadiness((state) => ({ ...state, mobileOpened: true }));
      setAutoRunNarration("Paso 1/4: valor del producto. Paso 2/4: autenticidad validada en mobile.");
      setAutoRunLog((prev) => [...prev, "Paso 1/4: cargar pack y abrir narrativa de valor."]);
      await triggerScenario("valid");
      setAutoRunNarration("Paso 3/4: simulación de riesgo (tamper) + actualización del feed.");
      setAutoRunLog((prev) => [...prev, "Paso 2/4: AUTH_OK en mobile.", "Paso 3/4: TAMPER_RISK para evidenciar riesgo."]);
      await triggerScenario("tamper");
      setActiveSection("ops");
      setAutoRunNarration("Paso 4/4: cierre con CTA comerciales (ownership, garantía, provenance, tokenización).");
      setAutoRunLog((prev) => [...prev, "Paso 4/4: cierre con CTA comerciales y próxima acción recomendada."]);
      return;
    }
    await runSalesStory();
  }


  return (
    <div id="top" className={`demo-lab min-h-screen text-slate-200 ${textScale} ${focusMode ? "fixed inset-0 z-[90] overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a1a] to-black px-4 py-6 md:px-8" : "bg-transparent space-y-6"}`}>
      {/* HEADER SECTION */}
      <div className="mb-8 border-b border-white/10 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Demo Lab Narrative Engine
            {presenterLock && <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">Presenter Locked</span>}
          </h1>
          <p className="mt-2 text-sm text-slate-400">Escalabilidad, revenue mix, mitigación de riesgo y expansión comercial.</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setFocusMode((v) => !v)} className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${focusMode ? "border-cyan-500 bg-cyan-500/20 text-cyan-50" : "border-slate-700 hover:bg-slate-800 text-white"}`}>
              {focusMode ? "Exit Fullscreen" : "Enter Pitch View"}
            </button>
            <button type="button" onClick={() => setPresenterLock((v) => !v)} className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${presenterLock ? "border-emerald-500 bg-emerald-500/20 text-emerald-50" : "border-slate-700 hover:bg-slate-800 text-white"}`}>
              {presenterLock ? "Unlock Controls" : "Lock for Presentation"}
            </button>
        </div>
      </div>

      {/* STORY PIPELINE TRACK */}
      <div className="mb-8 grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
            <h3 className="font-semibold text-cyan-100">1) Product value</h3>
            <p className="text-xs text-cyan-300 mt-1">Initial scan & authenticity</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 opacity-70 hover:opacity-100 transition-opacity">
            <h3 className="font-semibold text-slate-300">2) Authentic scan</h3>
            <p className="text-xs text-slate-500 mt-1">Consumer engagement</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 opacity-70 hover:opacity-100 transition-opacity">
            <h3 className="font-semibold text-slate-300">3) Risk event</h3>
            <p className="text-xs text-slate-500 mt-1">Tamper/Replay mitigation</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 opacity-70 hover:opacity-100 transition-opacity">
            <h3 className="font-semibold text-slate-300">4) Ownership / loyalty</h3>
            <p className="text-xs text-slate-500 mt-1">Post-sale CRM & tokens</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT COLUMN: CONTROL & FEED */}
        <div className="space-y-6">
          <Card className="demo-lab-card border-slate-800 bg-slate-900/50 p-6 backdrop-blur shadow-xl">
            <h2 className="text-sm font-bold tracking-widest text-slate-400 uppercase mb-4">Live Feed Context</h2>
            <ul className="space-y-3 text-sm text-slate-200">
              <li className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span> Batch {activeBatchId || "DEMO-2026-02"} listo para piloto.</li>
              <li className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> Tag profile {pack} cargado.</li>
              <li className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]"></span> Route map inicializado.</li>
            </ul>

            <div className="grid grid-cols-3 gap-4 mt-6">
               <div className="rounded-lg bg-slate-950 p-4 border border-slate-800">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Pipeline</p>
                  <p className="text-lg font-bold text-white mt-1">Qualified</p>
               </div>
               <div className="rounded-lg bg-slate-950 p-4 border border-slate-800">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Risk Control</p>
                  <p className="text-lg font-bold text-emerald-400 mt-1">Active</p>
               </div>
               <div className="rounded-lg bg-slate-950 p-4 border border-slate-800">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Expansion</p>
                  <p className="text-lg font-bold text-violet-400 mt-1">LATAM-ready</p>
               </div>
            </div>

            <div className="mt-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-4 flex items-center justify-between">
              <p className="text-sm text-indigo-200">Recommended CTA: Solicitar reunión de rollout enterprise</p>
              <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-md transition-colors shadow-lg shadow-indigo-500/25">Action</button>
            </div>
          </Card>

          {!presenterLock && (
            <Card className="demo-lab-card border-amber-500/30 bg-amber-950/20 p-6 backdrop-blur">
              <h3 className="text-sm font-bold tracking-widest text-amber-500 uppercase mb-3">Narrative Engine Scenarios</h3>
              <p className="text-xs text-amber-200/70 leading-relaxed mb-4">
                Run simulated tags representing key moments in the product journey to show full-spectrum NFC value: Authenticity, Tamper-evidence, CRM/Loyalty, and Geo-Risk.
              </p>

              <div className="grid grid-cols-2 gap-3 mt-4">
                 <button onClick={() => triggerScenario("valid")} disabled={pending} className="group bg-slate-900 border border-slate-700 hover:border-emerald-500 hover:bg-emerald-950/30 transition-colors rounded-lg p-3 text-left">
                    <p className="text-sm font-semibold group-hover:text-emerald-400 transition-colors">1. Factory Sealed (Valid)</p>
                    <p className="text-[10px] text-slate-500 mt-1">Standard valid authentication</p>
                 </button>
                 <button onClick={() => triggerScenario("tamper")} disabled={pending} className="group bg-slate-900 border border-slate-700 hover:border-red-500 hover:bg-red-950/30 transition-colors rounded-lg p-3 text-left">
                    <p className="text-sm font-semibold group-hover:text-red-400 transition-colors">2. Broken Seal (Tampered)</p>
                    <p className="text-[10px] text-slate-500 mt-1">Opened loop or broken tag</p>
                 </button>
                 <button onClick={() => triggerScenario("replay")} disabled={pending} className="group bg-slate-900 border border-slate-700 hover:border-amber-500 hover:bg-amber-950/30 transition-colors rounded-lg p-3 text-left">
                    <p className="text-sm font-semibold group-hover:text-amber-400 transition-colors">3. Suspect Clone (Replay)</p>
                    <p className="text-[10px] text-slate-500 mt-1">Cloned URL parameters caught</p>
                 </button>
                 <button onClick={() => runAction(() => call("use-pack", "POST", { pack: "wine-secure" }))} disabled={pending} className="group bg-slate-900 border border-slate-700 hover:border-cyan-500 hover:bg-cyan-950/30 transition-colors rounded-lg p-3 text-left">
                    <p className="text-sm font-semibold group-hover:text-cyan-400 transition-colors">4. Load Enterprise Wine</p>
                    <p className="text-[10px] text-slate-500 mt-1">Reset context to premium wine</p>
                 </button>
              </div>
            </Card>
          )}

          {canShowTechnical && (
             <div className="rounded-xl border border-white/10 bg-black/50 p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center justify-between">
                   <span>Technical Event Log</span>
                   <span className="text-emerald-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> live</span>
                </h3>
                <div className="h-32 overflow-y-auto font-mono text-[10px] text-emerald-400/70 space-y-1">
                   {(summary.events || []).slice(0, 8).map((e) => (
                      <div key={e.id} className="flex gap-2 hover:bg-white/5 px-1 py-0.5 rounded transition-colors">
                        <span className="text-slate-600 w-16">[{new Date(e.created_at || Date.now()).toLocaleTimeString()}]</span>
                        <span className={`w-16 font-bold ${e.result === "valid" ? "text-emerald-400" : e.result === "replay_suspect" ? "text-amber-400" : "text-red-400"}`}>{e.result.toUpperCase()}</span>
                        <span className="text-cyan-300/50 truncate w-32">{e.uid_hex || "no-uid"}</span>
                        <span className="text-slate-500 ml-auto truncate max-w-[80px]">{e.city || "Unknown"}</span>
                      </div>
                   ))}
                   {(!summary.events || summary.events.length === 0) && (
                      <div className="text-slate-600 italic">Waiting for events...</div>
                   )}
                </div>
             </div>
          )}
        </div>

        {/* RIGHT COLUMN: PREVIEW */}
        <div className="h-full flex flex-col">
          <Card className="demo-lab-card border-slate-800 bg-[#0f172a] shadow-2xl overflow-hidden flex-1 flex flex-col relative h-[800px]">

             {/* Header */}
             <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex justify-between items-center z-10 relative">
                <div>
                   <h2 className="text-sm font-bold tracking-widest text-white uppercase flex items-center gap-2">
                     <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                     </span>
                     Mobile Preview Synced
                   </h2>
                   <p className="text-[10px] text-slate-500 mt-1 truncate max-w-sm">Tenant: {summary.tenant?.slug || "demo"} · Pack: {pack}</p>
                </div>
                <div className="flex gap-2">
                   <span className="px-2 py-1 bg-violet-500/20 text-violet-300 text-[10px] font-bold rounded border border-violet-500/30">DEMO MODE</span>
                </div>
             </div>

             {/* Interactive Emulated Frame */}
             <div className="flex-1 bg-slate-900 overflow-y-auto relative p-6 custom-scrollbar flex flex-col items-center justify-center">

                {/* Live Emulation Status Box */}
                <div className="w-full max-w-[400px] rounded-xl border border-slate-700 bg-slate-800/50 p-5 mb-6 backdrop-blur">
                   <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-4">NFC Scan Emulation</h3>
                   <div className="w-full bg-slate-900 rounded-full h-2 mb-2">
                      <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full w-full animate-pulse"></div>
                   </div>
                   <p className="text-[10px] text-slate-400 text-right mb-4">Cryptographic handshake 100%</p>

                   <div className="grid grid-cols-3 gap-2 text-center mt-2">
                      <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/50">
                         <p className="text-[9px] text-slate-500 uppercase">Scan-to-ETA</p>
                         <p className="text-sm font-bold text-white mt-1">47ms</p>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/50">
                         <p className="text-[9px] text-slate-500 uppercase">Fraud Shield</p>
                         <p className="text-sm font-bold text-emerald-400 mt-1">Active</p>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/50">
                         <p className="text-[9px] text-slate-500 uppercase">Lead Quality</p>
                         <p className="text-sm font-bold text-amber-400 mt-1">Pending</p>
                      </div>
                   </div>
                </div>

                {/* Simulated Passport Integration */}
                <div className="relative w-[375px] h-[750px] rounded-[3rem] border-[10px] border-slate-950 bg-black shadow-2xl overflow-hidden shrink-0">
                   {/* Hardware Frame UI Details */}
                   <div className="absolute top-0 inset-x-0 h-6 bg-slate-950 rounded-b-2xl w-40 mx-auto z-50 flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
                      <div className="w-10 h-1.5 rounded-full bg-slate-800"></div>
                   </div>
                   <div className="absolute top-20 -left-2.5 w-1 h-8 bg-slate-800 rounded-l-md"></div>
                   <div className="absolute top-36 -left-2.5 w-1 h-12 bg-slate-800 rounded-l-md"></div>
                   <div className="absolute top-52 -left-2.5 w-1 h-12 bg-slate-800 rounded-l-md"></div>
                   <div className="absolute top-36 -right-2.5 w-1 h-16 bg-slate-800 rounded-r-md"></div>

                   <iframe
                      src={openMobilePreviewHref}
                      className="w-full h-full border-0 bg-black"
                      title="Mobile Preview"
                      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                   />
                </div>
             </div>

             {/* Footer Actions */}
             <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-between items-center z-10 relative">
                <div>
                   <p className="text-xs font-bold text-white">Wine passport</p>
                   <p className="text-[10px] text-slate-400">Autenticidad + Storytelling enológico + Loyalty</p>
                </div>
                <a
                   href={openMobilePreviewHref}
                   target="_blank"
                   rel="noreferrer"
                   className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-full border border-slate-700 transition-colors flex items-center gap-2"
                >
                   Open in New Tab ↗
                </a>
             </div>

          </Card>
        </div>
      </div>
    </div>
  );
}
