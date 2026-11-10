"use client";

import { BellRing, CheckCircle2, ChevronDown, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ConsumerContactInput,
  consumerContactPayload,
  consumerContactDraftValue,
  createEmptyConsumerContactDraft,
  type ConsumerContactDraft,
} from "../../components/consumer-contact-input";
import { useSunLocale } from "./sun-locale-provider";
import { resolveTenantActionAvailability, TENANT_ACTION_COPY } from "./tenant-action-availability";

const LEAD_EMAIL = /^[^\s@]{1,120}@[^\s@]{1,190}\.[^\s@]{2,63}$/;
const LEAD_PHONE = /^\+?[0-9 ()-]{7,30}$/;
const LEAD_TENANT_SLUG = /^[a-z0-9][a-z0-9._-]{1,119}$/;
const LEAD_EVENT_ID = /^[1-9]\d{0,19}$/;
const LEAD_BID = /^[A-Za-z0-9._:-]{3,120}$/;
const CONTEXT_RECOVERY_COPY = "No pudimos vincular esta solicitud con el producto. Volvé a abrir su pasaporte desde la etiqueta.";

function leadContactPayload(draft: ConsumerContactDraft) {
  const payload = consumerContactPayload(draft);
  if (!payload) return null;
  if ("email" in payload) {
    if (draft.email.trim().length > 320 || payload.email.length > 320 || !LEAD_EMAIL.test(payload.email)) return null;
  } else if (payload.phone.length > 32 || !LEAD_PHONE.test(payload.phone)) return null;
  return payload;
}

// Feedback policy only: this does not time out or cancel the pending request.
const UPDATES_PENDING_NOTICE_MS = 8_000;

type SubmitState = "idle" | "success" | "error";
type Flight = { contextKey: string };
type FlightOwner = {
  active: Flight | null;
  delayed: Flight | null;
  reserve: (contextKey: string) => Flight | null;
  release: (flight: Flight) => void;
  pending: () => boolean;
  owns: (flight: Flight) => boolean;
};
type SunUpdatesOptInProps = {
  brandName: string;
  productName: string;
  tenantSlug?: string | null;
  eventId?: string | null;
  bid?: string | null;
  configuration?: unknown;
  canEngage?: boolean;
};

export function SunUpdatesOptIn({
  brandName,
  productName,
  tenantSlug = null,
  eventId = null,
  bid = null,
  configuration,
  canEngage = true,
}: SunUpdatesOptInProps) {
  const { locale } = useSunLocale();
  const [active, setActive] = useState<Flight | null>(null);
  const [delayed, setDelayed] = useState<Flight | null>(null);
  const inFlight = useRef<Flight | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      if (mounted.current && inFlight.current === active) setDelayed(active);
    }, UPDATES_PENDING_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [active]);

  // Only explicit handlers reserve/release a send. Context renders never edit
  // the shared owner, so an abandoned render cannot revoke committed controls.
  function reserve(contextKey: string): Flight | null {
    if (!mounted.current || inFlight.current) return null;
    const owned = { contextKey };
    inFlight.current = owned;
    setActive(owned);
    return owned;
  }
  function release(owned: Flight) {
    if (inFlight.current !== owned) return;
    inFlight.current = null;
    if (mounted.current) setActive(null);
  }
  const actions = resolveTenantActionAvailability({ configuration, verifiedTenant: Boolean(tenantSlug), canEngage });
  const currentTenant = tenantSlug?.trim().toLowerCase() || "";
  const currentEvent = eventId?.trim() || "";
  const currentBid = bid?.trim() || "";
  const contextReady = LEAD_TENANT_SLUG.test(currentTenant) && LEAD_EVENT_ID.test(currentEvent) && LEAD_BID.test(currentBid);
  const available = actions.lead && (!actions.configuration?.tenantSlug || actions.configuration.tenantSlug === currentTenant);
  if (!available) return <p role="status" className="text-sm text-slate-300">{contextReady ? TENANT_ACTION_COPY[locale].empty : CONTEXT_RECOVERY_COPY}</p>;
  const contextKey = JSON.stringify([locale, brandName, productName, tenantSlug, eventId, bid, canEngage, actions.configuration]);
  return <SunUpdatesForm
    key={contextKey}
    contextKey={contextKey}
    locale={locale}
    brandName={brandName}
    productName={productName}
    tenantSlug={tenantSlug}
    eventId={eventId}
    bid={bid}
    contextReady={contextReady}
    owner={{ active, delayed, reserve, release, pending: () => inFlight.current !== null, owns: (flight) => inFlight.current === flight }}
  />;
}

type FormProps = {
  contextKey: string;
  locale: ReturnType<typeof useSunLocale>["locale"];
  brandName: string;
  productName: string;
  tenantSlug: string | null;
  eventId: string | null;
  bid: string | null;
  contextReady: boolean;
  owner: FlightOwner;
};

function SunUpdatesForm({ contextKey, locale, brandName, productName, tenantSlug, eventId, bid, contextReady, owner }: FormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactDraft, setContactDraft] = useState(createEmptyConsumerContactDraft);
  const [consent, setConsent] = useState(false);
  const [revision, setRevision] = useState(0);
  const [localFlight, setLocalFlight] = useState<Flight | null>(null);
  const [state, setState] = useState<SubmitState>("idle");
  const nameDraft = useRef(name);
  const contactDraftRef = useRef(contactDraft);
  const revisionRef = useRef(0);
  const consentRevision = useRef<number | null>(null);
  const completedRevision = useRef<number | null>(null);
  const lifetime = useRef(0);
  const mounted = useRef(true);
  const pending = owner.active !== null;
  const previousRequestPending = pending && owner.active !== localFlight;
  const showDelay = pending && owner.delayed === owner.active;
  const contactPayload = leadContactPayload(contactDraft);
  const contact = consumerContactDraftValue(contactDraft);
  const nameIsValid = name.trim().length <= 120;
  const contactError = !contactPayload && (contactDraft.channel === "email" ? contactDraft.email.trim() : contactDraft.localPhone.trim())
    ? contactDraft.channel === "email" ? "Revisá el correo antes de confirmar. Podés elegir otro canal." : "Revisá el país y el número completo antes de confirmar."
    : null;

  useEffect(() => {
    mounted.current = true;
    setConsent(false);
    return () => { mounted.current = false; consentRevision.current = null; lifetime.current += 1; };
  }, []);
  function canEdit() {
    return mounted.current && !owner.pending() && completedRevision.current !== revisionRef.current;
  }
  function revokeConsent() {
    revisionRef.current += 1;
    setRevision(revisionRef.current);
    consentRevision.current = null;
    setConsent(false);
    setState("idle");
  }
  function changeContact(next: ConsumerContactDraft) {
    if (!canEdit()) return;
    const current = contactDraftRef.current;
    if (next.channel === current.channel && next.countryCode === current.countryCode && next.localPhone === current.localPhone && next.email === current.email) return;
    contactDraftRef.current = next;
    revokeConsent();
    setContactDraft(next);
  }
  function changeName(value: string) {
    if (!canEdit() || value === nameDraft.current) return;
    nameDraft.current = value;
    revokeConsent();
    setName(value);
  }
  function changeConsent(checked: boolean) {
    if (!canEdit() || revisionRef.current !== revision) return;
    consentRevision.current = checked ? revision : null;
    setConsent(checked);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mounted.current || revisionRef.current !== revision || completedRevision.current === revision
      || consentRevision.current !== revision || !contactPayload || !nameIsValid || !contextReady) return;
    const owned = owner.reserve(contextKey);
    if (!owned) return;
    const requestLifetime = lifetime.current;
    setLocalFlight(owned);
    setState("idle");
    const isCurrent = () => mounted.current && lifetime.current === requestLifetime && owner.owns(owned)
      && revisionRef.current === revision && consentRevision.current === revision;
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
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
      const payload = await response.json().catch(() => null) as { ok?: boolean; persisted?: boolean } | null;
      if (!response.ok || payload?.ok !== true || payload.persisted !== true) throw new Error("lead_save_unconfirmed");
      if (isCurrent()) { completedRevision.current = revision; setState("success"); }
    } catch {
      if (isCurrent()) setState("error");
    } finally {
      owner.release(owned);
      if (mounted.current) setLocalFlight(null);
    }
  }
  return (
    <section
      id="sun-updates-opt-in"
      className="@container/sun-updates min-w-0 scroll-mt-24 rounded-2xl border border-indigo-300/15 bg-indigo-500/[0.06] [overflow-wrap:anywhere]"
      aria-labelledby="sun-updates-title"
    >
      <div className="p-4 @max-[15rem]/sun-updates:p-[12px]">
        <div className="flex items-start gap-3 @max-[15rem]/sun-updates:flex-col @max-[15rem]/sun-updates:gap-[8px]">
          <span className="sun-updates-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-indigo-300/20 bg-indigo-500/10 text-indigo-200 @max-[15rem]/sun-updates:size-[32px]">
            <BellRing className="h-4 w-4 @max-[15rem]/sun-updates:size-[16px]" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="sun-updates-title" className="text-sm font-black text-white">Novedades de {brandName}</h3>
            <p className="mt-1 text-[11px] leading-4 text-slate-400 @max-[15rem]/sun-updates:text-xs @max-[15rem]/sun-updates:leading-normal">
              Elegí cómo recibir novedades. Compartir tu contacto es opcional.
            </p>
          </div>
        </div>

        <details className="mt-3 text-[11px] leading-4 text-slate-400">
          <summary className="min-h-11 cursor-pointer font-bold text-slate-300 @max-[15rem]/sun-updates:min-h-[44px]">Antes de suscribirte</summary>
          <p>No activa premios, propiedad ni garantía. No solicita ubicación ni datos del dispositivo.</p>
        </details>
        {!contextReady ? <p role="status" className="mt-3 text-xs text-slate-300">{CONTEXT_RECOVERY_COPY}</p> : null}
        <div id="sun-updates-request-status" role="status" aria-live="polite" aria-atomic="true">
          {showDelay ? <div className="mt-3 text-sm leading-relaxed text-slate-200">
            <p>{previousRequestPending
              ? "Seguimos esperando la confirmación de una solicitud anterior. Podría haberse guardado. Este producto todavía necesita una nueva autorización."
              : "Seguimos esperando la confirmación de tu solicitud. Podría haberse guardado. Sólo la reenviamos si lo pedís."}</p>
            <a href="#sun-summary" className="mt-1 inline-flex min-h-11 items-center underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-300">Volver a la ficha</a>
          </div> : previousRequestPending ? <p className="mt-3 text-xs text-slate-300">Estamos terminando una solicitud anterior. Este producto necesita una nueva autorización.</p> : null}
        </div>

        {state === "success" ? (
          <div className="sun-updates-success mt-3 flex items-start gap-3 rounded-xl border p-3" role="status">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <strong className="block text-sm">Suscripción solicitada</strong>
              <p className="mt-1 text-xs leading-relaxed">La marca puede comunicarse por el canal autorizado. Podrás pedir la baja desde cualquier mensaje.</p>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="sun-updates-form"
              onClick={() => setOpen((value) => !value)}
              disabled={pending || !contextReady}
              className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-left text-xs font-black text-slate-100 transition hover:border-indigo-300/25 hover:bg-slate-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-300 @max-[15rem]/sun-updates:min-h-[44px] @max-[15rem]/sun-updates:gap-[8px] @max-[15rem]/sun-updates:px-[12px] @max-[15rem]/sun-updates:py-[8px]"
            >
              {open ? "Cerrar formulario" : "Elegir canal de contacto"}
              <ChevronDown className={`sun-updates-icon h-4 w-4 shrink-0 text-indigo-200 transition @max-[15rem]/sun-updates:size-[16px] ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>

            {open ? (
              <>
                <form id="sun-updates-form" className="mt-3 v3-space-y-3" aria-busy={pending} onSubmit={submit}>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Nombre <span className="normal-case tracking-normal text-slate-400">(opcional)</span>
                    <input
                      value={name}
                      onChange={(event) => changeName(event.target.value)}
                      autoComplete="name"
                      disabled={pending}
                      className="mt-1.5 block min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-xs font-medium normal-case tracking-normal text-white outline-hidden transition placeholder:text-slate-600 focus:border-indigo-300/35 focus:ring-2 focus:ring-indigo-300/20"
                      placeholder="Tu nombre"
                    />
                  </label>
                  <fieldset className="min-w-0 [&_input]:min-w-0 [&_input]:w-full [&_select]:min-w-0 [&_select]:w-full @max-[15rem]/sun-updates:[&_[data-sun-updates-contact-channels]]:grid-cols-1 @max-[15rem]/sun-updates:[&_[data-sun-updates-contact-channels]]:gap-[8px] @max-[15rem]/sun-updates:[&_[data-sun-updates-contact-channels]]:p-[4px] @max-[15rem]/sun-updates:[&_[data-sun-updates-contact-channels]>button]:min-h-[44px] @max-[15rem]/sun-updates:[&_[data-sun-updates-contact-channels]>button]:px-[12px] @max-[15rem]/sun-updates:[&_[data-sun-updates-contact-channels]>button]:py-[8px]">
                    <legend className="mb-2 text-xs font-bold text-slate-300">Elegí dónde recibir novedades</legend>
                    <ConsumerContactInput
                      draft={contactDraft}
                      onChange={changeContact}
                      disabled={pending}
                      idPrefix="sun-updates-contact"
                      invalid={Boolean(contactError)}
                      describedBy={contactError ? "sun-updates-contact-error" : undefined}
                      purpose="updates"
                      compact
                    />
                  </fieldset>
                  {contactError ? <p id="sun-updates-contact-error" role="status" aria-live="polite" className="text-xs text-rose-200">{contactError}</p> : null}
                  {!nameIsValid ? <p role="status" className="text-xs text-rose-200">Usá hasta 120 caracteres en el nombre.</p> : null}
                  <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-[10px] leading-4 text-slate-300 @max-[15rem]/sun-updates:gap-[8px] @max-[15rem]/sun-updates:p-[12px] @max-[15rem]/sun-updates:text-xs @max-[15rem]/sun-updates:leading-normal">
                    <input
                      required
                      type="checkbox"
                      checked={consent}
                      disabled={pending}
                      onChange={(event) => changeConsent(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-400 @max-[15rem]/sun-updates:size-[20px]"
                    />
                    Autorizo a {brandName} a enviarme novedades de este producto por el canal indicado. Este consentimiento es opcional y revocable.
                  </label>
                  {state === "error" ? (
                    <p id="sun-updates-send-error" className="text-xs leading-relaxed text-rose-200" role="alert">
                      No pudimos confirmar la solicitud. Tus datos siguen en el formulario. Sólo se reenvía si elegís reintentar.
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={pending || !consent || !contactPayload || !nameIsValid || !contextReady}
                    aria-describedby={state === "error" ? "sun-updates-send-error" : undefined}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-400 px-4 text-xs font-black text-slate-950 transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:opacity-50 @max-[15rem]/sun-updates:min-h-[44px] @max-[15rem]/sun-updates:gap-[8px] @max-[15rem]/sun-updates:px-[12px] @max-[15rem]/sun-updates:py-[8px]"
                  >
                    <Send className="h-4 w-4 @max-[15rem]/sun-updates:size-[16px] @max-[15rem]/sun-updates:shrink-0" aria-hidden="true" />
                    {pending ? previousRequestPending ? "Terminando solicitud anterior..." : "Enviando solicitud..." : state === "error" ? "Reintentar solicitud" : "Confirmar suscripción"}
                  </button>
                </form>
              </>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
