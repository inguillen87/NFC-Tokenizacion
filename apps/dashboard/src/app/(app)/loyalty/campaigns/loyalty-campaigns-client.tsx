"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Card, Badge, Button, SectionHeading } from "@product/ui";
import { 
  AlertTriangle,
  Sparkles, 
  TrendingUp, 
  Gauge, 
  FileText, 
  Gift,
  MapPin,
  MessageCircle,
  Phone,
  Send, 
  ShieldCheck,
  Check, 
  RotateCcw, 
  Plus, 
  Bot, 
  Layers, 
  ArrowRight,
  Sparkle,
  MessageSquare,
  BookmarkCheck,
  ChevronRight,
  Cpu
} from "lucide-react";
import { motion } from "framer-motion";
import {
  resolveLoyaltyAiProvenance,
  type LoyaltyOptimizerMode,
} from "../../../../lib/loyalty-ai-provenance";
import {
  describeCampaignMeasurement,
  describeQuestionRate,
  describeTriviaSummary,
  type CampaignMeasurement,
} from "./loyalty-campaign-truth";
import { buildLoyaltyAdminUrl } from "./loyalty-campaign-scope";
import {
  CampaignAudienceIdentity,
  CampaignConsentAudiencePanel,
  campaignAudienceRequestKey,
  campaignAudienceRowKey,
  loadCampaignConsentAudience,
  type AudienceMember,
  type CampaignAudienceChannel,
  type CampaignAudienceRequest,
  type CampaignConsentAudience,
} from "./loyalty-campaign-audience";
import { campaignDraftContent, campaignDraftErrorCopy, CampaignDraftError, type CampaignDraft } from "./loyalty-campaign-drafts";
import { CampaignDraftListPanel, CampaignDraftSaveFeedback, useCampaignDraftWorkspace } from "./loyalty-campaign-draft-workspace";

// Types
interface Campaign {
  id: string;
  status: "RUNNING" | "DRAFT" | "COMPLETED";
  measurement: CampaignMeasurement;
  title: string;
  description: string;
  conversion: string;
  sentCount: number;
  clicksCount: number;
  rewardsCount: number;
}

interface AnalysisResult {
  prestigeScore: number;
  prestigeTier: "Bajo" | "Estándar" | "Premium" | "Exclusivo Ultra VIP";
  emotions: {
    exclusivity: number;
    trust: number;
    curiosity: number;
    urgency: number;
  };
  viralityScore: number;
  viralityTier: "Baja" | "Media" | "Alta" | "Potencial muy alto";
}

interface ChatMessage {
  id: string;
  sender: "bot" | "user" | string;
  text: string;
  action?: {
    label: string;
    title: string;
    prompt: string;
  };
}

interface ImprovementApplied {
  from: string;
  to: string;
}

interface TriviaInsight {
  summary: {
    attempts: number;
    completed: number;
    pointsIssued: number;
    avgScorePct: number;
    topCity?: string | null;
    topProduct?: string | null;
    insight?: string | null;
  };
  cities: Array<{ city: string; attempts: number; avgScorePct: number; pointsIssued: number; topProduct?: string | null }>;
  questions: Array<{ prompt: string; insightTag?: string | null; attempts: number; correctRatePct: number; dominantMiss?: string | null }>;
  recent: Array<{ id: string; score: number; total: number; pointsAwarded: number; city?: string | null; productName?: string | null; displayName?: string | null; createdAt?: string | null }>;
}

interface CampaignTemplate {
  id: string;
  name: string;
  channel: "whatsapp" | "email" | "instagram";
  category: "MARKETING" | "UTILITY" | "LOYALTY";
  segment: string;
  offer: string;
  body: string;
  requirements: string[];
}

interface TwilioStatus {
  ok: boolean;
  message: string;
  sid?: string | null;
  mediaSid?: string | null;
  contentSid?: string | null;
  mediaUrl?: string | null;
}

interface RedemptionValidation {
  ok: boolean;
  reason?: string;
  action?: string;
  redemption?: {
    redemption_code?: string;
    status?: string;
    seal?: string | null;
    expires_at?: string | null;
    reward?: { title?: string; code?: string };
    consumer?: { name?: string; phone_masked?: string | null; email_masked?: string | null };
    tenant?: { slug?: string };
    staff_instruction?: string;
  };
}

type LoyaltyCampaignsClientProps = {
  tenantScope: string;
  allowDemoData: boolean;
  canWriteDrafts?: boolean;
};

const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "mendoza-near-winery",
    name: "Voucher cercanía bodega",
    channel: "whatsapp",
    category: "MARKETING",
    segment: "Perfiles demo con ciudad declarada cerca de Mendoza",
    offer: "2x1 en copa de bienvenida + upgrade de visita",
    body:
      "Hola {{name}}, vimos una lectura NFC registrada en {{city}} para {{product}}. {{brand}} te reserva {{offer}} por 48h. Toca Quiero y nexID emite tu código de canje con respaldo por WhatsApp y email si lo tenés cargado. Stop para salir.",
    requirements: ["phone_verified", "whatsapp_opt_in", "city_match"],
  },
  {
    id: "post-tap-welcome",
    name: "Bienvenida post-tap",
    channel: "whatsapp",
    category: "UTILITY",
    segment: "Primer tap validado",
    offer: "club digital con puntos iniciales",
    body:
      "Hola {{name}}, la lectura NFC de {{product}} fue aceptada según la política de {{brand}}. Ya tenés {{points}} puntos y podés guardar el pasaporte, solicitar beneficios y recibir novedades. La lectura no certifica por sí sola el contenido físico ni el origen. Stop para salir.",
    requirements: ["tap_valid", "consumer_session"],
  },
  {
    id: "trust-recovery",
    name: "Recuperación de confianza",
    channel: "whatsapp",
    category: "UTILITY",
    segment: "Usuarios con señales de riesgo",
    offer: "validación asistida y beneficio compensatorio",
    body:
      "Hola {{name}}, detectamos una lectura NFC que requiere revisión para {{product}}. El equipo de {{brand}} puede revisar el mensaje y la política aplicable antes de activar un beneficio desde tu Pasaporte nexID. Stop para salir.",
    requirements: ["risk_case", "support_ready"],
  },
  {
    id: "vip-gamified",
    name: "Reto gamificado VIP",
    channel: "whatsapp",
    category: "LOYALTY",
    segment: "Clientes con 2+ taps o puntos",
    offer: "bonus de 300 puntos + badge Vendimia Insider",
    body:
      "Hola {{name}}, por tus lecturas NFC registradas en {{city}} desbloqueaste el reto Vendimia Insider. Lee otra etiqueta de {{brand}} esta semana y gana {{offer}} según las bases del portal nexID. Stop para salir.",
    requirements: ["loyalty_member", "marketing_opt_in"],
  },
];

const DEMO_AUDIENCE: AudienceMember[] = [
  {
    consumer_id: "demo-mendoza-001",
    display_name: "Marcelo Guillen",
    email_masked: "m***@gmail.com",
    phone_masked: "+549***8608",
    city: "Mendoza",
    country: "AR",
    tenant_slug: "demobodega",
    status: "active",
    points_balance: 420,
    lifetime_points: 780,
    tap_count: 5,
    valid_taps: 5,
    risk_taps: 0,
    saved_products: 2,
    last_product: "Gran Reserva Malbec",
    marketing_opt_in: true,
    whatsapp_opt_in: true,
    segment: "promo_ready",
  },
  {
    consumer_id: "demo-cordoba-001",
    display_name: "Cliente Cordoba",
    email_masked: "c***@gmail.com",
    phone_masked: "+549***2211",
    city: "Cordoba",
    country: "AR",
    tenant_slug: "demobodega",
    status: "active",
    points_balance: 120,
    lifetime_points: 120,
    tap_count: 1,
    valid_taps: 1,
    risk_taps: 0,
    saved_products: 1,
    last_product: "Cabernet Franc Reserva",
    marketing_opt_in: false,
    whatsapp_opt_in: false,
    segment: "post_tap_warm",
  },
];

const TRIVIA_FALLBACK: TriviaInsight = {
  summary: {
    attempts: 0,
    completed: 0,
    pointsIssued: 0,
    avgScorePct: 0,
    topCity: null,
    topProduct: null,
    insight: "Apenas los clientes completen la trivia post-tap, este panel muestra conocimiento por ciudad, producto y pregunta para activar promociones o eventos.",
  },
  cities: [],
  questions: [
    { prompt: "Origen declarado y lote asociado al mensaje NFC", insightTag: "origin-literacy", attempts: 0, correctRatePct: 0, dominantMiss: null },
    { prompt: "Beneficios por cercania a bodega o feria", insightTag: "geo-campaign-understanding", attempts: 0, correctRatePct: 0, dominantMiss: null },
    { prompt: "Experiencia premium post-tap", insightTag: "post-tap-experience-fit", attempts: 0, correctRatePct: 0, dominantMiss: null },
  ],
  recent: [],
};

const EMPTY_TRIVIA: TriviaInsight = {
  summary: {
    attempts: 0,
    completed: 0,
    pointsIssued: 0,
    avgScorePct: 0,
    topCity: null,
    topProduct: null,
    insight: null,
  },
  cities: [],
  questions: [],
  recent: [],
};

function asNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstName(name: string | null | undefined) {
  const clean = String(name || "").trim();
  return clean ? clean.split(/\s+/)[0] : "cliente";
}

function renderTemplateBody(template: CampaignTemplate, member: AudienceMember | undefined) {
  const selected: AudienceMember = member || {};
  const replacements: Record<string, string> = {
    name: selected.display_name ? firstName(selected.display_name) : "{{name}}",
    city: selected.city || "{{city}}",
    product: selected.last_product || "{{product}}",
    brand: selected.tenant_slug === "demobodega" ? "Bodega Balmec" : selected.tenant_slug || "{{brand}}",
    offer: template.offer,
    points: selected.points_balance == null ? "{{points}}" : String(asNumber(selected.points_balance)),
  };
  return template.body.replace(/\{\{(name|city|product|brand|offer|points)\}\}/g, (_, key: string) => replacements[key] || "");
}

// Initial campaigns data
const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: "1",
    status: "RUNNING",
    measurement: "demo_model",
    title: "Vendimia Passport (Seasonal)",
    description: "Invita a usuarios que hayan escaneado en el último mes a completar un Quiz de Terroir a cambio de un Upgrade en su próxima degustación.",
    conversion: "18%",
    sentCount: 1200,
    clicksCount: 450,
    rewardsCount: 216
  },
  {
    id: "2",
    status: "DRAFT",
    measurement: "demo_model",
    title: "Turista Brasil (Localizado)",
    description: "Borrador demo en portugués, preparado para un segmento de turismo de Brasil y pendiente de configurar antes del envío.",
    conversion: "-",
    sentCount: 0,
    clicksCount: 0,
    rewardsCount: 0
  }
];

export default function LoyaltyCampaignsClient({ tenantScope, allowDemoData, canWriteDrafts = false }: LoyaltyCampaignsClientProps) {
  const [activeTab, setActiveTab] = useState<"campaigns" | "ai-optimizer">("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => allowDemoData ? INITIAL_CAMPAIGNS : []);
  
  // Draft / AI Optimizer states
  const [draftTitle, setDraftTitle] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftChannel, setDraftChannel] = useState<CampaignAudienceChannel>("whatsapp");
  const [draftFormError, setDraftFormError] = useState<CampaignDraftError | null>(null);
  const draftWorkspace = useCampaignDraftWorkspace({ tenant: tenantScope, enabled: !allowDemoData, canWrite: canWriteDrafts });
  const [optimizedText, setOptimizedText] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showOptimizedResult, setShowOptimizedResult] = useState(false);
  const editorValue = { id: draftWorkspace.selected?.id || "new", title: draftTitle, message: showOptimizedResult ? optimizedText : draftText, channel: draftChannel };
  const editorValueRef = useRef(editorValue);
  editorValueRef.current = editorValue;
  const draftDirty = draftWorkspace.selected
    ? draftWorkspace.selected.title !== editorValue.title.trim() || draftWorkspace.selected.message !== editorValue.message.trim() || draftWorkspace.selected.channel !== draftChannel
    : Boolean(editorValue.title.trim() || editorValue.message.trim());
  useEffect(() => {
    if (!draftDirty && !draftWorkspace.write.pending && !draftWorkspace.hasUnresolved) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const confirmLinkExit = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      if (!window.confirm("Hay texto sin guardar o un guardado sin confirmar. ¿Querés salir de esta página? El texto no guardado y la clave de reintento de esta sesión se perderán.")) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    document.addEventListener("click", confirmLinkExit, true);
    return () => { window.removeEventListener("beforeunload", warnBeforeLeaving); document.removeEventListener("click", confirmLinkExit, true); };
  }, [draftDirty, draftWorkspace.write.pending, draftWorkspace.hasUnresolved]);
  const [selectedTone, setSelectedTone] = useState<"sommelier" | "vip-club" | "modern-web3">("sommelier");
  const [appliedImprovements, setAppliedImprovements] = useState<ImprovementApplied[]>([]);
  const [optimizerMode, setOptimizerMode] = useState<LoyaltyOptimizerMode>("idle");
  const [serverAiConfigured, setServerAiConfigured] = useState<boolean | null>(null);
  const [serverAiUnavailable, setServerAiUnavailable] = useState(false);
  const [serverAiModel, setServerAiModel] = useState("");
  const [lastOptimizerModel, setLastOptimizerModel] = useState("");
  const [lastOptimizerProvider, setLastOptimizerProvider] = useState("");
  const optimizerGeneration = useRef(0);
  const optimizerRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    optimizerGeneration.current += 1;
    optimizerRequest.current?.abort();
    setIsOptimizing(false);
    return () => { optimizerGeneration.current += 1; optimizerRequest.current?.abort(); };
  }, [draftWorkspace.selected?.id, draftTitle, draftText, draftChannel, selectedTone]);

  useEffect(() => {
    // Retire only this editor's obsolete key, without reading or transmitting its value.
    try { window.localStorage.removeItem("hf_api_token"); } catch { /* Storage may be disabled. */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadAiStatus() {
      try {
        const response = await fetch("/api/cognitive-ai", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.ok !== true || typeof payload?.configured !== "boolean") throw new Error("ai_status_unavailable");
        if (cancelled) return;
        setServerAiConfigured(payload.configured);
        setServerAiModel(String(payload?.defaultModel || ""));
      } catch {
        if (!cancelled) setServerAiUnavailable(true);
      }
    }
    void loadAiStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const [analysis, setAnalysis] = useState<AnalysisResult>({
    prestigeScore: 0,
    prestigeTier: "Bajo",
    emotions: { exclusivity: 0, trust: 0, curiosity: 0, urgency: 0 },
    viralityScore: 0,
    viralityTier: "Baja"
  });

  // BotIA Chat states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "bot",
      text: "¡Hola! Soy un asistente guiado por reglas locales. Puedo ayudarte a preparar un borrador de reactivación para usuarios sin lecturas recientes; revisá el segmento y los datos antes de enviarlo.",
      action: {
        label: "Diseñar Campaña de Reactivación",
        title: "Reactivación Club Selección",
        prompt: "Tenemos un vino rico guardado en la bodega. Completá el quiz escaneando tu botella para ganar una copa gratis de cortesía en nuestro club."
      }
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [audienceChannel, setAudienceChannel] = useState<CampaignAudienceChannel>("whatsapp");
  const [audienceRefresh, setAudienceRefresh] = useState(0);
  const audienceRequest = useMemo<CampaignAudienceRequest>(() => ({ tenant: tenantScope, channel: audienceChannel, purpose: "marketing" }), [tenantScope, audienceChannel]);
  const audienceKey = campaignAudienceRequestKey(audienceRequest);
  const [audienceState, setAudienceState] = useState<{
    key: string; loading: boolean; error: string | null; result: CampaignConsentAudience | null;
  }>(() => ({ key: audienceKey, loading: Boolean(tenantScope), error: tenantScope ? null : "tenant_scope_required", result: null }));
  const [triviaInsight, setTriviaInsight] = useState<TriviaInsight>(EMPTY_TRIVIA);
  const [triviaLoading, setTriviaLoading] = useState(Boolean(tenantScope));
  const [triviaError, setTriviaError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(CAMPAIGN_TEMPLATES[0].id);
  const [selectedCity, setSelectedCity] = useState("all");
  const [sandboxRecipientName, setSandboxRecipientName] = useState(allowDemoData ? "Marcelo" : "");
  const [twilioRecipient, setTwilioRecipient] = useState(allowDemoData ? "+5492613168608" : "");
  const [twilioOptInConfirmed, setTwilioOptInConfirmed] = useState(false);
  const [twilioSending, setTwilioSending] = useState(false);
  const [twilioStatus, setTwilioStatus] = useState<TwilioStatus | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherSeal, setVoucherSeal] = useState("");
  const [voucherPhoneLast4, setVoucherPhoneLast4] = useState("");
  const [voucherChecking, setVoucherChecking] = useState(false);
  const [voucherResult, setVoucherResult] = useState<RedemptionValidation | null>(null);

  // Demonstration profiles never enter the consent audience or become real recipients.
  const audienceDataIsDemo = allowDemoData;
  const audience = audienceDataIsDemo ? DEMO_AUDIENCE : [];
  const audienceContextMatches = audienceState.key === audienceKey;
  const audienceLoading = !allowDemoData && (!audienceContextMatches || audienceState.loading);
  const audienceError = audienceContextMatches ? audienceState.error : null;
  const confirmedAudience = audienceContextMatches ? audienceState.result : null;
  const selectedTemplate = CAMPAIGN_TEMPLATES.find((item) => item.id === selectedTemplateId) || CAMPAIGN_TEMPLATES[0];
  const triviaMeasurement = describeTriviaSummary(triviaInsight.summary);
  const triviaHasMeasurements = triviaMeasurement.hasMeasurements;
  const triviaAvailable = !triviaLoading && (!triviaError || allowDemoData);
  const triviaGuideEnabled = allowDemoData && !triviaLoading && Boolean(triviaError || triviaInsight.questions.length === 0);
  const visibleTriviaQuestions = triviaGuideEnabled ? TRIVIA_FALLBACK.questions : triviaInsight.questions;
  const triviaInsightCopy = triviaLoading
    ? "Esperando respuesta de la fuente de trivia."
    : triviaError && !allowDemoData
      ? "Fuente no disponible: no se generan conclusiones ni recomendaciones desde datos sustitutos."
      : triviaInsight.summary.insight
        || (triviaGuideEnabled ? TRIVIA_FALLBACK.summary.insight : "Sin insight confirmado para el scope actual.");
  const measuredTriviaCities = triviaInsight.cities.filter((city) => asNumber(city.attempts) > 0);
  const cityOptions = useMemo(() => {
    return Array.from(new Set(audience.map((item) => item.city).filter(Boolean) as string[])).sort();
  }, [audience]);
  const filteredAudience = useMemo(() => {
    return audience.filter((member) => selectedCity === "all" || member.city === selectedCity);
  }, [audience, selectedCity]);
  const previewMember = filteredAudience.find((member) => member.whatsapp_opt_in || member.marketing_opt_in) || filteredAudience[0] || audience[0];
  const messagePreview = renderTemplateBody(selectedTemplate, {
    ...previewMember,
    display_name: sandboxRecipientName || previewMember?.display_name || "cliente",
  });
  const audienceKpis = useMemo(() => {
    const total = audience.length;
    const withPhone = audience.filter((member) => Boolean(member.phone_masked)).length;
    const whatsappOptIn = audience.filter((member) => member.whatsapp_opt_in).length;
    const mendoza = audience.filter((member) => String(member.city || "").toLowerCase().includes("mendoza")).length;
    const taps = audience.reduce((sum, member) => sum + asNumber(member.tap_count), 0);
    return { total, withPhone, whatsappOptIn, mendoza, taps };
  }, [audience]);
  useEffect(() => {
    if (allowDemoData) return;
    let cancelled = false;
    const controller = new AbortController();
    async function loadAudience() {
      setAudienceState({ key: audienceKey, loading: true, error: null, result: null });
      try {
        const result = await loadCampaignConsentAudience(audienceRequest, { signal: controller.signal });
        if (!cancelled) {
          setAudienceState({ key: audienceKey, loading: false, error: null, result });
        }
      } catch (error) {
        if (!cancelled) {
          setAudienceState({ key: audienceKey, loading: false, error: error instanceof Error ? error.message : "campaign_audience_unavailable", result: null });
        }
      }
    }
    void loadAudience();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [allowDemoData, audienceKey, audienceRequest, audienceRefresh]);

  useEffect(() => {
    let cancelled = false;
    async function loadTriviaInsight() {
      const endpoint = buildLoyaltyAdminUrl("loyalty/trivia/overview", tenantScope);
      if (!endpoint) {
        setTriviaInsight(EMPTY_TRIVIA);
        setTriviaError("tenant_scope_required");
        setTriviaLoading(false);
        return;
      }
      setTriviaInsight(EMPTY_TRIVIA);
      setTriviaLoading(true);
      setTriviaError(null);
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false || !payload?.summary) {
          throw new Error(payload?.reason || payload?.error || "trivia_unavailable");
        }
        if (String(payload?.tenant || "").trim().toLowerCase() !== tenantScope) {
          throw new Error("tenant_scope_mismatch");
        }
        if (!cancelled) {
          setTriviaInsight({
            summary: payload.summary,
            cities: Array.isArray(payload.cities) ? payload.cities : [],
            questions: Array.isArray(payload.questions) ? payload.questions : [],
            recent: Array.isArray(payload.recent) ? payload.recent : [],
          });
        }
      } catch (error) {
        if (!cancelled) {
          setTriviaInsight(allowDemoData ? TRIVIA_FALLBACK : EMPTY_TRIVIA);
          setTriviaError(error instanceof Error ? error.message : "trivia_unavailable");
        }
      } finally {
        if (!cancelled) setTriviaLoading(false);
      }
    }
    void loadTriviaInsight();
    return () => {
      cancelled = true;
    };
  }, [allowDemoData, tenantScope]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const city = params.get("city");
    const offer = params.get("offer");
    const channel = params.get("channel");
    if (city) setSelectedCity(city);
    if (offer || channel) {
      const preferred = CAMPAIGN_TEMPLATES.find((template) => {
        return (offer && template.offer.toLowerCase().includes(offer.toLowerCase())) || (channel && template.channel === channel);
      });
      if (preferred) setSelectedTemplateId(preferred.id);
      setDraftTitle(`Campana ${city || "segmentada"} - ${offer || "post tap"}`);
      setDraftText(renderTemplateBody(preferred || selectedTemplate, previewMember));
    }
    // Only hydrate once from deep-link params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-analyze draft text whenever it changes
  useEffect(() => {
    const textToAnalyze = showOptimizedResult ? optimizedText : draftText;
    setAnalysis(analyzeText(textToAnalyze));
  }, [draftText, optimizedText, showOptimizedResult]);

  // NLP Analysis Engine
  function analyzeText(text: string): AnalysisResult {
    if (!text || text.trim().length === 0) {
      return {
        prestigeScore: 0,
        prestigeTier: "Bajo",
        emotions: { exclusivity: 0, trust: 0, curiosity: 0, urgency: 0 },
        viralityScore: 0,
        viralityTier: "Baja"
      };
    }

    const clean = text.toLowerCase();

    // Keywords mapping
    const prestigeKeywords = [
      "exclusivo", "limitada", "reserva", "premium", "seleccionado", "autor", 
      "barrica", "sommelier", "crianza", "cosecha", "terroir", "noble", "único", 
      "distinguido", "seda", "terciopelo", "complejo", "sofisticado", "vip", 
      "gran reserva", "legado", "colección", "edición", "mística", "tesoro",
      "tasting", "varietal", "caldo", "elixir", "maridaje", "trazabilidad", "tokenizado",
      "verificable", "digital", "wallet", "cofradía", "miembro", "cupo", "asignación"
    ];
    
    const cheapKeywords = [
      "barato", "económico", "descuento", "liquidación", "promo", "gratis", 
      "oferta", "rebaja", "outlet", "regalo", "barata", "baratos"
    ];

    let prestigeMatches = 0;
    prestigeKeywords.forEach(kw => {
      if (clean.includes(kw)) prestigeMatches++;
    });

    let cheapMatches = 0;
    cheapKeywords.forEach(kw => {
      if (clean.includes(kw)) cheapMatches++;
    });

    // Score Calculations
    const basePrestige = 35;
    let prestigeScore = basePrestige + (prestigeMatches * 12) - (cheapMatches * 15);
    prestigeScore = Math.max(5, Math.min(100, prestigeScore));

    let prestigeTier: AnalysisResult["prestigeTier"] = "Estándar";
    if (prestigeScore < 35) prestigeTier = "Bajo";
    else if (prestigeScore > 80) prestigeTier = "Exclusivo Ultra VIP";
    else if (prestigeScore > 55) prestigeTier = "Premium";

    // Emotions distribution
    const exclWords = ["exclusivo", "único", "limitado", "vip", "reserva", "selección", "autor", "terroir", "cofradía", "miembro", "privada", "asignación"];
    const trustWords = ["certificado", "garantizado", "origen", "historia", "auténtico", "bodega", "familia", "noble", "calidad", "sello", "trazabilidad", "verificable"];
    const curWords = ["descubrir", "secreto", "revelar", "misterio", "explorar", "edición", "catar", "mística", "experiencia", "tasting", "wallet"];
    const urgWords = ["ahora", "hoy", "último", "pocas", "cupo", "adquirir", "lanzamiento", "inmediato", "solo por", "preferencial", "reclamar"];

    let exclCount = 0; exclWords.forEach(w => { if (clean.includes(w)) exclCount++; });
    let trustCount = 0; trustWords.forEach(w => { if (clean.includes(w)) trustCount++; });
    let curCount = 0; curWords.forEach(w => { if (clean.includes(w)) curCount++; });
    let urgCount = 0; urgWords.forEach(w => { if (clean.includes(w)) urgCount++; });

    let rawExcl = 20 + exclCount * 15;
    let rawTrust = 20 + trustCount * 12;
    let rawCur = 20 + curCount * 12;
    let rawUrg = 20 + urgCount * 15;

    if (cheapMatches > 0) {
      rawExcl = Math.max(5, rawExcl - cheapMatches * 15);
      rawTrust = Math.max(5, rawTrust - cheapMatches * 10);
      rawUrg += cheapMatches * 15;
    }

    const total = rawExcl + rawTrust + rawCur + rawUrg;
    const emotions = {
      exclusivity: Math.round((rawExcl / total) * 100),
      trust: Math.round((rawTrust / total) * 100),
      curiosity: Math.round((rawCur / total) * 100),
      urgency: Math.round((rawUrg / total) * 100)
    };

    // Ensure it sums to exactly 100
    const sum = emotions.exclusivity + emotions.trust + emotions.curiosity + emotions.urgency;
    if (sum !== 100) {
      emotions.exclusivity += (100 - sum);
    }

    // Local copy heuristic. It is not a calibrated CTR or conversion model.
    const len = text.trim().length;
    let lenFactor = 0;
    if (len >= 80 && len <= 160) lenFactor = 30; // Optimal SMS/Push notification size
    else if (len > 0 && len < 250) lenFactor = 15;

    const hasEmoji = /[\uD800-\uDFFF\u2600-\u27BF]/.test(text);
    const hasExclamation = text.includes("!");
    const punctuationFactor = (hasEmoji ? 15 : 0) + (hasExclamation ? 10 : 0);

    const ctaWords = ["unite", "participá", "descubrí", "completá", "escaneá", "accedé", "ingresá", "obtené", "canjeá", "ganá", "autenticá", "completar", "escanear", "reclamar", "adquirir"];
    let ctaCount = 0;
    ctaWords.forEach(w => { if (clean.includes(w)) ctaCount++; });
    const ctaFactor = Math.min(25, ctaCount * 12);

    const prestigeBonus = prestigeScore > 70 ? 20 : 5;

    let viralityScore = 15 + lenFactor + punctuationFactor + ctaFactor + prestigeBonus;
    viralityScore = Math.max(10, Math.min(100, viralityScore));

    let viralityTier: AnalysisResult["viralityTier"] = "Media";
    if (viralityScore < 35) viralityTier = "Baja";
    else if (viralityScore > 75) viralityTier = "Potencial muy alto";
    else if (viralityScore > 50) viralityTier = "Alta";

    return {
      prestigeScore,
      prestigeTier,
      emotions,
      viralityScore,
      viralityTier
    };
  }

  // Re-writer dictionaries per profile
  const TONE_DICTIONARIES: Record<"sommelier" | "vip-club" | "modern-web3", Record<string, string[]>> = {
    sommelier: {
      "vino": ["exquisito varietal de autor", "caldo de alta gama", "ensamble de barrica", "elixir de terroir"],
      "vinos": ["varietales de autor", "caldos de alta gama", "etiquetas de colección"],
      "rico": ["armónico, de taninos redondos y persistente final", "de gran estructura y complejidad aromática", "sofisticado en boca con notas frutales y madera noble"],
      "ricos": ["de sobresaliente complejidad y elegancia en paladar"],
      "bueno": ["distinguido y con carácter único", "excepcional y minuciosamente seleccionado"],
      "barato": ["un valor excepcional para una pieza de colección", "de accesibilidad privilegiada para miembros de nuestra cofradía"],
      "baratos": ["valores preferenciales de asignación directa"],
      "comprar": ["adquirir y atesorar", "sumar a su bodega privada", "incorporar a su colección selecta"],
      "compra": ["adquisición selecta"],
      "club": ["círculo privado VIP", "selecto club de coleccionistas", "cofradía exclusiva nexID"],
      "degustar": ["catar pausadamente en copa fina", "apreciar la mística en paladar"],
      "botella": ["pieza numerada", "botella de guarda seleccionada"],
      "botellas": ["piezas numeradas de guarda exclusiva"],
      "olor": ["perfil aromático complejo con notas de vainilla, trufa y roble francés"],
      "tomar": ["degustar pausadamente", "apreciar"],
      "oferta": ["oportunidad exclusiva de asignación directa", "reserva preferencial"],
      "descuento": ["beneficio preferencial de miembro", "reconocimiento a su lealtad"],
      "gratis": ["cortesía selecta sin cargo", "experiencia de cortesía exclusiva"],
      "completar": ["consagrar", "validar"],
      "ganar": ["ser galardonado con", "acceder al derecho de disfrutar"],
      "escanear": ["validar el mensaje NFC con nexID", "leer la etiqueta NFC y consultar su registro"],
      "escaneá": ["validá el mensaje NFC de la etiqueta", "leé la etiqueta NFC nexID"],
    },
    "vip-club": {
      "vino": ["reserva privada numerada", "cosecha limitada de cofradía", "etiqueta exclusiva de asignación"],
      "vinos": ["piezas numeradas de guarda", "asignaciones exclusivas", "reliquias de bodega"],
      "rico": ["de prestigio inigualable y distinción sublime", "reservado exclusivamente para paladares exigentes"],
      "ricos": ["presentados por la marca como una selección de linaje destacado"],
      "bueno": ["altamente codiciado y de colección privada", "de abolengo vinícola excepcional"],
      "barato": ["un beneficio arancelario de cortesía exclusivo de miembro", "un valor preferencial de cofradía"],
      "baratos": ["privilegios de asignación directa"],
      "comprar": ["asegurar su asignación", "adquirir en carácter de miembro", "reclamar su cupo limitado"],
      "compra": ["reserva de miembro VIP"],
      "club": ["Cofradía Privada VIP", "Círculo de Coleccionistas nexID", "Club Exclusivo de Asignación"],
      "degustar": ["catar en nuestras bodegas reservadas", "disfrutar en copa de cristal"],
      "botella": ["pieza numerada de colección", "botella de guarda reservada"],
      "botellas": ["piezas limitadas de colección"],
      "olor": ["bouquet complejo y señorial con notas de roble añejo y cacao"],
      "tomar": ["degustar en copa privada", "saborear la exclusividad de"],
      "oferta": ["invitación reservada de asignación directa", "privilegio VIP limitado"],
      "descuento": ["tarifa preferencial de miembro", "atención preferente"],
      "gratis": ["cortesía de cofradía", "beneficio exclusivo sin cargo adicional"],
      "completar": ["formalizar su registro de miembro", "validar su pasaporte digital"],
      "ganar": ["adquirir el derecho preferencial de disfrutar", "ser condecorado con"],
      "escanear": ["validar el mensaje NFC según la política", "consultar el pasaporte digital desde la etiqueta NFC"],
      "escaneá": ["validá el mensaje NFC de la etiqueta", "consultá tu pasaporte digital nexID"],
    },
    "modern-web3": {
      "vino": ["producto con registro digital sujeto a política", "botella con ficha digital declarada", "gemelo digital de colección"],
      "vinos": ["productos con registros digitales", "coleccionables con pasaporte consultable", "botellas con ficha digital declarada"],
      "rico": ["con historia declarada en el pasaporte digital"],
      "ricos": ["con ficha digital declarada por la marca"],
      "bueno": ["con mensaje NFC validable por backend", "elegible para un registro digital sujeto a política"],
      "barato": ["un valor preferencial de acuñación (minting rate)"],
      "baratos": ["asignaciones inteligentes con fee reducido"],
      "comprar": ["iniciar una solicitud digital sujeta a validación", "solicitar registro en el ledger", "pedir un certificado digital según política"],
      "compra": ["validación de compra previa a cualquier claim"],
      "club": ["red descentralizada de coleccionistas", "Cofradía Cripto-Sommelier nexID", "DAO de beneficios Web3"],
      "degustar": ["catar y consultar la ficha digital", "desbloquear la experiencia interactiva"],
      "botella": ["activo digital tokenizado", "botella con microchip nexID NFC"],
      "botellas": ["lote digitalizado de etiquetas"],
      "olor": ["perfil aromático declarado por la marca"],
      "tomar": ["registrar el consumo según la política del tenant", "desbloquear"],
      "oferta": ["drop exclusivo de asignación digital", "acceso anticipado al pool"],
      "descuento": ["recompensa nativa de fidelidad", "cashback digital de protocolo"],
      "gratis": ["airdrop de cortesía sin cargo", "recompensa directa de bloque"],
      "completar": ["firmar la transacción digital", "aprobar en el ledger"],
      "ganar": ["acuñar el derecho de redención", "desbloquear la recompensa en tu wallet"],
      "escanear": ["validar el mensaje NFC del registro digital", "leer la etiqueta NFC nexID"],
      "escaneá": ["validá el mensaje NFC de la etiqueta", "consultá el registro digital nexID"],
    }
  };

  // Re-writer premium (Sommelier translator using Hugging Face + Local Fallback)
  async function handleOptimizeText() {
    if (!draftText.trim()) return;
    const generation = ++optimizerGeneration.current;
    const initialEditor = JSON.stringify(editorValueRef.current);
    const isCurrentEditor = () => generation === optimizerGeneration.current && initialEditor === JSON.stringify(editorValueRef.current);
    const controller = new AbortController();
    optimizerRequest.current?.abort();
    optimizerRequest.current = controller;
    setIsOptimizing(true);
    setOptimizerMode("idle");
    setLastOptimizerProvider("");
    setLastOptimizerModel("");

    try {
      const response = await fetch("/api/cognitive-ai", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: draftText, 
          tone: selectedTone,
        }),
      });

      if (!response.ok) {
        throw new Error("API rewrite failed");
      }

      const data = await response.json();
      if (!isCurrentEditor()) return;
      if (!data.optimizedText) {
        throw new Error("No text returned from API");
      }

      // Calculate matching improvements by comparing original words with result
      const foundImprovements: ImprovementApplied[] = [];
      const replacements = TONE_DICTIONARIES[selectedTone];
      Object.keys(replacements).forEach(key => {
        if (draftText.toLowerCase().includes(key) && data.optimizedText.toLowerCase().includes(replacements[key][0].toLowerCase())) {
          foundImprovements.push({ from: key, to: replacements[key][0] });
        }
      });

      setAppliedImprovements(foundImprovements);
      setOptimizedText(data.optimizedText);
      const confirmedProvider = typeof data.provider === "string" ? data.provider.trim() : "";
      const confirmedModel = typeof data.model === "string" ? data.model.trim() : "";
      const hasConfirmedLiveProvenance = data.fallback !== true && Boolean(confirmedProvider && confirmedModel);
      setOptimizerMode(hasConfirmedLiveProvenance ? "live-provider" : "server-fallback");
      setLastOptimizerProvider(hasConfirmedLiveProvenance ? confirmedProvider : "");
      setLastOptimizerModel(hasConfirmedLiveProvenance ? confirmedModel : "");
      setShowOptimizedResult(true);
      setIsOptimizing(false);
    } catch (err) {
      if (!isCurrentEditor()) return;
      console.warn("Hugging Face API failed or not configured, using premium local heuristics fallback:", err);
      
      // Local Heuristic Fallback
      setTimeout(() => {
        if (!isCurrentEditor()) return;
        const replacements = TONE_DICTIONARIES[selectedTone];
        const foundImprovements: ImprovementApplied[] = [];

        // Split words keeping spaces and punctuation
        let words = draftText.split(/(\s+|[,.!?;:()])/);
        let enhancedWords = words.map(w => {
          const lower = w.toLowerCase().trim();
          if (replacements[lower]) {
            const options = replacements[lower];
            const selected = options[Math.floor(Math.random() * options.length)];
            
            if (!foundImprovements.some(imp => imp.from === lower)) {
              foundImprovements.push({ from: lower, to: selected });
            }

            if (w.charAt(0) === w.charAt(0).toUpperCase() && w.length > 1) {
              return selected.charAt(0).toUpperCase() + selected.slice(1);
            }
            return selected;
          }
          return w;
        });

        let optimized = enhancedWords.join("");

        // Ensure premium framing is set
        const clean = optimized.toLowerCase();
        const hasPremiumHook = clean.includes("vip") || clean.includes("exclusiv") || clean.includes("colección") || clean.includes("terroir") || clean.includes("cofradía") || clean.includes("chain") || clean.includes("token");
        if (!hasPremiumHook) {
          if (selectedTone === "modern-web3") {
            optimized = `Borrador Web3 nexID: ${optimized} — Registro digital sujeto a política, evidencia y confirmación on-chain.`;
          } else {
            optimized = `Una propuesta de valor exclusivo nexID: ${optimized} — Reservado para miembros de nuestra Cofradía Privada.`;
          }
        }

        const hasCTA = clean.includes("autentic") || clean.includes("escan") || clean.includes("sumar") || clean.includes("adquirir") || clean.includes("particip") || clean.includes("claim") || clean.includes("reclamar");
        if (!hasCTA) {
          if (selectedTone === "modern-web3") {
            optimized += " Leé la etiqueta NFC nexID para iniciar una solicitud digital sujeta a validación; la lectura no prueba propiedad física.";
          } else {
            optimized += " Escaneá el chip NFC nexID para activar este beneficio único.";
          }
        }

        setAppliedImprovements(foundImprovements);
        setOptimizedText(optimized);
        setOptimizerMode("local-fallback");
        setLastOptimizerModel("");
        setShowOptimizedResult(true);
        setIsOptimizing(false);
      }, 1000);
    }
  }

  function applySavedDraft(draft: CampaignDraft) {
    if (!draftWorkspace.select(draft)) return;
    optimizerGeneration.current += 1;
    optimizerRequest.current?.abort();
    setDraftTitle(draft.title);
    setDraftText(draft.message);
    setDraftChannel(draft.channel);
    setOptimizedText("");
    setShowOptimizedResult(false);
    setAppliedImprovements([]);
    setOptimizerMode("idle");
    setDraftFormError(null);
    setActiveTab("ai-optimizer");
  }

  async function handleOpenDraft(draft: CampaignDraft) {
    if (draftDirty && !window.confirm("Hay cambios sin guardar en el editor. ¿Querés reemplazarlos por este borrador?")) return;
    const before = JSON.stringify(editorValueRef.current);
    const current = await draftWorkspace.readDraft(draft.id);
    // A late read never discards text typed while it was in flight.
    if (current && before === JSON.stringify(editorValueRef.current)) applySavedDraft(current);
  }

  function handleNewDraft() {
    if (draftWorkspace.hasUnresolved || draftWorkspace.write.pending || draftWorkspace.reading) return;
    if (draftDirty && !window.confirm("Hay cambios sin guardar. ¿Querés descartarlos y empezar otro borrador?")) return;
    if (!draftWorkspace.select(null)) return;
    optimizerGeneration.current += 1;
    optimizerRequest.current?.abort();
    setDraftTitle("");
    setDraftText("");
    setOptimizedText("");
    setShowOptimizedResult(false);
    setAppliedImprovements([]);
    setDraftChannel(audienceChannel);
    setOptimizerMode("idle");
    setLastOptimizerProvider("");
    setLastOptimizerModel("");
    setDraftFormError(null);
    setActiveTab("ai-optimizer");
  }

  async function handleCreateCampaign() {
    const textToUse = showOptimizedResult ? optimizedText : draftText;
    if (!textToUse.trim()) return;
    if (!allowDemoData) {
      if (!canWriteDrafts || draftWorkspace.write.pending) return;
      setDraftFormError(null);
      try {
        const content = campaignDraftContent(draftTitle, textToUse, draftChannel);
        await draftWorkspace.save(content);
      } catch (error) {
        setDraftFormError(error instanceof CampaignDraftError ? error : new CampaignDraftError("campaign_drafts_unavailable"));
      }
      // Server errors, conflicts and acknowledgements preserve the editor text.
      return;
    }

    const newCampaign: Campaign = {
      id: Date.now().toString(),
      status: "DRAFT",
      measurement: "draft_unmeasured",
      title: draftTitle.trim() || `Campaña AI #${campaigns.length + 1}`,
      description: textToUse,
      conversion: "-",
      sentCount: 0,
      clicksCount: 0,
      rewardsCount: 0
    };

    setCampaigns([newCampaign, ...campaigns]);
    
    // Reset editor
    setDraftTitle("");
    setDraftText("");
    setOptimizedText("");
    setShowOptimizedResult(false);
    setAppliedImprovements([]);
    setOptimizerMode("idle");
    setLastOptimizerProvider("");
    setLastOptimizerModel("");
    
    // Back to list
    setActiveTab("campaigns");
  }

  function handleUseTemplate(template: CampaignTemplate) {
    setSelectedTemplateId(template.id);
    const body = renderTemplateBody(template, previewMember);
    setDraftTitle(`${template.name} - ${previewMember?.city || "segmento activo"}`);
    setDraftText(body);
    setOptimizedText("");
    setShowOptimizedResult(false);
    setAppliedImprovements([]);
  }

  async function handleSendSandboxWhatsApp() {
    const endpoint = buildLoyaltyAdminUrl("campaigns/test-whatsapp", tenantScope);
    if (!endpoint) {
      setTwilioStatus({ ok: false, message: "Seleccioná un tenant autorizado antes de enviar una prueba." });
      return;
    }
    setTwilioStatus(null);
    setTwilioSending(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: twilioRecipient,
          body: messagePreview,
          confirmRecipientOptIn: twilioOptInConfirmed,
          sandbox: true,
          quickReplies: [
            { title: "Quiero", id: "promo_yes" },
            { title: "No gracias", id: "promo_no" },
          ],
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        const twilioMessage = payload?.twilio?.message ? ` Twilio: ${payload.twilio.message}` : "";
        throw new Error(`${payload?.reason || payload?.error || "sandbox_send_failed"}.${twilioMessage}`);
      }
      setTwilioStatus({
        ok: true,
        sid: payload?.sid || null,
        mediaSid: payload?.mediaSid || null,
        contentSid: payload?.contentSid || null,
        mediaUrl: payload?.mediaUrl || null,
        message: `Mensaje interactivo enviado a ${payload?.to || "destinatario configurado"}. Estado reportado: ${payload?.status || "queued"}.`,
      });
    } catch (error) {
      setTwilioStatus({
        ok: false,
        message: error instanceof Error ? error.message : "sandbox_send_failed",
      });
    } finally {
      setTwilioSending(false);
    }
  }

  async function handleValidateVoucher(action: "lookup" | "redeem") {
    const endpoint = buildLoyaltyAdminUrl("rewards/redemptions/validate", tenantScope);
    if (!endpoint) {
      setVoucherResult({ ok: false, reason: "tenant_scope_required" });
      return;
    }
    setVoucherChecking(true);
    setVoucherResult(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: voucherCode,
          seal: voucherSeal,
          phoneLast4: voucherPhoneLast4,
          action,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      setVoucherResult({
        ok: response.ok && payload?.ok !== false,
        reason: payload?.reason || null,
        action: payload?.action || action,
        redemption: payload?.redemption || null,
      });
    } catch (error) {
      setVoucherResult({
        ok: false,
        reason: error instanceof Error ? error.message : "voucher_validation_failed",
      });
    } finally {
      setVoucherChecking(false);
    }
  }

  // Handle BotIA messages
  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: "user",
      text: chatInput
    };

    setChatMessages(prev => [...prev, userMsg]);
    const prompt = chatInput.toLowerCase();
    setChatInput("");
    setIsBotTyping(true);

    setTimeout(() => {
      let replyText = "Entendido. Con las reglas locales de este asistente, te sugiero diseñar una campaña enfocada en la propuesta de valor del producto. Podés pasar el borrador al optimizador y revisar su procedencia antes de usarlo.";
      let action = undefined;

      if (prompt.includes("fidelización") || prompt.includes("retención") || prompt.includes("reactivar")) {
        replyText = "¡Excelente enfoque! Para reactivar usuarios, sugiero una campaña de 'Tasting Privado'. He redactado una propuesta enfocada en exclusividad para ti. ¿Querés insertarla en el Editor AI para optimizarla?";
        action = {
          label: "Usar Borrador de Retención",
          title: "Tasting Privado Reservado",
          prompt: "Tenemos un vino rico guardado en la bodega. Completá el quiz escaneando tu botella para ganar una copa gratis de cortesía en nuestro club."
        };
      } else if (prompt.includes("lujo") || prompt.includes("exclusivo") || prompt.includes("vip")) {
        replyText = "Para potenciar el prestigio de tu marca, te sugiero crear una campaña orientada al Lanzamiento de Cosecha Exclusiva. Aquí tenés un borrador técnico inicial que podés enriquecer:";
        action = {
          label: "Usar Borrador Premium",
          title: "Cosecha Limitada de Autor",
          prompt: "Lanzamos el nuevo vino de barrica de este año. Comprá ahora con descuento del club y leé la etiqueta NFC para consultar la ficha digital disponible según la política de la marca."
        };
      } else if (prompt.includes("brasil") || prompt.includes("portugués") || prompt.includes("turismo")) {
        replyText = "Para tu segmento internacional, es vital destacar la logística premium y el pasaporte de bodega. Probá con esta estructura en el Editor:";
        action = {
          label: "Usar Borrador Turismo",
          title: "Passaporte Terroir nexID",
          prompt: "Aprovechá el envío gratis para comprar vino de autor y escaneá tu botella en Brasil para ganar accesos VIP en Mendoza."
        };
      } else if (prompt.includes("web3") || prompt.includes("blockchain") || prompt.includes("nft")) {
        replyText = "Para una campaña basada en registros digitales y claims declarados sujetos a política, probá este borrador en el tono 'Modern Web3':";
        action = {
          label: "Usar Borrador Web3",
          title: "Tokenización de Lote Exclusivo",
          prompt: "Leé la etiqueta NFC para consultar la ficha declarada e iniciar, si la política lo permite, una solicitud de certificado digital o beneficios de club. La lectura no prueba propiedad física."
        };
      }

      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: "bot",
        text: replyText,
        action
      }]);
      setIsBotTyping(false);
    }, 1000);
  }

  const aiProvenance = resolveLoyaltyAiProvenance({
    mode: optimizerMode,
    provider: lastOptimizerProvider,
    model: lastOptimizerModel,
    requestPending: isOptimizing,
    serverConfigured: serverAiConfigured,
    serverUnavailable: serverAiUnavailable,
    serverModel: serverAiModel,
  });
  const optimizerModeLabel = aiProvenance.tabBadge;
  const optimizerModeDetail = aiProvenance.detail;
  const optimizerStatusClass =
    aiProvenance.kind === "live-provider"
      ? "bg-emerald-500/10 text-emerald-300"
      : aiProvenance.kind === "checking"
        ? "bg-sky-500/10 text-sky-300"
        : "bg-amber-500/10 text-amber-300";

  return (
    <div
      className="space-y-8 pb-12"
      data-tenant-scope={tenantScope || "unavailable"}
      data-demo-data-allowed={String(allowDemoData)}
    >
      <SectionHeading 
        eyebrow="IA Comercial" 
        title="Clientes & campañas" 
        description="Fidelizá a tus consumidores con campañas asistidas, reglas comerciales y un optimizador cuya procedencia se informa en cada resultado."
      />
      <section className="rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-4 shadow-[0_0_30px_rgba(6,182,212,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
              <MessageCircle className="h-4 w-4" />
              {audienceDataIsDemo
                ? "Audiencia demo modelada"
                : audienceLoading
                  ? "Consultando audiencia"
                : audienceError
                  ? "Audiencia no disponible"
                  : "Consulta de audiencia autorizada"}
            </div>
            <h2 className="mt-1 text-xl font-black text-white">Audiencia y preparación de campañas</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
              Consultá consentimientos por canal y prepará el contenido. {allowDemoData ? "Los borradores demo son locales y no escriben en el servidor." : "Los borradores se guardan por tenant con control de versión."} Guardar no aprueba ni envía una campaña.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200">
            <ShieldCheck className="h-4 w-4" />
            {audienceLoading
              ? "Cargando audiencia"
              : audienceDataIsDemo
                ? "Datos demo · no son audiencia real"
                : audienceError
                  ? "Fuente no disponible"
                  : "Consulta protegida · sin envío"}
          </div>
        </div>

        {!audienceDataIsDemo ? (
          <CampaignConsentAudiencePanel
            key={audienceKey}
            audience={confirmedAudience}
            request={audienceRequest}
            loading={audienceLoading}
            error={audienceError}
            onChannelChange={setAudienceChannel}
            onRefresh={() => setAudienceRefresh((value) => value + 1)}
          />
        ) : null}

        {audienceDataIsDemo ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Clientes registrados", value: audienceKpis.total, hint: "con perfil CRM", icon: Phone, color: "text-cyan-300" },
            { label: "Con teléfono demo", value: audienceKpis.withPhone, hint: "no habilita envíos", icon: MessageCircle, color: "text-sky-300" },
            { label: "WhatsApp opt-in", value: audienceKpis.whatsappOptIn, hint: "consentidos", icon: ShieldCheck, color: "text-emerald-300" },
            { label: "Mendoza", value: audienceKpis.mendoza, hint: "cercanía bodega", icon: MapPin, color: "text-amber-300" },
            { label: "Lecturas acumuladas", value: audienceKpis.taps, hint: "señal comercial", icon: Gauge, color: "text-purple-300" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{item.label}</span>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <div className="mt-2 text-2xl font-black text-white">{item.value.toLocaleString("es-AR")}</div>
              <div className="mt-1 text-[10px] text-slate-500">{item.hint}</div>
            </div>
          ))}
        </div> : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-cyan-400/20 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,.16),transparent_36%),linear-gradient(135deg,rgba(2,6,23,.92),rgba(8,47,73,.36))] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
                <Sparkles className="h-4 w-4" />
                Estado del circuito
              </div>
              <h3 className="mt-1 text-sm font-black text-white">Qué podés hacer hoy</h3>
              <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-400">
                Guardamos sólo texto, canal y finalidad: ningún contacto ni conteo de audiencia. La audiencia consultada es una referencia actual, no un listado de envío guardado.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              { label: "Audiencia", value: audienceDataIsDemo ? "Ejemplos demo" : audienceLoading ? "Consultando" : audienceError ? "No disponible" : "Consulta protegida", detail: "Consentimiento por canal y finalidad. No crea destinatarios desde UIDs.", Icon: ShieldCheck },
              { label: "Borrador", value: allowDemoData ? "Demo local" : "Guardado por versión", detail: allowDemoData ? "La simulación se pierde al recargar; nunca escribe borradores reales." : "Título, mensaje, canal y finalidad. Recuperá la versión guardada al volver a abrir la página.", Icon: FileText },
              { label: "Aprobación y envío", value: "Pendiente de conexión", detail: "Todavía no hay revisión persistida ni envío de campañas desde esta lista.", Icon: MessageSquare },
            ].map((step) => (
              <div key={step.label} className="relative rounded-2xl border border-white/10 bg-slate-950/55 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
                    <step.Icon className="h-4 w-4" />
                </div>
                <div className="mt-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{step.label}</div>
                <div className="mt-1 line-clamp-1 text-sm font-black text-white">{step.value}</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <details className="mt-4 rounded-2xl border border-white/10 p-3">
          <summary className="min-h-11 cursor-pointer px-1 py-3 text-sm font-semibold text-slate-200">Herramientas de prueba y canje</summary>
          <p className="px-1 text-xs leading-relaxed text-slate-400">Plantillas de ejemplo, trivia, prueba manual de WhatsApp y canjes. Son funciones separadas de los borradores guardados; no envían campañas a la audiencia consultada.</p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-violet-400/20 bg-[radial-gradient(circle_at_0%_0%,rgba(168,85,247,.16),transparent_38%),linear-gradient(135deg,rgba(15,23,42,.92),rgba(30,41,59,.52))] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-violet-200">
                <Sparkles className="h-4 w-4" />
                Trivia & market research
              </div>
              <h3 className="mt-1 text-sm font-black text-white">Resultados de trivia asociados a lecturas NFC</h3>
              <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-400">
                Solo las respuestas confirmadas permiten medir conocimiento por ciudad reportada, producto asociado y pregunta. Una lectura NFC no verifica contenido físico ni origen.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-xs font-bold text-violet-100">
              <Gauge className="h-4 w-4" />
              {triviaLoading
                ? "Cargando trivia"
                : triviaError
                  ? allowDemoData
                    ? "Guia demo · sin medicion"
                    : "Fuente no disponible"
                  : triviaHasMeasurements
                    ? "Intentos confirmados"
                    : "Sin intentos confirmados"}
            </div>
          </div>

          {triviaError && !allowDemoData ? (
            <div
              role="status"
              data-testid="loyalty-trivia-unavailable"
              className="mt-4 rounded-xl border border-amber-300/30 bg-amber-400/[0.07] px-4 py-3 text-xs leading-5 text-amber-100"
            >
              La fuente de trivia no respondió para {tenantScope ? `tenant:${tenantScope}` : "un tenant autorizado"}.
              Las métricas quedan no disponibles y no se reemplazan por una medición demo. Motivo: <span className="font-mono">{triviaError}</span>.
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Intentos", value: triviaInsight.summary.attempts, hint: "trivias post-tap", color: "text-violet-200" },
              { label: "Score medio", value: triviaMeasurement.avgScoreLabel, hint: triviaMeasurement.avgScoreHint, color: "text-cyan-200" },
              { label: "Puntos emitidos", value: triviaInsight.summary.pointsIssued, hint: "gamificacion", color: "text-emerald-200" },
              { label: "Ciudad lider", value: triviaMeasurement.topCityLabel, hint: triviaMeasurement.topCityHint, color: "text-amber-200" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">{item.label}</div>
                <div className={`mt-2 truncate text-2xl font-black ${item.color}`}>{triviaAvailable ? (typeof item.value === "number" ? item.value.toLocaleString("es-AR") : item.value) : "—"}</div>
                <div className="mt-1 truncate text-[10px] text-slate-500">{item.hint}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-black text-white">Preguntas con oportunidad comercial</h4>
                  <p className="text-[11px] text-slate-400">Las tasas bajas marcan dónde educar mejor al cliente o crear una promo.</p>
                </div>
                <span className="rounded-full bg-violet-400/10 px-2 py-1 text-[9px] font-black uppercase text-violet-200">
                  {triviaGuideEnabled ? `Guía demo · ${visibleTriviaQuestions.length}` : `${visibleTriviaQuestions.length} señales`}
                </span>
              </div>
              <div className="space-y-2">
                {visibleTriviaQuestions.slice(0, 4).map((question, index) => (
                  <div key={`${question.prompt}-${index}`} className="rounded-xl border border-white/10 bg-slate-900/45 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-xs font-bold text-white">{question.prompt}</div>
                        <div className="mt-1 text-[10px] text-slate-500">{question.insightTag || "market-signal"} · {question.attempts} intentos</div>
                      </div>
                      <div className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
                        question.correctRatePct >= 70
                          ? "bg-emerald-400/10 text-emerald-300"
                          : question.correctRatePct > 0
                            ? "bg-amber-400/10 text-amber-200"
                            : "bg-slate-800 text-slate-400"
                      }`}>
                        {describeQuestionRate(question.attempts, question.correctRatePct)}
                      </div>
                    </div>
                  </div>
                ))}
                {!visibleTriviaQuestions.length ? (
                  <div className="rounded-xl border border-dashed border-violet-300/20 bg-slate-900/30 p-3 text-[11px] leading-relaxed text-slate-400">
                    {triviaError ? "Preguntas no disponibles mientras la fuente está caída." : "La fuente confirmó que todavía no hay preguntas con respuestas para este tenant."}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-black text-white">Acciones recomendadas</h4>
                  <p className="text-[11px] text-slate-400">Qué haría el equipo comercial con estos datos.</p>
                </div>
                <MapPin className="h-5 w-5 text-violet-200" />
              </div>
              <div className="space-y-2">
                {measuredTriviaCities.slice(0, 4).map((city) => (
                  <button
                    key={city.city}
                    type="button"
                    title={`Preparar un borrador basado en el resumen de trivia de ${city.city}; no selecciona destinatarios`}
                    onClick={() => {
                      if (audienceDataIsDemo) setSelectedCity(city.city === "Sin ciudad" ? "all" : city.city);
                      setDraftTitle(`Trivia ${city.city} - ${city.topProduct || "post tap"}`);
                      setDraftText(`Hola {{name}}, vimos tu tap y tu avance en la trivia de ${city.topProduct || "tu producto"}. Te reservamos un beneficio por 48h para completar la experiencia en ${city.city}.`);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-slate-900/45 p-3 text-left transition hover:border-violet-300/40 hover:bg-violet-400/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-white">{city.city}</div>
                      <div className="text-[10px] font-black text-violet-200">{city.avgScorePct}% score</div>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {city.attempts} intentos · {city.pointsIssued} puntos · {city.topProduct || "producto pendiente"}
                    </div>
                  </button>
                ))}
                {!measuredTriviaCities.length ? (
                  <div className="rounded-xl border border-dashed border-violet-300/20 bg-slate-900/30 p-3 text-[11px] leading-relaxed text-slate-400">
                    Sin ciudades con intentos confirmados. No se infiere una ciudad lider desde plantillas ni datos demo.
                  </div>
                ) : null}
              </div>
              <p className="mt-3 rounded-xl border border-violet-400/20 bg-violet-400/10 p-3 text-[11px] leading-relaxed text-violet-100">
                {triviaInsightCopy}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-900/35 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-white">Plantillas demo para configurar</h3>
                <p className="text-[11px] text-slate-400">Ejemplos para configurar y revisar. No describen beneficios activos ni resultados medidos.</p>
              </div>
              <Gift className="h-5 w-5 text-amber-300" />
            </div>
            <div className="grid gap-2">
              {CAMPAIGN_TEMPLATES.map((template) => {
                const active = template.id === selectedTemplateId;
                return (
                  <button
                    key={template.id}
                    type="button"
                    title={`Usar plantilla ${template.name}: ${template.segment}`}
                    onClick={() => handleUseTemplate(template)}
                    className={`rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-cyan-400/70 bg-cyan-400/10 shadow-[0_0_18px_rgba(34,211,238,0.12)]"
                        : "border-white/10 bg-slate-950/50 hover:border-cyan-400/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-black text-white">{template.name}</div>
                        <div className="mt-1 text-[11px] text-slate-400">{template.segment}</div>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-cyan-200">
                        {template.channel} · {template.category}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                      <span className="rounded-full bg-amber-400/10 px-2 py-1 font-bold text-amber-200">{template.offer}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/35 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white">Sandbox WhatsApp controlado</h3>
                <p className="text-[11px] text-slate-400">Prueba manual con destinatario opt-in. Produccion requiere sender aprobado y plantillas Meta.</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-300" />
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {audienceDataIsDemo ? <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Ciudad / ejemplo demo
                <select
                  title="Filtra sólo los perfiles ficticios de demostración por ciudad"
                  value={selectedCity}
                  onChange={(event) => setSelectedCity(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs normal-case tracking-normal text-white outline-none focus:border-cyan-400"
                >
                  <option value="all">Todas las ciudades</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </label> : null}
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Nombre preview
                <input
                  title="Nombre que se usa en el saludo del mensaje de prueba"
                  value={sandboxRecipientName}
                  onChange={(event) => setSandboxRecipientName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs normal-case tracking-normal text-white outline-none focus:border-cyan-400"
                />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Número receptor
                <input
                  title="Número WhatsApp de prueba con opt-in confirmado"
                  value={twilioRecipient}
                  onChange={(event) => setTwilioRecipient(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs normal-case tracking-normal text-white outline-none focus:border-cyan-400"
                />
              </label>
            </div>

            <div className="mt-3 rounded-xl border border-cyan-400/20 bg-slate-950/70 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-200">Preview del mensaje</span>
                <span className="text-[10px] text-slate-500">{messagePreview.length} caracteres · botones Quiero/No gracias</span>
              </div>
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/30 bg-slate-950 text-cyan-200">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-black text-cyan-100">nexID Verified CRM</div>
                  <div className="text-[10px] text-slate-400">WhatsApp no permite un logo chico inline con botones. La marca y el QR aparecen después, en el pase de canje PNG.</div>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white">{messagePreview}</p>
            </div>

            <div className="mt-3">
              <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={twilioOptInConfirmed}
                  onChange={(event) => setTwilioOptInConfirmed(event.target.checked)}
                  className="mt-0.5"
                />
                Confirmo que este número ya hizo opt-in en WhatsApp y acepta recibir esta prueba.
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                title={tenantScope ? "Enviar el preview al WhatsApp configurado" : "Seleccioná un tenant autorizado para enviar una prueba"}
                onClick={handleSendSandboxWhatsApp}
                disabled={twilioSending || !twilioOptInConfirmed || !tenantScope}
                className="gap-2 bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:opacity-40"
              >
                {twilioSending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" /> : <Send className="h-4 w-4" />}
                Enviar prueba
              </Button>
              <button
                type="button"
                title="Copiar esta plantilla al editor IA para ajustarla antes de lanzar"
                onClick={() => handleUseTemplate(selectedTemplate)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-cyan-200 hover:border-cyan-400/50"
              >
                Llevar al editor
              </button>
            </div>
            {twilioStatus && (
              <div className={`mt-3 rounded-xl border p-3 text-xs ${
                twilioStatus.ok
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                  : "border-rose-400/30 bg-rose-400/10 text-rose-200"
              }`}>
                {twilioStatus.message}
                {twilioStatus.mediaSid ? <span className="block pt-1 font-mono text-[10px] opacity-80">Media SID: {twilioStatus.mediaSid}</span> : null}
                {twilioStatus.sid ? <span className="block pt-1 font-mono text-[10px] opacity-80">SID: {twilioStatus.sid}</span> : null}
                {twilioStatus.contentSid ? <span className="block pt-1 font-mono text-[10px] opacity-80">Content: {twilioStatus.contentSid}</span> : null}
                {twilioStatus.mediaUrl ? <span className="block pt-1 font-mono text-[10px] opacity-80">Media: {twilioStatus.mediaUrl}</span> : null}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                <BookmarkCheck className="h-4 w-4" />
                Voucher desk
              </div>
              <h3 className="mt-1 text-sm font-black text-white">Validar código de canje en bodega / comercio</h3>
              <p className="mt-1 text-[11px] text-slate-400">
                Pegá el código que muestra el cliente. El sello y últimos 4 dígitos son control extra cuando el staff necesita más seguridad.
              </p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200">
              staff-ready
            </span>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-[1.2fr_.9fr_.7fr_auto]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Código
              <input
                title="Código de canje recibido por WhatsApp o email"
                placeholder="12345678"
                value={voucherCode}
                onChange={(event) => setVoucherCode(event.target.value.toUpperCase())}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs normal-case tracking-normal text-white outline-none focus:border-emerald-400"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Sello
              <input
                title="Sello nexID opcional para evitar canjes copiados"
                placeholder="opcional"
                value={voucherSeal}
                onChange={(event) => setVoucherSeal(event.target.value.toUpperCase())}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs normal-case tracking-normal text-white outline-none focus:border-emerald-400"
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Tel. últimos 4
              <input
                title="Últimos cuatro dígitos del teléfono para control del staff"
                placeholder="8608"
                value={voucherPhoneLast4}
                onChange={(event) => setVoucherPhoneLast4(event.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs normal-case tracking-normal text-white outline-none focus:border-emerald-400"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                title="Consultar estado, beneficio, consumidor y vencimiento sin marcarlo como usado"
                disabled={voucherChecking || !voucherCode.trim() || !tenantScope}
                onClick={() => handleValidateVoucher("lookup")}
                className="rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-black text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-40"
              >
                Consultar
              </button>
              <button
                type="button"
                title="Marcar el voucher como canjeado después de entregar premio, cena, experiencia o descuento"
                disabled={voucherChecking || !voucherCode.trim() || !tenantScope}
                onClick={() => handleValidateVoucher("redeem")}
                className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-emerald-300 disabled:opacity-40"
              >
                Canjear
              </button>
            </div>
          </div>

          {voucherResult && (
            <div className={`mt-3 rounded-xl border p-3 text-xs ${
              voucherResult.ok
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                : "border-rose-400/30 bg-rose-400/10 text-rose-100"
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-black">
                  {voucherResult.ok ? "Voucher válido" : `No validado: ${voucherResult.reason || "error"}`}
                </div>
                {voucherResult.redemption?.status ? (
                  <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[10px] font-black uppercase">
                    {voucherResult.redemption.status}
                  </span>
                ) : null}
              </div>
              {voucherResult.redemption ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider opacity-60">Beneficio</div>
                    <div className="font-bold">{voucherResult.redemption.reward?.title || "Voucher nexID"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider opacity-60">Consumidor</div>
                    <div className="font-bold">{voucherResult.redemption.consumer?.name || "Usuario nexID"}</div>
                    <div className="text-[10px] opacity-75">{voucherResult.redemption.consumer?.phone_masked || voucherResult.redemption.consumer?.email_masked || "contacto protegido"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider opacity-60">Sello</div>
                    <div className="font-mono font-bold">{voucherResult.redemption.seal || "n/a"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider opacity-60">Vence</div>
                    <div className="font-bold">{voucherResult.redemption.expires_at ? new Date(voucherResult.redemption.expires_at).toLocaleString("es-AR") : "sin vencimiento"}</div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {audienceDataIsDemo ? <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <div>
              <h3 className="text-sm font-black text-white">Perfiles ficticios de demostración</h3>
              <p className="text-[11px] text-slate-400">Nombre, contacto enmascarado, ciudad, lecturas, puntos, opt-in y segmento.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-300">
              {filteredAudience.length} perfiles
            </span>
          </div>
          <div className="grid gap-2 p-3 md:hidden">
            {filteredAudience.slice(0, 8).map((member, index) => (
              <div key={campaignAudienceRowKey(member, index)} className="rounded-2xl border border-white/10 bg-slate-900/45 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CampaignAudienceIdentity member={member} />
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase ${
                    member.whatsapp_opt_in
                      ? "bg-emerald-400/10 text-emerald-300"
                      : member.marketing_opt_in
                        ? "bg-amber-400/10 text-amber-200"
                        : "bg-slate-800 text-slate-400"
                  }`}>
                    {member.whatsapp_opt_in ? "wa" : member.marketing_opt_in ? "mkt" : "pendiente"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-slate-400">
                  <div className="rounded-xl bg-slate-950/55 p-2">
                    <div className="uppercase tracking-wider text-slate-600">Ciudad</div>
                    <div className="truncate font-bold text-slate-200">{member.city || "Sin ciudad"}</div>
                  </div>
                  <div className="rounded-xl bg-slate-950/55 p-2">
                    <div className="uppercase tracking-wider text-slate-600">Lecturas</div>
                    <div className="font-bold text-cyan-200">{asNumber(member.tap_count)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-950/55 p-2">
                    <div className="uppercase tracking-wider text-slate-600">Puntos</div>
                    <div className="font-bold text-emerald-200">{asNumber(member.points_balance)}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[10px] text-cyan-200">{member.phone_masked || "sin teléfono"}</span>
                  <button
                    type="button"
                    title="Usar este usuario como ejemplo de personalizacion del mensaje"
                    onClick={() => {
                      setSelectedCity(member.city || "all");
                      setDraftText(renderTemplateBody(selectedTemplate, member));
                      setDraftTitle(`${selectedTemplate.name} - ${member.city || "usuario"}`);
                    }}
                    className="shrink-0 rounded-lg border border-cyan-400/30 px-2.5 py-1 text-[10px] font-bold text-cyan-200 hover:bg-cyan-400/10"
                  >
                    Personalizar
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-900/70 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2">Usuario</th>
                  <th className="px-4 py-2">Ciudad</th>
                  <th className="px-4 py-2">Telefono</th>
                  <th className="px-4 py-2">Lecturas</th>
                  <th className="px-4 py-2">Puntos</th>
                  <th className="px-4 py-2">Consentimiento</th>
                  <th className="px-4 py-2">Accion</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudience.slice(0, 8).map((member, index) => (
                  <tr key={campaignAudienceRowKey(member, index)} className="border-t border-white/5 text-slate-300">
                    <td className="px-4 py-3">
                      <CampaignAudienceIdentity member={member} />
                    </td>
                    <td className="px-4 py-3">{member.city || "Sin ciudad"}{member.country ? `, ${member.country}` : ""}</td>
                    <td className="px-4 py-3 font-mono text-cyan-200">{member.phone_masked || "no phone"}</td>
                    <td className="px-4 py-3">{asNumber(member.tap_count)}</td>
                    <td className="px-4 py-3">{asNumber(member.points_balance)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                        member.whatsapp_opt_in
                          ? "bg-emerald-400/10 text-emerald-300"
                          : member.marketing_opt_in
                            ? "bg-amber-400/10 text-amber-200"
                            : "bg-slate-800 text-slate-400"
                      }`}>
                        {member.whatsapp_opt_in ? "whatsapp" : member.marketing_opt_in ? "marketing" : "pendiente"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        title="Usar este usuario como ejemplo de personalizacion del mensaje"
                        onClick={() => {
                          setSelectedCity(member.city || "all");
                          setDraftText(renderTemplateBody(selectedTemplate, member));
                          setDraftTitle(`${selectedTemplate.name} - ${member.city || "usuario"}`);
                        }}
                        className="rounded-lg border border-cyan-400/30 px-2.5 py-1 text-[10px] font-bold text-cyan-200 hover:bg-cyan-400/10"
                      >
                        Personalizar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div> : null}
        </details>
      </section>

      {/* Tabs Menu */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 mb-6">
        <button
          type="button"
          title="Ver los borradores locales de esta sesión y los ejemplos si estás en modo demo"
          onClick={() => setActiveTab("campaigns")}
          className={`pb-3 text-sm font-bold border-b-2 px-4 transition-colors flex items-center gap-2 ${
            activeTab === "campaigns" 
              ? "border-cyan-500 text-white" 
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="w-4 h-4 text-cyan-400" />
          {allowDemoData ? `Borradores demo locales (${campaigns.length})` : "Borradores guardados"}
        </button>
        <button
          type="button"
          title="Abrir el editor IA para redactar, optimizar y puntuar mensajes comerciales"
          onClick={() => setActiveTab("ai-optimizer")}
          className={`pb-3 text-sm font-bold border-b-2 px-4 transition-colors flex items-center gap-2 relative ${
            activeTab === "ai-optimizer" 
              ? "border-purple-500 text-white" 
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sparkle className="w-4 h-4 text-purple-400 animate-pulse" />
          Editor asistido
          <span
            title={aiProvenance.detail}
            className={`absolute -top-1.5 -right-2 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${optimizerStatusClass}`}
          >
            {aiProvenance.tabBadge}
          </span>
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main Column */}
        <div className="space-y-6">
          {activeTab === "campaigns" && !allowDemoData ? (
            <div className="space-y-4">
              <CampaignDraftSaveFeedback workspace={draftWorkspace} dirty={draftDirty} onUseServer={applySavedDraft} />
              <CampaignDraftListPanel workspace={draftWorkspace} canWrite={canWriteDrafts} onEdit={(draft) => void handleOpenDraft(draft)} onNew={handleNewDraft} />
            </div>
          ) : activeTab === "campaigns" ? (
            /* Tab 1: Campaigns List */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Borradores de esta sesión</h2>
                <Button 
                  type="button"
                  title="Abrir el editor IA para crear una nueva campaña"
                  onClick={() => setActiveTab("ai-optimizer")} 
                  variant="secondary"
                  className="gap-2 text-xs py-1.5 border border-purple-500/30 hover:border-purple-500/60"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  Abrir optimizador
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">Estos borradores sólo viven en esta página y se pierden al recargar. No se guardan en el servidor ni habilitan envíos.</p>

              {/* Promo Banner to AI Optimizer */}
              <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-transparent p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-300">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">{aiProvenance.headline}</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {aiProvenance.detail} Podés analizar el copy y abrir el optimizador sin perder el borrador.
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  title="Ir al editor de copy y optimizacion cognitiva"
                  onClick={() => setActiveTab("ai-optimizer")}
                  className="text-xs font-bold text-purple-300 hover:text-purple-200 flex items-center gap-1 shrink-0"
                >
                  Abrir Editor <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {campaigns.map((camp) => {
                const measurement = describeCampaignMeasurement(camp.measurement, camp.conversion);
                return (
                <Card key={camp.id} className="p-5 hover:border-white/20 transition-all duration-300">
                  <div className="flex flex-wrap justify-between items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {camp.status === "RUNNING" && (
                          <span className="inline-flex px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                            {camp.measurement === "demo_model" ? "ACTIVE DEMO" : "ACTIVE"}
                          </span>
                        )}
                        {camp.status === "DRAFT" && (
                          <span className="inline-flex px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase tracking-wider">
                            {camp.measurement === "demo_model" ? "BORRADOR DEMO" : "BORRADOR LOCAL"}
                          </span>
                        )}
                        <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          camp.measurement === "confirmed"
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                            : "border-violet-500/20 bg-violet-500/10 text-violet-300"
                        }`}>
                          {measurement.badge}
                        </span>
                        <h3 className="text-base font-bold text-white leading-none">{camp.title}</h3>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                        {camp.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-white">{measurement.conversion}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                        {measurement.conversionLabel}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
                    <span>Enviado: <strong className="text-white">{camp.sentCount.toLocaleString("es-AR")}</strong></span>
                    <span>Clicks: <strong className="text-white">{camp.clicksCount.toLocaleString("es-AR")}</strong></span>
                    <span>Recompensas emitidas: <strong className="text-white">{camp.rewardsCount.toLocaleString("es-AR")}</strong></span>
                  </div>
                  {camp.measurement !== "confirmed" ? (
                    <p className="mt-2 text-[10px] leading-relaxed text-violet-200">Valores de demostracion o borrador; no representan envios, conversion ni recompra medidas del tenant.</p>
                  ) : null}
                </Card>
                );
              })}
              {!campaigns.length ? (
                <div
                  role="status"
                  data-testid="loyalty-campaigns-empty"
                  className="rounded-2xl border border-dashed border-white/15 bg-slate-900/35 p-5 text-sm leading-6 text-slate-300"
                >
                  Todavía no agregaste borradores demo en esta sesión. La simulación no consulta ni escribe borradores reales.
                </div>
              ) : null}
            </div>
          ) : (
            /* Tab 2: AI Optimizer Workspace */
            <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
              {/* Left Side: Text Editor */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">Redacción de Campaña</h3>
                  <p className="text-xs text-slate-400">{allowDemoData ? "Simulación local; no se guarda en el servidor." : draftWorkspace.selected ? `Borrador ${draftWorkspace.selected.status === "archived" ? "archivado" : "guardado"} · versión ${draftWorkspace.selected.revision}.` : "Nuevo borrador; guardalo para recuperarlo al recargar."} Aprobación y envío no están conectados.</p>
                </div>

                {/* AI provider settings */}
                <div className="rounded-xl border border-purple-500/20 bg-purple-950/5 p-4 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      Motor IA de campañas
                    </span>
                    <span
                      title={optimizerModeDetail}
                      className={`text-[8.5px] font-bold px-2 py-0.5 rounded font-mono ${optimizerStatusClass}`}
                    >
                      {optimizerModeLabel.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    La credencial y el modelo se administran en el servidor; este editor no recibe ni guarda claves.
                    Configurado no significa ejecutado. Cada resultado informa si respondió un proveedor o si se usaron reglas de respaldo.
                  </p>
                  <div className="space-y-1.5 border-t border-white/5 pt-2">
                    <p className="break-words text-xs text-slate-300">{aiProvenance.detail}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="campaign-draft-title" className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Nombre de la Campaña
                    </label>
                    <input
                      id="campaign-draft-title"
                      maxLength={160}
                      type="text"
                      placeholder="Ej. Cosecha Especial VIP o Lanzamiento Reserva"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      className="min-h-11 w-full bg-slate-950/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                  {!allowDemoData ? <label className="block text-xs font-semibold text-slate-400">
                    Canal del borrador · finalidad Marketing
                    <select value={draftChannel} onChange={(event) => setDraftChannel(event.target.value as CampaignAudienceChannel)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white">
                      <option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="phone">Teléfono</option>
                    </select>
                    <span className="mt-1 block text-xs font-normal leading-relaxed">Se guarda la elección de canal, no la muestra de contactos ni su consentimiento. La audiencia actual se consulta por separado.</span>
                  </label> : null}

                  {/* Profile Tone Switcher */}
                  {!showOptimizedResult && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Perfil de Redacción AI
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "sommelier", label: "Sommelier", icon: Sparkles, desc: "Aromas, cata y terruño" },
                          { id: "vip-club", label: "Club Privado", icon: BookmarkCheck, desc: "Exclusividad y cupo VIP" },
                          { id: "modern-web3", label: "Modern Web3", icon: Cpu, desc: "Tokenización segura" }
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            title={`Usar perfil de redaccion ${t.label}: ${t.desc}`}
                            onClick={() => setSelectedTone(t.id as "sommelier" | "vip-club" | "modern-web3")}
                            className={`p-2 rounded-xl border text-left transition-all duration-300 flex flex-col gap-0.5 ${
                              selectedTone === t.id
                                ? "border-purple-500 bg-purple-500/10 text-white"
                                : "border-white/10 bg-slate-950/30 text-slate-400 hover:border-white/20"
                            }`}
                          >
                            <span className="flex items-center gap-1.5 text-xs font-bold">
                              <t.icon className="w-3.5 h-3.5 text-purple-400" />
                              {t.label}
                            </span>
                            <span className="text-[8px] text-slate-500 leading-tight">{t.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="campaign-draft-message" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Cuerpo del Mensaje (Borrador)
                      </label>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {showOptimizedResult ? optimizedText.length : draftText.length} caracteres
                      </span>
                    </div>

                    <div className="relative">
                      {!showOptimizedResult ? (
                        <textarea
                          id="campaign-draft-message"
                          maxLength={6000}
                          placeholder="Escribí aquí tu borrador plano. Ejemplo: 'Este vino malbec es muy rico y es barato para comprar en nuestro club.'"
                          value={draftText}
                          onChange={(e) => setDraftText(e.target.value)}
                          rows={6}
                          className="w-full bg-slate-950/70 border border-white/10 rounded-xl p-3.5 text-xs text-white outline-none focus:border-purple-500 transition-all placeholder:text-slate-600 resize-none font-sans leading-relaxed"
                        />
                      ) : (
                        <div className="space-y-4">
                          {/* Side by side comparison */}
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <span className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1 font-bold">Borrador Original</span>
                              <div className="bg-slate-950/50 border border-white/5 rounded-xl p-3 text-xs text-slate-400 leading-relaxed italic min-h-[120px] select-none">
                                "{draftText}"
                              </div>
                            </div>
                            <div>
                              <span className="block text-[9px] uppercase tracking-wider text-purple-400 mb-1 font-bold">Optimizado por {optimizerModeLabel} ({selectedTone})</span>
                              <div className="bg-slate-900/40 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.08)] rounded-xl p-3 text-xs text-white leading-relaxed min-h-[120px]">
                                {optimizedText}
                              </div>
                              <p className="mt-1 text-[9px] text-slate-500">{optimizerModeDetail}</p>
                            </div>
                          </div>

                          {/* Improvements checklist */}
                          {appliedImprovements.length > 0 && (
                            <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3.5 space-y-2">
                              <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                                Traducciones y Mejoras Semánticas Aplicadas:
                              </span>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
                                {appliedImprovements.map((imp, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5 py-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                    <span className="text-slate-400 line-through">"{imp.from}"</span>
                                    <ChevronRight className="w-3 h-3 text-slate-600" />
                                    <span className="text-purple-300 font-medium">"{imp.to}"</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            <button
                              type="button"
                              title="Mover el texto optimizado al editor para seguir ajustandolo"
                              onClick={() => {
                                setDraftText(optimizedText);
                                setShowOptimizedResult(false);
                              }}
                              className="text-[10px] px-3.5 py-1.5 rounded-lg border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 transition font-bold flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" /> Editar este texto
                            </button>
                            <button
                              type="button"
                              title="Descartar la version optimizada y volver al borrador original"
                              onClick={() => {
                                setShowOptimizedResult(false);
                                setAppliedImprovements([]);
                              }}
                              className="text-[10px] px-3.5 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 transition font-bold flex items-center gap-1"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Volver al Original
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {!showOptimizedResult && (
                    <Button
                      type="button"
                      title="Analizar el texto y generar una version premium segun el tono seleccionado"
                      onClick={handleOptimizeText}
                      disabled={isOptimizing || !draftText.trim()}
                      className="w-full gap-2 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 border-none text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {isOptimizing ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Analizando Semántica y Redactando ({selectedTone})...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-purple-200 animate-pulse" />
                          <span>Optimizar a Tono Premium ({selectedTone})</span>
                        </>
                      )}
                    </Button>
                  )}

                  <div className="pt-2">
                    <Button
                      type="button"
                      title={allowDemoData ? "Agregar un borrador demo local" : "Guardar el texto en el servidor con control de versión, sin enviar mensajes"}
                      onClick={handleCreateCampaign}
                      disabled={(!draftText.trim() && !optimizedText.trim()) || (!allowDemoData && (!canWriteDrafts || draftWorkspace.write.pending || draftWorkspace.reading || draftWorkspace.hasUnresolved || draftWorkspace.selected?.status === "archived"))}
                      variant="primary"
                      className="min-h-11 w-full gap-2 text-xs py-2 bg-gradient-to-r from-cyan-400 to-emerald-500 border-none text-slate-950 font-bold shadow-[0_0_20px_rgba(6,182,212,0.2)] disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{allowDemoData ? "Agregar borrador demo local" : draftWorkspace.write.pending ? "Guardando…" : draftWorkspace.selected ? "Guardar nueva versión" : "Guardar borrador"}</span>
                    </Button>
                    <p className="mt-2 text-xs text-slate-400">{allowDemoData ? "Sólo en esta sesión; se pierde al recargar." : !canWriteDrafts ? "Tu rol permite consultar, pero no guardar ni archivar borradores." : draftWorkspace.selected?.status === "archived" ? "Este borrador está archivado y no se puede editar desde aquí." : "Sólo se confirma el guardado al recibir y validar la versión del servidor."}</p>
                    {!allowDemoData ? <div className="mt-3 space-y-3">
                      {draftFormError ? <p role="alert" className="text-sm text-amber-200">{campaignDraftErrorCopy(draftFormError)}</p> : null}
                      <CampaignDraftSaveFeedback workspace={draftWorkspace} dirty={draftDirty} onUseServer={applySavedDraft} />
                    </div> : null}
                  </div>
                </div>
              </div>

              {/* Right Side: AI Cognitive Analysis Suite */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-purple-400" /> Heurísticas locales de copy
                  </h3>
                  <p className="text-xs text-slate-400">Scores de 0 a 100 calculados con palabras, longitud, CTA, emoji y puntuación. No son CTR, conversión, sentimiento medido ni telemetría de campaña.</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-5 space-y-5">
                  {/* Prestige score radial SVG */}
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-20 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="40"
                          cy="40"
                          r="34"
                          className="stroke-slate-800"
                          strokeWidth="6"
                          fill="transparent"
                        />
                        <motion.circle
                          cx="40"
                          cy="40"
                          r="34"
                          className="stroke-amber-400"
                          strokeWidth="6"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 34}
                          initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                          style={{ strokeDashoffset: 2 * Math.PI * 34 }}
                          animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - analysis.prestigeScore / 100) }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                        <span className="text-sm font-black text-white">{analysis.prestigeScore}/100</span>
                        <span className="text-[8px] text-slate-400 uppercase font-bold">Heurística</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[8px] font-bold text-amber-300 uppercase bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                        Rango: {analysis.prestigeTier}
                      </span>
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                        {analysis.prestigeScore === 0 ? (
                          "Ingresá texto para calificar la exclusividad del copy."
                        ) : analysis.prestigeScore > 75 ? (
                          "Excelente jerga premium. Genera valor de lujo y alta exclusividad."
                        ) : (
                          "El texto usa palabras muy genéricas. Recomendamos reescribir a tono Sommelier."
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Local action-copy heuristic. Never present it as observed CTR. */}
                  <div className="pt-2 border-t border-white/5 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-purple-400" /> Heurística de acción del copy · 0–100
                      </span>
                      <span className="font-mono text-purple-300 font-black">{analysis.viralityScore}/100</span>
                    </div>
                    
                    <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                      <motion.div
                        className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full"
                        animate={{ width: `${analysis.viralityScore}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>

                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>Rango heurístico: <strong>{analysis.viralityTier}</strong></span>
                      <span>{analysis.viralityScore > 65 ? "Score de copy alto" : "Score de copy moderado"}</span>
                    </div>
                  </div>

                  {/* Emotion Distribution Breakdown */}
                  <div className="pt-2 border-t border-white/5 space-y-3">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] block">
                      Distribución heurística de palabras del copy
                    </span>

                    <div className="space-y-2.5">
                      {[
                        { name: "Exclusividad / Lujo", value: analysis.emotions.exclusivity, color: "bg-purple-500" },
                        { name: "Confianza / origen declarado", value: analysis.emotions.trust, color: "bg-emerald-500" },
                        { name: "Curiosidad / Experiencia", value: analysis.emotions.curiosity, color: "bg-cyan-500" },
                        { name: "Urgencia / Deseo", value: analysis.emotions.urgency, color: "bg-amber-500" }
                      ].map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-300 font-medium">{item.name}</span>
                            <span className="font-mono text-slate-400">{item.value}%</span>
                          </div>
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                            <motion.div
                              className={`${item.color} h-full rounded-full`}
                              animate={{ width: `${item.value}%` }}
                              transition={{ duration: 0.5, delay: idx * 0.1 }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: BotIA Growth Strategist Chat */}
        <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/70 backdrop-blur shadow-[0_0_30px_rgba(6,182,212,0.05)] flex flex-col h-[520px]">
          <div className="p-4 border-b border-white/10 bg-slate-900/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-400 to-purple-600 text-slate-950 flex items-center justify-center font-bold">
                <Bot className="w-4 h-4 text-slate-950" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Asistente de cercanía comercial</h3>
                <p className="text-[9px] text-amber-300 font-bold uppercase tracking-wider">Reglas locales · simulación conversacional</p>
              </div>
            </div>
            <span className="rounded border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-amber-300">
              Sin LLM
            </span>
          </div>

          {/* Messages Container */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 scrollbar-thin text-xs">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${
                  msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
                }`}
              >
                <div
                  className={`p-3 rounded-2xl leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-cyan-500 text-slate-950 rounded-br-none font-medium"
                      : "bg-slate-900/80 border border-white/5 text-slate-300 rounded-bl-none"
                  }`}
                >
                  {msg.text}
                </div>
                
                {msg.sender === "bot" && msg.action && (
                  <button
                    type="button"
                    title="Usar esta recomendación del asistente como borrador de campaña"
                    onClick={() => {
                      setDraftTitle(msg.action?.title || "");
                      setDraftText(msg.action?.prompt || "");
                      setOptimizedText("");
                      setShowOptimizedResult(false);
                      setAppliedImprovements([]);
                      if (msg.action?.title.toLowerCase().includes("token") || msg.action?.title.toLowerCase().includes("web3")) {
                        setSelectedTone("modern-web3");
                      } else if (msg.action?.title.toLowerCase().includes("tasting") || msg.action?.title.toLowerCase().includes("seleccion")) {
                        setSelectedTone("sommelier");
                      }
                      setActiveTab("ai-optimizer");
                    }}
                    className="mt-2 text-[10px] bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 text-purple-200 px-3 py-1.5 rounded-xl transition font-black uppercase flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                    {msg.action.label}
                  </button>
                )}
              </div>
            ))}

            {isBotTyping && (
              <div className="bg-slate-900/80 border border-white/5 text-slate-300 p-3 rounded-2xl rounded-bl-none mr-auto max-w-[80%] flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>

          {/* Quick recommendations panel */}
          <div className="p-2 border-t border-white/5 bg-slate-900/20">
            <div className="flex flex-wrap gap-1.5">
              {[
                "Sugerir Campaña VIP",
                "Ideas de Retención",
                "Campaña Brasil",
                "Drop Tokenizado Web3"
              ].map((text, idx) => (
                <button
                  type="button"
                  title={`Cargar sugerencia rapida: ${text}`}
                  key={idx}
                  onClick={() => {
                    setChatInput(text);
                  }}
                  className="px-2.5 py-1 bg-slate-900/60 hover:bg-slate-800 border border-white/5 rounded-lg text-[9px] text-cyan-300 font-bold uppercase transition"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>

          {/* Input field */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-slate-900/40">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Preguntale a la IA comercial..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl pl-3 pr-10 py-2.5 text-xs text-white outline-none focus:border-cyan-500 transition-colors"
              />
              <button
                type="submit"
                title="Enviar mensaje al asistente de fidelizacion"
                aria-label="Enviar mensaje al asistente de fidelizacion"
                className="absolute right-2 text-cyan-400 hover:text-cyan-300 transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
