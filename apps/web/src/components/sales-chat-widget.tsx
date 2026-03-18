"use client";

import { useEffect, useMemo, useState, type KeyboardEventHandler } from "react";
import type { AppLocale } from "@product/config";

type Message = { role: "user" | "assistant"; text: string };

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
  videoCall: string;
  realtimeLabel: string;
  openLab: string;
  openSnapshot: string;
  openPricing: string;
};

const copy: Record<AppLocale, WidgetCopy> = {
  "es-AR": {
    title: "NexID Sales AI",
    subtitle: "215 vs 424 · samples · cotización · reseller",
    input: "Escribí tu consulta",
    send: "Enviar",
    placeholder: "Hola, necesito cotización para 50k botellas y tags 424.",
    starter: ["Diferencia entre 215 y 424", "Quiero pedir muestras", "Quiero ser reseller"],
    contactName: "Nombre",
    contactEmail: "Email",
    contactWhats: "WhatsApp",
    submitLead: "Enviar contacto",
    leadError: "Completá nombre y email o WhatsApp.",
    leadOk: "Lead enviado al CRM.",
    voiceStart: "Hablar",
    voiceStop: "Detener",
    voiceUnsupported: "Tu navegador no soporta dictado por voz.",
    toggleOpen: "Cotizar",
    toggleClose: "Cerrar",
    audioCall: "Llamada telefónica",
    videoCall: "Videollamada",
    realtimeLabel: "¿No querés escribir? Hablamos en tiempo real.",
    openLab: "Abrir Demo Lab",
    openSnapshot: "Investor snapshot",
    openPricing: "Ver pricing",
  },
  "pt-BR": {
    title: "NexID Sales AI",
    subtitle: "215 vs 424 · amostras · proposta · revenda",
    input: "Escreva sua pergunta",
    send: "Enviar",
    placeholder: "Olá, preciso de proposta para 50k garrafas com tags 424.",
    starter: ["Diferença entre 215 e 424", "Quero solicitar amostras", "Quero ser revendedor"],
    contactName: "Nome",
    contactEmail: "Email",
    contactWhats: "WhatsApp",
    submitLead: "Enviar contato",
    leadError: "Preencha nome e email ou WhatsApp.",
    leadOk: "Lead enviado ao CRM.",
    voiceStart: "Falar",
    voiceStop: "Parar",
    voiceUnsupported: "Seu navegador não suporta ditado por voz.",
    toggleOpen: "Cotar",
    toggleClose: "Fechar",
    audioCall: "Ligação telefônica",
    videoCall: "Videochamada",
    realtimeLabel: "Prefere não digitar? Vamos em tempo real.",
    openLab: "Abrir Demo Lab",
    openSnapshot: "Investor snapshot",
    openPricing: "Ver pricing",
  },
  en: {
    title: "NexID Sales AI",
    subtitle: "215 vs 424 · samples · quote · reseller",
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
    voiceStart: "Speak",
    voiceStop: "Stop",
    voiceUnsupported: "Your browser does not support voice dictation.",
    toggleOpen: "Quote",
    toggleClose: "Close",
    audioCall: "Phone call",
    videoCall: "Video call",
    realtimeLabel: "Don't want to type? Let's talk in real time.",
    openLab: "Open Demo Lab",
    openSnapshot: "Investor snapshot",
    openPricing: "View pricing",
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

export function SalesChatWidget({ locale }: { locale: AppLocale }) {
  const t = copy[locale] || copy["es-AR"];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [leadState, setLeadState] = useState<"idle" | "ok" | "error">("idle");
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "unsupported">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("assistant") === "open") setOpen(true);
  }, []);

  const readyContact = useMemo(() => fullName.trim().length > 2 && (email.trim().length > 4 || whatsapp.trim().length > 6), [fullName, email, whatsapp]);

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
      const answer = data?.answer || "NexID assistant unavailable. Please try again in a few seconds.";
      setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
      if (data?.leadSaved) setLeadState("ok");
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "NexID assistant unavailable. Please try again in a few seconds." }]);
    } finally {
      setLoading(false);
    }
  };

  const sendLead = () => {
    if (!readyContact || loading) {
      setLeadState("error");
      return;
    }
    const scriptedMessage = locale === "en"
      ? `I need quote and samples. Name: ${fullName}. Email: ${email}. WhatsApp: ${whatsapp}.`
      : locale === "pt-BR"
        ? `Quero proposta e amostras. Nome: ${fullName}. Email: ${email}. WhatsApp: ${whatsapp}.`
        : `Quiero cotización y muestras. Nombre: ${fullName}. Email: ${email}. WhatsApp: ${whatsapp}.`;
    void ask(scriptedMessage, true);
  };

  const startVoice = () => {
    const w = window as unknown as { SpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }; webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void } };
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceState("unsupported");
      return;
    }

    const rec = new Recognition();
    rec.lang = locale === "pt-BR" ? "pt-BR" : locale === "en" ? "en-US" : "es-AR";
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

  return (
    <div className="fixed bottom-4 right-4 z-[70] w-[360px] max-w-[calc(100vw-1.5rem)]">
      {open ? (
        <div className="sales-widget-panel rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">{t.title}</p>
              <p className="text-[11px] text-cyan-300">{t.subtitle}</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-md border border-white/20 px-2 py-1 text-xs text-slate-300">✕</button>
          </div>

          <div className="max-h-[42vh] space-y-2 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="space-y-2">
                {t.starter.map((q) => (
                  <button key={q} onClick={() => ask(q)} className="w-full rounded-lg border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-left text-xs text-cyan-100">
                    {q}
                  </button>
                ))}
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <a href={`${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://app.nexid.lat"}/demo-lab`} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-left text-xs text-slate-200">{t.openLab}</a>
                  <a href={`${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://app.nexid.lat"}/investor-snapshot`} className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-100">{t.openSnapshot}</a>
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
            <p className="sales-realtime-label text-[11px] text-slate-300">{t.realtimeLabel}</p>
            <div className="grid grid-cols-2 gap-2">
              <a href="tel:+5492613168608" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-center text-xs text-cyan-100">{t.audioCall}</a>
              <a href="https://meet.jit.si/nexid-realtime-support" target="_blank" rel="noreferrer" className="rounded-lg border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-center text-xs text-violet-100">{t.videoCall}</a>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.contactName} className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-400" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.contactEmail} className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-400" />
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder={t.contactWhats} className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-400" />
            </div>
            <button disabled={loading} onClick={sendLead} className="w-full rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-200 disabled:opacity-40">
              {t.submitLead}
            </button>
            {leadState === "error" ? <p className="text-[11px] text-rose-300">{t.leadError}</p> : null}
            {leadState === "ok" ? <p className="text-[11px] text-emerald-300">{t.leadOk}</p> : null}

            <div className="flex gap-2">
              <input value={input} onKeyDown={onInputKeyDown} onChange={(e) => setInput(e.target.value)} placeholder={t.placeholder} className="flex-1 rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-400" />
              <button type="button" onClick={startVoice} className="sales-voice-btn rounded-lg border border-violet-300/30 bg-violet-500/15 px-3 py-2 text-xs text-violet-100">{voiceState === "listening" ? t.voiceStop : t.voiceStart}</button>
              <button onClick={() => ask(input)} disabled={loading || !input.trim()} className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-2 text-xs text-cyan-100 disabled:opacity-40">{t.send}</button>
            </div>
            {voiceState === "unsupported" ? <p className="text-[11px] text-amber-300">{t.voiceUnsupported}</p> : null}
          </div>
        </div>
      ) : null}

      <button
        onClick={() => setOpen((prev) => !prev)}
        className="helpbot-toggle sales-widget-toggle ml-auto inline-flex min-h-12 items-center gap-2 rounded-full border border-cyan-300/40 bg-slate-950/95 px-4 py-2 text-sm font-semibold text-cyan-200 shadow-[0_0_24px_rgba(47,225,195,.24)]"
      >
        <span aria-hidden>💬</span>
        <span>{open ? t.toggleClose : t.toggleOpen}</span>
      </button>
    </div>
  );
}
