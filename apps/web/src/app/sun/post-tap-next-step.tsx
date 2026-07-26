import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  ChevronRight,
  LockKeyhole,
  MapPinned,
  ShieldCheck,
  Sparkles,
  Store,
  WalletCards,
} from "lucide-react";
import { resolvePostTapQuickActionAvailability } from "./post-tap-policy";

type JourneyKind = "wine" | "seeds" | "chemicals" | "logistics" | "pharma" | "consumer";

type JourneyCopy = {
  badge: string;
  title: string;
  summary: string;
  primary: string;
  primaryHelp: string;
  marketplace: string;
};

type PostTapNextStepProps = {
  vertical: string;
  productName: string;
  isFreshTap: boolean;
  isSnapshotView: boolean;
  protectedTitle: string;
  protectedCopy: string;
  primaryActionHref: string;
  rewardsHref: string;
  marketplaceHref: string;
  certificateHref?: string | null;
  walletHref: string;
  reportProblemHref: string;
  allowedActions?: string[];
  blockedActions?: string[];
};

const JOURNEY_COPY: Record<JourneyKind, JourneyCopy> = {
  wine: {
    badge: "Vino y bebidas premium",
    title: "El mensaje de la etiqueta fue analizado. Elegí qué querés hacer.",
    summary: "Guardar la botella, activar beneficios o pedir propiedad digital son acciones separadas. Ninguna ocurre sólo por acercar el teléfono.",
    primary: "Iniciar validación de compra",
    primaryHelp: "Abrí el flujo seguro de contacto y comprobante cuando la política de la marca lo requiera.",
    marketplace: "Ver colección y reposición",
  },
  seeds: {
    badge: "Semillas y producción",
    title: "El lote fue identificado. Revisá origen antes de usarlo.",
    summary: "El tap comprueba la identidad disponible del envase. Después podés guardar la compra, consultar el recorrido y conservar la evidencia del lote.",
    primary: "Revisar requisitos y registrar lote",
    primaryHelp: "Abrí el flujo seguro; el tap por sí solo no transfiere custodia ni propiedad.",
    marketplace: "Ver catálogo y reposición",
  },
  chemicals: {
    badge: "Agroquímicos y fitosanitarios",
    title: "Primero seguridad del envase; después registro comercial.",
    summary: "Confirmá identidad, lote y condición del sello antes de manipular el producto. Si algo no coincide, no continúes con acciones premium y reportalo.",
    primary: "Revisar sello y registrar compra",
    primaryHelp: "Abrí el flujo seguro para guardar unidad, lote y comprobante de soporte o recall.",
    marketplace: "Ver reposición autorizada",
  },
  logistics: {
    badge: "Pallet, caja o embarque",
    title: "Revisá la ruta y los eventos antes de aceptar la entrega.",
    summary: "La pantalla separa identidad, ubicación declarada y evidencias de custodia. La recepción operativa requiere una acción explícita del responsable.",
    primary: "Revisar entrega y registrar custodia",
    primaryHelp: "Abrí el flujo autorizado de recepción; la custodia cambia sólo después de confirmarlo.",
    marketplace: "Abrir catálogo operativo",
  },
  pharma: {
    badge: "Pharma y salud",
    title: "Verificá lote, estado y trazabilidad antes de registrar.",
    summary: "La lectura ayuda a revisar la evidencia disponible; no reemplaza instrucciones clínicas, regulatorias ni controles de calidad.",
    primary: "Revisar requisitos de registro",
    primaryHelp: "Abrí el flujo seguro de postventa, recall o soporte definido por el laboratorio.",
    marketplace: "Ver productos del laboratorio",
  },
  consumer: {
    badge: "Producto conectado",
    title: "La identidad digital fue analizada. Elegí el siguiente paso.",
    summary: "Ver el producto, registrarlo y solicitar propiedad digital son acciones distintas y auditables.",
    primary: "Iniciar registro o garantía",
    primaryHelp: "Abrí el flujo seguro para aportar la evidencia requerida por la marca.",
    marketplace: "Ver más productos de la marca",
  },
};

function resolveJourneyKind(vertical: string, productName: string): JourneyKind {
  const haystack = `${vertical} ${productName}`.toLocaleLowerCase("es");
  if (/agroqu|quimic|químic|fitosanit|herbic|fungic|insectic|bidon|bidón|crop protection/.test(haystack)) return "chemicals";
  if (/logistic|pallet|shipment|cargo|container|cold chain|cadena fria|cadena fría|embarque/.test(haystack)) return "logistics";
  if (/pharma|farmac|medic|salud|health|laboratorio/.test(haystack)) return "pharma";
  if (/seed|semill|agro|grain|grano/.test(haystack)) return "seeds";
  if (/wine|vino|bodega|malbec|spirits|botella/.test(haystack)) return "wine";
  return "consumer";
}

export function PostTapNextStep({
  vertical,
  productName,
  isFreshTap,
  isSnapshotView,
  protectedTitle,
  protectedCopy,
  primaryActionHref,
  rewardsHref,
  marketplaceHref,
  certificateHref,
  walletHref,
  reportProblemHref,
  allowedActions = [],
  blockedActions = [],
}: PostTapNextStepProps) {
  const journeyKind = resolveJourneyKind(vertical, productName);
  const copy = JOURNEY_COPY[journeyKind];
  const available = resolvePostTapQuickActionAvailability({ allowedActions, blockedActions });
  const supportsRewards = (journeyKind === "wine" || journeyKind === "consumer") && available.rewards;
  const supportsWallet = (journeyKind === "wine" || journeyKind === "consumer")
    && available.wallet;

  if (!isFreshTap) {
    return (
      <section data-testid="post-tap-next-step" role="status" className="rounded-3xl border border-amber-300/25 bg-amber-500/10 p-5" aria-labelledby="post-tap-blocked-title">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-300/25 bg-slate-950/45 text-amber-200">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">Acciones protegidas</span>
            <h2 id="post-tap-blocked-title" className="mt-1 text-base font-black text-white">{protectedTitle}</h2>
            <p className="mt-1 text-xs leading-5 text-amber-50/80">{protectedCopy}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {isSnapshotView ? (
            <a href="#fresh-tap-required" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 text-center text-xs font-black text-slate-950 transition hover:bg-amber-200">
              Escanear la etiqueta otra vez
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <Link href={reportProblemHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 text-center text-xs font-black text-slate-950 transition hover:bg-amber-200">
              Reportar el problema
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
          <a href="#geo-trace" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/45 px-4 text-center text-xs font-black text-white transition hover:bg-slate-900">
            Ver evidencia disponible
            <MapPinned className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          </a>
        </div>
      </section>
    );
  }

  const secondaryActions = [
    ...(available.trace ? [{
      key: "trace",
      href: "#geo-trace",
      label: journeyKind === "logistics" ? "Revisar ruta y eventos" : "Ver origen y trazabilidad",
      help: "Separá datos declarados, eventos observados y pruebas públicas.",
      icon: MapPinned,
    }] : []),
    ...(certificateHref && available.certificate ? [{
      key: "certificate",
      href: certificateHref,
      label: "Abrir certificado verificable",
      help: "Consultá el comprobante público y su evidencia técnica.",
      icon: BadgeCheck,
    }] : []),
    ...(!available.primary && available.warranty ? [{
      key: "warranty",
      href: "#warranty-action",
      label: "Registrar garantía",
      help: "Abrí la acción de garantía habilitada para este producto.",
      icon: ShieldCheck,
    }] : []),
    ...(supportsRewards ? [{
      key: "rewards",
      href: rewardsHref,
      label: "Entrar al club de la marca",
      help: "Beneficios y puntos sólo después de una acción explícita.",
      icon: Sparkles,
    }] : []),
    ...(available.marketplace ? [{
      key: "marketplace",
      href: marketplaceHref,
      label: copy.marketplace,
      help: "Explorá opciones comerciales sin alterar la evidencia del producto.",
      icon: Store,
    }] : []),
    ...(supportsWallet ? [{
      key: "wallet",
      href: walletHref,
      label: "Ver propiedad digital opcional",
      help: "Wallet o NFT sólo si la política y la compra quedan validadas.",
      icon: WalletCards,
    }] : []),
  ];

  return (
    <section data-testid="post-tap-next-step" className="rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-500/10 via-slate-950/85 to-cyan-500/10 p-5 shadow-xl" aria-labelledby="post-tap-next-step-title">
      <header>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {copy.badge}
        </span>
        <h2 id="post-tap-next-step-title" className="mt-3 text-lg font-black leading-tight text-white">{copy.title}</h2>
        <p className="mt-2 text-xs leading-5 text-slate-300">{copy.summary}</p>
      </header>

      <ol className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Progreso después del tap">
        <li className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-3">
          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-200">1 · listo</span>
          <strong className="mt-1 block text-xs text-white">Lectura analizada</strong>
        </li>
        <li className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-3" aria-current="step">
          <span className="text-[9px] font-black uppercase tracking-wider text-cyan-200">2 · ahora</span>
          <strong className="mt-1 block text-xs text-white">Elegí tu objetivo</strong>
        </li>
        <li className="rounded-2xl border border-white/10 bg-slate-950/45 p-3">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">3 · después</span>
          <strong className="mt-1 block text-xs text-white">Registro auditable</strong>
        </li>
      </ol>

      {available.primary ? (
        <Link href={primaryActionHref} className="mt-4 flex min-h-16 items-center justify-between gap-3 rounded-2xl bg-emerald-300 p-4 text-slate-950 shadow-[0_0_22px_rgba(110,231,183,0.18)] transition hover:bg-emerald-200 active:scale-[0.99]">
          <span className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="text-left">
              <strong className="block text-sm font-black leading-tight">{copy.primary}</strong>
              <small className="mt-1 block text-[10px] font-semibold leading-4 text-slate-800">{copy.primaryHelp}</small>
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0" aria-hidden="true" />
        </Link>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {secondaryActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.key} href={action.href} className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-white transition hover:border-cyan-300/25 hover:bg-slate-900">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-500/10 text-cyan-200">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <strong className="block text-xs font-black leading-4">{action.label}</strong>
                <small className="mt-0.5 block text-[10px] leading-4 text-slate-400">{action.help}</small>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
