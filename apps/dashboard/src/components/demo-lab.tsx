"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@product/ui";
import { productUrls } from "@product/config";
import { DemoOpsMap } from "./demo-ops-map";

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
          bullets: [
            "Qué pasos ejecutar: cargar pack, importar UIDs, activar, validar URL.",
            "Qué señales de riesgo importan: tamper, replay y no activo.",
            "Qué siguiente acción tomar para dejar el lote READY TO SCAN.",
          ],
        }
      : {
        title: "Client / Buyer view",
        summary: "Mostramos el valor de compra: confianza, UX simple, activación postventa y protección de marca.",
        bullets: [
          "Qué gana el cliente final al escanear o tocar el producto.",
          "Qué riesgo evitamos con autenticidad, tamper y replay detection.",
          "Qué CTA comercial sigue después: ownership, garantía o soporte.",
        ],
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
        .filter((event) => typeof event.lat === "number" && typeof event.lng === "number")
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

  const opsReady = points.length > 0;

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
    try {
      await runAction(() => call("use-pack", "POST", { pack: experiencePreset.packKey }));
      let openedMobile = false;
      setMobilePreviewOpened(false);
      setLastTriggeredScenario("none");
      for (const [index, cue] of cinematicScript.entries()) {
        setAutoRunCueIndex(index);
        setStageBeatIndex(cue.beat);
        setActiveSection(cue.section);
        setAutoRunNarration(cue.narration);
        if (cue.openMobile && !openedMobile && typeof window !== "undefined") {
          window.open(openMobilePreviewHref, "_blank", "noopener,noreferrer");
          openedMobile = true;
          setMobilePreviewOpened(true);
        }
        if (cue.scenario) {
          // eslint-disable-next-line no-await-in-loop
          await triggerScenario(cue.scenario);
        }
        // eslint-disable-next-line no-await-in-loop
        await waitWithCountdown(cue.durationSec);
      }
      setActiveSection("ops");
      setAutoRunNarration("Auto-run terminada. Cerrá mostrando evidencia, KPI y siguiente paso comercial.");
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
    if (duration === "30s") {
      await runAction(() => call("use-pack", "POST", { pack }));
      setReadiness((state) => ({ ...state, packLoaded: true }));
      setActiveSection("mobile");
      if (typeof window !== "undefined") window.open(openMobilePreviewHref, "_blank", "noopener,noreferrer");
      setReadiness((state) => ({ ...state, mobileOpened: true }));
      setAutoRunNarration("Paso 1/4: valor del producto. Paso 2/4: autenticidad validada en mobile.");
      await triggerScenario("valid");
      setAutoRunNarration("Paso 3/4: simulación de riesgo (tamper) + actualización del feed.");
      await triggerScenario("tamper");
      setActiveSection("ops");
      setAutoRunNarration("Paso 4/4: cierre con CTA comerciales (ownership, garantía, provenance, tokenización).");
      return;
    }
    await runSalesStory();
  }

  return (
    <div id="top" className={`demo-lab space-y-4 ${textScale} ${focusMode ? "fixed inset-0 z-[90] overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(34,211,238,.10),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,.12),transparent_32%),#020617] px-4 py-4 md:px-8" : ""}`}>
      <Card className={`demo-lab-card p-4 text-slate-300 ${focusMode ? "sticky top-0 z-20 border-cyan-300/20 bg-slate-950/95 shadow-[0_24px_80px_rgba(2,6,23,.55)] backdrop-blur" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p>{COPY[locale].intro}</p>
            <p className="mt-1 text-xs text-slate-400">Vertical activa: <b className="text-white">{activeVertical}</b> · Pack: <b className="text-white">{pack}</b> · Modo: <b className="text-white">{modeLabel(mode)}</b></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setFocusMode((v) => !v)} className={`rounded-lg border px-3 py-1 text-xs ${focusMode ? "border-cyan-300/50 bg-cyan-500/10 text-cyan-100" : "border-white/20 text-white"}`}>
              {focusMode ? "Salir fullscreen" : "Fullscreen presenter canvas"}
            </button>
            <button type="button" onClick={() => setPresenterMode((v) => !v)} className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white">
              {presenterMode ? "Salir modo presentador" : "Modo presentador"}
            </button>
            <button type="button" onClick={() => setPresenterLock((v) => !v)} className={`rounded-lg border px-3 py-1 text-xs ${presenterLock ? "border-emerald-300/50 bg-emerald-500/10 text-emerald-100" : "border-white/20 text-white"}`}>
              {presenterLock ? "Presenter Lock activo" : "Activar Presenter Lock"}
            </button>
          </div>
        </div>
      </Card>

      <Card className="demo-lab-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Demo Lab · flujo guiado para ventas</h2>
            <p className="mt-1 text-sm text-slate-300">Runbook dinámico por vertical, pitch guiado y evidencia operativa lista para reuniones.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100" onClick={() => void runMeetingStory("30s")} disabled={pending}>
              Meeting 30s
            </button>
            <button type="button" className="rounded-xl border border-violet-300/40 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-100" onClick={() => void runMeetingStory("90s")} disabled={pending}>
              Meeting 90s
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <div className={`rounded-xl border p-3 text-xs ${readiness.packLoaded ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-900/70 text-slate-300"}`}>Pack cargado</div>
          <div className={`rounded-xl border p-3 text-xs ${readiness.manifestLoaded ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-900/70 text-slate-300"}`}>Manifest aplicado</div>
          <div className={`rounded-xl border p-3 text-xs ${readiness.scenarioRun ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-900/70 text-slate-300"}`}>Escenario ejecutado</div>
          <div className={`rounded-xl border p-3 text-xs ${readiness.mobileOpened ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-900/70 text-slate-300"}`}>Mobile abierto</div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Narrativa</span>
          <button type="button" className={`rounded-full border px-3 py-1 text-xs ${audienceMode === "buyer" ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-100" : "border-white/15 text-slate-300"}`} onClick={() => setAudienceMode("buyer")}>Buyer / cliente</button>
          <button type="button" className={`rounded-full border px-3 py-1 text-xs ${audienceMode === "operator" ? "border-amber-300/40 bg-amber-500/10 text-amber-100" : "border-white/15 text-slate-300"}`} onClick={() => setAudienceMode("operator")}>Operator</button>
          <button type="button" className={`rounded-full border px-3 py-1 text-xs ${audienceMode === "ceo" ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100" : "border-white/15 text-slate-300"}`} onClick={() => setAudienceMode("ceo")}>CEO / ingeniero</button>
        </div>
        <div className="mt-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <p className="text-sm font-semibold text-white">{audienceCopy.title}</p>
          <p className="mt-1 text-sm text-slate-300">{audienceCopy.summary}</p>
          <ul className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-3">
            {audienceCopy.bullets.map((bullet) => (
              <li key={bullet} className="rounded-xl border border-white/10 bg-slate-950/70 p-3">{bullet}</li>
            ))}
          </ul>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          {(Object.entries(DEMO_EXPERIENCES) as Array<[ExperiencePresetKey, typeof DEMO_EXPERIENCES[ExperiencePresetKey]]>).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => void runExperiencePreset(key)}
              disabled={pending}
              className={`rounded-2xl border p-4 text-left ${selectedExperience === key ? "border-cyan-300/50 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-900/70 text-slate-200"}`}
            >
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Experience preset</p>
              <p className="mt-2 text-base font-semibold text-white">{preset.label}</p>
              <p className="mt-2 text-xs text-slate-300">{preset.description}</p>
              <p className="mt-3 text-[11px] text-cyan-200">{preset.packKey} · {modeLabel(preset.mode)} · {preset.playlist.length} beats</p>
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-4 text-xs text-cyan-100">
          Preset activo: <b>{experiencePreset.label}</b>. Esto alinea pack, modo y secuencia para contar una historia consistente de producto premium, evento en vivo o credencial auditada.
        </div>
        <div className={`mt-3 rounded-2xl border border-violet-300/20 bg-violet-500/5 p-4 ${focusMode ? "shadow-[0_24px_90px_rgba(76,29,149,.28)] ring-1 ring-violet-300/20" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-violet-200">Stage mode</p>
              <p className="mt-1 text-sm font-semibold text-white">{activeStageBeat.title}</p>
              <p className="mt-1 text-xs text-slate-300">{activeStageBeat.speaker}</p>
              <p className="mt-2 text-xs text-violet-200">Objetivo: {activeStageBeat.goal}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`rounded-lg border px-3 py-1 text-xs ${stageMode ? "border-violet-300/40 bg-violet-500/10 text-violet-100" : "border-white/15 text-slate-300"}`} onClick={() => setStageMode((value) => !value)}>
                {stageMode ? "Stage mode activo" : "Activar stage mode"}
              </button>
              <button type="button" className="rounded-lg border border-white/15 px-3 py-1 text-xs text-slate-300" onClick={() => setStageBeatIndex((value) => Math.max(0, value - 1))}>Anterior</button>
              <button type="button" className="rounded-lg border border-white/15 px-3 py-1 text-xs text-slate-300" onClick={() => setStageBeatIndex((value) => Math.min(stageBeats.length - 1, value + 1))}>Siguiente</button>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-white">Auto-run cinematográfica</p>
                <p className="mt-1 text-slate-400">Escena actual: {activeCue?.section || "setup"} · cue {autoRunCueIndex + 1}/{cinematicScript.length}</p>
              </div>
              <button type="button" onClick={() => void runCinematicAutoRun()} disabled={pending || autoRunActive} className="rounded-lg border border-violet-300/40 bg-violet-500/10 px-3 py-2 text-xs text-violet-100 disabled:opacity-50">
                {autoRunActive ? `Running · ${autoRunSecondsLeft}s` : "Start cinematic auto-run"}
              </button>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full rounded-full bg-violet-400 transition-all ${autoRunActive ? "animate-pulse" : ""}`} style={{ width: `${autoRunProgress}%` }} />
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <div className={`rounded-xl border p-3 ${mobilePreviewOpened ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300"}`}>Mobile preview {mobilePreviewOpened ? "opened" : "pending"}</div>
              <div className={`rounded-xl border p-3 ${lastTriggeredScenario !== "none" ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/5 text-slate-300"}`}>Scenario {lastTriggeredScenario}</div>
              <div className={`rounded-xl border p-3 ${opsReady ? "border-amber-300/40 bg-amber-500/10 text-amber-100" : "border-white/10 bg-white/5 text-slate-300"}`}>Ops map {opsReady ? "ready" : "waiting"}</div>
              <div className={`rounded-xl border p-3 ${autoRunActive ? "border-violet-300/40 bg-violet-500/10 text-violet-100" : "border-white/10 bg-white/5 text-slate-300"}`}>Progress {autoRunProgress}%</div>
            </div>
            <p className="mt-3 text-violet-100">{autoRunNarration || "Al iniciar, el Demo Lab avanzará por beats, cambiará secciones y disparará escenarios automáticamente."}</p>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            {stageBeats.map((beat, index) => (
              <button key={beat.title} type="button" onClick={() => setStageBeatIndex(index)} className={`rounded-xl border p-3 text-left text-xs ${stageBeatIndex === index ? "border-violet-300/50 bg-violet-500/10 text-violet-100" : "border-white/10 bg-slate-950/70 text-slate-300"}`}>
                <p className="font-semibold text-white">Beat {index + 1}</p>
                <p className="mt-1">{beat.title}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          {([
            ["setup", "1) Setup"],
            ["simulate", "2) Simular"],
            ["mobile", "3) Mobile / Pitch"],
            ["ops", "4) Ops / Evidencia"],
          ] as Array<[LabSection, string]>).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setActiveSection(key)} className={`rounded-lg border p-2 text-sm ${activeSection === key ? "border-cyan-300/60 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-900 text-slate-200"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <a href="/demo" className="rounded-lg border border-white/20 px-3 py-1 text-slate-200">Página pública demo</a>
          <a href="/demo-sandbox" className="rounded-lg border border-white/20 px-3 py-1 text-slate-200">Sandbox anónimo</a>
          <a href="#top" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-cyan-100">Volver arriba</a>
        </div>
      </Card>

      <Card className={`demo-lab-card p-4 ${activeSection === "mobile" ? "" : "hidden"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Runbook vertical-aware</h3>
            <p className="mt-1 text-sm text-slate-300">{runbook.headline}</p>
            <p className="mt-1 text-xs text-slate-400">{runbook.summary}</p>
          </div>
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-100">
            <p className="font-semibold uppercase tracking-[0.16em]">KPIs para contar</p>
            <p className="mt-2 max-w-xs">{runbook.kpis.join(" · ")}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {runbook.steps.map((step) => (
            <div key={step.title} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-xs text-slate-300">
              <p className="font-semibold text-white">{step.title}</p>
              <p className="mt-2">{step.detail}</p>
              <p className="mt-3 text-cyan-200">KPI foco: {step.kpi}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-emerald-300">Prueba recomendada: {runbook.proof}</p>
        <button className="mt-3 w-full rounded-xl border border-violet-300/40 bg-violet-500/10 p-3 text-sm text-violet-100" onClick={() => void runAuto90SecondsDemo()} disabled={pending}>Iniciar pitch automático</button>
      </Card>

      <Card className={`demo-lab-card p-4 ${activeSection === "setup" ? "" : "hidden"}`}>
        <h3 className="font-semibold text-white">Checklist “todo funcionando”</h3>
        <p className="mt-2 text-xs text-slate-300">Para cerrar la demo completa necesitamos: pack activo, escenario corrido, mobile abierto y entorno listo para LIVE NFC.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <div className={`rounded-xl border p-3 text-xs ${readiness.packLoaded ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-900/70 text-slate-300"}`}>1) Pack activo: <b>{readiness.packLoaded ? "OK" : "pendiente"}</b></div>
          <div className={`rounded-xl border p-3 text-xs ${readiness.scenarioRun ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-900/70 text-slate-300"}`}>2) Escenario: <b>{readiness.scenarioRun ? "OK" : "pendiente"}</b></div>
          <div className={`rounded-xl border p-3 text-xs ${readiness.mobileOpened ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-900/70 text-slate-300"}`}>3) Mobile: <b>{readiness.mobileOpened ? "OK" : "pendiente"}</b></div>
          <div className={`rounded-xl border p-3 text-xs ${liveNfcReady ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100" : "border-amber-300/30 bg-amber-500/10 text-amber-100"}`}>4) LIVE NFC: <b>{liveNfcReady ? "listo" : "requiere dispositivo NFC + HTTPS"}</b></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100" href={openMobilePreviewHref} target="_blank" rel="noreferrer" onClick={() => setReadiness((state) => ({ ...state, mobileOpened: true }))}>
            Abrir mobile ahora
          </a>
          <button type="button" className="rounded-lg border border-white/15 px-3 py-1 text-xs text-white" onClick={() => void navigator.clipboard?.writeText(openMobilePreviewHref)}>
            Copiar URL mobile
          </button>
        </div>
      </Card>

      <Card className={`demo-lab-card p-4 ${activeSection === "setup" ? "" : "hidden"}`}>
        <h3 className="font-semibold text-white">Demo Wizard (para reuniones)</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-300">
          <li>Paso 1: elegí un pack vertical.</li>
          <li>Paso 2: elegí modo (simulado, consumer tap, live NFC).</li>
          <li>Paso 3: cargá pack y ejecutá escenarios.</li>
          <li>Paso 4: abrí la vista mobile por item/tenant.</li>
        </ol>
      </Card>

      <Card className={`demo-lab-card p-4 ${activeSection === "setup" ? "" : "hidden"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-white">Pack listo en 1 click (10 tags)</h3>
          <button type="button" onClick={() => void applyPackReadyFlow()} disabled={pending} className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
            Aplicar pack completo
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-300">Esto carga pack, sube manifest de 10 UIDs y genera eventos demo para mostrar trazabilidad/antifraude sin esperar chips físicos.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {DEMO_UIDS.map((uid, index) => (
            <div key={uid} className="rounded-lg border border-white/10 bg-slate-900/70 p-2.5 text-xs text-slate-200">
              <p className="font-semibold text-white">Tag {index + 1}</p>
              <p className="mt-1 break-all text-slate-300">{uid}</p>
              <button type="button" onClick={() => void navigator.clipboard?.writeText(tagPreviewLinks[index] || openMobilePreviewHref)} className="mt-2 rounded-md border border-white/15 px-2 py-1 text-[11px] text-cyan-100">
                Copiar URL mobile
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card className={`demo-lab-card p-4 ${activeSection === "setup" ? "" : "hidden"}`}>
        <label className="text-xs uppercase tracking-wide text-slate-400">{COPY[locale].pick}</label>
        <select className="demo-lab-input mt-2 w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white" value={pack} onChange={(event) => setPack(event.target.value)}>
          {(packs.length ? packs : [{ key: "wine-secure", icType: "NTAG424DNA_TT", batchId: "DEMO-2026-02" }]).map((item) => (
            <option key={item.key} value={item.key}>{item.key} · {item.icType}</option>
          ))}
        </select>
      </Card>

      <Card className={`demo-lab-card p-4 ${activeSection === "setup" ? "" : "hidden"}`}>
        <label className="text-xs uppercase tracking-wide text-slate-400">Paso 2 · Demo mode</label>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {(["simulated", "consumer_tap", "live_nfc"] as DemoMode[]).map((item) => (
            <button key={item} className={`rounded-xl border p-3 text-left text-xs ${mode === item ? "border-cyan-300/60 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-900 text-slate-200"}`} onClick={() => setMode(item)} type="button">
              <p className="font-semibold">{modeLabel(item)}</p>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-300">Modo activo: <b>{modeLabel(mode)}</b></p>
        {mode === "live_nfc" && !liveNfcReady ? (
          <p className="mt-2 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            LIVE NFC requiere navegador compatible (Android + Chrome), HTTPS y permiso NFC. Si no, usá SIMULATED para demo comercial.
          </p>
        ) : null}
      </Card>

      {canShowTechnical ? (
        <Card className={`demo-lab-card p-4 text-xs text-slate-300 ${activeSection === "setup" ? "" : "hidden"}`}>
          <h3 className="text-sm font-semibold text-white">Live NFC panel operativo</h3>
          <p className="mt-1">NFC: <b>{nfcSupport ? "compatible" : "no disponible"}</b> · HTTPS: <b>{hasSecureContext ? "ok" : "requerido"}</b> · GPS API: <b>{hasGeo ? "disponible" : "no disponible"}</b></p>
          <p className="mt-1">Permiso NFC: <b>{nfcPermission}</b> · Permiso GPS: <b>{geoPermission}</b></p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-cyan-100" onClick={() => void triggerScenario("valid")}>
              Simular lectura NFC (demo)
            </button>
            <button type="button" className="rounded-lg border border-white/20 px-3 py-1 text-white" onClick={requestGeoForLive}>
              Pedir geolocalización real
            </button>
          </div>
          <p className="mt-2 text-amber-300">Privacidad: no se obtiene GPS real sin permiso explícito del usuario.</p>
        </Card>
      ) : null}

      {presenterLock ? (
        <Card className={`demo-lab-card p-5 ${activeSection === "simulate" || activeSection === "mobile" ? "" : "hidden"}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Presenter Lock</h3>
              <p className="mt-1 text-sm text-slate-300">Vista limpia para reunión: solo acciones clave, sin uploads, logs ni controles técnicos.</p>
            </div>
            <p className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">Sin ruido técnico</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <button className="rounded-2xl border border-white/10 bg-slate-900 p-5 text-left text-white" onClick={() => runAction(() => call("use-pack", "POST", { pack })).then(() => setReadiness((state) => ({ ...state, packLoaded: true })))} disabled={pending}>
              <p className="text-lg font-semibold">1. Load pack</p>
              <p className="mt-2 text-sm text-slate-300">Prepará el vertical elegido y dejá el contexto listo para el pitch.</p>
            </button>
            <button className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-5 text-left text-emerald-100" onClick={() => void triggerScenario(selectedScenario)} disabled={pending}>
              <p className="text-lg font-semibold">2. Run scenario</p>
              <p className="mt-2 text-sm">Dispará {SCENARIOS.find((scenario) => scenario.eventType === selectedScenario)?.label || "AUTH OK"} en un clic.</p>
            </button>
            <a className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-5 text-left text-cyan-100" href={openMobilePreviewHref} target="_blank" rel="noreferrer" onClick={() => setReadiness((state) => ({ ...state, mobileOpened: true }))}>
              <p className="text-lg font-semibold">3. Open mobile</p>
              <p className="mt-2 text-sm">Abrí la experiencia del consumidor sin cambiar de historia ni contexto.</p>
            </a>
          </div>
        </Card>
      ) : (
        <>
          <div className={`grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${activeSection === "simulate" ? "" : "hidden"}`}>
            <button className="demo-lab-action rounded-xl border border-white/10 bg-slate-900 p-3 text-white" onClick={() => runAction(() => call("use-pack", "POST", { pack }))} disabled={pending}>Paso 3 · Load demo pack</button>
            <button className="demo-lab-action rounded-xl border border-white/10 bg-slate-900 p-3 text-white" onClick={() => runAction(() => call("generate-live-scans", "POST", { count: 10, mode: "mixed" }))} disabled={pending}>Generate live stream</button>
            <button className="demo-lab-action rounded-xl border border-white/10 bg-slate-900 p-3 text-white" onClick={() => runAction(() => call("reset", "POST"))} disabled={pending}>Reset demo</button>
            <button className="demo-lab-action rounded-xl border border-white/10 bg-slate-900 p-3 text-white" onClick={() => void downloadPackFile("manifest")} disabled={pending}>Download CSV manifest</button>
            <button className="demo-lab-action rounded-xl border border-white/10 bg-slate-900 p-3 text-white" onClick={() => void downloadPackFile("seed")} disabled={pending}>Download JSON seed</button>
            <a className="demo-lab-action rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-3 text-cyan-100" href={openMobilePreviewHref} target="_blank" rel="noreferrer">Paso 4 · Open mobile preview</a>
          </div>

          <Card className={`demo-lab-card p-4 ${activeSection === "mobile" ? "" : "hidden"}`}>
            <h3 className="text-sm font-semibold text-white">Tarjeta local de acceso para demo en celular</h3>
            <p className="mt-1 text-xs text-slate-400">Para no romper lo que ya funcionaba, mantenemos el link directo como canal principal. Esta tarjeta SVG es un acceso visual local para reuniones sin terceros; no pretende reemplazar un QR estándar enterprise until sumemos un encoder offline dedicado.</p>
            <div className="mt-3 flex flex-col items-center gap-3 md:flex-row md:items-start">
              <img src={qrPreviewHref} alt="Local mobile preview access card" className="h-44 w-44 rounded-2xl border border-white/15 bg-white p-3 shadow-[0_12px_40px_rgba(15,23,42,0.35)]" />
              <div className="text-xs text-slate-300">
                <p className="break-all rounded-lg border border-white/10 bg-slate-900 p-2">{openMobilePreviewHref}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a className="inline-block rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-cyan-100" href={openMobilePreviewHref} target="_blank" rel="noreferrer">Abrir en esta compu</a>
                  <button type="button" className="rounded-lg border border-white/15 px-3 py-1 text-white" onClick={() => void navigator.clipboard?.writeText(openMobilePreviewHref)}>Copiar link</button>
                </div>
              </div>
            </div>
          </Card>

          <Card className={`demo-lab-card p-4 ${activeSection === "simulate" ? "" : "hidden"}`}>
            <h3 className="text-sm font-semibold text-white">Simular evento (un clic)</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {SCENARIOS.map((scenario) => (
                <button key={scenario.eventType} type="button" className={`rounded-xl border p-3 text-left text-xs ${selectedScenario === scenario.eventType ? "border-emerald-300/70 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-900 text-slate-200"}`} onClick={() => setSelectedScenario(scenario.eventType)}>
                  <p className="font-semibold">{scenario.label}</p>
                  <p className="mt-1 text-[11px] text-slate-300">{scenario.description}</p>
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <button className="w-full rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100" onClick={() => void triggerScenario(selectedScenario)} disabled={pending}>Simulate selected scenario</button>
              <button className="w-full rounded-xl border border-violet-300/30 bg-violet-500/10 p-3 text-sm text-violet-100" onClick={() => void runAuto90SecondsDemo()} disabled={pending}>Auto demo 90s</button>
            </div>
          </Card>

          <div className={`grid gap-3 md:grid-cols-2 ${activeSection === "simulate" ? "" : "hidden"}`}>
            <label className="demo-lab-upload rounded-xl border border-white/10 bg-slate-900 p-3 text-white">CSV manifest uploader
              <input type="file" accept=".csv,text/csv" className="mt-2 block w-full" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const csv = await readFile(file); await runAction(() => call("upload-manifest", "POST", { bid: activeBatchId, csv })); setReadiness((state) => ({ ...state, manifestLoaded: true })); }} />
            </label>
            <label className="demo-lab-upload rounded-xl border border-white/10 bg-slate-900 p-3 text-white">JSON metadata uploader
              <input type="file" accept=".json,application/json" className="mt-2 block w-full" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const data = JSON.parse(await readFile(file)); await runAction(() => call("upload-products", "POST", { bid: activeBatchId, ...data })); setReadiness((state) => ({ ...state, manifestLoaded: true })); }} />
            </label>
          </div>
        </>
      )}

      <div className={`grid gap-3 md:grid-cols-3 ${activeSection === "ops" ? "" : "hidden"}`}>
        <Card className="demo-lab-card p-4 text-slate-200">Tenant: <b>{summary.tenant?.name || "-"}</b><br />Slug: {summary.tenant?.slug || "-"}</Card>
        <Card className="demo-lab-card p-4 text-slate-200">Batch: <b>{summary.batch?.bid || "-"}</b><br />Tags: {summary.tagCount ?? 0}</Card>
        <Card className="demo-lab-card p-4 text-slate-200">CRM lite<br />Leads: {summary.crm?.leads ?? 0} · Tickets: {summary.crm?.tickets ?? 0} · Orders: {summary.crm?.orders ?? 0}</Card>
      </div>

      <div className={activeSection === "ops" ? "" : "hidden"}>
        <DemoOpsMap points={points} selectedVertical={activeVertical} selectedPack={pack} />
      </div>

      <Card className={`demo-lab-card p-4 ${activeSection === "mobile" ? "" : "hidden"}`}>
        <h3 className="text-sm font-semibold text-white">Mobile preview snapshot</h3>
        <p className="mt-2 text-slate-300">Estado actual: <b>{latestEvent?.result || "N/A"}</b> · Item: {latestEvent?.product_name || "-"}</p>
      </Card>

      {canShowTechnical && activeSection === "ops" ? (
        <Card className="demo-lab-card p-4">
          <h3 className="text-sm font-semibold text-white">Recent events</h3>
          <div className="mt-2 space-y-2 text-sm text-slate-300">{(summary.events || []).slice(0, 8).map((event) => <div key={event.id}>{event.result} · {event.product_name || event.uid_hex || "-"} · {event.vertical || "-"} · {event.city || "-"}</div>)}</div>
        </Card>
      ) : null}

      {canShowTechnical && activeSection === "ops" ? <pre className="demo-lab-log overflow-auto rounded-xl border border-white/10 bg-slate-950 p-4 text-xs text-cyan-200">{out}</pre> : null}
    </div>
  );
}
