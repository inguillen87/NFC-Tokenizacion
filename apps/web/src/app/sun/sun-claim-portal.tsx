"use client";

import { useId } from "react";
import { ArrowRight, LifeBuoy, UserRound } from "lucide-react";
import { ConsumerTapLink } from "./consumer-passport-link";
import { useSunLocale } from "./sun-locale-provider";

type ClaimAvailability = "ready" | "fresh_required" | "manual_opened" | "not_enabled" | "busy";

type Props = {
  href?: string | null;
  eventId: string;
  freshToken: string;
  availability: ClaimAvailability;
  supportAvailable?: boolean;
};

const copy = {
  "es-AR": {
    eyebrow: "Tu cuenta NexID",
    title: "Solicitar titularidad",
    intro: "Continuá en tu cuenta para consultar los requisitos y confirmar tu solicitud.",
    conditions: "La marca define los requisitos. Si exige un comprobante o una aprobación, necesitás confirmarlos con la marca.",
    separate: "Entrar no confirma titularidad ni activa garantía o beneficios.",
    action: "Continuar en mi cuenta",
    help: "Pedir ayuda a la marca",
    fresh_required: "Hacé un nuevo tap desde la etiqueta para solicitar titularidad. Una lectura guardada no renueva ese acceso.",
    manual_opened: "La apertura declarada no habilita la solicitud de titularidad. Podés pedir ayuda cuando la marca ofrezca esa opción.",
    not_enabled: "La marca no habilitó la solicitud de titularidad para este producto.",
    busy: "Hay otra acción en curso. Esperá a que termine antes de continuar.",
    unavailable: "No hay un acceso disponible para solicitar titularidad desde esta lectura.",
  },
  en: {
    eyebrow: "Your NexID account",
    title: "Request ownership",
    intro: "Continue in your account to check the requirements and confirm your request.",
    conditions: "The brand sets the requirements. If proof of purchase or approval is required, confirm it with the brand.",
    separate: "Signing in does not confirm ownership or activate a warranty or benefits.",
    action: "Continue in my account",
    help: "Ask the brand for help",
    fresh_required: "Tap the physical label again to request ownership. A saved reading does not renew that access.",
    manual_opened: "A manually reported opening does not enable an ownership request. You can ask for help when the brand provides that option.",
    not_enabled: "The brand has not enabled ownership requests for this product.",
    busy: "Another action is in progress. Wait for it to finish before continuing.",
    unavailable: "There is no access to request ownership from this reading.",
  },
  "pt-BR": {
    eyebrow: "Sua conta NexID",
    title: "Solicitar titularidade",
    intro: "Continue na sua conta para consultar os requisitos e confirmar sua solicitação.",
    conditions: "A marca define os requisitos. Se exigir comprovante de compra ou aprovação, confirme com a marca.",
    separate: "Entrar não confirma titularidade nem ativa garantia ou benefícios.",
    action: "Continuar na minha conta",
    help: "Pedir ajuda à marca",
    fresh_required: "Aproxime o celular da etiqueta física novamente para solicitar titularidade. Uma leitura salva não renova esse acesso.",
    manual_opened: "A abertura declarada não habilita a solicitação de titularidade. Você pode pedir ajuda quando a marca oferecer essa opção.",
    not_enabled: "A marca não habilitou solicitações de titularidade para este produto.",
    busy: "Há outra ação em andamento. Aguarde a conclusão antes de continuar.",
    unavailable: "Não há acesso para solicitar titularidade a partir desta leitura.",
  },
};

// Only the canonical, event-bound account destination is accepted here. The
// fresh capability belongs to ConsumerTapLink's HttpOnly handoff, never a URL.
export function sunClaimPortalDestination(href: string | null | undefined, eventId: string): string | null {
  if (typeof href !== "string" || !href || typeof eventId !== "string" || !/^[1-9]\d{0,18}$/.test(eventId)
    || BigInt(eventId) > 9223372036854775807n || href.length > 2048
    || !href.startsWith("/me?") || /[\u0000-\u0020\u007f\\]/.test(href)) return null;
  try {
    const url = new URL(href, "https://nexid.invalid");
    if (url.origin !== "https://nexid.invalid" || url.pathname !== "/me" || url.hash) return null;
    const allowed = new Set(["fromTap", "eventId", "tenant", "bid", "action"]);
    for (const key of url.searchParams.keys()) {
      if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) return null;
    }
    const tenant = url.searchParams.get("tenant") || "", bid = url.searchParams.get("bid") || "";
    if (tenant.length > 120 || bid.length > 200 || /[\u0000-\u001f\u007f]/.test(tenant + bid)) return null;
    return url.searchParams.get("fromTap") === "1"
      && url.searchParams.get("eventId") === eventId
      && url.searchParams.get("action") === "claim" ? href : null;
  } catch {
    return null;
  }
}

export function SunClaimPortal({ href, eventId, freshToken, availability, supportAvailable = false }: Props) {
  const { locale } = useSunLocale();
  const labels = copy[locale];
  const headingId = useId();
  const destination = sunClaimPortalDestination(href, eventId);
  const freshContext = typeof freshToken === "string" && freshToken.length > 0
    && freshToken.length <= 4096 && !/\s|[\u0000-\u001f\u007f]/.test(freshToken);
  const available = availability === "ready" && destination !== null && freshContext;
  const reason = availability === "ready" ? freshContext ? labels.unavailable : labels.fresh_required
    : Object.hasOwn(labels, availability) ? labels[availability] : labels.unavailable;
  const buttonClass = "sun-account-entry inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

  return <section
    aria-labelledby={headingId}
    data-testid="sun-claim-portal"
    data-claim-available={available}
    data-sun-server-evidence="true"
    className="min-w-0 rounded-2xl border p-4"
    style={{ borderColor: "var(--passport-line, #31454e)", background: "var(--passport-surface, #142630)", color: "var(--passport-ink, #edf4f6)" }}
  >
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "var(--passport-info-bg, #192f3b)", color: "var(--passport-info, #8bd8c3)" }}><UserRound size={20} /></span>
      <div className="min-w-0">
        <p className="text-xs font-semibold" style={{ color: "var(--passport-muted, #adbec8)" }}>{labels.eyebrow}</p>
        <h3 id={headingId} className="mt-1 text-lg font-bold leading-snug">{labels.title}</h3>
      </div>
    </div>
    <p className="mt-3 text-sm leading-relaxed">{labels.intro}</p>
    <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--passport-muted, #adbec8)" }}>{labels.conditions}</p>
    <div className="mt-4" style={{ color: "var(--passport-info, #8bd8c3)" }}>
      {available ? <ConsumerTapLink href={destination} eventId={eventId} freshToken={freshToken} className={buttonClass}><span>{labels.action}</span><ArrowRight size={18} aria-hidden="true" /></ConsumerTapLink>
        : <><button type="button" disabled className={buttonClass}>{labels.action}<ArrowRight size={18} aria-hidden="true" /></button><p role="status" className="mt-2 text-sm leading-relaxed">{reason}</p></>}
    </div>
    <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--passport-muted, #adbec8)" }}>{labels.separate}</p>
    {supportAvailable ? <a href="#report-problem" data-testid="sun-claim-help" data-sun-experience-event="PROBLEM_REPORTED" data-sun-experience-placement="protected_actions" data-sun-experience-interaction="report_started" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><LifeBuoy size={17} aria-hidden="true" />{labels.help}</a> : null}
  </section>;
}
