"use client";

import { useState } from "react";
import type { AppLocale } from "@product/config";
import { Button, Card, SectionHeading } from "@product/ui";

type LeadForm = {
  name: string;
  contact: string;
  company: string;
  country: string;
  vertical: string;
  volume: string;
  notes: string;
};

const copy: Record<AppLocale, {
  eyebrow: string;
  title: string;
  description: string;
  submit: string;
  sent: string;
  error: string;
  fields: Record<keyof LeadForm, string>;
}> = {
  "es-AR": {
    eyebrow: "Agendar demo",
    title: "Coordinemos una demo y guardemos tu caso en el super admin",
    description: "Completá tus datos y te contactamos con el pack correcto (vino, eventos, cosmética, agro o pharma).",
    submit: "Enviar solicitud",
    sent: "Solicitud enviada. Tu lead quedó registrado para seguimiento comercial.",
    error: "No se pudo enviar ahora. Intentá nuevamente.",
    fields: {
      name: "Nombre y apellido",
      contact: "Email o WhatsApp",
      company: "Empresa",
      country: "País",
      vertical: "Vertical (wine/events/cosmetics/agro/pharma)",
      volume: "Volumen estimado anual",
      notes: "Notas del caso (opcional)",
    },
  },
  "pt-BR": {
    eyebrow: "Agendar demo",
    title: "Vamos agendar uma demo e registrar seu caso no super admin",
    description: "Preencha seus dados e nosso time retorna com o pack ideal (wine, events, cosmetics, agro ou pharma).",
    submit: "Enviar solicitação",
    sent: "Solicitação enviada. Seu lead foi salvo para acompanhamento comercial.",
    error: "Não foi possível enviar agora. Tente novamente.",
    fields: {
      name: "Nome",
      contact: "Email ou WhatsApp",
      company: "Empresa",
      country: "País",
      vertical: "Vertical (wine/events/cosmetics/agro/pharma)",
      volume: "Volume anual estimado",
      notes: "Notas do caso (opcional)",
    },
  },
  en: {
    eyebrow: "Schedule demo",
    title: "Book a demo and store your case in super-admin leads",
    description: "Share your data and we will follow up with the right pack (wine, events, cosmetics, agro or pharma).",
    submit: "Submit request",
    sent: "Request sent. Your lead is now stored for sales follow-up.",
    error: "Could not submit right now. Please retry.",
    fields: {
      name: "Full name",
      contact: "Email or WhatsApp",
      company: "Company",
      country: "Country",
      vertical: "Vertical (wine/events/cosmetics/agro/pharma)",
      volume: "Estimated annual volume",
      notes: "Case notes (optional)",
    },
  },
};

export function DemoRequestSection({ locale }: { locale: AppLocale }) {
  const t = copy[locale] || copy["es-AR"];
  const [status, setStatus] = useState<"idle" | "ok" | "error" | "loading">("idle");
  const [form, setForm] = useState<LeadForm>({ name: "", contact: "", company: "", country: "", vertical: "wine", volume: "", notes: "" });

  async function submit() {
    if (!form.contact.trim()) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    const payload = {
      locale,
      contact: form.contact,
      company: form.company || form.name,
      country: form.country,
      vertical: form.vertical,
      volume: Number(form.volume || 0),
      tag_type: form.vertical === "events" ? "basic" : "secure",
      source: "demo_request",
      notes: [form.name ? `Name: ${form.name}` : "", form.notes].filter(Boolean).join(" | "),
    };

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!res || !res.ok) {
      setStatus("error");
      return;
    }

    setStatus("ok");
    setForm({ name: "", contact: "", company: "", country: "", vertical: "wine", volume: "", notes: "" });
  }

  return (
    <section id="agendar-demo" className="container-shell py-16">
      <Card className="p-6 md:p-8">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} description={t.description} />
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <input className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white" placeholder={t.fields.name} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <input className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white" placeholder={t.fields.contact} value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} />
          <input className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white" placeholder={t.fields.company} value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
          <input className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white" placeholder={t.fields.country} value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
          <input className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white" placeholder={t.fields.vertical} value={form.vertical} onChange={(event) => setForm({ ...form, vertical: event.target.value })} />
          <input className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white" placeholder={t.fields.volume} value={form.volume} onChange={(event) => setForm({ ...form, volume: event.target.value })} />
          <textarea className="md:col-span-2 min-h-28 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white" placeholder={t.fields.notes} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={submit} disabled={status === "loading"}>{t.submit}</Button>
          {status === "ok" ? <p className="text-sm text-emerald-300">{t.sent}</p> : null}
          {status === "error" ? <p className="text-sm text-rose-300">{t.error}</p> : null}
        </div>
      </Card>
    </section>
  );
}
