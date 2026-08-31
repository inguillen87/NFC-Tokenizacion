import {
  AlertTriangle,
  BellRing,
  ChevronRight,
  Gift,
  LockKeyhole,
  ShoppingBag,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import {
  resolveSunServicesHubAvailability,
  type SunServicesFreshnessState,
  type SunServicesPolicyAvailability,
  type SunServicesRiskState,
} from "./sun-services-hub-model";

export type SunPublishedPromotion = {
  title: string;
  description?: string | null;
  points?: number | null;
  state?: string | null;
  sourceLabel?: string | null;
};

export type SunServicesHubProps = {
  promotion?: SunPublishedPromotion | null;
  purchaseHref?: string | null;
  subscribeHref?: string | null;
  claimOrManageHref?: string | null;
  warrantyHref?: string | null;
  riskState: SunServicesRiskState;
  freshnessState: SunServicesFreshnessState;
  policyAvailability: SunServicesPolicyAvailability;
};

const RISK_COPY: Record<SunServicesRiskState, { label: string; detail: string; className: string }> = {
  clear: {
    label: "Sin alertas reportadas",
    detail: "Podés consultar los servicios que la marca habilitó para esta unidad.",
    className: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
  },
  observed: {
    label: "Lectura con observaciones",
    detail: "Revisá la evidencia antes de iniciar una acción asociada al producto.",
    className: "border-amber-300/25 bg-amber-500/10 text-amber-100",
  },
  blocked: {
    label: "Acciones protegidas",
    detail: "Claim, garantía y promociones quedan pausados mientras la marca revisa la lectura.",
    className: "border-rose-300/25 bg-rose-500/10 text-rose-100",
  },
};

const FRESHNESS_LABEL: Record<SunServicesFreshnessState, string> = {
  fresh: "Tap vigente",
  stale: "Tap vencido",
  snapshot: "Vista guardada",
  demo: "Muestra sin tap físico",
  unknown: "Frescura no informada",
};

const ACTION_CLASS_NAME = "group flex min-h-20 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-3 text-left text-white transition hover:border-cyan-300/30 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300";

export function SunServicesHub({
  promotion,
  purchaseHref,
  subscribeHref,
  claimOrManageHref,
  warrantyHref,
  riskState,
  freshnessState,
  policyAvailability,
}: SunServicesHubProps) {
  const promotionPublished = typeof promotion?.title === "string" && Boolean(promotion.title.trim());
  const available = resolveSunServicesHubAvailability({
    riskState,
    policyAvailability,
    promotionPublished,
    purchaseHref,
    subscribeHref,
    claimOrManageHref,
    warrantyHref,
  });
  const riskCopy = freshnessState === "demo"
    ? {
        label: "Servicios de muestra",
        detail: "Recorré el formato sin crear un reclamo, una compra ni un beneficio real.",
        className: "border-cyan-300/20 bg-cyan-500/10 text-cyan-100",
      }
    : RISK_COPY[riskState];
  const publishedPoints = typeof promotion?.points === "number"
    && Number.isFinite(promotion.points)
    && promotion.points > 0
    ? Math.floor(promotion.points)
    : null;

  const actions = [
    ...(available.purchase ? [{
      key: "purchase",
      href: purchaseHref as string,
      label: "Solicitar compra",
      detail: "Consultá disponibilidad con la marca. La solicitud no confirma stock ni completa una compra.",
      icon: ShoppingBag,
    }] : []),
    ...(available.subscribe ? [{
      key: "subscribe",
      href: subscribeHref as string,
      label: "Suscribirme a novedades",
      detail: "Elegí si querés recibir información publicada por la marca. No promete premios.",
      icon: BellRing,
    }] : []),
    ...(available.claimOrManage ? [{
      key: "claim",
      href: claimOrManageHref as string,
      label: "Solicitar vínculo o gestionar",
      detail: "El tap no transfiere propiedad: identidad, compra y política se validan por separado.",
      icon: UserRoundCheck,
    }] : []),
    ...(available.warranty ? [{
      key: "warranty",
      href: warrantyHref as string,
      label: "Solicitar garantía",
      detail: "Iniciá la revisión de la marca. Enviar la solicitud no confirma su aceptación.",
      icon: ShieldCheck,
    }] : []),
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-[#0a1020]/95 p-5 shadow-2xl shadow-black/20" aria-labelledby="sun-services-title">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Servicios de la marca</span>
          <h2 id="sun-services-title" className="mt-1 text-xl font-black tracking-tight text-white">¿Qué querés hacer con este producto?</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">Cada acción es opcional y se procesa por separado de la lectura NFC.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1.5 text-[10px] font-bold text-slate-300">
          <span className={`h-2 w-2 rounded-full ${freshnessState === "fresh" ? "bg-emerald-300" : "bg-amber-300"}`} aria-hidden="true" />
          {FRESHNESS_LABEL[freshnessState]}
        </span>
      </header>

      <div className={`mt-4 flex items-start gap-3 rounded-2xl border p-3 ${riskCopy.className}`} role="status">
        {freshnessState === "demo" ? (
          <Gift className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        ) : riskState === "blocked" ? (
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        ) : riskState === "observed" ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <div>
          <strong className="block text-xs font-black">{riskCopy.label}</strong>
          <p className="mt-0.5 text-[11px] leading-4 opacity-80">{riskCopy.detail}</p>
        </div>
      </div>

      <div className={`mt-4 rounded-2xl border p-4 ${available.promotionDegraded ? "border-amber-300/20 bg-amber-500/[0.06]" : "border-violet-300/15 bg-violet-500/[0.07]"}`}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-500/10 text-violet-200">
            <Gift className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-200">
              {promotion?.sourceLabel || "Beneficios publicados por la marca"}
            </span>
            {!promotionPublished ? (
              <p className="mt-1 text-sm font-semibold leading-5 text-slate-300">La marca no publicó una promoción para este producto</p>
            ) : available.promotionVisible ? (
              <>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-black text-white">{promotion?.title}</h3>
                  {promotion?.state ? <span className="rounded-full border border-white/10 bg-slate-950/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-300">{promotion.state}</span> : null}
                  {available.promotionDegraded ? <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-100">Revisar lectura</span> : null}
                </div>
                {promotion?.description ? <p className="mt-1 text-xs leading-5 text-slate-300">{promotion.description}</p> : null}
                {publishedPoints ? <p className="mt-2 text-[10px] font-bold text-violet-200">{publishedPoints.toLocaleString("es-AR")} puntos informados por la marca · sujetos a sus condiciones</p> : null}
              </>
            ) : (
              <p className="mt-1 text-sm font-semibold leading-5 text-slate-300">
                {riskState === "blocked" ? "La promoción queda oculta mientras esta lectura requiere revisión." : "La promoción no está habilitada por la política de este producto."}
              </p>
            )}
          </div>
        </div>
      </div>

      {freshnessState !== "fresh" ? (
        <p className="mt-3 text-[11px] leading-4 text-amber-100/75">Las acciones protegidas pueden pedir una nueva lectura NFC antes de continuar.</p>
      ) : null}

      {actions.length ? (
        <nav className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Servicios disponibles para este producto">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <a key={action.key} href={action.href} className={ACTION_CLASS_NAME}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-500/10 text-cyan-200">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-xs font-black leading-4">{action.label}</strong>
                  <small className="mt-1 block text-[10px] font-medium leading-4 text-slate-400">{action.detail}</small>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" aria-hidden="true" />
              </a>
            );
          })}
        </nav>
      ) : (
        <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-xs leading-5 text-slate-400">La marca no habilitó servicios adicionales para este producto.</p>
      )}
    </section>
  );
}
