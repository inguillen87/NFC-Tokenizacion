import Link from "next/link";
import { BadgeCheck, Coins, ExternalLink, PackageCheck, ShieldCheck, Store, WalletCards, Award } from "lucide-react";
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
  blockchainWallet?: {
    address?: string | null;
    chainId?: string | null;
    network?: string | null;
    verifiedAt?: string | null;
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
  if (hasOnChainProof(product)) return "Certificado (Blockchain)";
  if (String(product.tokenization_status || "none").toLowerCase() !== "none") return `NFT ${product.tokenization_status}`;
  if (ownership === "claimed") return "Propietario Confirmado";
  return "Listo para Reclamar";
}

function certificateHref(product: ConsumerPortalProduct) {
  const eventId = String(product.latest_tap_event_id || product.first_tap_event_id || "").trim();
  return eventId ? `/certificado/${encodeURIComponent(eventId)}` : "";
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
      title="Pasaporte Criptográfico & Wallet"
      subtitle="Colecciona y administra los certificados de autenticidad NFT de tus botellas y canjea tus puntos por preventas exclusivas."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
         
         {/* Left Column: Passport & Certificates */}
         <div className="space-y-6">
            
            {/* Collector Banner with deep wine/burgundy and gold accents */}
            <section className="rounded-3xl border border-amber-500/25 bg-[radial-gradient(circle_at_top_left,rgba(153,27,27,0.3),transparent_40%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-500/5 blur-2xl" />
              
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-200">
                    Certificación de Autenticidad
                  </span>
                  <h2 className="mt-3 text-2xl font-black text-white tracking-tight leading-none">Tu Pasaporte de Colección</h2>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">
                    Cada botella cuenta con un identificador de seguridad encriptado en su chip NFC. Al escanearla, registras la firma digital en tu cuenta, garantizando su procedencia e impidiendo fraudes de clonación.
                  </p>
                </div>
                <div className="flex flex-row gap-2 sm:flex-col shrink-0 min-w-48">
                  <div className="flex-1 rounded-xl border border-amber-300/15 bg-amber-500/5 p-2.5 text-center">
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Vinos en Passport</span>
                    <strong className="text-base font-black text-amber-200">{claimedProducts.length}</strong>
                  </div>
                  <div className="flex-1 rounded-xl border border-cyan-300/15 bg-cyan-500/5 p-2.5 text-center">
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">NFTs Acuñados</span>
                    <strong className="text-base font-black text-cyan-200">{onChainProducts.length}</strong>
                  </div>
                </div>
              </div>
              
              {/* Stepper for consumers */}
              <div className="mt-6 grid gap-2.5 sm:grid-cols-4 border-t border-white/5 pt-5">
                {[
                  [ShieldCheck, "1", "Tocar NFC", "Escanea la etiqueta con tu celular."],
                  [BadgeCheck, "2", "Asociar Dueño", "Registra la botella en tu cuenta."],
                  [WalletCards, "3", "Ver Firma", "Visualiza tu certificado digital."],
                  [Store, "4", "Canjear Club", "Usa tus beneficios en el marketplace."]
                ].map(([Icon, step, title, text]) => {
                  const StepIcon = Icon as typeof ShieldCheck;
                  return (
                    <div key={String(step)} className="rounded-xl border border-white/5 bg-slate-950/45 p-3">
                      <div className="flex items-center justify-between">
                        <span className="grid h-5 w-5 place-items-center rounded-lg border border-amber-300/20 bg-amber-500/10 text-[9px] font-black text-amber-300">{step as string}</span>
                        <StepIcon className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                      </div>
                      <p className="mt-2 text-xs font-black text-white">{title as string}</p>
                      <p className="mt-1 text-[9px] leading-snug text-slate-400">{text as string}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Quick Metrics Cards */}
            <section className="grid gap-3 grid-cols-3">
              {[
                { label: "Puntos Disponibles", value: networkPoints, Icon: Coins, desc: "Canjeables en bodega" },
                { label: "Puntos Históricos", value: lifetimePoints, Icon: Award, desc: "Acumulado total" },
                { label: "Botellas Totales", value: products.length, Icon: PackageCheck, desc: "Originales asociadas" },
              ].map(({ label, value, Icon, desc }) => (
                <article key={label} className="rounded-2xl border border-white/5 bg-slate-950/60 p-4 transition duration-300 hover:border-white/10">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
                    <Icon className="h-4 w-4 text-amber-300" aria-hidden="true" />
                  </div>
                  <p className="mt-2 text-2xl font-black text-white leading-none">{value}</p>
                  <p className="mt-1 text-[9px] text-slate-500">{desc}</p>
                </article>
              ))}
            </section>

            {/* Collected Certificates List */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/5">
                <div>
                  <h3 className="text-sm font-black text-white">Tus Certificados Digitales (NFTs)</h3>
                  <p className="text-xs text-slate-400">Colección original vinculada a tu identidad digital.</p>
                </div>
                <Link href={selectedTenant ? `/me/marketplace?tenant=${encodeURIComponent(selectedTenant)}` : "/me/marketplace"} className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20 transition">
                  Ver Club de Beneficios
                </Link>
              </div>

              {!products.length ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/25 p-8 text-center text-slate-400">
                  <PackageCheck className="mx-auto h-10 w-10 text-slate-600 animate-pulse" />
                  <p className="mt-3 text-xs">Todavía no has asociado productos.</p>
                  <p className="mt-1 text-[10px] text-slate-500 max-w-sm mx-auto">
                    Cuando escanees un vino con nexID, presiona "Reclamar Dueño" para que aparezca su certificado aquí.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {products.slice(0, 10).map((product, index) => {
                    const tenant = String(product.tenant_slug || selectedTenant || "");
                    const txHash = String(product.tokenization_tx_hash || "");
                    const explorerHref = hasOnChainProof(product) ? `https://amoy.polygonscan.com/tx/${encodeURIComponent(txHash)}` : "";
                    const certificateUrl = certificateHref(product);
                    const statusText = walletStatus(product);
                    const isClaimed = String(product.ownership_record_status || product.ownership_status || "").toLowerCase() === "claimed";
                    
                    // Determine wine or case asset thumbnail
                    const isBottle = !product.product_name?.toLowerCase().includes("crate") && !product.product_name?.toLowerCase().includes("caja");
                    const thumbnailImg = isBottle ? "/images/premium_magnum.png" : "/images/wine_crate.png";

                    return (
                      <article key={`${product.bid || product.product_name || "wallet-product"}-${index}`} className="rounded-2xl border border-white/5 bg-slate-950/60 p-4 transition duration-300 hover:border-white/10 relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-16 w-16 bg-gradient-to-bl from-amber-500/5 to-transparent blur-md" />
                        
                        <div className="flex gap-4 items-start">
                          
                          {/* Visual asset thumbnail */}
                          <div className="h-16 w-14 shrink-0 rounded-xl border border-white/10 bg-black/40 p-1 flex items-center justify-center overflow-hidden">
                            <img
                              src={thumbnailImg}
                              alt={product.product_name || "Wine"}
                              className="h-14 w-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
                            />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <span className="rounded-full border border-amber-400/20 bg-amber-400/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-300/80">
                                  Certificado Original
                                </span>
                                <h3 className="mt-1 text-sm font-black text-white truncate leading-snug">{product.product_name || "Vino Auténtico"}</h3>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  Bodega: <span className="text-slate-200 font-bold">{product.brand_name || "nexID Partner"}</span> · Lote: <span className="font-mono text-slate-300">{product.bid || "n/a"}</span>
                                </p>
                              </div>
                              <span className={`rounded-full border px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider shrink-0 ${
                                hasOnChainProof(product)
                                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                                  : isClaimed
                                  ? "border-cyan-500/35 bg-cyan-500/10 text-cyan-300"
                                  : "border-white/5 bg-slate-900 text-slate-400"
                              }`}>
                                {statusText}
                              </span>
                            </div>

                            <div className="mt-3 grid gap-2 text-[10px] sm:grid-cols-3">
                              <div className="rounded-xl border border-white/5 bg-slate-900/50 p-2.5">
                                <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Estado Propietario</span>
                                <strong className="mt-1 block text-white uppercase">{String(product.ownership_record_status || product.ownership_status || "viewed").toUpperCase()}</strong>
                              </div>
                              
                              <div className="rounded-xl border border-white/5 bg-slate-900/50 p-2.5">
                                <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Registro Blockchain</span>
                                <strong className="mt-1 block text-white">
                                  {product.tokenization_token_id ? `Token ID #${product.tokenization_token_id}` : String(product.tokenization_status || "Pendiente")}
                                </strong>
                              </div>

                              <div className="rounded-xl border border-white/5 bg-slate-900/50 p-2.5 flex flex-col justify-center">
                                <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold mb-1">Acciones</span>
                                {certificateUrl ? (
                                  <Link href={certificateUrl} className="inline-flex items-center gap-1 font-black text-amber-300 hover:text-white transition">
                                    Ver Firma <ExternalLink className="h-3 w-3" />
                                  </Link>
                                ) : explorerHref ? (
                                    <a href={explorerHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-black text-emerald-300 hover:text-white transition">
                                      Ver Tx <ExternalLink className="h-3 w-3" />
                                    </a>
                                ) : (
                                  <Link href={tenant ? `/me/marketplace?tenant=${encodeURIComponent(tenant)}` : "/me/marketplace"} className="inline-flex font-black text-cyan-300 hover:text-white transition">
                                    Canjear Club
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>

                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
         </div>

         {/* Right Column: Faucet / Metamask / Sandbox & Tenant Points */}
         <div className="space-y-6">
            
            {/* Wallet Integration box */}
            <MetamaskSandboxCard initialWallet={wallet?.blockchainWallet} />

            {/* Tenant Wallets/Points summary */}
            <div className="rounded-3xl border border-white/10 bg-slate-950/65 p-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Mis Puntos por Marca</h3>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Saldos activos canjeables por experiencias.</p>

              <div className="mt-4 space-y-2.5">
                {tenantWallets.length ? (
                  tenantWallets.map((tenant) => (
                    <div key={String(tenant.slug || tenant.name || "tenant")} className="rounded-2xl border border-white/5 bg-slate-900/30 p-4 transition hover:border-white/10">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10 text-xs font-black">
                          🍇
                        </div>
                        <div>
                          <p className="text-xs font-black text-white leading-none">{tenant.name || tenant.slug || "Bodega"}</p>
                          <p className="text-[8px] uppercase tracking-wider text-slate-500 mt-1 font-mono">{tenant.slug || "general"}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-baseline justify-between">
                        <span className="text-lg font-black text-white">{toNumber(tenant.points_balance)} <span className="text-[10px] font-medium text-slate-400">puntos</span></span>
                        <span className="text-[9px] text-slate-500">{toNumber(tenant.lifetime_points)} hist.</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/5 bg-slate-900/10 p-4 text-center text-[10px] text-slate-500">
                    Aún no acumulas puntos. Los puntos se activan con tu primer escaneo físico.
                  </div>
                )}
              </div>
            </div>

            {/* Premium details widget */}
            <div className="rounded-3xl border border-cyan-500/15 bg-cyan-500/5 p-5">
               <h4 className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                 <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                 Red Descentralizada nexID
               </h4>
               <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
                 Tus certificados se registran en Polygon. Esto te otorga un título de autenticidad transferible si decides regalar o vender la botella en nuestro marketplace.
               </p>
               <div className="mt-4 space-y-2 text-[10px] text-slate-300 font-mono">
                 {["1. Tap Físico Seguro", "2. Firma Criptográfica", "3. Acuñación del NFT", "4. Drops Habilitados"].map((step, idx) => (
                   <div key={step} className="rounded-xl border border-white/5 bg-slate-950/65 px-3 py-2 flex items-center justify-between">
                     <span>{step}</span>
                     <span className="text-cyan-400 font-bold">Paso 0{idx + 1}</span>
                   </div>
                 ))}
               </div>
            </div>

         </div>

      </div>
    </PortalShell>
  );
}
