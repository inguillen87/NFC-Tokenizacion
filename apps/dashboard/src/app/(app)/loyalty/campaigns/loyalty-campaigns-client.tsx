"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Card, Badge, Button } from "@product/ui";
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

// Types
interface Campaign {
  id: string;
  status: "RUNNING" | "DRAFT" | "COMPLETED";
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
  viralityTier: "Baja" | "Media" | "Alta" | "Viral Garantizado";
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

interface AudienceMember {
  consumer_id: string;
  display_name?: string | null;
  email_masked?: string | null;
  phone_masked?: string | null;
  city?: string | null;
  country?: string | null;
  tenant_slug?: string | null;
  status?: string | null;
  points_balance?: number | string | null;
  lifetime_points?: number | string | null;
  tap_count?: number | string | null;
  valid_taps?: number | string | null;
  risk_taps?: number | string | null;
  saved_products?: number | string | null;
  last_product?: string | null;
  marketing_opt_in?: boolean | null;
  whatsapp_opt_in?: boolean | null;
  segment?: string | null;
  last_tap_at?: string | null;
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
  expectedLift: string;
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

const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "mendoza-near-winery",
    name: "Voucher cercanía bodega",
    channel: "whatsapp",
    category: "MARKETING",
    segment: "Usuarios verificados cerca de Mendoza",
    offer: "2x1 en copa de bienvenida + upgrade de visita",
    expectedLift: "+14% visitas al portal",
    body:
      "Hola {{name}}, vimos tu tap verificado en {{city}} sobre {{product}}. Bodega Balmec te reserva {{offer}} por 48h. Toca Quiero y nexID emite tu código de canje con respaldo por WhatsApp y email si lo tenés cargado. Stop para salir.",
    requirements: ["phone_verified", "whatsapp_opt_in", "city_match"],
  },
  {
    id: "post-tap-welcome",
    name: "Bienvenida post-tap",
    channel: "whatsapp",
    category: "UTILITY",
    segment: "Primer tap validado",
    offer: "club digital con puntos iniciales",
    expectedLift: "+22% registros completados",
    body:
      "Hola {{name}}, tu producto {{product}} quedó autenticado con nexID. Ya tenés {{points}} puntos y podés guardar el pasaporte, reclamar beneficios y recibir novedades de {{brand}}. Stop para salir.",
    requirements: ["tap_valid", "consumer_session"],
  },
  {
    id: "trust-recovery",
    name: "Recuperación de confianza",
    channel: "whatsapp",
    category: "UTILITY",
    segment: "Usuarios con señales de riesgo",
    offer: "validación asistida y beneficio compensatorio",
    expectedLift: "-18% abandono post-alerta",
    body:
      "Hola {{name}}, detectamos una verificación que requiere revisión para {{product}}. El equipo de {{brand}} puede validar el caso y activar un beneficio de confianza desde tu Pasaporte nexID. Stop para salir.",
    requirements: ["risk_case", "support_ready"],
  },
  {
    id: "vip-gamified",
    name: "Reto gamificado VIP",
    channel: "whatsapp",
    category: "LOYALTY",
    segment: "Clientes con 2+ taps o puntos",
    offer: "bonus de 300 puntos + badge Vendimia Insider",
    expectedLift: "+9% recompra esperada",
    body:
      "Hola {{name}}, por tus taps en {{city}} desbloqueaste el reto Vendimia Insider. Escanea otro producto de {{brand}} esta semana y gana {{offer}}. Ver bases en tu portal nexID. Stop para salir.",
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
    topCity: "Mendoza",
    topProduct: "Gran Reserva Malbec",
    insight: "Apenas los clientes completen la trivia post-tap, este panel muestra conocimiento por ciudad, producto y pregunta para activar promociones o eventos.",
  },
  cities: [
    { city: "Mendoza", attempts: 0, avgScorePct: 0, pointsIssued: 0, topProduct: "Gran Reserva Malbec" },
    { city: "Cordoba", attempts: 0, avgScorePct: 0, pointsIssued: 0, topProduct: "Cabernet Franc Reserva" },
  ],
  questions: [
    { prompt: "Origen verificado y lote del producto", insightTag: "origin-literacy", attempts: 0, correctRatePct: 0, dominantMiss: null },
    { prompt: "Beneficios por cercania a bodega o feria", insightTag: "geo-campaign-understanding", attempts: 0, correctRatePct: 0, dominantMiss: null },
    { prompt: "Experiencia premium post-tap", insightTag: "post-tap-experience-fit", attempts: 0, correctRatePct: 0, dominantMiss: null },
  ],
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
  const selected = member || DEMO_AUDIENCE[0];
  const replacements: Record<string, string> = {
    name: firstName(selected.display_name),
    city: selected.city || "Mendoza",
    product: selected.last_product || "tu producto autenticado",
    brand: selected.tenant_slug === "demobodega" ? "Bodega Balmec" : selected.tenant_slug || "tu marca",
    offer: template.offer,
    points: String(asNumber(selected.points_balance)),
  };
  return template.body.replace(/\{\{(name|city|product|brand|offer|points)\}\}/g, (_, key: string) => replacements[key] || "");
}

// Initial campaigns data
const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: "1",
    status: "RUNNING",
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
    title: "Turista Brasil (Localizado)",
    description: "Campaña generada por IA en Portugués. Segmentada a IPs de Brasil para incentivar la compra de cajas de vino con envío bonificado.",
    conversion: "-",
    sentCount: 0,
    clicksCount: 0,
    rewardsCount: 0
  }
];

export default function LoyaltyCampaignsClient() {
  const [activeTab, setActiveTab] = useState<"campaigns" | "ai-optimizer">("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  
  // Draft / AI Optimizer states
  const [draftTitle, setDraftTitle] = useState("");
  const [draftText, setDraftText] = useState("");
  const [optimizedText, setOptimizedText] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showOptimizedResult, setShowOptimizedResult] = useState(false);
  const [selectedTone, setSelectedTone] = useState<"sommelier" | "vip-club" | "modern-web3">("sommelier");
  const [appliedImprovements, setAppliedImprovements] = useState<ImprovementApplied[]>([]);
  const [selectedModel, setSelectedModel] = useState("Qwen/Qwen2.5-7B-Instruct");
  const [optimizerMode, setOptimizerMode] = useState<"idle" | "huggingface" | "server-fallback" | "local-fallback">("idle");
  const [serverAiConfigured, setServerAiConfigured] = useState<boolean | null>(null);
  const [serverAiModel, setServerAiModel] = useState("");
  const [lastOptimizerModel, setLastOptimizerModel] = useState("");

  // Custom Hugging Face Token state loaded from localStorage
  const [hfTokenInput, setHfTokenInput] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hf_api_token") || "";
    }
    return "";
  });

  const handleSaveToken = (val: string) => {
    const cleanValue = val.trim();
    setHfTokenInput(cleanValue);
    if (typeof window !== "undefined") {
      if (cleanValue) {
        localStorage.setItem("hf_api_token", cleanValue);
      } else {
        localStorage.removeItem("hf_api_token");
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function loadAiStatus() {
      try {
        const response = await fetch("/api/cognitive-ai", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        setServerAiConfigured(Boolean(payload?.configured));
        setServerAiModel(String(payload?.defaultModel || ""));
      } catch {
        if (!cancelled) setServerAiConfigured(false);
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
      text: "¡Hola! Analicé los datos de fidelización de este mes. Tu tasa de retención de clientes cayó un 2%. ¿Querés que diseñemos una campaña exclusiva para reactivar a los usuarios que no han escaneado en los últimos 30 días?",
      action: {
        label: "Diseñar Campaña de Reactivación",
        title: "Reactivación Club Selección",
        prompt: "Tenemos un vino rico guardado en la bodega. Completá el quiz escaneando tu botella para ganar una copa gratis de cortesía en nuestro club."
      }
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [audienceMembers, setAudienceMembers] = useState<AudienceMember[]>([]);
  const [audienceLoading, setAudienceLoading] = useState(true);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [triviaInsight, setTriviaInsight] = useState<TriviaInsight>(TRIVIA_FALLBACK);
  const [triviaLoading, setTriviaLoading] = useState(true);
  const [triviaError, setTriviaError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(CAMPAIGN_TEMPLATES[0].id);
  const [selectedCity, setSelectedCity] = useState("all");
  const [sandboxRecipientName, setSandboxRecipientName] = useState("Marcelo");
  const [twilioRecipient, setTwilioRecipient] = useState("+5492613168608");
  const [twilioOptInConfirmed, setTwilioOptInConfirmed] = useState(false);
  const [twilioSending, setTwilioSending] = useState(false);
  const [twilioStatus, setTwilioStatus] = useState<TwilioStatus | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherSeal, setVoucherSeal] = useState("");
  const [voucherPhoneLast4, setVoucherPhoneLast4] = useState("");
  const [voucherChecking, setVoucherChecking] = useState(false);
  const [voucherResult, setVoucherResult] = useState<RedemptionValidation | null>(null);

  const audience = audienceMembers.length ? audienceMembers : DEMO_AUDIENCE;
  const selectedTemplate = CAMPAIGN_TEMPLATES.find((item) => item.id === selectedTemplateId) || CAMPAIGN_TEMPLATES[0];
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
  const flowReadiness = useMemo(() => {
    const selectedProfiles = filteredAudience.length;
    const optInProfiles = filteredAudience.filter((member) => member.whatsapp_opt_in || member.marketing_opt_in).length;
    const score =
      (audienceKpis.taps > 0 ? 20 : 0) +
      (selectedProfiles > 0 ? 20 : 0) +
      (optInProfiles > 0 ? 20 : 0) +
      (selectedTemplate ? 20 : 0) +
      (twilioOptInConfirmed ? 20 : 0);
    return {
      score,
      selectedProfiles,
      optInProfiles,
      steps: [
        {
          label: "Tap verificado",
          value: `${audienceKpis.taps.toLocaleString("es-AR")} taps`,
          detail: "Senal fisica del producto usada como disparador comercial.",
          ready: audienceKpis.taps > 0,
          Icon: Gauge,
        },
        {
          label: "Segmento CRM",
          value: `${selectedProfiles.toLocaleString("es-AR")} perfiles`,
          detail: selectedCity === "all" ? "Todos los perfiles accionables." : `Filtrado por ${selectedCity}.`,
          ready: selectedProfiles > 0,
          Icon: Layers,
        },
        {
          label: "Consentimiento",
          value: `${optInProfiles.toLocaleString("es-AR")} opt-in`,
          detail: "WhatsApp o marketing habilitado antes de enviar.",
          ready: optInProfiles > 0,
          Icon: ShieldCheck,
        },
        {
          label: "Plantilla",
          value: selectedTemplate.name,
          detail: selectedTemplate.offer,
          ready: Boolean(selectedTemplate),
          Icon: MessageSquare,
        },
        {
          label: "Canje staff",
          value: voucherResult?.redemption?.status || "lookup/redeem",
          detail: "Código, sello y teléfono validables desde el CRM.",
          ready: Boolean(voucherResult?.ok),
          Icon: BookmarkCheck,
        },
      ],
    };
  }, [audienceKpis.taps, filteredAudience, selectedCity, selectedTemplate, twilioOptInConfirmed, voucherResult]);

  useEffect(() => {
    let cancelled = false;
    async function loadAudience() {
      setAudienceLoading(true);
      setAudienceError(null);
      try {
        const response = await fetch("/api/admin/consumer-network/members?tenant=demobodega", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(payload?.items)) {
          throw new Error(payload?.reason || payload?.error || "audience_unavailable");
        }
        if (!cancelled) {
          setAudienceMembers(payload.items as AudienceMember[]);
        }
      } catch (error) {
        if (!cancelled) {
          setAudienceMembers([]);
          setAudienceError(error instanceof Error ? error.message : "audience_unavailable");
        }
      } finally {
        if (!cancelled) setAudienceLoading(false);
      }
    }
    loadAudience();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadTriviaInsight() {
      setTriviaLoading(true);
      setTriviaError(null);
      try {
        const response = await fetch("/api/admin/loyalty/trivia/overview?tenant=demobodega", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false || !payload?.summary) {
          throw new Error(payload?.reason || payload?.error || "trivia_unavailable");
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
          setTriviaInsight(TRIVIA_FALLBACK);
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
  }, []);

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

    // Virality/CTR prediction
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
    else if (viralityScore > 75) viralityTier = "Viral Garantizado";
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
      "escanear": ["autenticar su chip nexID", "verificar la firma criptográfica de su etiqueta"],
      "escaneá": ["autenticá tu botella NFC", "escaneá el sello de autenticidad nexID"],
    },
    "vip-club": {
      "vino": ["reserva privada numerada", "cosecha limitada de cofradía", "etiqueta exclusiva de asignación"],
      "vinos": ["piezas numeradas de guarda", "asignaciones exclusivas", "reliquias de bodega"],
      "rico": ["de prestigio inigualable y distinción sublime", "reservado exclusivamente para paladares exigentes"],
      "ricos": ["de nobleza certificada y linaje sobresaliente"],
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
      "escanear": ["autenticar su chip de seguridad", "validar su pasaporte digital en el sello NFC"],
      "escaneá": ["autenticá tu botella nexID", "verificá tu sello digital de miembro"],
    },
    "modern-web3": {
      "vino": ["activo físico con certificado transferible", "botella respaldada criptográficamente", "gemelo digital de colección"],
      "vinos": ["activos físicos con certificado", "coleccionables con pasaporte auditable", "botellas con respaldo criptográfico"],
      "rico": ["con trazabilidad verificable y huella sensorial auditada"],
      "ricos": ["de alto valor de coleccionabilidad y procedencia certificada"],
      "bueno": ["con firma criptográfica verificable", "certificado transferible"],
      "barato": ["un valor preferencial de acuñación (minting rate)"],
      "baratos": ["asignaciones inteligentes con fee reducido"],
      "comprar": ["reclamar la propiedad digital (claim)", "transferir al ledger privado", "acuñar el certificado de procedencia"],
      "compra": ["tokenización de propiedad"],
      "club": ["red descentralizada de coleccionistas", "Cofradía Cripto-Sommelier nexID", "DAO de beneficios Web3"],
      "degustar": ["catar y validar certificado", "desbloquear la experiencia interactiva"],
      "botella": ["activo digital tokenizado", "botella con microchip nexID NFC"],
      "botellas": ["lote digitalizado de etiquetas"],
      "olor": ["perfil aromático verificado y registrado en el smart contract"],
      "tomar": ["consumir y quemar el token de sello (burn)", "desbloquear"],
      "oferta": ["drop exclusivo de asignación digital", "acceso anticipado al pool"],
      "descuento": ["recompensa nativa de fidelidad", "cashback digital de protocolo"],
      "gratis": ["airdrop de cortesía sin cargo", "recompensa directa de bloque"],
      "completar": ["firmar la transacción digital", "aprobar en el ledger"],
      "ganar": ["acuñar el derecho de redención", "desbloquear la recompensa en tu wallet"],
      "escanear": ["autenticar el gemelo digital NFC", "escanear el chip físico criptográfico nexID"],
      "escaneá": ["escaneá el chip criptográfico NFC", "autenticá tu gemelo digital nexID"],
    }
  };

  // Re-writer premium (Sommelier translator using Hugging Face + Local Fallback)
  async function handleOptimizeText() {
    if (!draftText.trim()) return;
    setIsOptimizing(true);

    try {
      const response = await fetch("/api/cognitive-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: draftText, 
          tone: selectedTone,
          customToken: hfTokenInput || undefined,
          model: selectedModel
        }),
      });

      if (!response.ok) {
        throw new Error("API rewrite failed");
      }

      const data = await response.json();
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
      setOptimizerMode(data.fallback ? "server-fallback" : "huggingface");
      setLastOptimizerModel(String(data.model || selectedModel || ""));
      setShowOptimizedResult(true);
      setIsOptimizing(false);
    } catch (err) {
      console.warn("Hugging Face API failed or not configured, using premium local heuristics fallback:", err);
      
      // Local Heuristic Fallback
      setTimeout(() => {
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
            optimized = `Gemelo digital verificado nexID: ${optimized} — Certificado transferible bajo política del tenant.`;
          } else {
            optimized = `Una propuesta de valor exclusivo nexID: ${optimized} — Reservado para miembros de nuestra Cofradía Privada.`;
          }
        }

        const hasCTA = clean.includes("autentic") || clean.includes("escan") || clean.includes("sumar") || clean.includes("adquirir") || clean.includes("particip") || clean.includes("claim") || clean.includes("reclamar");
        if (!hasCTA) {
          if (selectedTone === "modern-web3") {
            optimized += " Escaneá el chip NFC nexID para reclamar el certificado de propiedad de tu activo físico.";
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

  // Create Campaign from current draft
  function handleCreateCampaign() {
    const textToUse = showOptimizedResult ? optimizedText : draftText;
    if (!textToUse.trim()) return;

    const newCampaign: Campaign = {
      id: Date.now().toString(),
      status: "DRAFT",
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
    setTwilioStatus(null);
    setTwilioSending(true);
    try {
      const response = await fetch("/api/admin/campaigns/test-whatsapp", {
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
        message: `Mensaje interactivo enviado a ${payload?.to || "destinatario verificado"}. Estado: ${payload?.status || "queued"}.`,
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
    setVoucherChecking(true);
    setVoucherResult(null);
    try {
      const response = await fetch("/api/admin/rewards/redemptions/validate", {
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
      let replyText = "Entendido. Como nexID Cognitive AI Engine, te sugiero diseñar campañas enfocadas en la exclusividad de tu terroir y el valor agregado de tus colecciones numeradas. ¿Querés probar redactando un copy promocional en la pestaña superior?";
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
          prompt: "Lanzamos el nuevo vino de barrica de este año. Comprá ahora con descuento del club y escaneá el chip para ver el certificado."
        };
      } else if (prompt.includes("brasil") || prompt.includes("portugués") || prompt.includes("turismo")) {
        replyText = "Para tu segmento internacional, es vital destacar la logística premium y el pasaporte de bodega. Probá con esta estructura en el Editor:";
        action = {
          label: "Usar Borrador Turismo",
          title: "Passaporte Terroir nexID",
          prompt: "Aprovechá el envío gratis para comprar vino de autor y escaneá tu botella en Brasil para ganar accesos VIP en Mendoza."
        };
      } else if (prompt.includes("web3") || prompt.includes("blockchain") || prompt.includes("nft")) {
        replyText = "Para una campaña de fidelización basada en activos digitales y procedencia criptográfica, probá este borrador en el tono 'Modern Web3':";
        action = {
          label: "Usar Borrador Web3",
          title: "Tokenización de Lote Exclusivo",
          prompt: "Asegurá tu botella con certificado transferible. Escaneá el chip NFC para reclamar propiedad digital, beneficios de club y trazabilidad verificable."
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

  const optimizerModeLabel =
    optimizerMode === "huggingface"
      ? "LLM Hugging Face"
      : optimizerMode === "server-fallback"
        ? "Fallback seguro"
        : optimizerMode === "local-fallback"
          ? "Motor local"
          : hfTokenInput
            ? "LLM override listo"
            : serverAiConfigured === true
              ? "LLM servidor listo"
              : serverAiConfigured === null
                ? "Verificando IA"
                : "Heuristicas locales";

  const optimizerModeDetail =
    optimizerMode === "huggingface"
      ? "La reescritura salio por Hugging Face Router con el modelo seleccionado."
      : optimizerMode === "server-fallback"
        ? "No hubo respuesta util del proveedor o falta token; se uso fallback seguro del servidor."
        : optimizerMode === "local-fallback"
          ? "La API no respondio; se uso el diccionario premium local del navegador."
          : hfTokenInput
            ? `Hay token guardado en este navegador; al optimizar se intenta usar ${selectedModel}.`
            : serverAiConfigured === true
              ? `El servidor tiene IA configurada${serverAiModel ? ` (${serverAiModel})` : ""}. El editor usa esa configuracion sin exponer tokens al navegador.`
              : serverAiConfigured === null
                ? "Consultando el estado del proveedor de IA del servidor."
                : "Sin proveedor configurado, la reescritura y los scores quedan en modo estimado/local.";
  const optimizerIsConfigured = Boolean(hfTokenInput || serverAiConfigured === true);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Growth Campaigns <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-black uppercase">Cognitive Suite</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Fidelizá a tus consumidores mediante campañas inteligentes optimizadas en tiempo real por el motor cognitivo de nexID.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-cyan-500/20 bg-slate-950/70 p-4 shadow-[0_0_30px_rgba(6,182,212,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
              <MessageCircle className="h-4 w-4" />
              Audience CRM live
            </div>
            <h2 className="mt-1 text-xl font-black text-white">Segmentos, vouchers y WhatsApp</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
              De tap verificado a relación comercial: usuario registrado, ciudad, producto, consentimiento, plantilla y envío controlado.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200">
            <ShieldCheck className="h-4 w-4" />
            {audienceLoading ? "Cargando audiencia" : audienceError ? "Fallback offline activo" : "Datos CRM activos"}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Contactos CRM", value: audienceKpis.total, hint: "registrados", icon: Phone, color: "text-cyan-300" },
            { label: "Con teléfono", value: audienceKpis.withPhone, hint: "listos para canal", icon: MessageCircle, color: "text-sky-300" },
            { label: "WhatsApp opt-in", value: audienceKpis.whatsappOptIn, hint: "consentidos", icon: ShieldCheck, color: "text-emerald-300" },
            { label: "Mendoza", value: audienceKpis.mendoza, hint: "cercanía bodega", icon: MapPin, color: "text-amber-300" },
            { label: "Taps acumulados", value: audienceKpis.taps, hint: "señal comercial", icon: Gauge, color: "text-purple-300" },
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
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-cyan-400/20 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,.16),transparent_36%),linear-gradient(135deg,rgba(2,6,23,.92),rgba(8,47,73,.36))] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
                <Sparkles className="h-4 w-4" />
                Investor flow
              </div>
              <h3 className="mt-1 text-sm font-black text-white">Circuito post-tap listo para mostrar</h3>
              <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-400">
                De la lectura NFC al beneficio canjeable: segmento, consentimiento, plantilla, WhatsApp/email y validación staff en un solo recorrido.
              </p>
            </div>
            <div className="min-w-[150px] rounded-2xl border border-cyan-300/20 bg-slate-950/60 p-3 text-right">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Readiness</div>
              <div className="mt-1 text-3xl font-black text-cyan-100">{flowReadiness.score}%</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-all" style={{ width: `${flowReadiness.score}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {flowReadiness.steps.map((step, index) => (
              <div key={step.label} className="relative rounded-2xl border border-white/10 bg-slate-950/55 p-3">
                {index < flowReadiness.steps.length - 1 ? (
                  <div className="absolute -right-2 top-1/2 hidden h-px w-4 bg-cyan-300/30 md:block" />
                ) : null}
                <div className="flex items-start justify-between gap-2">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                    step.ready ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200" : "border-slate-600/50 bg-slate-900 text-slate-500"
                  }`}>
                    <step.Icon className="h-4 w-4" />
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${
                    step.ready ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-800 text-slate-500"
                  }`}>
                    {step.ready ? "ready" : "pendiente"}
                  </span>
                </div>
                <div className="mt-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{step.label}</div>
                <div className="mt-1 line-clamp-1 text-sm font-black text-white">{step.value}</div>
                <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-400">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-violet-400/20 bg-[radial-gradient(circle_at_0%_0%,rgba(168,85,247,.16),transparent_38%),linear-gradient(135deg,rgba(15,23,42,.92),rgba(30,41,59,.52))] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-violet-200">
                <Sparkles className="h-4 w-4" />
                Trivia & market research
              </div>
              <h3 className="mt-1 text-sm font-black text-white">Conocimiento real del cliente por tap</h3>
              <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-400">
                Cada respuesta convierte el producto físico en investigación de mercado: ciudad, producto, interés, educación de marca y puntos emitidos.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-xs font-bold text-violet-100">
              <Gauge className="h-4 w-4" />
              {triviaLoading ? "Cargando trivia" : triviaError ? "Fallback market demo" : "Datos de trivia activos"}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Intentos", value: triviaInsight.summary.attempts, hint: "trivias post-tap", color: "text-violet-200" },
              { label: "Score medio", value: `${triviaInsight.summary.avgScorePct}%`, hint: "conocimiento marca", color: "text-cyan-200" },
              { label: "Puntos emitidos", value: triviaInsight.summary.pointsIssued, hint: "gamificacion", color: "text-emerald-200" },
              { label: "Ciudad lider", value: triviaInsight.summary.topCity || "Sin datos", hint: triviaInsight.summary.topProduct || "producto pendiente", color: "text-amber-200" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-500">{item.label}</div>
                <div className={`mt-2 truncate text-2xl font-black ${item.color}`}>{typeof item.value === "number" ? item.value.toLocaleString("es-AR") : item.value}</div>
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
                  {triviaInsight.questions.length} señales
                </span>
              </div>
              <div className="space-y-2">
                {(triviaInsight.questions.length ? triviaInsight.questions : TRIVIA_FALLBACK.questions).slice(0, 4).map((question, index) => (
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
                        {question.correctRatePct}%
                      </div>
                    </div>
                  </div>
                ))}
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
                {(triviaInsight.cities.length ? triviaInsight.cities : TRIVIA_FALLBACK.cities).slice(0, 4).map((city) => (
                  <button
                    key={city.city}
                    type="button"
                    title={`Usar ${city.city} como segmento de campaña`}
                    onClick={() => {
                      setSelectedCity(city.city === "Sin ciudad" ? "all" : city.city);
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
              </div>
              <p className="mt-3 rounded-xl border border-violet-400/20 bg-violet-400/10 p-3 text-[11px] leading-relaxed text-violet-100">
                {triviaInsight.summary.insight || TRIVIA_FALLBACK.summary.insight}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-900/35 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-white">Plantillas profesionales</h3>
                <p className="text-[11px] text-slate-400">Promos, fidelizacion, recuperacion de confianza y gamificacion.</p>
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
                      <span className="rounded-full bg-emerald-400/10 px-2 py-1 font-bold text-emerald-300">{template.expectedLift}</span>
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
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Ciudad / segmento
                <select
                  title="Filtra la audiencia por ciudad detectada en los taps"
                  value={selectedCity}
                  onChange={(event) => setSelectedCity(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs normal-case tracking-normal text-white outline-none focus:border-cyan-400"
                >
                  <option value="all">Todas las ciudades</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </label>
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
                  title="Número WhatsApp verificado para recibir la prueba"
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
                title="Enviar el preview al WhatsApp configurado"
                onClick={handleSendSandboxWhatsApp}
                disabled={twilioSending || !twilioOptInConfirmed}
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
                disabled={voucherChecking || !voucherCode.trim()}
                onClick={() => handleValidateVoucher("lookup")}
                className="rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-black text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-40"
              >
                Consultar
              </button>
              <button
                type="button"
                title="Marcar el voucher como canjeado después de entregar premio, cena, experiencia o descuento"
                disabled={voucherChecking || !voucherCode.trim()}
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

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <div>
              <h3 className="text-sm font-black text-white">Usuarios accionables del tenant</h3>
              <p className="text-[11px] text-slate-400">Nombre, contacto enmascarado, ciudad, taps, puntos, opt-in y segmento.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-300">
              {filteredAudience.length} perfiles
            </span>
          </div>
          <div className="grid gap-2 p-3 md:hidden">
            {filteredAudience.slice(0, 8).map((member) => (
              <div key={member.consumer_id} className="rounded-2xl border border-white/10 bg-slate-900/45 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white">{member.display_name || "Usuario registrado"}</div>
                    <div className="truncate text-[10px] text-slate-500">{member.email_masked || member.consumer_id.slice(0, 8)}</div>
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
                    <div className="uppercase tracking-wider text-slate-600">Taps</div>
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
                  <th className="px-4 py-2">Taps</th>
                  <th className="px-4 py-2">Puntos</th>
                  <th className="px-4 py-2">Consentimiento</th>
                  <th className="px-4 py-2">Accion</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudience.slice(0, 8).map((member) => (
                  <tr key={member.consumer_id} className="border-t border-white/5 text-slate-300">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">{member.display_name || "Usuario registrado"}</div>
                      <div className="text-[10px] text-slate-500">{member.email_masked || member.consumer_id.slice(0, 8)}</div>
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
        </div>
      </section>

      {/* Tabs Menu */}
      <div className="flex border-b border-white/10 mb-6">
        <button
          type="button"
          title="Ver campañas activas, resultados y recompensas emitidas"
          onClick={() => setActiveTab("campaigns")}
          className={`pb-3 text-sm font-bold border-b-2 px-4 transition-colors flex items-center gap-2 ${
            activeTab === "campaigns" 
              ? "border-cyan-500 text-white" 
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="w-4 h-4 text-cyan-400" />
          Campañas Activas ({campaigns.length})
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
          nexID Cognitive AI Engine
          <span className="absolute -top-1.5 -right-2 px-1.5 py-0.5 text-[8px] bg-purple-600 text-white rounded font-bold uppercase tracking-wider">
            Live
          </span>
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main Column */}
        <div className="space-y-6">
          {activeTab === "campaigns" ? (
            /* Tab 1: Campaigns List */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Listado de Campañas</h2>
                <Button 
                  type="button"
                  title="Abrir el editor IA para crear una nueva campaña"
                  onClick={() => setActiveTab("ai-optimizer")} 
                  variant="secondary"
                  className="gap-2 text-xs py-1.5 border border-purple-500/30 hover:border-purple-500/60"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  Redactar con IA
                </Button>
              </div>

              {/* Promo Banner to AI Optimizer */}
              <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-transparent p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-300">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">nexID Cognitive AI Suite Activo</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Analizá el prestigio, la viralidad de tus borradores y reescribilos al instante con vocabulario Sommelier Premium.
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

              {campaigns.map((camp) => (
                <Card key={camp.id} className="p-5 hover:border-white/20 transition-all duration-300">
                  <div className="flex flex-wrap justify-between items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {camp.status === "RUNNING" && (
                          <span className="inline-flex px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                            ACTIVE
                          </span>
                        )}
                        {camp.status === "DRAFT" && (
                          <span className="inline-flex px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase tracking-wider">
                            DRAFT
                          </span>
                        )}
                        <h3 className="text-base font-bold text-white leading-none">{camp.title}</h3>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                        {camp.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-white">{camp.conversion}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Tasa Conversión</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
                    <span>Enviado: <strong className="text-white">{camp.sentCount.toLocaleString()}</strong></span>
                    <span>Clicks: <strong className="text-white">{camp.clicksCount.toLocaleString()}</strong></span>
                    <span>Recompensas emitidas: <strong className="text-white">{camp.rewardsCount.toLocaleString()}</strong></span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            /* Tab 2: AI Optimizer Workspace */
            <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
              {/* Left Side: Text Editor */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">Redacción de Campaña</h3>
                  <p className="text-xs text-slate-400">Escribí tu propuesta comercial técnica y analizala en tiempo real.</p>
                </div>

                {/* AI provider settings */}
                <div className="rounded-xl border border-purple-500/20 bg-purple-950/5 p-4 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      Motor IA de campañas
                    </span>
                    <span
                      title={optimizerModeDetail}
                      className={`text-[8.5px] font-bold px-2 py-0.5 rounded font-mono ${optimizerIsConfigured ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400 animate-pulse"}`}
                    >
                      {optimizerModeLabel.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    El editor usa el proveedor configurado en el servidor y, solo para pruebas, permite un token local opcional.
                    Sin proveedor activo, no llama modelos externos: usa fallback seguro y scores estimados de copy.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      title="Override opcional para pruebas del editor AI. Se guarda solo en este navegador."
                      placeholder="hf_..."
                      value={hfTokenInput}
                      onChange={(e) => handleSaveToken(e.target.value)}
                      className="flex-1 bg-slate-950/70 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500 transition-colors font-mono"
                    />
                    {hfTokenInput && (
                      <button
                        onClick={() => handleSaveToken("")}
                        title="Eliminar el token Hugging Face guardado en este navegador"
                        className="text-[10px] px-2.5 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition font-bold"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>

                  {/* Model Selector below the token input */}
                  <div className="space-y-1.5 pt-1 border-t border-white/5">
                    <label className="block text-[8px] font-bold uppercase tracking-wider text-slate-400">
                      Modelo LLM
                    </label>
                    <div className="flex flex-col gap-1.5 md:flex-row md:items-center">
                      <select
                        value={selectedModel}
                        title="Modelo solicitado al proveedor LLM cuando el modo IA este activo"
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-200 outline-none focus:border-purple-500 transition-colors cursor-pointer w-full"
                      >
                        <option value="Qwen/Qwen2.5-7B-Instruct">Qwen 2.5 7B Instruct (Recomendado)</option>
                        <option value="google/gemma-2-9b-it">Gemma 2 9B Instruct (Creativo)</option>
                        <option value="meta-llama/Llama-3-8b-instruct">Llama 3 8B Instruct (Comercial)</option>
                        <option value="mistralai/Mistral-7B-Instruct-v0.3">Mistral 7B Instruct (Estándar)</option>
                      </select>
                      
                      <span className="text-[7.5px] text-slate-550 leading-normal font-mono uppercase bg-white/5 px-2 py-1 rounded w-fit shrink-0">
                        {(lastOptimizerModel || serverAiModel || selectedModel).split("/")[0]} Engine
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Nombre de la Campaña
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Cosecha Especial VIP o Lanzamiento Reserva"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>

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
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Cuerpo del Mensaje (Borrador)
                      </label>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {showOptimizedResult ? optimizedText.length : draftText.length} caracteres
                      </span>
                    </div>

                    <div className="relative">
                      {!showOptimizedResult ? (
                        <textarea
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
                      title="Registrar esta campaña en el CRM"
                      onClick={handleCreateCampaign}
                      disabled={!draftText.trim() && !optimizedText.trim()}
                      variant="primary"
                      className="w-full gap-2 text-xs py-2 bg-gradient-to-r from-cyan-400 to-emerald-500 border-none text-slate-950 font-bold shadow-[0_0_20px_rgba(6,182,212,0.2)] disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Registrar y Lanzar Campaña</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right Side: AI Cognitive Analysis Suite */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-purple-400" /> Score de copy y conversion
                  </h3>
                  <p className="text-xs text-slate-400">Estimación local de prestigio, emoción y CTR probable. No es telemetría real de campaña hasta que haya envíos y aperturas medidos.</p>
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
                        <span className="text-sm font-black text-white">{analysis.prestigeScore}%</span>
                        <span className="text-[8px] text-slate-400 uppercase font-bold">Prestigio</span>
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

                  {/* Virality / CTR Meter */}
                  <div className="pt-2 border-t border-white/5 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-purple-400" /> Tasa Click-Through (CTR) Estimada
                      </span>
                      <span className="font-mono text-purple-300 font-black">{analysis.viralityScore}%</span>
                    </div>
                    
                    <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5">
                      <motion.div
                        className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full"
                        animate={{ width: `${analysis.viralityScore}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>

                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>Conversión Estimada: <strong>{analysis.viralityTier}</strong></span>
                      <span>{analysis.viralityScore > 65 ? "🔥 CTR Elevado" : "⏳ Moderado"}</span>
                    </div>
                  </div>

                  {/* Emotion Distribution Breakdown */}
                  <div className="pt-2 border-t border-white/5 space-y-3">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] block">
                      Huella Emocional del Copy
                    </span>

                    <div className="space-y-2.5">
                      {[
                        { name: "Exclusividad / Lujo", value: analysis.emotions.exclusivity, color: "bg-purple-500" },
                        { name: "Confianza / Sello de Origen", value: analysis.emotions.trust, color: "bg-emerald-500" },
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
                <h3 className="text-xs font-black text-white uppercase tracking-wider">BotIA Growth Suite</h3>
                <p className="text-[9px] text-cyan-300 font-bold uppercase tracking-wider">Asistente de Fidelización</p>
              </div>
            </div>
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
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
                placeholder="Preguntale a BotIA..."
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
