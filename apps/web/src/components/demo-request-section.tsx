"use client";

import { useState } from "react";
import { schedulingUrls, type AppLocale } from "@product/config";
import { Button, Card, SectionHeading } from "@product/ui";

type LeadForm = {
  name: string;
  contact: string;
  company: string;
  vertical: string;
  notes: string;
};

type LeadResponse = {
  ok?: boolean;
  delivery?: {
    webhook?: { ok?: boolean; status?: number } | null;
    whatsapp?: { ok?: boolean; status?: number } | null;
  };
};

const verticals = ["agro", "pharma", "wine", "cosmetics", "fashion", "events", "other"] as const;

const copy: Record<AppLocale, {
  eyebrow: string;
  title: string;
  description: string;
  submit: string;
  loading: string;
  sent: string;
  error: string;
  delivery: string;
  meeting: string;
  meetingHint: string;
  fields: Record<keyof LeadForm, string>;
  verticalLabels: Record<(typeof verticals)[number], string>;
}> = {
  "es-AR": {
    eyebrow: "Diseñemos un piloto",
    title: "Contanos qué producto querés conectar.",
    description: "Dejanos un contacto y una breve idea del caso. Te respondemos para definir el alcance y los próximos pasos.",
    submit: "Enviar consulta",
    loading: "Enviando...",
    sent: "Recibimos tu consulta.",
    error: "Ingresá un contacto válido o volvé a intentar.",
    delivery: "El equipo comercial ya fue avisado.",
    meeting: "Agendar una reunión",
    meetingHint: "Si preferís, podés elegir un horario directamente.",
    fields: {
      name: "Nombre",
      contact: "Email o WhatsApp",
      company: "Empresa",
      vertical: "Rubro",
      notes: "¿Qué necesitás mostrar, comprobar o activar? (opcional)",
    },
    verticalLabels: {
      agro: "Agro e insumos",
      pharma: "Farmacéutica y salud",
      wine: "Bodegas y bebidas",
      cosmetics: "Cosmética y cuidado personal",
      fashion: "Moda y bienes durables",
      events: "Eventos y accesos",
      other: "Otro rubro",
    },
  },
  "pt-BR": {
    eyebrow: "Vamos desenhar um piloto",
    title: "Conte qual produto você quer conectar.",
    description: "Deixe um contato e uma breve ideia do caso. Respondemos para definir o escopo e os próximos passos.",
    submit: "Enviar consulta",
    loading: "Enviando...",
    sent: "Recebemos sua consulta.",
    error: "Informe um contato válido ou tente novamente.",
    delivery: "A equipe comercial já foi avisada.",
    meeting: "Agendar uma reunião",
    meetingHint: "Se preferir, escolha um horário diretamente.",
    fields: {
      name: "Nome",
      contact: "Email ou WhatsApp",
      company: "Empresa",
      vertical: "Setor",
      notes: "O que você precisa mostrar, comprovar ou ativar? (opcional)",
    },
    verticalLabels: {
      agro: "Agro e insumos",
      pharma: "Farmacêutica e saúde",
      wine: "Vinhos e bebidas",
      cosmetics: "Cosméticos e cuidado pessoal",
      fashion: "Moda e bens duráveis",
      events: "Eventos e acessos",
      other: "Outro setor",
    },
  },
  en: {
    eyebrow: "Design a pilot",
    title: "Tell us which product you want to connect.",
    description: "Leave a contact and a short outline of the case. We will reply to define scope and next steps.",
    submit: "Send inquiry",
    loading: "Sending...",
    sent: "We received your inquiry.",
    error: "Add a valid contact or retry the request.",
    delivery: "The sales team has been notified.",
    meeting: "Schedule a meeting",
    meetingHint: "If you prefer, choose a time directly.",
    fields: {
      name: "Name",
      contact: "Email or WhatsApp",
      company: "Company",
      vertical: "Industry",
      notes: "What do you need to show, verify or enable? (optional)",
    },
    verticalLabels: {
      agro: "Agriculture and inputs",
      pharma: "Pharmaceutical and health",
      wine: "Wine and beverages",
      cosmetics: "Cosmetics and personal care",
      fashion: "Fashion and durable goods",
      events: "Events and access",
      other: "Another industry",
    },
  },
};

function deliveryWorked(data: LeadResponse) {
  return Boolean(data.delivery?.webhook?.ok || data.delivery?.whatsapp?.ok);
}

export function DemoRequestSection({ locale }: { locale: AppLocale }) {
  const t = copy[locale] || copy["es-AR"];
  const [status, setStatus] = useState<"idle" | "ok" | "error" | "loading">("idle");
  const [deliveryOk, setDeliveryOk] = useState(false);
  const [form, setForm] = useState<LeadForm>({ name: "", contact: "", company: "", vertical: "", notes: "" });

  async function submit() {
    if (!form.contact.trim()) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    setDeliveryOk(false);
    const payload = {
      locale,
      name: form.name,
      contact: form.contact,
      company: form.company || form.name,
      vertical: form.vertical,
      tag_type: form.vertical === "events" ? "basic" : "secure",
      source: "landing_demo_request",
      role_interest: "enterprise_pilot",
      message: `demo_request vertical=${form.vertical}`,
      notes: form.notes,
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

    const data = await res.json().catch(() => ({} as LeadResponse));
    setDeliveryOk(deliveryWorked(data));
    setStatus("ok");
    setForm({ name: "", contact: "", company: "", vertical: "", notes: "" });
  }

  return (
    <section id="agendar-demo" className="landing-demo-request container-shell scroll-mt-24 py-14 md:py-20">
      <Card className="demo-request-card p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
          <div>
            <SectionHeading eyebrow={t.eyebrow} title={t.title} description={t.description} />
          </div>

          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <label className="demo-field-label">
                <span>{t.fields.name}</span>
                <input suppressHydrationWarning name="name" autoComplete="name" className="demo-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <label className="demo-field-label">
                <span>{t.fields.contact}</span>
                <input suppressHydrationWarning required name="contact" autoComplete="email" className="demo-input" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} />
              </label>
              <label className="demo-field-label md:col-span-2">
                <span>{t.fields.company}</span>
                <input suppressHydrationWarning name="company" autoComplete="organization" className="demo-input" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
              </label>
            </div>

            <label className="demo-field-label">
              <span>{t.fields.vertical}</span>
              <select suppressHydrationWarning required name="vertical" className="demo-input" value={form.vertical} onChange={(event) => setForm({ ...form, vertical: event.target.value })}>
                <option value="" disabled>{locale === "en" ? "Choose an industry" : locale === "pt-BR" ? "Escolha um setor" : "Elegí un rubro"}</option>
                {verticals.map((vertical) => <option key={vertical} value={vertical}>{t.verticalLabels[vertical]}</option>)}
              </select>
            </label>

            <label className="demo-field-label">
              <span>{t.fields.notes}</span>
              <textarea suppressHydrationWarning name="notes" className="demo-input min-h-24" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={status === "loading"}>{status === "loading" ? t.loading : t.submit}</Button>
              <a href={schedulingUrls.meeting} target="_blank" rel="noreferrer" className="demo-meeting-link inline-flex min-h-10 items-center justify-center px-2 text-sm font-semibold underline-offset-4 hover:underline">
                {t.meeting}
              </a>
              <p className="text-xs text-slate-400">{t.meetingHint}</p>
              {status === "ok" ? <p className="text-sm text-emerald-700" role="status">{t.sent} {deliveryOk ? t.delivery : ""}</p> : null}
              {status === "error" ? <p className="text-sm text-rose-700" role="alert">{t.error}</p> : null}
            </div>
          </form>
        </div>
      </Card>
    </section>
  );
}
