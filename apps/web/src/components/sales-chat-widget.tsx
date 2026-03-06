"use client";

import { useMemo, useState } from "react";
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
  },
};

export function SalesChatWidget({ locale }: { locale: AppLocale }) {
  const t = copy[locale] || copy["es-AR"];
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  const readyContact = useMemo(() => fullName.trim().length > 2 && (email.trim().length > 4 || whatsapp.trim().length > 6), [fullName, email, whatsapp]);

  const ask = async (text: string, fromContactForm = false) => {
    if (!text.trim()) return;
    const userText = text.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setLoading(true);

    const payload = {
      locale,
      question: userText,
      fullName,
      email,
      whatsapp,
      mode: fromContactForm ? "lead_capture" : "web_widget",
    };

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { answer?: string } | null;
      const answer = data?.answer || "NexID assistant unavailable. Please try again in a few seconds.";
      setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "NexID assistant unavailable. Please try again in a few seconds." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[70] w-[360px] max-w-[calc(100vw-1.5rem)]">
      {open ? (
        <div className="rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
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
              </div>
            ) : null}
            {messages.map((message, idx) => (
              <div key={`${message.role}-${idx}`} className={`rounded-xl px-3 py-2 text-xs ${message.role === "user" ? "ml-8 bg-blue-500/25 text-blue-100" : "mr-8 border border-white/10 bg-white/5 text-slate-100"}`}>
                {message.text}
              </div>
            ))}
            {loading ? <div className="text-[11px] text-slate-400">Typing...</div> : null}
          </div>

          <div className="space-y-2 border-t border-white/10 p-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.contactName} className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.contactEmail} className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100" />
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder={t.contactWhats} className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-100" />
            </div>
            <button disabled={!readyContact || loading} onClick={() => ask(locale === "en" ? "I want a quote and samples." : locale === "pt-BR" ? "Quero proposta e amostras." : "Quiero cotización y muestras.", true)} className="w-full rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-200 disabled:opacity-40">
              {t.submitLead}
            </button>

            <div className="flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t.placeholder} className="flex-1 rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-100" />
              <button onClick={() => ask(input)} disabled={loading || !input.trim()} className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 py-2 text-xs text-cyan-100 disabled:opacity-40">{t.send}</button>
            </div>
          </div>
        </div>
      ) : null}

      <button onClick={() => setOpen((prev) => !prev)} className="ml-auto flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-500/20 text-2xl shadow-[0_0_30px_rgba(47,225,195,.35)]">
        💬
      </button>
    </div>
  );
}
