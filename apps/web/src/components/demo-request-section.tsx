"use client";

import { useState } from "react";
import type { AppLocale } from "@product/config";
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
  queued_local?: boolean;
  delivery?: {
    webhook?: { ok?: boolean; status?: number } | null;
    whatsapp?: { ok?: boolean; status?: number } | null;
  };
};

const verticals = ["wine", "events", "cosmetics", "agro", "pharma"] as const;

const copy: Record<AppLocale, {
  eyebrow: string;
  title: string;
  description: string;
  submit: string;
  loading: string;
  sent: string;
  queued: string;
  error: string;
  delivery: string;
  fields: Record<keyof LeadForm, string>;
}> = {
  "es-AR": {
    eyebrow: "Demo enterprise",
    title: "Contanos el caso y activamos el seguimiento comercial",
    description: "Formulario corto: guardamos el lead en super-admin y disparamos la notificacion comercial para responder rapido.",
    submit: "Enviar demo",
    loading: "Enviando...",
    sent: "Lead creado en super-admin.",
    queued: "Solicitud recibida. Quedo en cola local porque el backend comercial no respondio.",
    error: "Falta un contacto valido o no pudimos enviar la solicitud.",
    delivery: "Notificacion comercial enviada.",
    fields: {
      name: "Nombre",
      contact: "Email o WhatsApp",
      company: "Empresa",
      vertical: "Vertical",
      notes: "Que queres validar en la demo? (opcional)",
    },
  },
  "pt-BR": {
    eyebrow: "Demo enterprise",
    title: "Conte o caso e ativamos o follow-up comercial",
    description: "Formulario curto: salvamos o lead no super-admin e disparamos a notificacao comercial para responder rapido.",
    submit: "Enviar demo",
    loading: "Enviando...",
    sent: "Lead criado no super-admin.",
    queued: "Solicitacao recebida. Ficou em fila local porque o backend comercial nao respondeu.",
    error: "Falta um contato valido ou nao foi possivel enviar.",
    delivery: "Notificacao comercial enviada.",
    fields: {
      name: "Nome",
      contact: "Email ou WhatsApp",
      company: "Empresa",
      vertical: "Vertical",
      notes: "O que voce quer validar na demo? (opcional)",
    },
  },
  en: {
    eyebrow: "Enterprise demo",
    title: "Share the case and we will trigger sales follow-up",
    description: "Short form: we save the lead in super-admin and trigger the commercial notification so the team can respond fast.",
    submit: "Send demo request",
    loading: "Sending...",
    sent: "Lead created in super-admin.",
    queued: "Request received. It is locally queued because the commercial backend did not respond.",
    error: "Add a valid contact or retry the request.",
    delivery: "Commercial notification sent.",
    fields: {
      name: "Name",
      contact: "Email or WhatsApp",
      company: "Company",
      vertical: "Vertical",
      notes: "What should we validate in the demo? (optional)",
    },
  },
};

function deliveryWorked(data: LeadResponse) {
  return Boolean(data.delivery?.webhook?.ok || data.delivery?.whatsapp?.ok);
}

export function DemoRequestSection({ locale }: { locale: AppLocale }) {
  const t = copy[locale] || copy["es-AR"];
  const [status, setStatus] = useState<"idle" | "ok" | "queued" | "error" | "loading">("idle");
  const [deliveryOk, setDeliveryOk] = useState(false);
  const [form, setForm] = useState<LeadForm>({ name: "", contact: "", company: "", vertical: "wine", notes: "" });

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
    setStatus(data.queued_local ? "queued" : "ok");
    setForm({ name: "", contact: "", company: "", vertical: "wine", notes: "" });
  }

  return (
    <section id="agendar-demo" className="container-shell py-16">
      <Card className="demo-request-card p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
          <div>
            <SectionHeading eyebrow={t.eyebrow} title={t.title} description={t.description} />
            <div className="mt-5 grid gap-2 text-sm text-slate-300">
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">1. Lead nuevo en super-admin.</div>
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3">2. Notificacion comercial por webhook/WhatsApp si esta configurado.</div>
              <div className="rounded-xl border border-violet-300/20 bg-violet-500/10 p-3">3. Seguimiento desde tickets, cotizador y Demo Lab.</div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <input suppressHydrationWarning className="demo-input" placeholder={t.fields.name} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <input suppressHydrationWarning className="demo-input" placeholder={t.fields.contact} value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} />
              <input suppressHydrationWarning className="demo-input md:col-span-2" placeholder={t.fields.company} value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300">{t.fields.vertical}</p>
              <div className="flex flex-wrap gap-2">
                {verticals.map((vertical) => (
                  <button suppressHydrationWarning
                    key={vertical}
                    type="button"
                    onClick={() => setForm({ ...form, vertical })}
                    className={`demo-vertical-pill ${form.vertical === vertical ? "demo-vertical-pill--active" : ""}`}
                  >
                    {vertical}
                  </button>
                ))}
              </div>
            </div>

            <textarea suppressHydrationWarning className="demo-input min-h-24" placeholder={t.fields.notes} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={submit} disabled={status === "loading"}>{status === "loading" ? t.loading : t.submit}</Button>
              {status === "ok" ? <p className="text-sm text-emerald-300">{t.sent} {deliveryOk ? t.delivery : ""}</p> : null}
              {status === "queued" ? <p className="text-sm text-amber-300">{t.queued}</p> : null}
              {status === "error" ? <p className="text-sm text-rose-300">{t.error}</p> : null}
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
