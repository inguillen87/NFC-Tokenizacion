import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ExternalLink, FileCheck2, Fingerprint, ShieldCheck, Store, WalletCards } from "lucide-react";
import { productUrls } from "@product/config";
import { resolveProductAssetProfile, type ProductAssetProfile } from "../../../lib/product-asset-bank";

export const dynamic = "force-dynamic";

type CertificateFactor = { label?: string; ok?: boolean };
type CertificateTimelineItem = { eventId?: string; result?: string | null; city?: string | null; country?: string | null; at?: string | null };

type CertificatePayload = {
  ok?: boolean;
  certificate?: {
    id?: string;
    publicUrl?: string;
    links?: { certificateUrl?: string | null; walletUrl?: string | null; marketplaceUrl?: string | null; explorerUrl?: string | null };
    status?: string;
    statusLabel?: string;
    verification?: {
      state?: "nfc_message_validated_tt_intact" | "nfc_message_validated_tt_opened" | "nfc_message_validated" | "replay_blocked" | "tamper_review" | "not_verified";
      evidenceState?: string;
      nfcMessageValidated?: boolean;
      /** @deprecated Legacy compatibility field; never use it as physical-authenticity evidence. */
      tagMessageValidated?: boolean;
      physicalAuthenticityConfirmed?: boolean;
      /** @deprecated The API keeps this nullable for compatibility. */
      authentic?: boolean;
      actionEligible?: boolean;
      resultCode?: string;
      explainer?: string;
    };
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
    ownership?: { status?: string | null; claimed?: boolean; actionEligible?: boolean; recordScope?: string; onChainOwnerVerified?: boolean; claimedAt?: string | null; ownerLabel?: string | null };
    tokenization?: { status?: string | null; network?: string | null; txHash?: string | null; tokenId?: string | null; anchorHash?: string | null; processedAt?: string | null; explorerUrl?: string | null };
    trust?: { score?: number | string | null; factors?: CertificateFactor[] };
    timeline?: CertificateTimelineItem[];
    assets?: ProductAssetProfile;
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

function blockchainExplainer(token?: NonNullable<CertificatePayload["certificate"]>["tokenization"]) {
  const status = String(token?.status || "none").toLowerCase();
  if (token?.explorerUrl || token?.txHash || token?.tokenId) {
    return "Referencia Polygon reportada: abrí el explorer para comprobar red, contrato, transacción y estado.";
  }
  if (status === "pending" || status === "processing" || status === "pending_retry") {
    return "En cola: la solicitud esta guardada y se muestra la transaccion cuando Polygon confirme.";
  }
  if (status === "blocked") {
    return "Protegido: falta un tap fisico fresco o una politica del tenant antes de mintear.";
  }
  return "Disponible: el tenant puede habilitar mint despues del claim de ownership.";
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] || "").trim() : String(value || "").trim();
}

async function fetchCertificate(eventId: string, shareToken: string): Promise<CertificatePayload | null> {
  const query = shareToken ? `?share=${encodeURIComponent(shareToken)}` : "";
  const res = await fetch(`${productUrls.api}/public/certificates/${encodeURIComponent(eventId)}${query}`, { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json().catch(() => null);
}

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }): Promise<Metadata> {
  const { eventId } = await params;
  return {
    title: `Certificado nexID #${eventId}`,
    description: "Certificado público de evidencia NFC, ownership declarado y tokenización nexID.",
  };
}

export default async function PublicCertificatePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventId } = await params;
  const query = await searchParams;
  const shareToken = firstParam(query.share);
  const payload = await fetchCertificate(eventId, shareToken);
  const cert = payload?.certificate;

  if (!cert) {
    return (
      <main className="min-h-screen overflow-hidden bg-[#070b14] px-4 py-8 text-slate-100">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,.16),transparent_34%),linear-gradient(180deg,rgba(15,23,42,.2),#070b14_72%)]" />
        <section className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-5 lg:grid-cols-[1fr_.8fr]">
          <div className="rounded-[2rem] border border-amber-300/25 bg-slate-950/88 p-6 shadow-[0_30px_90px_rgba(0,0,0,.35)] backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-200">Certificado no disponible</p>
            <h1 className="mt-3 text-4xl font-black leading-tight text-slate-50 sm:text-6xl" style={{ color: "#f8fafc" }}>
              No pudimos consultar el certificado #{eventId}.
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-100/90">
              El enlace puede haber vencido, el registro puede no estar disponible o el servicio puede estar temporalmente sin respuesta.
              Reintentá la consulta o abrí tus lecturas guardadas. Esta pantalla no confirma ni descarta la autenticidad de la etiqueta.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <a href={`/certificado/${encodeURIComponent(eventId)}${shareToken ? `?share=${encodeURIComponent(shareToken)}` : ""}`} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-cyan-200/40 bg-cyan-500/25 px-4 text-sm font-black text-cyan-50" style={{ color: "#ecfeff" }}>
                Reintentar consulta
              </a>
              <Link href="/me/products" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-emerald-100 px-4 text-sm font-black" style={{ background: "rgba(236,253,245,.94)", color: "#052e16" }}>
                Mis productos
              </Link>
              <Link href="/me/wallet" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-violet-200/40 bg-violet-500/25 px-4 text-sm font-black text-violet-50" style={{ color: "#f5f3ff" }}>
                Wallet / NFT
              </Link>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Como recuperarlo</p>
            <ol className="mt-4 space-y-3 text-sm">
              {[
                ["1", "Reintentar", "Vuelve a consultar el mismo enlace; no genera otra lectura NFC."],
                ["2", "Ver productos", "Si guardaste el producto en tu cuenta, podés consultar allí su lectura privada."],
                ["3", "Nueva lectura", "Para obtener un registro nuevo, acercá tu teléfono NFC a la etiqueta física y abrí el enlace que aparezca."],
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
  const evidenceFactors = trust.factors || [];
  const confirmedEvidenceCount = evidenceFactors.filter((factor) => factor.ok === true).length;
  const assetProfile = cert.assets || resolveProductAssetProfile({
    tenantSlug: tenant.slug,
    brandName: product.brand || tenant.name,
    productName: product.name,
    bid: product.batch,
    vertical: product.vertical,
    imageUrl: product.imageUrl,
    sku: product.sku,
  });
  const tenantSlug = String(tenant.slug || "");
  const actionEligible = cert.verification?.actionEligible === true && ownership.actionEligible !== false;
  const walletHref = actionEligible
    ? cert.links?.walletUrl || (tenantSlug ? `/me/wallet?tenant=${encodeURIComponent(tenantSlug)}&eventId=${encodeURIComponent(String(tap.eventId || eventId))}` : `/me/wallet?eventId=${encodeURIComponent(String(tap.eventId || eventId))}`)
    : null;
  const marketplaceHref = actionEligible
    ? cert.links?.marketplaceUrl || (tenantSlug ? `/me/marketplace?tenant=${encodeURIComponent(tenantSlug)}` : "/me/marketplace")
    : null;
  const permanentUrl = cert.links?.certificateUrl
    || cert.publicUrl
    || `https://nexid.lat/certificado/${encodeURIComponent(String(tap.eventId || eventId))}${shareToken ? `?share=${encodeURIComponent(shareToken)}` : ""}`;
  const blockchainState = blockchainExplainer(token);
  const nfcMessageValidated = cert.verification?.nfcMessageValidated === true
    || cert.verification?.tagMessageValidated === true;
  const statusTone = nfcMessageValidated
    ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
    : cert.verification?.state === "replay_blocked"
      ? "border-rose-300/30 bg-rose-500/15 text-rose-100"
      : "border-amber-300/30 bg-amber-500/15 text-amber-100";

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
          <span className={`max-w-full rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusTone}`}>
            {cert.statusLabel || "Estado no confirmado"}
          </span>
        </header>

        <section className="grid min-w-0 flex-1 gap-5 py-6 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div className="min-w-0 space-y-5">
            <div className="min-w-0 max-w-[calc(100vw-2rem)] rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-[0_30px_90px_rgba(0,0,0,.35)] backdrop-blur-xl sm:max-w-none">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Certificado #{tap.eventId || eventId}</p>
              <h1 className="mt-3 max-w-full break-words text-3xl font-black leading-tight text-white [overflow-wrap:anywhere] sm:text-6xl">
                {product.name || "Producto conectado"}
              </h1>
              <p className="mt-3 max-w-full break-words text-sm leading-6 text-slate-300 [overflow-wrap:anywhere] sm:text-base sm:leading-7">
                <span className="block">
                  {nfcMessageValidated
                    ? `${product.brand || tenant.name || "La marca"} tiene un mensaje NFC validado y un evento digital registrado en nexID.`
                    : "Este evento no aporta evidencia NFC suficiente; no confirma autenticidad física ni habilita ownership."}
                </span>
                <span className="block">{cert.verification?.explainer || "Polygon registra ownership solo despues de la validacion nexID."}</span>
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                {[
                  [ShieldCheck, "Evidencia NFC", String(tap.result || "sin validar").toUpperCase()],
                  [Fingerprint, "UID", cert.identity?.uidMasked || "Protegido"],
                  [BadgeCheck, "Ownership", ownership.claimed ? "Claim nexID" : actionEligible ? "Reclamable" : "Bloqueado"],
                  [WalletCards, "NFT", actionEligible ? chainLabel(token.status) : "No habilitado"],
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

            <section className="max-w-[calc(100vw-2rem)] rounded-[2rem] border border-cyan-300/20 bg-cyan-950/20 p-5 backdrop-blur-xl sm:max-w-none">
              <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="relative min-h-60 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,.18),transparent_36%),linear-gradient(180deg,rgba(15,23,42,.74),rgba(2,6,23,.92))]">
                  {assetProfile.primaryImageUrl ? (
                    <img
                      src={assetProfile.primaryImageUrl}
                      alt={assetProfile.productName}
                      className="h-full min-h-60 w-full object-contain p-4"
                    />
                  ) : (
                    <div className="grid h-full min-h-60 place-items-center p-6 text-center">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Asset demo controlado</p>
                        <p className="mt-2 text-xl font-black text-white">{assetProfile.visualKind}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-400">Cuando el tenant sube foto real, este certificado, el tap y el marketplace muestran el producto exacto.</p>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Banco real de assets</p>
                  <h2 className="mt-2 text-2xl font-black text-white">{assetProfile.productName}</h2>
                  <p className="mt-2 text-sm leading-6 text-cyan-50/80">{assetProfile.heroLine}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {assetProfile.slots.map((slot) => (
                      <article key={slot.id} className="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <b className="text-xs text-white">{slot.label}</b>
                          <span className={slot.status === "ready" ? "text-[10px] font-black uppercase tracking-[0.1em] text-emerald-200" : slot.status === "missing" ? "text-[10px] font-black uppercase tracking-[0.1em] text-amber-200" : "text-[10px] font-black uppercase tracking-[0.1em] text-cyan-200"}>
                            {slot.status === "ready" ? "real" : slot.status === "missing" ? "pendiente" : "demo"}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-5 text-slate-400">{slot.detail}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <div className="grid max-w-[calc(100vw-2rem)] gap-3 sm:max-w-none sm:grid-cols-3">
              {walletHref ? (
                <Link href={walletHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-500/15 px-4 text-sm font-black text-emerald-100 transition hover:bg-emerald-500/25">
                  <WalletCards className="h-4 w-4" aria-hidden="true" />
                  Abrir Wallet
                </Link>
              ) : (
                <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 text-center text-sm font-black text-rose-100">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Wallet bloqueada
                </span>
              )}
              {marketplaceHref ? (
                <Link href={marketplaceHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-500/15 px-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/25">
                  <Store className="h-4 w-4" aria-hidden="true" />
                  Marketplace
                </Link>
              ) : (
                <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 text-center text-sm font-black text-rose-100">
                  <Store className="h-4 w-4" aria-hidden="true" />
                  Reventa no habilitada
                </span>
              )}
              {actionEligible && token.explorerUrl ? (
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
            <section className="max-w-[calc(100vw-2rem)] rounded-[2rem] border border-emerald-300/20 bg-emerald-950/20 p-5 backdrop-blur-xl sm:max-w-none">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">Link permanente</p>
              <h2 className="mt-2 text-xl font-black text-white">Certificado digital compartible</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-50/80">
                Este link comparte el veredicto nexID, el estado de ownership y la evidencia Polygon disponible sin exponer el UID completo.
              </p>
              <a href={permanentUrl} className="mt-3 block break-all rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-xs font-semibold text-cyan-100">
                {permanentUrl}
              </a>
              <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/55 p-3 text-xs leading-5 text-slate-300">
                <b className="block text-white">Blockchain: {chainLabel(token.status)}</b>
                <span>{blockchainState}</span>
              </div>
            </section>

            <section className="max-w-[calc(100vw-2rem)] rounded-[2rem] border border-cyan-300/20 bg-cyan-950/20 p-5 backdrop-blur-xl sm:max-w-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Cobertura de evidencia</p>
                  <h2 className="mt-2 text-4xl font-black text-white">{confirmedEvidenceCount}/{evidenceFactors.length || "—"}</h2>
                </div>
                <FileCheck2 className="h-8 w-8 text-emerald-200" aria-hidden="true" />
              </div>
              <div className="mt-4 grid gap-2">
                {evidenceFactors.map((factor) => (
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
                  ["Claim", ownership.ownerLabel || "Estado de ownership disponible", ownership.claimedAt ? `${fmtDate(ownership.claimedAt)} - registro off-chain; no prueba ownerOf.` : "Validacion por email/celular + tap fresco."],
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
