"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEventHandler } from "react";
import type { AppLocale } from "@product/config";
import { ProductExitLink } from "./product-exit-link";

type Message = { role: "user" | "assistant"; text: string };
type RealtimeState = "idle" | "connecting" | "live" | "error";

type WidgetCopy = {
  title: string;
  subtitle: string;
  input: string;
  send: string;
  placeholder: string;
  starter: string[];
  contactName: string;
  contactEmail: string;
  contactWhats: string;
  submitLead: string;
  leadError: string;
  leadOk: string;
  voiceStart: string;
  voiceStop: string;
  voiceUnsupported: string;
  toggleOpen: string;
  toggleClose: string;
  audioCall: string;
  realtimeCall: string;
  realtimeConnecting: string;
  realtimeLive: string;
  realtimeError: string;
  realtimeLabel: string;
  openLab: string;
  openSnapshot: string;
  openPricing: string;
  quoteIntent: string;
  demoIntent: string;
  integrateIntent: string;
  resellerIntent: string;
  welcomeMessage: string;
  quickActionsLabel: string;
  intentLabel: string;
  resetChat: string;
  leadReady: string;
  leadMissing: string;
};

const copy: Record<AppLocale, WidgetCopy> = {
  "es-AR": {
    title: "NexID Sales AI",
    subtitle: "215 vs 424 - muestras - cotizacion - reseller",
    input: "Escribi tu consulta",
    send: "Enviar",
    placeholder: "Hola, necesito cotizacion para 50k botellas y tags 424.",
    starter: ["Diferencia entre 215 y 424", "Quiero pedir muestras", "Quiero ser reseller"],
    contactName: "Nombre",
    contactEmail: "Email",
    contactWhats: "WhatsApp",
    submitLead: "Enviar contacto",
    leadError: "Completa nombre y email o WhatsApp.",
    leadOk: "Lead enviado al CRM.",
    voiceStart: "Dictar",
    voiceStop: "Detener",
    voiceUnsupported: "Tu navegador no soporta dictado por voz.",
    toggleOpen: "Cotizar",
    toggleClose: "Cerrar",
    audioCall: "Llamada telefonica",
    realtimeCall: "AI realtime",
    realtimeConnecting: "Conectando voz AI segura...",
    realtimeLive: "AI realtime activo",
    realtimeError: "No pude iniciar voz realtime. Deja contacto y seguimos por CRM.",
    realtimeLabel: "No queres escribir? Hablamos en tiempo real con AI.",
    openLab: "Abrir Demo Lab",
    openSnapshot: "Investor snapshot",
    openPricing: "Ver pricing",
    quoteIntent: "Quiero cotizar",
    demoIntent: "Quiero una demo",
    integrateIntent: "Quiero integrar",
    resellerIntent: "Quiero ser reseller",
    welcomeMessage: "Hola. Puedo ayudarte con pricing, muestras de tags, demo, integracion o canal reseller.",
    quickActionsLabel: "Atajos comerciales",
    intentLabel: "Intenciones rapidas",
    resetChat: "Reiniciar",
    leadReady: "Contacto listo para enviar",
    leadMissing: "Falta contacto para convertir el lead",
  },
  "pt-BR": {
    title: "NexID Sales AI",
    subtitle: "215 vs 424 - amostras - proposta - revenda",
    input: "Escreva sua pergunta",
    send: "Enviar",
    placeholder: "Ola, preciso de proposta para 50k garrafas com tags 424.",
    starter: ["Diferenca entre 215 e 424", "Quero solicitar amostras", "Quero ser revendedor"],
    contactName: "Nome",
    contactEmail: "Email",
    contactWhats: "WhatsApp",
    submitLead: "Enviar contato",
    leadError: "Preencha nome e email ou WhatsApp.",
    leadOk: "Lead enviado ao CRM.",
    voiceStart: "Ditado",
    voiceStop: "Parar",
    voiceUnsupported: "Seu navegador nao suporta ditado por voz.",
    toggleOpen: "Cotar",
    toggleClose: "Fechar",
    audioCall: "Ligacao telefonica",
    realtimeCall: "AI realtime",
    realtimeConnecting: "Conectando voz AI segura...",
    realtimeLive: "AI realtime ativo",
    realtimeError: "Nao consegui iniciar voz realtime. Deixe contato e seguimos pelo CRM.",
    realtimeLabel: "Prefere nao digitar? Vamos em tempo real com AI.",
    openLab: "Abrir Demo Lab",
    openSnapshot: "Investor snapshot",
    openPricing: "Ver pricing",
    quoteIntent: "Quero cotar",
    demoIntent: "Quero uma demo",
    integrateIntent: "Quero integrar",
    resellerIntent: "Quero ser revendedor",
    welcomeMessage: "Ola. Posso ajudar com proposta, amostras, demo, integracao ou canal de revenda.",
    quickActionsLabel: "Atalhos comerciais",
    intentLabel: "Intencoes rapidas",
    resetChat: "Reiniciar",
    leadReady: "Contato pronto para envio",
    leadMissing: "Ainda falta contato para converter o lead",
  },
  en: {
    title: "NexID Sales AI",
    subtitle: "215 vs 424 - samples - quote - reseller",
    input: "Ask your question",
    send: "Send",
    placeholder: "Hi, I need a quote for 50k bottles with 424 tags.",
    starter: ["Difference between 215 and 424", "I want sample tags", "I want to become a reseller"],
    contactName: "Name",
    contactEmail: "Email",
    contactWhats: "WhatsApp",
    submitLead: "Submit contact",
    leadError: "Fill name and email or WhatsApp.",
    leadOk: "Lead submitted to CRM.",
    voiceStart: "Dictate",
    voiceStop: "Stop",
    voiceUnsupported: "Your browser does not support voice dictation.",
    toggleOpen: "Quote",
    toggleClose: "Close",
    audioCall: "Phone call",
    realtimeCall: "Realtime AI",
    realtimeConnecting: "Connecting secure AI voice...",
    realtimeLive: "Realtime AI is live",
    realtimeError: "Could not start realtime voice. Leave contact details and CRM will continue.",
    realtimeLabel: "Don't want to type? Talk with realtime AI.",
    openLab: "Open Demo Lab",
    openSnapshot: "Investor snapshot",
    openPricing: "View pricing",
    quoteIntent: "I want pricing",
    demoIntent: "I want a demo",
    integrateIntent: "I want to integrate",
    resellerIntent: "I want to become a reseller",
    welcomeMessage: "Hi. I can help with pricing, sample tags, demos, integrations, or reseller onboarding.",
    quickActionsLabel: "Sales shortcuts",
    intentLabel: "Quick intents",
    resetChat: "Reset",
    leadReady: "Contact is ready to submit",
    leadMissing: "Contact info still needed to capture the lead",
  },
};

function extractEmail(text: string) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.trim() || "";
}

function extractPhone(text: string) {
  const match = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  return match?.[0]?.replace(/\s+/g, " ").trim() || "";
}

function resolveIntentFromQuery(value: string | null, t: WidgetCopy) {
  if (!value) return "";
  const normalized = value.toLowerCase();
  if (normalized === "quote" || normalized === "pricing") return t.quoteIntent;
  if (normalized === "demo") return t.demoIntent;
  if (normalized === "integrate" || normalized === "integration") return t.integrateIntent;
  if (normalized === "reseller" || normalized === "channel") return t.resellerIntent;
  return "";
}

function resolveDictationLanguage(locale: AppLocale) {
  if (locale === "pt-BR") return "pt-BR";
  if (locale === "en") return "en-US";
  return "es-AR";
}

export function SalesChatWidget({ locale, deferUntilScroll = false }: { locale: AppLocale; deferUntilScroll?: boolean }) {
  const t = copy[locale] || copy["es-AR"];
  const [isAvailable, setIsAvailable] = useState(!deferUntilScroll);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [leadState, setLeadState] = useState<"idle" | "ok" | "error">("idle");
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "unsupported">("idle");
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("idle");
  const [bootIntent, setBootIntent] = useState("");
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!deferUntilScroll || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("assistant") === "open" || params.get("assistant_intent")) {
      setIsAvailable(true);
      return;
    }

    const revealOffset = Math.max(900, window.innerHeight * 1.25);
    const reveal = () => {
      if (window.scrollY < revealOffset) return;
      setIsAvailable(true);
      window.removeEventListener("scroll", reveal);
    };

    reveal();
    window.addEventListener("scroll", reveal, { passive: true });
    return () => window.removeEventListener("scroll", reveal);
  }, [deferUntilScroll]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const shouldOpen = params.get("assistant") === "open";
    const intentFromQuery = resolveIntentFromQuery(params.get("assistant_intent"), t);
    if (shouldOpen) setOpen(true);
    if (intentFromQuery) {
      setBootIntent(intentFromQuery);
      setOpen(true);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    setMessages((prev) => (prev.length === 0 ? [{ role: "assistant", text: t.welcomeMessage }] : prev));
  }, [open, t.welcomeMessage]);

  const readyContact = useMemo(() => fullName.trim().length > 2 && (email.trim().length > 4 || whatsapp.trim().length > 6), [fullName, email, whatsapp]);

  async function saveLeadDirect(message: string, mode = "sales_chat_widget") {
    if (!readyContact) return false;
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale,
        name: fullName.trim(),
        email: email.trim(),
        whatsapp: whatsapp.trim(),
        contact: [fullName, email, whatsapp].map((item) => item.trim()).filter(Boolean).join(" | "),
        source: mode,
        role_interest: mode === "realtime_ai" ? "private_meeting_realtime_ai" : "commercial_quote",
        tag_type: "secure",
        message,
        notes: `assistant_mode=${mode}`,
      }),
      cache: "no-store",
    }).catch(() => null);
    return Boolean(response?.ok);
  }

  const ask = async (text: string, fromContactForm = false) => {
    if (!text.trim()) return;
    const userText = text.trim();
    setInput("");
    setLeadState("idle");

    const inferredEmail = email || extractEmail(userText);
    const inferredPhone = whatsapp || extractPhone(userText);
    if (!email && inferredEmail) setEmail(inferredEmail);
    if (!whatsapp && inferredPhone) setWhatsapp(inferredPhone);

    const nextMessages = [...messages, { role: "user" as const, text: userText }];
    setMessages(nextMessages);
    setLoading(true);

    const payload = {
      locale,
      question: userText,
      fullName,
      email: inferredEmail,
      whatsapp: inferredPhone,
      mode: fromContactForm ? "lead_capture" : "web_widget",
      history: messages.slice(-8),
    };

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { answer?: string; leadSaved?: boolean } | null;
      const answer = data?.answer || t.realtimeError;
      setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
      if (data?.leadSaved) setLeadState("ok");
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: t.realtimeError }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !bootIntent || messages.length > 1 || loading) return;
    void ask(bootIntent);
    setBootIntent("");
    // ask intentionally stays outside deps because this effect only consumes URL boot intent once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootIntent, loading, messages.length, open]);

  const sendLead = () => {
    if (!readyContact || loading) {
      setLeadState("error");
      return;
    }
    const scriptedMessage = locale === "en"
      ? `I need quote, samples or a private meeting. Name: ${fullName}. Email: ${email}. WhatsApp: ${whatsapp}.`
      : locale === "pt-BR"
        ? `Quero proposta, amostras ou reuniao privada. Nome: ${fullName}. Email: ${email}. WhatsApp: ${whatsapp}.`
        : `Quiero cotizacion, muestras o reunion privada. Nombre: ${fullName}. Email: ${email}. WhatsApp: ${whatsapp}.`;
    void ask(scriptedMessage, true);
  };

  const stopRealtime = () => {
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
    audioRef.current = null;
    setRealtimeState("idle");
  };

  useEffect(() => () => stopRealtime(), []);

  const startRealtime = async () => {
    if (realtimeState === "connecting" || realtimeState === "live") {
      stopRealtime();
      return;
    }

    try {
      setRealtimeState("connecting");
      if (readyContact) {
        await saveLeadDirect("Solicitud de soporte AI realtime y reunion privada desde Cotizar.", "realtime_ai");
      }

      const peer = new RTCPeerConnection();
      peerRef.current = peer;

      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      peer.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) {
          audio.srcObject = remoteStream;
          void audio.play().catch(() => null);
        }
      };

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = localStream;
      for (const track of localStream.getAudioTracks()) peer.addTrack(track, localStream);

      const channel = peer.createDataChannel("oai-events");
      channel.addEventListener("open", () => {
        const contactContext = [
          fullName ? `Nombre: ${fullName}` : "",
          email ? `Email: ${email}` : "",
          whatsapp ? `WhatsApp: ${whatsapp}` : "",
        ].filter(Boolean).join(". ");
        const intro = locale === "en"
          ? `The visitor opened realtime sales support. ${contactContext}`
          : locale === "pt-BR"
            ? `O visitante abriu suporte comercial em tempo real. ${contactContext}`
            : `El visitante abrio soporte comercial en tiempo real. ${contactContext}`;
        channel.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: intro }],
          },
        }));
        channel.send(JSON.stringify({ type: "response.create" }));
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch("/api/realtime/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
          "X-Nexid-Locale": locale,
        },
        body: offer.sdp || "",
      });
      if (!response.ok) throw new Error(await response.text());
      const answerSdp = await response.text();
      await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
      setRealtimeState("live");
      setMessages((prev) => [...prev, { role: "assistant", text: t.realtimeLive }]);
    } catch {
      stopRealtime();
      setRealtimeState("error");
      setMessages((prev) => [...prev, { role: "assistant", text: t.realtimeError }]);
    }
  };

  const startVoice = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
      webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
    };
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceState("unsupported");
      return;
    }

    const rec = new Recognition();
    rec.lang = resolveDictationLanguage(locale);
    rec.interimResults = false;
    setVoiceState("listening");
    rec.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript) setInput((prev) => `${prev} ${transcript}`.trim());
    };
    rec.onend = () => setVoiceState("idle");
    rec.start();

    setTimeout(() => {
      try { rec.stop(); } catch {}
    }, 7000);
  };

  const onInputKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask(input);
    }
  };

  const resetChat = () => {
    stopRealtime();
    setMessages([{ role: "assistant", text: t.welcomeMessage }]);
    setInput("");
    setLeadState("idle");
  };

  const realtimeButtonLabel =
    realtimeState === "connecting" ? t.realtimeConnecting :
    realtimeState === "live" ? "Cortar AI" :
    t.realtimeCall;

  if (!isAvailable) return null;

  return (
    <div className={`sales-widget-root fixed z-[38] md:bottom-4 md:left-4 md:right-auto md:z-[70] md:max-w-[calc(100vw-1.5rem)] ${open ? "bottom-4 left-3 right-3 w-auto md:w-[390px]" : "bottom-4 right-4 w-auto"}`}>
      {open ? (
        <div className="sales-widget-panel rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">{t.title}</p>
              <p className="text-[11px] text-cyan-300">{t.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <button suppressHydrationWarning type="button" onClick={resetChat} className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-300">{t.resetChat}</button>
              <button suppressHydrationWarning onClick={() => setOpen(false)} className="rounded-md border border-white/20 px-2 py-1 text-xs text-slate-300">x</button>
            </div>
          </div>

          <div className="max-h-[46vh] space-y-2 overflow-y-auto p-3 md:max-h-[42vh]">
            {messages.length <= 1 ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t.quickActionsLabel}</p>
                  <div className="mt-2 space-y-2">
                    {t.starter.map((q) => (
                      <button suppressHydrationWarning key={q} onClick={() => ask(q)} className="w-full rounded-lg border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-left text-xs text-cyan-100">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t.intentLabel}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[t.quoteIntent, t.demoIntent, t.integrateIntent, t.resellerIntent].map((intent) => (
                      <button suppressHydrationWarning key={intent} onClick={() => ask(intent)} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-left text-xs text-slate-200">
                        {intent}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <ProductExitLink kind="demoLab" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-left text-xs text-slate-200">{t.openLab}</ProductExitLink>
                  <ProductExitLink kind="investorSnapshot" className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-100">{t.openSnapshot}</ProductExitLink>
                  <a href="/pricing" className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-left text-xs text-emerald-100">{t.openPricing}</a>
                </div>
              </div>
            ) : null}
            {messages.map((message, idx) => (
              <div key={`${message.role}-${idx}`} className={`sales-msg whitespace-pre-wrap rounded-xl px-3 py-2 text-xs ${message.role === "user" ? "sales-msg-user ml-8 bg-blue-500/25 text-blue-100" : "sales-msg-ai mr-8 border border-white/10 bg-white/5 text-slate-100"}`}>
                {message.text}
              </div>
            ))}
            {loading ? <div className="sales-typing text-[11px] text-slate-400">Typing...</div> : null}
          </div>

          <div className="space-y-2 border-t border-white/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="sales-realtime-label text-[11px] text-slate-300">{t.realtimeLabel}</p>
              <span className={`rounded-full border px-2 py-1 text-[10px] ${readyContact ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/5 text-slate-400"}`}>
                {readyContact ? t.leadReady : t.leadMissing}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a href="tel:+5492613168608" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-center text-xs text-cyan-100">{t.audioCall}</a>
              <button suppressHydrationWarning type="button" onClick={startRealtime} disabled={realtimeState === "connecting"} className="rounded-lg border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-center text-xs text-violet-100 disabled:opacity-60">{realtimeButtonLabel}</button>
            </div>
            {realtimeState === "live" ? <p className="text-[11px] text-emerald-300">{t.realtimeLive}</p> : null}
            {realtimeState === "error" ? <p className="text-[11px] text-rose-300">{t.realtimeError}</p> : null}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <input suppressHydrationWarning value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.contactName} className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-400" />
              <input suppressHydrationWarning value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.contactEmail} className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-400" />
              <input suppressHydrationWarning value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder={t.contactWhats} className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-400" />
            </div>
            <button suppressHydrationWarning disabled={loading} onClick={sendLead} className="w-full rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-200 disabled:opacity-40">
              {t.submitLead}
            </button>
            {leadState === "error" ? <p className="text-[11px] text-rose-300">{t.leadError}</p> : null}
            {leadState === "ok" ? <p className="text-[11px] text-emerald-300">{t.leadOk}</p> : null}

            <div className="flex gap-2">
              <input suppressHydrationWarning value={input} onKeyDown={onInputKeyDown} onChange={(e) => setInput(e.target.value)} placeholder={t.placeholder} className="flex-1 rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-400" aria-label={t.input} />
              <button suppressHydrationWarning type="button" onClick={startVoice} className="sales-voice-btn rounded-lg border border-violet-300/30 bg-violet-500/15 px-3 py-2 text-xs text-violet-100">{voiceState === "listening" ? t.voiceStop : t.voiceStart}</button>
              <button suppressHydrationWarning onClick={() => ask(input)} disabled={loading || !input.trim()} className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-2 text-xs text-cyan-100 disabled:opacity-40">{t.send}</button>
            </div>
            {voiceState === "unsupported" ? <p className="text-[11px] text-amber-300">{t.voiceUnsupported}</p> : null}
          </div>
        </div>
      ) : null}

      <button
        suppressHydrationWarning
        onClick={() => setOpen((prev) => !prev)}
        className="helpbot-toggle sales-widget-toggle ml-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-300/40 bg-slate-950/95 px-4 py-2 text-sm font-semibold text-cyan-200 shadow-[0_0_24px_rgba(47,225,195,.24)]"
      >
        <span aria-hidden className="sales-widget-dot" />
        <span>{open ? t.toggleClose : t.toggleOpen}</span>
      </button>
    </div>
  );
}
