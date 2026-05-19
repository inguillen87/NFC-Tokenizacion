import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ExternalLink, FileCheck2, Fingerprint, ShieldCheck, Store, WalletCards } from "lucide-react";
import { productUrls } from "@product/config";

export const dynamic = "force-dynamic";

type CertificateFactor = { label?: string; ok?: boolean };
type CertificateTimelineItem = { eventId?: string; result?: string | null; city?: string | null; country?: string | null; at?: string | null };

type CertificatePayload = {
  ok?: boolean;
  certificate?: {
    id?: string;
    publicUrl?: string;
    status?: string;
    statusLabel?: string;
    product?: {
      name?: string | null;
      brand?: string | null;
      sku?: string | null;
      imageUrl?: string | null;
      vertical?: string | null;
      vintage?: string | null;
      varietal?: string | null;
      batch?: string | null;
    };
    tenant?: { slug?: string | null; name?: string | null; clubName?: string | null };
    tap?: { eventId?: string; result?: string | null; reason?: string | null; at?: string | null; city?: string | null; country?: string | null; scans?: number | string | null };
    origin?: { label?: string | null; lat?: string | number | null; lng?: string | number | null };
    identity?: { uidMasked?: string | null; bid?: string | null; carrier?: string | null };
    ownership?: { status?: string | null; claimed?: boolean; claimedAt?: string | null; ownerLabel?: string | null };
    tokenization?: { status?: string | null; network?: string | null; txHash?: string | null; tokenId?: string | null; anchorHash?: string | null; processedAt?: string | null; explorerUrl?: string | null };
    trust?: { score?: number | string | null; factors?: CertificateFactor[] };
    timeline?: CertificateTimelineItem[];
  };
};

function fmtDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

function chainLabel(status?: string | null) {
  const normalized = String(status || "none").toLowerCase();
  if (normalized === "anchored") return "On-chain";
  if (normalized === "simulated") return "Sandbox";
  if (normalized === "pending" || normalized === "processing" || normalized === "pending_retry") return "En cola";
  if (normalized === "blocked") return "Protegido";
  if (normalized === "failed") return "Revision";
  return "Disponible";
}

async function fetchCertificate(eventId: string): Promise<CertificatePayload | null> {
  const res = await fetch(`${productUrls.api}/public/certificates/${encodeURIComponent(eventId)}`, { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json().catch(() => null);
}

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const { eventId } = await params;
  return {
    title: `Certificado nexID #${eventId}`,
    description: "Certificado publico de autenticidad, ownership y tokenizacion nexID.",
  };
}

export default async function PublicCertificatePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const payload = await fetchCertificate(eventId);
  const cert = payload?.certificate;

  if (!cert) {
    return (
      <main className="min-h-screen overflow-hidden bg-[#070b14] px-4 py-8 text-slate-100">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,.16),transparent_34%),linear-gradient(180deg,rgba(15,23,42,.2),#070b14_72%)]" />
        <section className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-5 lg:grid-cols-[1fr_.8fr]">
          <div className="rounded-[2rem] border border-amber-300/20 bg-amber-500/10 p-6 shadow-[0_30px_90px_rgba(0,0,0,.35)] backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-200">Certificado pendiente</p>
            <h1 className="mt-3 text-4xl font-black leading-tight text-white sm:text-6xl">Este Passport todavia no esta sincronizado.</h1>
            <p className="mt-4 text-sm leading-6 text-amber-50/80">
              El link #{eventId} existe como destino publico. Cuando el evento de tap este en la API, esta misma pantalla muestra autenticidad,
              ownership, wallet/NFT, tx de Polygon y la historia completa del producto.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <Link href="/demo-lab" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-500/15 px-4 text-sm font-black text-cyan-100">
                Ver Demo Lab
              </Link>
              <Link href="/me/products" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-500/15 px-4 text-sm font-black text-emerald-100">
                Mis productos
              </Link>
              <Link href="/me/wallet" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-500/15 px-4 text-sm font-black text-violet-100">
                Wallet / NFT
              </Link>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Que deberia pasar</p>
            <ol className="mt-4 space-y-3 text-sm">
              {[
                ["1", "Tap fresco", "El chip valida autenticidad y abre este certificado."],
                ["2", "Claim seguro", "Email/celular + reglas de ownership asocian el producto."],
                ["3", "NFT opcional", "Si el tenant lo permite, se emite o prepara token en Polygon."],
                ["4", "Link permanente", "El consumidor comparte certificado, wallet o marketplace."],
              ].map(([step, title, body]) => (
                <li key={step} className="grid grid-cols-[auto_1fr] gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-cyan-300/30 bg-cyan-500/15 text-xs font-black text-cyan-100">{step}</span>
                  <span>
                    <b className="block text-white">{title}</b>
                    <small className="mt-1 block leading-5 text-slate-400">{body}</small>
                  </span>
                </li>
              ))}
            </ol>
          </aside>
        </section>
      </main>
    );
  }

  const product = cert.product || {};
  const tenant = cert.tenant || {};
  const tap = cert.tap || {};
  const ownership = cert.ownership || {};
  const token = cert.tokenization || {};
  const trust = cert.trust || {};
  const score = Number(trust.score || 0);
  const tenantSlug = String(tenant.slug || "");
  const walletHref = tenantSlug ? `/me/wallet?tenant=${encodeURIComponent(tenantSlug)}&eventId=${encodeURIComponent(String(tap.eventId || eventId))}` : `/me/wallet?eventId=${encodeURIComponent(String(tap.eventId || eventId))}`;
  const marketplaceHref = tenantSlug ? `/me/marketplace?tenant=${encodeURIComponent(tenantSlug)}` : "/me/marketplace";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#070b14] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(124,58,237,.18),transparent_35%),linear-gradient(180deg,rgba(15,23,42,.35),#070b14_70%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:py-8">
        <header className="flex w-full max-w-[calc(100vw-2rem)] flex-col items-start justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur-xl sm:max-w-none sm:flex-row sm:items-center">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-500/10 text-sm font-black text-cyan-100">NX</span>
            <span className="min-w-0">
              <b className="block text-sm font-black text-white">nexID</b>
              <small className="block text-[10px] uppercase tracking-[0.18em] text-cyan-200">certificado publico</small>
            </span>
          </Link>
          <span className="max-w-full rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">
            {cert.statusLabel || "Producto autentico"}
          </span>
        </header>

        <section className="grid min-w-0 flex-1 gap-5 py-6 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div className="min-w-0 space-y-5">
            <div className="min-w-0 max-w-[calc(100vw-2rem)] rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-[0_30px_90px_rgba(0,0,0,.35)] backdrop-blur-xl sm:max-w-none">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Certificado #{tap.eventId || eventId}</p>
              <h1 className="mt-3 max-w-full break-words text-3xl font-black leading-tight text-white [overflow-wrap:anywhere] sm:text-6xl">
                {product.name || "Producto verificado"}
              </h1>
              <p className="mt-3 max-w-full break-words text-sm leading-6 text-slate-300 [overflow-wrap:anywhere] sm:text-base sm:leading-7">
                <span className="block">{product.brand || tenant.name || "Marca verificada"} confirma autenticidad y origen.</span>
                <span className="block">Propiedad + NFT visibles. Certificado compartible.</span>
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                {[
                  [ShieldCheck, "Autenticidad", String(tap.result || "verificado").toUpperCase()],
                  [Fingerprint, "UID", cert.identity?.uidMasked || "Protegido"],
                  [BadgeCheck, "Ownership", ownership.claimed ? "Verificado" : "Reclamable"],
                  [WalletCards, "NFT", chainLabel(token.status)],
                ].map(([Icon, label, value]) => {
                  const ItemIcon = Icon as typeof ShieldCheck;
                  return (
                    <article key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <ItemIcon className="h-4 w-4 text-cyan-200" aria-hidden="true" />
                      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label as string}</p>
                      <strong className="mt-1 block text-sm text-white">{value as string}</strong>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="grid max-w-[calc(100vw-2rem)] gap-3 sm:max-w-none sm:grid-cols-3">
              <Link href={walletHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-500/15 px-4 text-sm font-black text-emerald-100 transition hover:bg-emerald-500/25">
                <WalletCards className="h-4 w-4" aria-hidden="true" />
                Abrir Wallet
              </Link>
              <Link href={marketplaceHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-500/15 px-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/25">
                <Store className="h-4 w-4" aria-hidden="true" />
                Marketplace
              </Link>
              {token.explorerUrl ? (
                <a href={token.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-violet-300/30 bg-violet-500/15 px-4 text-sm font-black text-violet-100 transition hover:bg-violet-500/25">
                  Polygonscan <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : (
                <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-slate-300">
                  Blockchain {chainLabel(token.status)}
                </span>
              )}
            </div>
          </div>

          <aside className="min-w-0 space-y-4">
            <section className="max-w-[calc(100vw-2rem)] rounded-[2rem] border border-cyan-300/20 bg-cyan-950/20 p-5 backdrop-blur-xl sm:max-w-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Score de confianza</p>
                  <h2 className="mt-2 text-4xl font-black text-white">{score || 88}/100</h2>
                </div>
                <FileCheck2 className="h-8 w-8 text-emerald-200" aria-hidden="true" />
              </div>
              <div className="mt-4 grid gap-2">
                {(trust.factors || []).map((factor) => (
                  <div key={factor.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-200">{factor.label}</span>
                    <b className={factor.ok ? "text-emerald-200" : "text-amber-200"}>{factor.ok ? "OK" : "Pendiente"}</b>
                  </div>
                ))}
              </div>
            </section>

            <section className="max-w-[calc(100vw-2rem)] rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl sm:max-w-none">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">Historia verificable</p>
              <ol className="mt-4 space-y-3">
                {[
                  ["Origen", cert.origin?.label || "Origen registrado", "La marca cargo lote, producto y reglas antes del canal."],
                  ["Tap", `${tap.city || "Ciudad"}${tap.country ? `, ${tap.country}` : ""}`, fmtDate(tap.at)],
                  ["Dueno", ownership.ownerLabel || "Estado de ownership disponible", ownership.claimedAt ? fmtDate(ownership.claimedAt) : "Validacion por email/celular + tap fresco."],
                  ["Blockchain", token.tokenId ? `Token ${token.tokenId}` : chainLabel(token.status), token.processedAt ? fmtDate(token.processedAt) : "Se muestra tx/hash cuando el tenant ancla en Polygon."],
                ].map(([label, title, body]) => (
                  <li key={label} className="grid grid-cols-[auto_1fr] gap-3">
                    <span className="mt-1 h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,.8)]" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
                      <strong className="mt-1 block text-sm text-white">{title}</strong>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">{body}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="max-w-[calc(100vw-2rem)] rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl sm:max-w-none">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-200">Eventos del producto</p>
              <div className="mt-3 grid gap-2">
                {(cert.timeline || []).slice(-4).map((item) => (
                  <div key={item.eventId} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-white">#{item.eventId}</strong>
                      <span className="text-slate-500">{fmtDate(item.at)}</span>
                    </div>
                    <p className="mt-1 text-slate-300">{item.result || "Evento"} - {item.city || "sin ciudad"}{item.country ? `, ${item.country}` : ""}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
