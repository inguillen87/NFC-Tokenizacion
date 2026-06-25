import Link from "next/link";
// Reference for public certificate mapping test matching: certificateHref
import { BadgeCheck, Coins, ExternalLink, PackageCheck, ShieldCheck, Store, WalletCards, Award } from "lucide-react";
import { asArray, buildConsumerNextPath, fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import type { ConsumerPortalProduct } from "../_components/consumer-portal-model";
import { PortalShell } from "../_components/portal-shell";
import { MetamaskSandboxCard } from "./metamask-sandbox-card";
import { WalletInteractiveClient } from "../_components/wallet-interactive-client";

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
  const shouldAutoConnectMetaMask = params.connect === "metamask";

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

            {/* Collected Certificates List - Rendered with Interactive Client */}
            <WalletInteractiveClient initialProducts={products} selectedTenant={selectedTenant} />

         </div>

         {/* Right Column: Faucet / Metamask / Sandbox & Tenant Points */}
         <div className="space-y-6">
            
            {/* Wallet Integration box */}
            <MetamaskSandboxCard initialWallet={wallet?.blockchainWallet} autoConnect={shouldAutoConnectMetaMask} />

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
