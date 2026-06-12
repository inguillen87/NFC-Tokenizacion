"use client";

import React, { useState, useEffect } from "react";
import { Card, Badge, Button } from "@product/ui";
import { 
  Sparkles, 
  TrendingUp, 
  Gauge, 
  FileText, 
  Send, 
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
      "inmutable", "digital", "on-chain", "cofradía", "miembro", "cupo", "asignación"
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
    const trustWords = ["certificado", "garantizado", "origen", "historia", "auténtico", "bodega", "familia", "noble", "calidad", "sello", "trazabilidad", "inmutable"];
    const curWords = ["descubrir", "secreto", "revelar", "misterio", "explorar", "edición", "catar", "mística", "experiencia", "tasting", "on-chain"];
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
      "vino": ["activo físico tokenizado on-chain", "botella respaldada criptográficamente", "gemelo digital de colección"],
      "vinos": ["activos líquidos tokenizados", "coleccionables Web3 auditables", "botellas con pasaporte criptográfico"],
      "rico": ["con trazabilidad inmutable y huella sensorial verificable en la blockchain"],
      "ricos": ["de alto valor de coleccionabilidad y procedencia certificada"],
      "bueno": ["con firma criptográfica inalterable", "certificado on-chain"],
      "barato": ["un valor preferencial de acuñación (minting rate)"],
      "baratos": ["asignaciones inteligentes con fee reducido"],
      "comprar": ["reclamar la propiedad digital (claim)", "transferir al ledger privado", "acuñar el certificado de procedencia"],
      "compra": ["tokenización de propiedad"],
      "club": ["red descentralizada de coleccionistas", "Cofradía Cripto-Sommelier nexID", "DAO de beneficios Web3"],
      "degustar": ["catar y validar on-chain", "desbloquear la experiencia interactiva"],
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
        body: JSON.stringify({ text: draftText, tone: selectedTone }),
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
            optimized = `Gemelo digital verificado nexID: ${optimized} — Registrado inmutablemente on-chain.`;
          } else {
            optimized = `Una propuesta de valor exclusivo nexID: ${optimized} — Reservado para miembros de nuestra Cofradía Privada.`;
          }
        }

        const hasCTA = clean.includes("autentic") || clean.includes("escan") || clean.includes("sumar") || clean.includes("adquirir") || clean.includes("particip") || clean.includes("claim") || clean.includes("reclamar");
        if (!hasCTA) {
          if (selectedTone === "modern-web3") {
            optimized += " Escaneá el chip criptográfico NFC nexID para reclamar la propiedad de tu activo líquido.";
          } else {
            optimized += " Escaneá el chip NFC nexID para activar este beneficio único.";
          }
        }

        setAppliedImprovements(foundImprovements);
        setOptimizedText(optimized);
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
    
    // Back to list
    setActiveTab("campaigns");
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
          prompt: "Asegurá tu botella tokenizada on-chain. Escaneá el chip NFC para reclamar la propiedad digital y recibir airdrops de membresía."
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

      {/* Tabs Menu */}
      <div className="flex border-b border-white/10 mb-6">
        <button
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
                          { id: "modern-web3", label: "Modern Web3", icon: Cpu, desc: "Tokenización on-chain" }
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
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
                              <span className="block text-[9px] uppercase tracking-wider text-purple-400 mb-1 font-bold">Optimizado por AI ({selectedTone})</span>
                              <div className="bg-slate-900/40 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.08)] rounded-xl p-3 text-xs text-white leading-relaxed min-h-[120px]">
                                {optimizedText}
                              </div>
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
                              onClick={() => {
                                setDraftText(optimizedText);
                                setShowOptimizedResult(false);
                              }}
                              className="text-[10px] px-3.5 py-1.5 rounded-lg border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 transition font-bold flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" /> Editar este texto
                            </button>
                            <button
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
                    <Gauge className="w-4 h-4 text-purple-400" /> Telemetría Cognitiva de IA
                  </h3>
                  <p className="text-xs text-slate-400">Indicadores de impacto en tiempo real del copy seleccionado.</p>
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
