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

// Check if there is an on-chain proof
function hasOnChainProof(product: ConsumerPortalProduct) {
  const txHash = String(product.tokenization_tx_hash || "");
  const status = String(product.tokenization_status || "").toLowerCase();
  return Boolean(txHash && status !== "none" && !txHash.toUpperCase().includes("DEMO"));
}

function walletStatus(product: ConsumerPortalProduct) {
  const ownership = String(product.ownership_record_status || product.ownership_status || "viewed").toLowerCase();
  if (hasOnChainProof(product)) return "Auténtico (Blockchain)";
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
      title="Pasaporte Criptográfico & Beneficios"
      subtitle="Tu billetera personal donde coleccionas los certificados de autenticidad de tus botellas y accedes a preventas exclusivas."
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
         
         {/* Left Column: Passport & Certificates */}
         <div className="space-y-8">
            
            {/* Collector Banner with deep wine/burgundy and gold accents */}
            <section className="rounded-3xl border border-amber-500/25 bg-[radial-gradient(circle_at_top_left,rgba(153,27,27,0.35),transparent_40%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-6 shadow-[0_24px_60px_rgba(153,27,27,0.15)] relative overflow-hidden">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-500/5 blur-2xl" />
              
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">
                    Certificación de Autenticidad
                  </span>
                  <h2 className="mt-3 text-2xl font-black text-white">Tu Colección de Productos Originales</h2>
                  <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-300">
                    Cada vez que tocas una etiqueta NFC nexID con tu celular, se añade a tu Pasaporte. Esto demuestra que tienes una botella original, imposibilitando falsificaciones y fraudes.
                  </p>
                </div>
                <div className="flex flex-row gap-2 sm:flex-col shrink-0 min-w-48">
                  <div className="flex-1 rounded-xl border border-amber-300/15 bg-amber-500/5 p-2 text-center">
                    <span className="block text-[9px] uppercase tracking-wider text-slate-400">Vinos Registrados</span>
                    <strong className="text-sm font-black text-amber-200">{claimedProducts.length}</strong>
                  </div>
                  <div className="flex-1 rounded-xl border border-cyan-300/15 bg-cyan-500/5 p-2 text-center">
                    <span className="block text-[9px] uppercase tracking-wider text-slate-400">NFTs On-Chain</span>
                    <strong className="text-sm font-black text-cyan-200">{onChainProducts.length}</strong>
                  </div>
                </div>
              </div>
              
              {/* Stepper for consumers */}
              <div className="mt-6 grid gap-3 sm:grid-cols-4 border-t border-white/10 pt-5">
                {[
                  [ShieldCheck, "1", "Tocar NFC", "Escanea la etiqueta física de tu producto."],
                  [BadgeCheck, "2", "Confirmar Dueño", "Asocia la botella a tu Pasaporte nexID."],
                  [WalletCards, "3", "Ver Certificado", "Visualiza tu firma en la blockchain."],
                  [Store, "4", "Acceder al Club", "Disfruta de canjes y drops en el marketplace."]
                ].map(([Icon, step, title, text]) => {
                  const StepIcon = Icon as typeof ShieldCheck;
                  return (
                    <div key={String(step)} className="rounded-2xl border border-white/5 bg-slate-950/45 p-3">
                      <div className="flex items-center justify-between">
                        <span className="grid h-6 w-6 place-items-center rounded-lg border border-amber-300/20 bg-amber-500/10 text-[10px] font-black text-amber-300">{step as string}</span>
                        <StepIcon className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                      </div>
                      <p className="mt-2 text-xs font-black text-white">{title as string}</p>
                      <p className="mt-1 text-[10px] leading-4 text-slate-400">{text as string}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Quick Metrics Cards */}
            <section className="grid gap-4 md:grid-cols-3">
              {[
                { label: "Puntos de la Marca", value: networkPoints, Icon: Coins, desc: "Puntos para canjear en la bodega" },
                { label: "Puntos Históricos", value: lifetimePoints, Icon: Award, desc: "Total de puntos acumulados" },
                { label: "Productos Coleccionados", value: products.length, Icon: PackageCheck, desc: "Cantidad de botellas originales" },
              ].map(({ label, value, Icon, desc }) => (
                <article key={label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 transition hover:border-white/20">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
                    <Icon className="h-4 w-4 text-amber-300" aria-hidden="true" />
                  </div>
                  <p className="mt-2 text-3xl font-black text-white">{value}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{desc}</p>
                </article>
              ))}
            </section>

            {/* Collected Certificates List */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/10">
                <div>
                  <h2 className="text-base font-black text-white">Tus Botellas Autenticadas</h2>
                  <p className="text-xs text-slate-400">Colección oficial de productos vinculados a tu cuenta.</p>
                </div>
                <Link href={selectedTenant ? `/me/marketplace?tenant=${encodeURIComponent(selectedTenant)}` : "/me/marketplace"} className="rounded-xl border border-amber-300/35 bg-amber-500/10 px-4 py-2.5 text-xs font-black text-amber-200 transition hover:bg-amber-500/20">
                  Ver Club de Beneficios
                </Link>
              </div>

              {!products.length ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/20 p-8 text-center text-slate-400">
                  <PackageCheck className="mx-auto h-8 w-8 text-slate-500" />
                  <p className="mt-3 text-xs leading-5">Todavía no has asociado productos.</p>
                  <p className="mt-1 text-[11px] text-slate-500 max-w-sm mx-auto">
                    Cuando compres una botella con tecnología nexID, escanéala y presiona "Reclamar Dueño" para que aparezca aquí.
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
                    
                    return (
                      <article key={`${product.bid || product.product_name || "wallet-product"}-${index}`} className="rounded-2xl border border-white/5 bg-slate-950/60 p-5 transition hover:border-white/10 relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-16 w-16 bg-gradient-to-bl from-amber-500/5 to-transparent blur-md" />
                        
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <span className="rounded-full border border-amber-300/10 bg-amber-500/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-300/80">
                              Certificado Original
                            </span>
                            <h3 className="mt-1 text-base font-black text-white">{product.product_name || "Vino Auténtico"}</h3>
                            <p className="mt-1 text-xs text-slate-400">
                              Bodega: <span className="text-slate-200 font-bold">{product.brand_name || "nexID Partner"}</span> · Lote: <span className="font-mono text-slate-300">{product.bid || "n/a"}</span>
                            </p>
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-wider ${
                            hasOnChainProof(product)
                              ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-300"
                              : isClaimed
                              ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-300"
                              : "border-white/10 bg-slate-900 text-slate-400"
                          }`}>
                            {statusText}
                          </span>
                        </div>

                        <div className="mt-4 rounded-xl border border-white/5 bg-slate-900/30 p-3 text-[11px] leading-5 text-slate-400">
                          <span className="font-bold text-slate-200">Garantía nexID:</span> Este vino cuenta con trazabilidad verificada desde la embotelladora de origen. Las llaves de seguridad impiden la clonación digital.
                        </div>

                        <div className="mt-4 grid gap-2.5 text-xs sm:grid-cols-3">
                          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3">
                            <span className="block text-[9px] uppercase tracking-wider text-slate-500">Estado de Dueño</span>
                            <strong className="mt-1.5 block text-xs font-black text-white uppercase">{String(product.ownership_record_status || product.ownership_status || "viewed").toUpperCase()}</strong>
                          </div>
                          
                          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3">
                            <span className="block text-[9px] uppercase tracking-wider text-slate-500">Registro Blockchain</span>
                            <strong className="mt-1.5 block text-xs font-black text-white">
                              {product.tokenization_token_id ? `Token ID #${product.tokenization_token_id}` : String(product.tokenization_status || "Pendiente")}
                            </strong>
                          </div>

                          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3 flex flex-col justify-center">
                            <span className="block text-[9px] uppercase tracking-wider text-slate-500">Acción del Pasaporte</span>
                            {certificateUrl ? (
                              <Link href={certificateUrl} className="mt-1.5 inline-flex items-center gap-1 text-xs font-black text-amber-200 hover:text-white transition">
                                Ver Certificado <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              </Link>
                            ) : explorerHref ? (
                                <a href={explorerHref} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-black text-emerald-300 hover:text-white transition">
                                  Ver en Polygonscan <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                </a>
                            ) : (
                              <Link href={tenant ? `/me/marketplace?tenant=${encodeURIComponent(tenant)}` : "/me/marketplace"} className="mt-1.5 inline-flex text-xs font-black text-cyan-200 hover:text-white transition">
                                Abrir Beneficios
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

         {/* Right Column: Faucet / Metamask / Sandbox & Tenant Points */}
         <div className="space-y-6">
            
            {/* Wallet Integration box */}
            <MetamaskSandboxCard initialWallet={wallet?.blockchainWallet} />

            {/* Tenant Wallets/Points summary */}
            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Saldos de Puntos por Bodega</h3>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">Puntos acumulados que puedes usar para canjes en cada marca.</p>

              <div className="mt-4 space-y-3">
                {tenantWallets.length ? (
                  tenantWallets.map((tenant) => (
                    <div key={String(tenant.slug || tenant.name || "tenant")} className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 transition hover:border-white/10">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10 text-xs text-amber-300 font-black">
                          🍇
                        </div>
                        <div>
                          <p className="text-xs font-black text-white">{tenant.name || tenant.slug || "Bodega"}</p>
                          <p className="text-[9px] uppercase tracking-wider text-slate-500">{tenant.slug || "general"}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-baseline justify-between">
                        <span className="text-xl font-black text-white">{toNumber(tenant.points_balance)} <span className="text-xs font-medium text-slate-400">puntos</span></span>
                        <span className="text-[10px] text-slate-500">{toNumber(tenant.lifetime_points)} acumulados</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-white/5 bg-slate-900/20 p-4 text-center text-xs text-slate-500">
                    Aún no posees puntos. Los puntos se activan al realizar el primer escaneo de una botella y guardar su propiedad.
                  </div>
                )}
              </div>
            </div>

            {/* Premium details widget */}
            <div className="rounded-3xl border border-cyan-500/15 bg-cyan-500/5 p-5">
               <h4 className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                 <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                 Red Global nexID
               </h4>
               <p className="mt-2 text-[11px] leading-5 text-slate-300">
                 Tus vinos están protegidos por contratos inteligentes en Polygon. Esto te otorga un certificado eterno que nadie puede adulterar, transferible al instante si decides vender la botella en el marketplace.
               </p>
               <div className="mt-4 space-y-2 text-[10px] text-slate-200">
                 {["1. Escaneo NFC Seguro", "2. Firma de Procedencia", "3. Mint del Cromo Digital", "4. Marketplace Descentralizado"].map((step, idx) => (
                   <div key={step} className="rounded-xl border border-white/5 bg-slate-950/60 px-3 py-2 flex items-center justify-between">
                     <span>{step}</span>
                     <span className="text-cyan-400 font-bold">Paso {idx + 1}</span>
                   </div>
                 ))}
               </div>
            </div>

         </div>

      </div>
    </PortalShell>
  );
}
