"use client";

import { useState } from "react";
import { BrandDot } from "./brand";

type Props = {
  locale?: "es-AR" | "pt-BR" | "en";
  mode?: "sales" | "support";
  className?: string;
};

const copy = {
  "es-AR": {
    title: "nexID Assistant",
    placeholder: "Preguntame sobre batches, precios, reseller o seguridad...",
    open: "Abrir asistente",
    close: "Cerrar",
    send: "Enviar",
    leadPrompt: "¿Querés cotizar? Dejá email o WhatsApp.",
  },
  "pt-BR": {
    title: "nexID Assistant",
    placeholder: "Pergunte sobre batches, preços, reseller ou segurança...",
    open: "Abrir assistente",
    close: "Fechar",
    send: "Enviar",
    leadPrompt: "Quer cotação? Deixe email ou WhatsApp.",
  },
  en: {
    title: "nexID Assistant",
    placeholder: "Ask about batches, pricing, reseller, or security...",
    open: "Open assistant",
    close: "Close",
    send: "Send",
    leadPrompt: "Want a quote? Leave email or WhatsApp.",
  },
};

export function HelpBot({ locale = "es-AR", mode = "sales", className }: Props) {
  const t = copy[locale] || copy["es-AR"];
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([{ role: "assistant", text: t.leadPrompt }]);
  const [contact, setContact] = useState("");

  async function send() {
    if (!question.trim()) return;
    const q = question;
    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);

    const res = await fetch("/api/assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, question: q, mode, contact }),
    });
    const data = await res.json().catch(() => ({ answer: "No response" }));
    setMessages((prev) => [...prev, { role: "assistant", text: data.answer || "..." }]);
  }

  return (
    <div className={className}>
      <button className="fixed bottom-5 right-5 z-[90] inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-slate-950/95 px-4 py-2 text-sm text-cyan-200" onClick={() => setOpen((v) => !v)}>
        <BrandDot size={10} variant="ripple" theme="dark" />
        {open ? t.close : t.open}
      </button>

      {open ? (
        <div className="fixed bottom-20 right-5 z-[95] w-[360px] rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
          <p className="text-sm font-semibold text-white">{t.title}</p>
          <div className="mt-3 max-h-72 space-y-2 overflow-auto rounded-xl border border-white/10 bg-white/5 p-2 text-xs">
            {messages.map((m, idx) => (
              <div key={idx} className={m.role === "user" ? "text-cyan-300" : "text-slate-200"}>{m.role === "user" ? "You" : "AI"}: {m.text}</div>
            ))}
          </div>
          <input value={contact} onChange={(e) => setContact(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs" placeholder="email / whatsapp" />
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} className="mt-2 min-h-20 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs" placeholder={t.placeholder} />
          <button onClick={send} className="mt-2 w-full rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">{t.send}</button>
        </div>
      ) : null}
    </div>
  );
}
