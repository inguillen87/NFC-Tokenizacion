import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Box,
  Check,
  CircleAlert,
  ExternalLink,
  Fingerprint,
  KeyRound,
  Link2,
  LockKeyhole,
  Network,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { ThemeToggle } from "@product/ui";
import { productUrls } from "@product/config";
import styles from "./ownership.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Polygon Ownership Certificate | nexID",
  description: "Certificado publico de ownership testnet con verificacion on-chain, metadata HTTPS y limites de prueba explicados por nexID.",
};

type CertificateCheck = { id: string; label: string; ok: boolean; detail: string };

type OwnershipCertificate = {
  ok?: boolean;
  verification_state?: "confirmed" | "partial" | "unavailable" | "invalid_configuration";
  reason?: string;
  certificate_id?: string;
  environment?: string;
  network?: string;
  chain_id?: number;
  contract_address?: string;
  token_id?: string;
  expected_metadata_url?: string;
  generated_at?: string;
  product?: {
    name?: string;
    category?: string;
    certificate_type?: string;
    asset_ref?: string;
    physical_binding?: string;
  };
  owner?: { address?: string; label?: string; custody?: string; wallet_control_verified?: boolean; explorer_url?: string };
  token?: { name?: string; symbol?: string; token_uri?: string; chip_uid_hash?: string; asset_ref?: string };
  mint?: { tx_hash?: string | null; block_number?: number | null; confirmations?: number; status?: string };
  checks?: CertificateCheck[];
  links?: {
    metadata?: string;
    contract_explorer?: string;
    token_explorer?: string;
    owner_explorer?: string;
    transaction_explorer?: string | null;
    source_verification?: string | null;
  };
  proof_boundary?: { proves?: string[]; does_not_prove_alone?: string[] };
  privacy?: { public?: string[]; private?: string[] };
};

const fallback: OwnershipCertificate = {
  ok: false,
  verification_state: "unavailable",
  reason: "certificate_api_unavailable",
  certificate_id: "NX-POLYGON-AMOY",
  environment: "testnet",
  network: "polygon-amoy",
  chain_id: 80002,
  checks: [],
};

function apiBase() {
  return String(productUrls.api || "https://api.nexid.lat").replace(/\/$/, "");
}

async function loadCertificate(): Promise<OwnershipCertificate> {
  try {
    const response = await fetch(`${apiBase()}/public/polygon/ownership`, { cache: "no-store" });
    const body = await response.json().catch(() => null) as OwnershipCertificate | null;
    return body || fallback;
  } catch {
    return fallback;
  }
}

function short(value?: string | null, left = 12, right = 10) {
  const text = String(value || "");
  if (!text) return "No disponible";
  if (text.length <= left + right + 3) return text;
  return `${text.slice(0, left)}...${text.slice(-right)}`;
}

function statusCopy(state?: OwnershipCertificate["verification_state"]) {
  if (state === "confirmed") {
    return {
      label: "Emision testnet confirmada",
      title: "El registro coincide con Polygon Amoy.",
      body: "Contrato, eventos del mint, holder actual y metadata publica fueron leidos en vivo. El token sigue bajo custodia de plataforma, no de un comprador.",
      className: "border-emerald-300/40 bg-emerald-500/12 text-emerald-950 dark:text-emerald-100",
    };
  }
  if (state === "partial") {
    return {
      label: "Prueba parcial",
      title: "El token existe, pero falta cerrar una comprobacion.",
      body: "Mira la lista de controles: no mostramos un certificado como completo hasta que mint, owner y metadata coincidan.",
      className: "border-amber-300/50 bg-amber-400/12 text-amber-950 dark:text-amber-100",
    };
  }
  return {
    label: "Red no disponible",
    title: "No pudimos consultar Polygon ahora.",
    body: "El certificado no inventa un resultado. Puedes reintentar o abrir el explorer directamente.",
    className: "border-rose-300/40 bg-rose-500/10 text-rose-950 dark:text-rose-100",
  };
}

function ExternalButton({ href, children, tone = "cyan" }: { href?: string | null; children: React.ReactNode; tone?: "cyan" | "violet" | "neutral" }) {
  if (!href) return null;
  const tones = {
    cyan: "border-cyan-400/40 bg-cyan-400/12 text-cyan-950 hover:bg-cyan-400/20 dark:text-cyan-100",
    violet: "border-violet-400/40 bg-violet-400/12 text-violet-950 hover:bg-violet-400/20 dark:text-violet-100",
    neutral: "border-slate-300 bg-white/70 text-slate-800 hover:bg-white dark:border-white/15 dark:bg-white/[0.05] dark:text-slate-100",
  };
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-xs font-black uppercase ${tones[tone]}`}>
      {children} <ExternalLink className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}

export default async function PolygonOwnershipPage() {
  const certificate = await loadCertificate();
  const status = statusCopy(certificate.verification_state);
  const checks = certificate.checks || [];
  const passed = checks.filter((check) => check.ok).length;
  const sourceCheck = checks.find((check) => check.id === "source");
  const essentialPassed = checks.filter((check) => check.id !== "source" && check.ok).length;
  const essentialTotal = checks.filter((check) => check.id !== "source").length;

  return (
    <main className={styles.page}>
      <header className={`${styles.header} sticky top-0 z-40 border-b backdrop-blur-xl`}>
        <div className={`${styles.headerInner} mx-auto min-h-16 max-w-7xl items-center gap-3 px-4 sm:px-6`}>
          <Link
            href="/demo-lab?scenario=polygon-ownership"
            aria-label="Volver a Demo Lab"
            className={`${styles.backLink} inline-flex min-h-11 items-center gap-2 text-sm font-black`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className={styles.backLabel}>Demo Lab</span>
          </Link>
          <div className={`${styles.brand} min-w-0 text-center`}>
            <b className={`${styles.brandTitle} block truncate text-sm font-black`}>nexID Ownership</b>
            <span className={`${styles.brandEyebrow} block text-[10px] font-black uppercase`}>certificado publico</span>
          </div>
          <div className={styles.themeControl}>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <section className={`${styles.surfaceBand} border-b`}>
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-14">
          <div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-black uppercase ${status.className}`}>
              {certificate.verification_state === "confirmed" ? <BadgeCheck className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
              {status.label}
            </div>
            <p className="mt-6 text-xs font-black uppercase text-violet-700 dark:text-violet-300">{certificate.certificate_id || "NX-POLYGON-AMOY"}</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black leading-[1.04] sm:text-6xl">Una emision testnet que cualquiera puede comprobar.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              nexID demuestra mint, holder y metadata sin publicar identidad, factura ni secretos NFC. Este fixture esta en custodia de la plataforma; buyer ownership exige firma de wallet y transferencia posterior.
            </p>
            <div className="mt-7 flex flex-col gap-2 sm:flex-row">
              <ExternalButton href={certificate.links?.transaction_explorer}>Ver mint real</ExternalButton>
              <ExternalButton href={certificate.links?.token_explorer} tone="violet">Ver token</ExternalButton>
              <Link href="/proof/verify?layer=iota#iota-proof" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 text-xs font-black uppercase text-slate-800 dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-100">
                Comparar con IOTA <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className={`${styles.mediaFrame} relative min-h-[360px] overflow-hidden rounded-lg border`}>
            <img src="/demo/wine-secure/real-malbec-bottle-pexels.jpg" alt="Producto premium usado en el piloto de ownership" className="absolute inset-0 h-full w-full object-cover" />
            <div className={`${styles.mediaOverlay} absolute inset-x-0 bottom-0 p-5 backdrop-blur-md`}>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-cyan-300">Fixture de emision</p>
                  <strong className="mt-1 block text-xl" style={{ color: "#ffffff" }}>{certificate.product?.name || "Producto premium"}</strong>
                  <span className="mt-1 block text-xs" style={{ color: "#cbd5e1" }}>Token #{certificate.token_id || "-"} - {certificate.token?.symbol || "NXDT"}</span>
                </div>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-cyan-300/40 bg-cyan-400/10"><Fingerprint className="h-6 w-6 text-cyan-200" /></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className={`rounded-lg border p-5 ${status.className}`} aria-live="polite">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase">Veredicto</p>
              <h2 className="mt-2 text-2xl font-black">{status.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 opacity-80">{status.body}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg border border-current/20 bg-white/35 px-4 py-3 dark:bg-black/10">
                <strong className="block text-2xl">{essentialPassed}/{essentialTotal || 5}</strong>
                <span className="text-[10px] font-black uppercase">controles clave</span>
              </div>
              <div className="rounded-lg border border-current/20 bg-white/35 px-4 py-3 dark:bg-black/10">
                <strong className="block text-2xl">{certificate.mint?.confirmations || 0}</strong>
                <span className="text-[10px] font-black uppercase">confirmaciones</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.surfaceBand} border-y`}>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <p className="text-xs font-black uppercase text-cyan-700 dark:text-cyan-300">Tres capas, tres responsabilidades</p>
          <h2 className="mt-2 text-3xl font-black">Que esta probando cada sistema</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { Icon: ShieldCheck, label: "nexID", title: "Aporta el contexto del producto", body: "En produccion, un tap fresco, el chip y la politica tenant deben aprobarse antes de habilitar buyer ownership.", tone: "text-cyan-700 dark:text-cyan-300" },
              { Icon: Network, label: "Polygon", title: "Registra emision y holder", body: "El contrato NXDT muestra mint, token ID, metadata y holder actual. En este piloto el holder es la wallet de custodia nexID.", tone: "text-violet-700 dark:text-violet-300" },
              { Icon: LockKeyhole, label: "Privacidad", title: "No publica al comprador", body: "Una wallet es visible; nombre, email, factura, garantia y secretos NFC permanecen dentro de nexID.", tone: "text-emerald-700 dark:text-emerald-300" },
            ].map(({ Icon, label, title, body, tone }) => (
              <article key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.035]">
                <Icon className={`h-6 w-6 ${tone}`} />
                <p className={`mt-5 text-[10px] font-black uppercase ${tone}`}>{label}</p>
                <h3 className="mt-2 text-xl font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-violet-700 dark:text-violet-300">Lectura on-chain</p>
              <h2 className="mt-2 text-3xl font-black">Comprobaciones del certificado</h2>
            </div>
            <span className="rounded-full border border-slate-300 px-3 py-1 text-xs font-black dark:border-white/15">{passed}/{checks.length || 6}</span>
          </div>
          <div className="mt-5 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-[#081426]">
            {checks.length ? checks.map((check) => (
              <div key={check.id} className="grid grid-cols-[auto_1fr] gap-3 p-4">
                <span className={`mt-0.5 grid h-7 w-7 place-items-center rounded-full ${check.ok ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"}`}>
                  {check.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <strong className="block text-sm">{check.label}</strong>
                  <span className="mt-1 block break-all font-mono text-xs leading-5 text-slate-500 dark:text-slate-400">{check.detail}</span>
                </div>
              </div>
            )) : (
              <div className="p-5 text-sm text-slate-600 dark:text-slate-300">La API no respondio. No se muestra ningun check como aprobado por defecto.</div>
            )}
          </div>
          {sourceCheck && !sourceCheck.ok ? (
            <p className="mt-3 rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
              El bytecode y las lecturas del contrato son publicas, pero el source code todavia no aparece verificado en el explorer. Por eso este control queda pendiente y visible.
            </p>
          ) : null}
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#081426]">
          <p className="text-xs font-black uppercase text-cyan-700 dark:text-cyan-300">Datos tecnicos traducidos</p>
          <h2 className="mt-2 text-2xl font-black">Lo que veria un auditor</h2>
          <dl className="mt-5 grid gap-3">
            {[
              ["Red", `Polygon Amoy - Chain ID ${certificate.chain_id || 80002}`],
              ["Contrato", short(certificate.contract_address)],
              ["Token", `#${certificate.token_id || "-"} - ${certificate.token?.name || "Nexid Digital Twin"}`],
              ["Owner", short(certificate.owner?.address)],
              ["Custodia", certificate.owner?.custody === "platform_managed" ? "Wallet administrada por nexID" : "Wallet externa"],
              ["Mint", short(certificate.mint?.tx_hash)],
              ["Metadata", short(certificate.token?.token_uri, 24, 18)],
              ["Binding", short(certificate.token?.chip_uid_hash, 18, 14)],
            ].map(([label, value]) => (
              <div key={label} className="grid gap-1 border-b border-slate-200 pb-3 last:border-0 dark:border-white/10 sm:grid-cols-[110px_1fr]">
                <dt className="text-[10px] font-black uppercase text-slate-500">{label}</dt>
                <dd className="break-all font-mono text-xs font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <ExternalButton href={certificate.links?.contract_explorer} tone="neutral">Contrato</ExternalButton>
            <ExternalButton href={certificate.links?.metadata} tone="neutral">Metadata</ExternalButton>
            <ExternalButton href={certificate.links?.source_verification} tone="neutral">Source verificado</ExternalButton>
          </div>
        </aside>
      </section>

      <section className={`${styles.deepBand} border-y`}>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <p className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-300">De este fixture a buyer ownership</p>
          <h2 className="mt-2 text-3xl font-black">La cadena completa, sin confundir custodia con propiedad</h2>
          <div className="mt-7 grid gap-3 md:grid-cols-4">
            {[
              { Icon: Fingerprint, step: "1", title: "Verificar producto", body: "nexID valida NFC/QR, lote y estado." },
              { Icon: Box, step: "2", title: "Emitir fixture", body: "Estado actual: NXDT en custodia de plataforma." },
              { Icon: KeyRound, step: "3", title: "Probar wallet", body: "El comprador firma un challenge; aun no ocurre en este fixture." },
              { Icon: Link2, step: "4", title: "Transferir y certificar", body: "Solo la transferencia confirmada habilita buyer ownership." },
            ].map(({ Icon, step, title, body }) => (
              <article key={step} className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                  <span className="text-xs font-black text-slate-500 dark:text-slate-500">{step}/4</span>
                </div>
                <h3 className="mt-5 text-lg font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:px-6 md:grid-cols-2">
        <article className="rounded-lg border border-emerald-300/50 bg-emerald-50 p-5 dark:bg-emerald-500/10">
          <p className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-300">Publico</p>
          <h2 className="mt-2 text-2xl font-black">Lo necesario para auditar</h2>
          <ul className="mt-4 grid gap-2 text-sm text-emerald-950 dark:text-emerald-100">
            {(certificate.privacy?.public || ["contrato", "token ID", "owner wallet", "mint transaction", "metadata"]).map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" /> {item}</li>)}
          </ul>
        </article>
        <article className="rounded-lg border border-amber-300/60 bg-amber-50 p-5 dark:bg-amber-500/10">
          <p className="text-xs font-black uppercase text-amber-800 dark:text-amber-300">Privado dentro de nexID</p>
          <h2 className="mt-2 text-2xl font-black">Lo que nunca va al explorer</h2>
          <ul className="mt-4 grid gap-2 text-sm text-amber-950 dark:text-amber-100">
            {(certificate.privacy?.private || ["raw NFC UID", "buyer identity", "invoice", "warranty documents"]).map((item) => <li key={item} className="flex gap-2"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /> {item}</li>)}
          </ul>
        </article>
      </section>

      <footer className={`${styles.footer} border-t`}>
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xs font-black uppercase text-violet-700 dark:text-violet-300">Siguiente paso</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Reproduce el flujo o compara ownership con la prueba hash-only de IOTA.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/demo-lab?scenario=polygon-ownership" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-xs font-black uppercase text-white dark:bg-cyan-300 dark:text-slate-950">
              Reproducir Demo Lab <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/proof/verify?layer=iota#iota-proof" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-xs font-black uppercase dark:border-white/15">
              Abrir Proof Verify <WalletCards className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
