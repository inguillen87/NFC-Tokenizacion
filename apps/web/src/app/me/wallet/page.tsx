import { BadgeCheck, Coins, PackageCheck, ShieldCheck, Store, WalletCards } from "lucide-react";
import { asArray, buildConsumerNextPath, fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import type { ConsumerPortalProduct } from "../_components/consumer-portal-model";
import { buildConsumerWalletPointsModel } from "../_components/consumer-wallet-points-model";
import { ConsumerDataRetryButton } from "../_components/me-portal-interactive-client";
import { PortalShell } from "../_components/portal-shell";
import { MetamaskSandboxCard } from "./metamask-sandbox-card";
import { WalletInteractiveClient } from "../_components/wallet-interactive-client";

type WalletPayload = {
  blockchainWallet?: {
    address?: string | null;
    chainId?: string | null;
    network?: string | null;
    verifiedAt?: string | null;
    controlVerified?: boolean;
    verificationMethod?: string | null;
  };
};

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
  
  const points = buildConsumerWalletPointsModel(wallet);
  const products = asArray<ConsumerPortalProduct>(productsPayload);
  const claimedProducts = products.filter((product) => String(product.ownership_record_status || product.ownership_status || "").toLowerCase() === "claimed");
  const onChainProducts = products.filter(hasOnChainProof);
  const selectedTenant = typeof params.tenant === "string" ? params.tenant : "";
  const shouldAutoConnectMetaMask = params.connect === "metamask";

  return (
    <PortalShell
      title="Pasaporte Criptográfico & Wallet"
      subtitle="Administrá certificados digitales, registros de ownership, NFT y puntos. Ninguno garantiza por sí solo autenticidad física, contenido o procedencia."
    >
      <div className="space-y-6">
        <section aria-labelledby="wallet-brand-points-title" className="rounded-3xl border border-[color:var(--portal-border)] bg-[var(--portal-surface)] p-5 text-[var(--portal-text)] sm:p-6">
          <div className="flex items-start gap-3">
            <Coins className="mt-0.5 h-6 w-6 shrink-0 text-[var(--portal-accent)]" aria-hidden="true" />
            <div>
              <h2 id="wallet-brand-points-title" className="text-xl font-extrabold">Tus puntos por marca</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--portal-muted)]">Cada saldo pertenece a su marca. No se suman ni se transfieren entre empresas.</p>
            </div>
          </div>

          {points.brands.status === "unavailable" ? (
            <div role="status" className="mt-5 space-y-3 rounded-2xl border border-[color:var(--portal-border)] bg-[var(--portal-subtle)] p-4">
              <p className="text-sm text-[var(--portal-muted)]">No pudimos cargar tus saldos por marca. No se muestran como cero.</p>
              <ConsumerDataRetryButton />
            </div>
          ) : points.brands.data.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-[var(--portal-subtle)] p-4 text-sm leading-6 text-[var(--portal-muted)]">Todavía no hay saldos por marca asociados a esta cuenta.</p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
              {points.brands.data.map((brand, index) => (
                <article key={`${brand.slug || "brand"}-${index}`} data-wallet-scope="brand" className="min-w-0 rounded-2xl border border-[color:var(--portal-border)] bg-[var(--portal-subtle)] p-4">
                  <h3 className="break-words text-base font-extrabold">{brand.name || brand.slug || "Marca no informada"}</h3>
                  <dl className="mt-4 grid grid-cols-2 gap-3">
                    <div><dt className="text-xs font-semibold text-[var(--portal-muted)]">Saldo de esta marca</dt><dd className="mt-1 text-2xl font-extrabold text-[var(--portal-accent)]">{brand.balance === null ? <span className="text-sm font-semibold text-[var(--portal-muted)]">No informado</span> : brand.balance}</dd></div>
                    <div><dt className="text-xs font-semibold text-[var(--portal-muted)]">Acumulados en esta marca</dt><dd className="mt-1 text-xl font-bold">{brand.lifetime === null ? <span className="text-sm font-semibold text-[var(--portal-muted)]">No informado</span> : brand.lifetime}</dd></div>
                  </dl>
                  <p className="mt-3 text-xs leading-5 text-[var(--portal-muted)]">Puntos reportados. Los beneficios y sus condiciones se consultan por separado.</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <MetamaskSandboxCard initialWallet={wallet?.blockchainWallet} autoConnect={shouldAutoConnectMetaMask} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
         
         {/* Left Column: Passport & Certificates */}
         <div className="space-y-6">
            
            {/* Collector Banner with deep wine/burgundy and gold accents */}
            <section className="consumer-passport-collection rounded-3xl border border-amber-500/25 bg-[radial-gradient(circle_at_top_left,rgba(153,27,27,0.3),transparent_40%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-500/5 blur-2xl" />
              
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-200">
                    Evidencia Digital & Ownership
                  </span>
                  <h2 className="mt-3 text-2xl font-black text-white tracking-tight leading-none">Tu Pasaporte de Colección</h2>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">
                    El chip NFC puede aportar un mensaje dinámico validado y una referencia de evento. El certificado y el ownership registran evidencia digital; no garantizan procedencia, contenido ni ausencia de fraude físico.
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
                  [BadgeCheck, "2", "Solicitar Ownership", "Requiere identidad, compra y política del tenant."],
                  [WalletCards, "3", "Ver Evidencia", "Consultá el certificado y sus límites."],
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
            <section className="grid gap-3">
              {[
                { label: "Botellas Totales", value: products.length, Icon: PackageCheck, desc: "Unidades asociadas" },
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
            
            <section data-wallet-scope="network" aria-labelledby="wallet-network-points-title" className="rounded-3xl border border-[color:var(--portal-border)] bg-[var(--portal-surface)] p-5 text-[var(--portal-text)]">
              <h3 id="wallet-network-points-title" className="text-base font-extrabold">Puntos de la red nexID</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--portal-muted)]">Cuenta independiente de los saldos por marca.</p>
              {points.network.status === "disabled" ? (
                <p className="mt-4 rounded-xl bg-[var(--portal-subtle)] p-3 text-sm leading-6 text-[var(--portal-muted)]">La red nexID no está habilitada para esta cuenta. Esto no afecta tus puntos de cada marca.</p>
              ) : points.network.status === "unavailable" ? (
                <div role="status" className="mt-4 space-y-3">
                  <p className="text-sm leading-6 text-[var(--portal-muted)]">Saldo de red no disponible. No se reemplaza con cero ni con los puntos de tus marcas.</p>
                  {points.brands.status === "ready" ? <ConsumerDataRetryButton /> : null}
                </div>
              ) : (
                <dl className="mt-4 space-y-4">
                  <div><dt className="text-xs font-semibold text-[var(--portal-muted)]">Saldo reportado de la red</dt><dd className="mt-1 text-xl font-extrabold">{points.network.balance === null ? "No informado" : points.network.balance}</dd></div>
                  <div><dt className="text-xs font-semibold text-[var(--portal-muted)]">Acumulados en la red nexID</dt><dd className="mt-1 text-xl font-bold">{points.network.lifetime === null ? "No informado" : points.network.lifetime}</dd></div>
                </dl>
              )}
            </section>

            {/* Premium details widget */}
            <div className="rounded-3xl border border-cyan-500/15 bg-cyan-500/5 p-5">
               <h4 className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                 <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                 Registro Polygon opcional
               </h4>
               <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
                 Cuando la política lo habilita, nexID puede registrar un ownership digital en Polygon. La transacción prueba ese registro y el control de la wallet; no prueba autenticidad física, procedencia ni custodia del producto.
               </p>
               <div className="mt-4 space-y-2 text-[10px] text-slate-300 font-mono">
                 {["1. Mensaje NFC Validado", "2. Identidad + Política", "3. Acuñación Confirmada", "4. Acciones Habilitadas"].map((step, idx) => (
                   <div key={step} className="rounded-xl border border-white/5 bg-slate-950/65 px-3 py-2 flex items-center justify-between">
                     <span>{step}</span>
                     <span className="text-cyan-400 font-bold">Paso 0{idx + 1}</span>
                   </div>
                 ))}
               </div>
            </div>

         </div>

        </div>
      </div>
    </PortalShell>
  );
}
