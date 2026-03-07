"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type AppLocale = "es-AR" | "pt-BR" | "en";

type Intent = "demo" | "sales" | "reseller";

type LeadForm = {
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  role: string;
  vertical: string;
  volume: string;
  message: string;
};

const copy: Record<AppLocale, Record<string, string>> = {
  "es-AR": {
    demo: "Pedir demo",
    sales: "Hablar con ventas",
    reseller: "Quiero ser reseller",
    subtitle: "Completá tus datos y guardamos tu lead en el CRM super-admin.",
    submit: "Enviar",
    close: "Cerrar",
    success: "Lead guardado correctamente.",
    error: "No se pudo enviar. Reintentá en unos segundos.",
  },
  "pt-BR": {
    demo: "Solicitar demo",
    sales: "Falar com vendas",
    reseller: "Quero ser reseller",
    subtitle: "Preencha os dados para registrar o lead no CRM super-admin.",
    submit: "Enviar",
    close: "Fechar",
    success: "Lead salvo com sucesso.",
    error: "Não foi possível enviar agora.",
  },
  en: {
    demo: "Request demo",
    sales: "Talk to sales",
    reseller: "Become reseller",
    subtitle: "Share your details and we store your lead in super-admin CRM.",
    submit: "Submit",
    close: "Close",
    success: "Lead saved successfully.",
    error: "Could not submit right now.",
  },
};

function getLocale(): AppLocale {
  const match = typeof document !== "undefined" ? document.cookie.match(/(?:^|; )locale=([^;]+)/)?.[1] : "es-AR";
  return match === "en" || match === "pt-BR" ? match : "es-AR";
}

export function CommercialContactModal() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const intent = search.get("contact") as Intent | null;
  const open = intent === "demo" || intent === "sales" || intent === "reseller";
  const locale = getLocale();
  const t = copy[locale];
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [form, setForm] = useState<LeadForm>({ name: "", email: "", phone: "", company: "", country: "", role: "", vertical: "wine", volume: "", message: "" });

  useEffect(() => {
    if (!open) setStatus("idle");
  }, [open]);

  const source = useMemo(() => {
    if (intent === "reseller") return "reseller_cta";
    if (intent === "sales") return "hero_cta";
    return "demo_request";
  }, [intent]);

  function close() {
    router.replace(pathname, { scroll: false });
  }

  async function submit() {
    if (!form.name.trim() || (!form.email.trim() && !form.phone.trim())) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    const contact = [form.email.trim(), form.phone.trim()].filter(Boolean).join(" | ");
    const notes = [
      `name=${form.name}`,
      `role=${form.role}`,
      `message=${form.message}`,
      `phone=${form.phone}`,
      `email=${form.email}`,
    ].filter(Boolean).join(" | ");

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale,
        contact,
        company: form.company,
        country: form.country,
        vertical: form.vertical,
        volume: Number(form.volume || 0),
        tag_type: form.vertical === "events" ? "basic" : "secure",
        source,
        notes,
      }),
    }).catch(() => null);

    if (!res?.ok) {
      setStatus("error");
      return;
    }

    setStatus("ok");
    setTimeout(close, 700);
  }

  if (!open || !intent) return null;

  return (
    <div id="contact-modal" className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-slate-950 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white">{t[intent]}</h3>
            <p className="mt-1 text-sm text-slate-300">{t.subtitle}</p>
          </div>
          <button onClick={close} className="rounded-md border border-white/20 px-3 py-1 text-xs text-slate-300">{t.close}</button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Empresa" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="País" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <input className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Rol / interés" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <input className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Vertical" value={form.vertical} onChange={(e) => setForm({ ...form, vertical: e.target.value })} />
          <input className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Volumen anual" value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} />
          <textarea className="md:col-span-2 min-h-[88px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="Mensaje" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className={`text-xs ${status === "error" ? "text-rose-300" : "text-emerald-300"}`}>{status === "ok" ? t.success : status === "error" ? t.error : ""}</p>
          <button onClick={submit} disabled={status === "loading"} className="rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-4 py-2 text-sm text-cyan-100 disabled:opacity-40">{t.submit}</button>
        </div>
      </div>
    </div>
  );
}
