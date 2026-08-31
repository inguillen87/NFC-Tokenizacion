"use client";

import { BellRing, CheckCircle2, ChevronDown, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

type SubmitState = "idle" | "submitting" | "success" | "error";

type SunUpdatesOptInProps = {
  brandName: string;
  productName: string;
  tenantSlug?: string | null;
  eventId?: string | null;
  bid?: string | null;
};

export function SunUpdatesOptIn({
  brandName,
  productName,
  tenantSlug = null,
  eventId = null,
  bid = null,
}: SunUpdatesOptInProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<SubmitState>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting" || !consent || contact.trim().length < 5) return;
    setState("submitting");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: "es-AR",
          contact: contact.trim(),
          name: name.trim(),
          company: brandName,
          vertical: "connected_product",
          role_interest: "brand_updates",
          source: "sun_brand_opt_in",
          message: `Opt-in de novedades para ${productName}`,
          tenantSlug,
          eventId,
          bid,
          productName,
          gps: { consent: false, precision: "none" },
          engagement: {
            type: "sun_brand_opt_in",
            optIn: "brand_updates",
            consentTextVersion: "sun_updates_v1",
          },
        }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean } | null;
      if (!response.ok || payload?.ok !== true) throw new Error("lead_save_failed");
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <section
      id="sun-updates-opt-in"
      className="scroll-mt-24 rounded-2xl border border-indigo-300/15 bg-indigo-500/[0.06] p-4"
      aria-labelledby="sun-updates-title"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-indigo-300/20 bg-indigo-500/10 text-indigo-200">
          <BellRing className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="sun-updates-title" className="text-sm font-black text-white">Novedades de {brandName}</h3>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">
            Opt-in separado del tap. No activa premios, propiedad ni garantía y no solicita ubicación o datos del dispositivo.
          </p>
        </div>
      </div>

      {state === "success" ? (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-emerald-100" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <strong className="block text-xs">Suscripción solicitada</strong>
            <p className="mt-1 text-[10px] leading-4 opacity-80">La marca puede comunicarse por el canal autorizado. Podrás pedir la baja desde cualquier mensaje.</p>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="sun-updates-form"
            onClick={() => setOpen((value) => !value)}
            className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-left text-xs font-black text-slate-100 transition hover:border-indigo-300/25 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            {open ? "Cerrar formulario" : "Elegir canal de contacto"}
            <ChevronDown className={`h-4 w-4 shrink-0 text-indigo-200 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>

          {open ? (
            <form id="sun-updates-form" className="mt-3 space-y-3" onSubmit={submit}>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Nombre <span className="normal-case tracking-normal text-slate-500">(opcional)</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  className="mt-1.5 block min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-xs font-medium normal-case tracking-normal text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/35 focus:ring-2 focus:ring-indigo-300/20"
                  placeholder="Tu nombre"
                />
              </label>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Email o WhatsApp
                <input
                  required
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  className="mt-1.5 block min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-xs font-medium normal-case tracking-normal text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/35 focus:ring-2 focus:ring-indigo-300/20"
                  placeholder="mail@ejemplo.com o +54 9..."
                />
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-[10px] leading-4 text-slate-300">
                <input
                  required
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-400"
                />
                Autorizo a {brandName} a enviarme novedades de este producto por el canal indicado. Este consentimiento es opcional y revocable.
              </label>
              <button
                type="submit"
                disabled={state === "submitting" || !consent || contact.trim().length < 5}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-400 px-4 text-xs font-black text-slate-950 transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {state === "submitting" ? "Guardando autorización..." : "Confirmar suscripción"}
              </button>
              {state === "error" ? <p className="text-center text-[10px] text-rose-200" role="alert">No pudimos guardar la autorización. Reintentá en unos segundos.</p> : null}
            </form>
          ) : null}
        </>
      )}
    </section>
  );
}
