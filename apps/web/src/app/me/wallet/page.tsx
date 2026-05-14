import Link from "next/link";
import { BadgeCheck, Coins, ExternalLink, PackageCheck, ShieldCheck, Store, WalletCards } from "lucide-react";
import { asArray, buildConsumerNextPath, fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import type { ConsumerPortalProduct } from "../_components/consumer-portal-model";
import { PortalShell } from "../_components/portal-shell";
import { MetamaskSandboxCard } from "./metamask-sandbox-card";

type TenantWallet = {
  slug?: string | null;
  name?: string | null;
  points_balance?: number | string | null;
  lifetime_points?: number | string | null;
};

type WalletPayload = {
  tenantWallets?: TenantWallet[];
  networkWallet?: {
    points_balance?: number | string | null;
    lifetime_points?: number | string | null;
    enabled?: boolean;
  };
};

function toNumber(value: unknown) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
}

function hasOnChainProof(product: ConsumerPortalProduct) {
  const txHash = String(product.tokenization_tx_hash || "");
  const status = String(product.tokenization_status || "").toLowerCase();
  return Boolean(txHash && status !== "none" && !txHash.toUpperCase().includes("DEMO"));
}

function walletStatus(product: ConsumerPortalProduct) {
  const ownership = String(product.ownership_record_status || product.ownership_status || "viewed").toLowerCase();
  if (hasOnChainProof(product)) return "NFT on-chain";
  if (String(product.tokenization_status || "none").toLowerCase() !== "none") return `NFT ${product.tokenization_status}`;
  if (ownership === "claimed") return "Ownership activo";
  return "Listo para reclamar";
}

export default async function WalletLedgerPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me/wallet", params));
  const [wallet, productsPayload] = await Promise.all([
    fetchConsumerPath("wallet") as Promise<WalletPayload | null>,
    fetchConsumerPath("products"),
  ]);
  const tenantWallets = Array.isArray(wallet?.tenantWallets) ? wallet.tenantWallets : [];
  const products = asArray<ConsumerPortalProduct>(productsPayload);
  const networkPoints = toNumber(wallet?.networkWallet?.points_balance);
  const lifetimePoints = toNumber(wallet?.networkWallet?.lifetime_points);
  const claimedProducts = products.filter((product) => String(product.ownership_record_status || product.ownership_status || "").toLowerCase() === "claimed");
  const onChainProducts = products.filter(hasOnChainProof);
  const selectedTenant = typeof params.tenant === "string" ? params.tenant : "";

  return (
    <PortalShell
      title="Wallet, NFT y ownership"
      subtitle="Tu Passport muestra el producto reclamado, el certificado blockchain, MetaMask sandbox y los beneficios del tenant en un solo lugar."
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">

         <div className="space-y-6">
            <section className="rounded-3xl border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,.22),transparent_35%),linear-gradient(135deg,rgba(8,47,73,.68),rgba(15,23,42,.92))] p-5 shadow-[0_24px_80px_rgba(16,185,129,.12)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">Certificado del consumidor</p>
                  <h2 className="mt-2 text-2xl font-black text-white">El tap ya puede convertirse en Passport + NFT</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/78">
                    Primero validas email o celular, despues el producto queda asociado al tenant, y desde aca se ve si el NFT esta on-chain, pendiente o en modo sandbox.
                  </p>
                </div>
                <div className="grid min-w-44 gap-2 text-xs">
                  <span className="rounded-xl border border-emerald-200/30 bg-emerald-500/15 px-3 py-2 font-semibold text-emerald-50">{claimedProducts.length} ownership activos</span>
                  <span className="rounded-xl border border-cyan-200/30 bg-cyan-500/15 px-3 py-2 font-semibold text-cyan-50">{onChainProducts.length} NFT on-chain</span>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {[
                  [ShieldCheck, "1", "Validar", "Email o celular crea tu Passport."],
                  [BadgeCheck, "2", "Asociar", "El tap se liga al tenant y al producto."],
                  [WalletCards, "3", "Wallet", "MetaMask o sandbox para mostrar ownership."],
                  [Store, "4", "Beneficios", "Marketplace contextual por marca."],
                ].map(([Icon, step, title, text]) => {
                  const StepIcon = Icon as typeof ShieldCheck;
                  return (
                    <div key={String(step)} className="rounded-2xl border border-white/10 bg-slate-950/45 p-3">
                      <div className="flex items-center justify-between">
                        <span className="grid h-7 w-7 place-items-center rounded-lg border border-emerald-300/30 bg-emerald-500/15 text-xs font-black text-emerald-100">{step as string}</span>
                        <StepIcon className="h-4 w-4 text-emerald-100" aria-hidden="true" />
                      </div>
                      <p className="mt-2 text-xs font-black text-white">{title as string}</p>
                      <p className="mt-1 text-[11px] leading-4 text-slate-300">{text as string}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-3">
              {[
                { label: "Network points", value: networkPoints, Icon: Coins },
                { label: "Lifetime", value: lifetimePoints, Icon: WalletCards },
                { label: "Productos", value: products.length, Icon: PackageCheck },
              ].map(({ label, value, Icon }) => (
                <article key={label} className="rounded-2xl border border-white/10 bg-slate-950/65 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
                    <Icon className="h-4 w-4 text-cyan-200" aria-hidden="true" />
                  </div>
                  <p className="mt-2 text-3xl font-black text-white">{value}</p>
                </article>
              ))}
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-white">Mis certificados</h2>
                <Link href={selectedTenant ? `/me/marketplace?tenant=${encodeURIComponent(selectedTenant)}` : "/me/marketplace"} className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-500/20">
                  Abrir marketplace
                </Link>
              </div>

              {!products.length ? (
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-5 text-sm leading-6 text-cyan-50">
                  Todavia no hay productos asociados. Desde el resultado del tap toca Crear Passport, valida tu contacto y volve a esta Wallet para ver ownership, NFT y beneficios.
                </div>
              ) : (
                <div className="grid gap-3">
                  {products.slice(0, 6).map((product, index) => {
                    const tenant = String(product.tenant_slug || selectedTenant || "");
                    const txHash = String(product.tokenization_tx_hash || "");
                    const explorerHref = hasOnChainProof(product) ? `https://amoy.polygonscan.com/tx/${encodeURIComponent(txHash)}` : "";
                    return (
                      <article key={`${product.bid || product.product_name || "wallet-product"}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/65 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Passport item</p>
                            <h3 className="mt-1 text-lg font-black text-white">{product.product_name || "Producto autenticado"}</h3>
                            <p className="mt-1 text-xs text-slate-400">{product.brand_name || "Marca"} - tenant {tenant || "n/a"} - BID {product.bid || "n/a"}</p>
                          </div>
                          <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">
                            {walletStatus(product)}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                            <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-500">Ownership</span>
                            <strong className="mt-1 block text-white">{String(product.ownership_record_status || product.ownership_status || "viewed").toUpperCase()}</strong>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                            <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-500">NFT</span>
                            <strong className="mt-1 block text-white">{product.tokenization_token_id ? `Token ${product.tokenization_token_id}` : String(product.tokenization_status || "pendiente")}</strong>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                            <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-500">Accion</span>
                            {explorerHref ? (
                              <a href={explorerHref} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-black text-emerald-100">
                                Polygonscan <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              </a>
                            ) : (
                              <Link href={tenant ? `/me/marketplace?tenant=${encodeURIComponent(tenant)}` : "/me/marketplace"} className="mt-1 inline-flex font-black text-cyan-100">
                                Beneficios
                              </Link>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
         </div>

         <div className="space-y-4">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-400">Saldos por tenant</h3>

            {tenantWallets.length ? (
              tenantWallets.map((tenant) => (
                <div key={String(tenant.slug || tenant.name || "tenant")} className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] font-black text-cyan-200">NX</div>
                    <div>
                      <p className="text-sm font-bold text-white">{tenant.name || tenant.slug || "Tenant"}</p>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{tenant.slug || "network"}</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white">{toNumber(tenant.points_balance)} <span className="text-xs text-slate-500">pts</span></p>
                  <p className="mt-1 text-[11px] text-slate-400">{toNumber(tenant.lifetime_points)} lifetime pts</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 text-xs leading-5 text-slate-300">
                Sin saldos por tenant todavia. Se activan al asociar el tap al Passport o reclamar ownership.
              </div>
            )}

            <div className="mt-6 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
               <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-400">NexID Network</h4>
               <p className="mt-1 text-[11px] leading-5 text-cyan-200/75">Creditos globales, beneficios cruzados y ownership transferible para marketplace.</p>
               <div className="mt-3 grid gap-2 text-[10px] text-slate-200">
                 {["Tap valido", "Passport link", "NFT / token", "Marketplace"].map((step) => (
                   <div key={step} className="rounded-lg border border-white/10 bg-slate-950/55 px-2 py-1.5">{step}</div>
                 ))}
               </div>
            </div>
            <MetamaskSandboxCard />
         </div>

      </div>
    </PortalShell>
  );
}
