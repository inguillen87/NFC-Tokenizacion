"use client";

import { useMemo, useState } from "react";
import { BrandDot } from "./brand";

type Locale = "es-AR" | "pt-BR" | "en";

type Props = {
  locale?: Locale;
  mode?: "sales" | "support";
  className?: string;
};

type AssistantReply = {
  answer?: string;
  intent?: string;
  requiresContact?: boolean;
  citations?: Array<{ title?: string; slug?: string; locale?: string }>;
};

const copy: Record<
  Locale,
  {
    title: string;
    placeholder: string;
    open: string;
    close: string;
    send: string;
    leadPrompt: string;
    fullNameLabel: string;
    emailLabel: string;
    whatsappLabel: string;
    roleUser: string;
    roleAi: string;
    typing: string;
    unavailable: string;
    quick: string[];
    ctaSchedule: string;
    ctaWhatsApp: string;
    contactRequired: string;
    sendLead: string;
    leadSuccess: string;
  }
> = {
  "es-AR": {
    title: "nexID Assistant",
    placeholder: "Preguntame sobre batches, precios, reseller, SUN/SDM o seguridad...",
    open: "Abrir asistente",
    close: "Cerrar",
    send: "Enviar",
    leadPrompt: "Te ayudo a cotizar y elegir plan. Si querés propuesta hoy, dejá tus datos.",
    fullNameLabel: "Nombre completo",
    emailLabel: "Email",
    whatsappLabel: "WhatsApp",
    roleUser: "Vos",
    roleAi: "AI",
    typing: "Escribiendo…",
    unavailable: "No pude conectar con API. Probá de nuevo en unos segundos.",
    quick: ["¿Qué es un batch?", "Quiero cotizar 10k", "Quiero ser reseller"],
    ctaSchedule: "Agendar demo",
    ctaWhatsApp: "Enviar mensaje",
    contactRequired: "Para enviar cotización necesitamos nombre completo y al menos email o WhatsApp.",
    sendLead: "Enviar lead",
    leadSuccess: "Perfecto. Lead enviado. El equipo comercial te contacta hoy / 24h.",
  },
  "pt-BR": {
    title: "nexID Assistant",
    placeholder: "Pergunte sobre batches, preços, reseller, SUN/SDM ou segurança...",
    open: "Abrir assistente",
    close: "Fechar",
    send: "Enviar",
    leadPrompt: "Posso ajudar com cotação e plano ideal. Para proposta hoje, deixe seus dados.",
    fullNameLabel: "Nome completo",
    emailLabel: "Email",
    whatsappLabel: "WhatsApp",
    roleUser: "Você",
    roleAi: "AI",
    typing: "Escrevendo…",
    unavailable: "Não consegui conectar com a API. Tente novamente em alguns segundos.",
    quick: ["O que é um batch?", "Quero cotar 10k", "Quero ser reseller"],
    ctaSchedule: "Agendar demo",
    ctaWhatsApp: "Enviar mensagem",
    contactRequired: "Para enviar proposta precisamos nome completo e pelo menos email ou WhatsApp.",
    sendLead: "Enviar lead",
    leadSuccess: "Perfeito. Lead enviado. Nosso time comercial responde hoje / em 24h.",
  },
  en: {
    title: "nexID Assistant",
    placeholder: "Ask about batches, pricing, reseller, SUN/SDM, or security...",
    open: "Open assistant",
    close: "Close",
    send: "Send",
    leadPrompt: "I can guide plans and pricing. Leave your details to get a proposal today.",
    fullNameLabel: "Full name",
    emailLabel: "Email",
    whatsappLabel: "WhatsApp",
    roleUser: "You",
    roleAi: "AI",
    typing: "Typing…",
    unavailable: "Could not reach the API right now. Please try again in a few seconds.",
    quick: ["What is a batch?", "I need a 10k quote", "I want to be a reseller"],
    ctaSchedule: "Book demo",
    ctaWhatsApp: "Send message",
    contactRequired: "To request a quote we need full name and at least email or WhatsApp.",
    sendLead: "Send lead",
    leadSuccess: "Great. Lead sent. Sales team will contact you today / within 24h.",
  },
};

export function HelpBot({ locale = "es-AR", mode = "sales", className }: Props) {
  const t = copy[locale] || copy["es-AR"];
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: t.leadPrompt },
  ]);
  const [requiresContact, setRequiresContact] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const hasContact = email.trim().length > 3 || whatsapp.trim().length > 5;
  const leadReady = fullName.trim().length > 3 && hasContact;

  const shouldShowSalesCta = useMemo(() => {
    const latest = [...messages].reverse().find((item) => item.role === "assistant")?.text || "";
    return /cotiz|quote|reseller|pedido|order|buy|compr/i.test(latest);
  }, [messages]);

  async function send(raw?: string) {
    const content = (raw ?? question).trim();
    if (!content || busy) return;

    setQuestion("");
    setRequiresContact(false);
    setMessages((prev) => [...prev, { role: "user", text: content }]);
    setBusy(true);

    const contact = [email.trim(), whatsapp.trim()].filter(Boolean).join(" | ");

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, question: content, mode, fullName, email, whatsapp, contact }),
      });

      const data: AssistantReply = await res.json().catch(() => ({}));
      const baseText = data.answer || (res.ok ? "..." : t.unavailable);
      const citations = (data.citations || [])
        .map((item) => item?.slug || item?.title)
        .filter(Boolean)
        .slice(0, 3)
        .join(" · ");
      const withCitations = citations ? `${baseText}\n\nKB: ${citations}` : baseText;
      const withPrompt = data.intent === "pricing" || data.intent === "reseller" ? `${withCitations}\n\n${t.leadPrompt}` : withCitations;
      setRequiresContact(Boolean(data.requiresContact));
      setMessages((prev) => [...prev, { role: "assistant", text: withPrompt }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: t.unavailable }]);
    } finally {
      setBusy(false);
    }
  }

  async function sendLead() {
    if (!leadReady || busy) {
      setRequiresContact(true);
      return;
    }

    const prompt = locale === "pt-BR"
      ? `Quero proposta comercial. Nome: ${fullName}. Email: ${email}. WhatsApp: ${whatsapp}.`
      : locale === "en"
      ? `I want a commercial proposal. Full name: ${fullName}. Email: ${email}. WhatsApp: ${whatsapp}.`
      : `Quiero propuesta comercial. Nombre completo: ${fullName}. Email: ${email}. WhatsApp: ${whatsapp}.`;

    await send(prompt);
    setMessages((prev) => [...prev, { role: "assistant", text: t.leadSuccess }]);
  }

  return (
    <div className={className}>
      <button className="helpbot-surface fixed bottom-5 right-5 z-[90] inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-slate-950/95 px-4 py-2 text-sm text-cyan-200" onClick={() => setOpen((v) => !v)}>
        <BrandDot size={10} variant="ripple" theme="dark" />
        {open ? t.close : t.open}
      </button>

      {open ? (
        <div className="helpbot-surface fixed bottom-20 right-5 z-[95] w-[360px] rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
          <p className="helpbot-text text-sm font-semibold text-white">{t.title}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {t.quick.map((q) => (
              <button key={q} onClick={() => send(q)} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-100">
                {q}
              </button>
            ))}
          </div>

          <div className="helpbot-input mt-3 max-h-72 space-y-2 overflow-auto rounded-xl border border-white/10 bg-white/5 p-2 text-xs">
            {messages.map((m, idx) => (
              <div key={idx} className={m.role === "user" ? "helpbot-user text-cyan-300" : "helpbot-text text-slate-200"}>
                {m.role === "user" ? t.roleUser : t.roleAi}: {m.text}
              </div>
            ))}
            {busy ? <div className="helpbot-muted text-slate-400">{t.typing}</div> : null}
          </div>

          {shouldShowSalesCta ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <a href="/pricing" className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-center text-xs text-cyan-200">{t.ctaSchedule}</a>
              <a href="https://wa.me/5492613168608" target="_blank" rel="noreferrer" className="rounded-lg border border-white/20 px-3 py-2 text-center text-xs text-slate-200">{t.ctaWhatsApp}</a>
            </div>
          ) : null}

          {requiresContact ? (
            <div className="mt-2 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              {t.contactRequired}
            </div>
          ) : null}

          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="helpbot-input mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs" placeholder={t.fullNameLabel} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="helpbot-input w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs" placeholder={t.emailLabel} />
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="helpbot-input w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs" placeholder={t.whatsappLabel} />
          </div>

          <button onClick={sendLead} disabled={busy || !leadReady} className="mt-2 w-full rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50">
            {t.sendLead}
          </button>

          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} className="helpbot-input mt-2 min-h-20 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs" placeholder={t.placeholder} />
          <button onClick={() => send()} disabled={busy} className="mt-2 w-full rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">
            {t.send}
          </button>
        </div>
      ) : null}
    </div>
  );
}
