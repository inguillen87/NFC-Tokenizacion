"use client";

import {
  AlertTriangle,
  BellRing,
  ChevronRight,
  Gift,
  Headphones,
  LockKeyhole,
  ShoppingBag,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import type { AppLocale } from "@product/config";
import type { DemoExperienceAction } from "../../lib/demo-product-profiles";
import {
  resolveSunServicesHubAvailability,
  type SunServicesFreshnessState,
  type SunServicesPolicyAvailability,
  type SunServicesRiskState,
} from "./sun-services-hub-model";
import { useSunLocale } from "./sun-locale-provider";
import { ConsumerTapLink } from "./consumer-passport-link";

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
  locale: AppLocale;
  demoIntent?: DemoExperienceAction | null;
  eventId?: string;
  freshToken?: string;
};

const RISK_COPY: Record<SunServicesRiskState, { label: string; detail: string; className: string }> = {
  clear: {
    label: "Sin observaciones adicionales de la lectura",
    detail: "Este estado técnico no determina si el lote tiene un retiro o restricción comercial.",
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

const ACTION_CLASS_NAME = "sun-services-action group flex min-h-20 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-3 text-left text-white transition hover:border-cyan-300/30 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300";
const DEMO_ACTION_CLASS_NAME = "sun-services-action flex min-h-20 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-3 text-left text-white";

const DEMO_ACTION_ICONS: Readonly<Record<DemoExperienceAction, typeof ShieldCheck>> = {
  warranty: ShieldCheck,
  benefit: Gift,
  support: Headphones,
};

type DemoServicesCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  freshness: string;
  riskLabel: string;
  riskDetail: string;
  selectionNote: string;
  actionsLabel: string;
  selectedBadge: string;
  actions: Readonly<Record<DemoExperienceAction, {
    label: string;
    detail: string;
  }>>;
};

const DEMO_COPY: Readonly<Record<AppLocale, DemoServicesCopy>> = {
  "es-AR": {
    eyebrow: "Opciones de la experiencia",
    title: "¿Qué podés hacer desde este producto?",
    subtitle: "Esta muestra explica las opciones sin enviar solicitudes ni activar servicios reales.",
    freshness: "Muestra sin tap físico",
    riskLabel: "Servicios de muestra",
    riskDetail: "Recorré el formato sin crear un reclamo, una compra ni un beneficio real.",
    selectionNote: "La opción destacada es la que elegiste en el Demo Lab. Esta vista no envía solicitudes ni activa servicios reales.",
    actionsLabel: "Opciones ilustrativas para este producto",
    selectedBadge: "Elegiste esta",
    actions: {
      warranty: {
        label: "Activar garantía",
        detail: "Ejemplo del alta y seguimiento que la marca puede ofrecer desde el producto.",
      },
      benefit: {
        label: "Ver beneficios",
        detail: "Ejemplo de una ventaja publicada con condiciones y vigencia visibles.",
      },
      support: {
        label: "Hablar con la marca",
        detail: "Ejemplo de un canal de atención asociado a este producto y lote.",
      },
    },
  },
  en: {
    eyebrow: "Experience options",
    title: "What can you do from this product?",
    subtitle: "This preview explains each option without sending requests or activating real services.",
    freshness: "Preview without a physical tap",
    riskLabel: "Preview services",
    riskDetail: "Explore the format without creating a claim, purchase, or real benefit.",
    selectionNote: "The highlighted option is the one you chose in Demo Lab. This preview does not send requests or activate real services.",
    actionsLabel: "Illustrative options for this product",
    selectedBadge: "Your choice",
    actions: {
      warranty: {
        label: "Activate warranty",
        detail: "Example of the registration and follow-up a brand can offer from the product.",
      },
      benefit: {
        label: "View benefits",
        detail: "Example of an offer with clearly displayed terms and validity.",
      },
      support: {
        label: "Contact the brand",
        detail: "Example of a support channel linked to this product and batch.",
      },
    },
  },
  "pt-BR": {
    eyebrow: "Opções da experiência",
    title: "O que você pode fazer a partir deste produto?",
    subtitle: "Esta demonstração explica as opções sem enviar solicitações nem ativar serviços reais.",
    freshness: "Demonstração sem toque físico",
    riskLabel: "Serviços de demonstração",
    riskDetail: "Explore o formato sem criar uma reclamação, compra ou benefício real.",
    selectionNote: "A opção em destaque é a que você escolheu no Demo Lab. Esta demonstração não envia solicitações nem ativa serviços reais.",
    actionsLabel: "Opções ilustrativas para este produto",
    selectedBadge: "Sua escolha",
    actions: {
      warranty: {
        label: "Ativar garantia",
        detail: "Exemplo do cadastro e acompanhamento que a marca pode oferecer a partir do produto.",
      },
      benefit: {
        label: "Ver benefícios",
        detail: "Exemplo de uma vantagem com condições e validade apresentadas com clareza.",
      },
      support: {
        label: "Falar com a marca",
        detail: "Exemplo de um canal de atendimento associado a este produto e lote.",
      },
    },
  },
};

export function SunServicesHub({
  promotion,
  purchaseHref,
  subscribeHref,
  claimOrManageHref,
  warrantyHref,
  riskState,
  freshnessState,
  policyAvailability,
  locale,
  demoIntent,
  eventId = "",
  freshToken = "",
}: SunServicesHubProps) {
  const { locale: activeLocale, text } = useSunLocale();
  const isDemo = freshnessState === "demo";
  const demoCopy = DEMO_COPY[activeLocale || locale];
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
        label: demoCopy.riskLabel,
        detail: demoCopy.riskDetail,
        className: "border-cyan-300/20 bg-cyan-500/10 text-cyan-100",
      }
    : RISK_COPY[riskState];
  const publishedPoints = typeof promotion?.points === "number"
    && Number.isFinite(promotion.points)
    && promotion.points > 0
    ? Math.floor(promotion.points)
    : null;

  const liveActions = [
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
  const demoActions = (["warranty", "benefit", "support"] as DemoExperienceAction[]).map((key) => ({
    key,
    ...demoCopy.actions[key],
    icon: DEMO_ACTION_ICONS[key],
    selected: key === (demoIntent || "warranty"),
  }));

  return (
    <section className="sun-services-card rounded-3xl border border-white/10 bg-[#0a1020]/95 p-5 shadow-2xl shadow-black/20" aria-labelledby="sun-services-title" data-sun-dock-avoid>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">{isDemo ? demoCopy.eyebrow : "Servicios de la marca"}</span>
          <h2 id="sun-services-title" className="mt-1 text-xl font-black tracking-tight text-white">{isDemo ? demoCopy.title : "¿Qué querés hacer con este producto?"}</h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">{isDemo ? demoCopy.subtitle : "Cada acción es opcional y se procesa por separado de la lectura NFC."}</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1.5 text-[10px] font-bold text-slate-300">
          <span className={`h-2 w-2 rounded-full ${freshnessState === "fresh" ? "bg-emerald-300" : "bg-amber-300"}`} aria-hidden="true" />
          {isDemo ? demoCopy.freshness : FRESHNESS_LABEL[freshnessState]}
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

      <div
        className={`mt-4 rounded-2xl border p-4 ${available.promotionDegraded ? "border-amber-300/20 bg-amber-500/[0.06]" : "border-violet-300/15 bg-violet-500/[0.07]"}`}
        data-sun-experience-impression={!isDemo && available.promotionVisible ? "LOYALTY_OFFER_VIEWED" : undefined}
        data-sun-experience-placement="services_promotion"
        data-sun-experience-interaction="published_offer_visible"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-500/10 text-violet-200">
            <Gift className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-200">
              {promotion?.sourceLabel ? <span data-sun-server-evidence={(!isDemo).toString()}>{promotion.sourceLabel}</span> : "Beneficios publicados por la marca"}
            </span>
            {!promotionPublished ? (
              <p className="mt-1 text-sm font-semibold leading-5 text-slate-300">La marca no publicó una promoción para este producto</p>
            ) : available.promotionVisible ? (
              <>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h3 data-sun-server-evidence={(!isDemo).toString()} className="text-sm font-black text-white">{promotion?.title}</h3>
                  {promotion?.state ? <span data-sun-server-evidence={(!isDemo).toString()} className="rounded-full border border-white/10 bg-slate-950/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-300">{promotion.state}</span> : null}
                  {available.promotionDegraded ? <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-100">Revisar lectura</span> : null}
                </div>
                {promotion?.description ? <p data-sun-server-evidence={(!isDemo).toString()} className="mt-1 text-xs leading-5 text-slate-300">{promotion.description}</p> : null}
                {publishedPoints ? <p className="mt-2 text-[10px] font-bold text-violet-200">{text(`${publishedPoints.toLocaleString(activeLocale || locale)} puntos informados por la marca · sujetos a sus condiciones`)}</p> : null}
              </>
            ) : (
              <p className="mt-1 text-sm font-semibold leading-5 text-slate-300">
                {riskState === "blocked" ? "La promoción queda oculta mientras esta lectura requiere revisión." : "La promoción no está habilitada por la política de este producto."}
              </p>
            )}
          </div>
        </div>
      </div>

      {isDemo ? (
        <p className="mt-3 text-[11px] leading-4 text-cyan-100/75">{demoCopy.selectionNote}</p>
      ) : freshnessState !== "fresh" ? (
        <p className="mt-3 text-[11px] leading-4 text-amber-100/75">Las acciones protegidas pueden pedir una nueva lectura NFC antes de continuar.</p>
      ) : null}

      {isDemo ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-3" role="list" aria-label={demoCopy.actionsLabel}>
          {demoActions.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.key}
                role="listitem"
                data-demo-selected-intent={action.selected ? action.key : undefined}
                className={`${DEMO_ACTION_CLASS_NAME} ${action.selected ? "border-cyan-200/50 bg-cyan-400/15 ring-1 ring-cyan-300/25" : ""}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-500/10 text-cyan-200">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-xs font-black leading-4">{action.label}</strong>
                  <small className="mt-1 block text-[10px] font-medium leading-4 text-slate-400">{action.detail}</small>
                </span>
                {action.selected ? <span className="rounded-full bg-cyan-300 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-slate-950">{demoCopy.selectedBadge}</span> : null}
              </div>
            );
          })}
        </div>
      ) : liveActions.length ? (
        <nav className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Servicios disponibles para este producto">
          {liveActions.map((action) => {
            const Icon = action.icon;
            const content = <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-500/10 text-cyan-200">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-xs font-black leading-4">{action.label}</strong>
                  <small className="mt-1 block text-[10px] font-medium leading-4 text-slate-400">{action.detail}</small>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" aria-hidden="true" />
            </>;
            return /^\/me(?:[/?#]|$)/.test(action.href)
              ? <ConsumerTapLink key={action.key} href={action.href} eventId={eventId} freshToken={freshnessState === "fresh" && riskState !== "blocked" ? freshToken : ""} className={`${ACTION_CLASS_NAME} w-full`}>{content}</ConsumerTapLink>
              : <a key={action.key} href={action.href} className={ACTION_CLASS_NAME}>{content}</a>;
          })}
        </nav>
      ) : (
        <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-xs leading-5 text-slate-400">La marca no habilitó servicios adicionales para este producto.</p>
      )}
    </section>
  );
}
