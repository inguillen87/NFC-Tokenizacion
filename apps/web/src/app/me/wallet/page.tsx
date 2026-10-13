import Link from "next/link";
import { ArrowRight, Coins, PackageCheck, WalletCards } from "lucide-react";
import { asArray, buildConsumerNextPath, fetchConsumerPath, readConsumerSession } from "../_components/consumer-api";
import { ConsumerPortalUnavailable } from "../_components/consumer-portal-recovery";
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
  const session = await readConsumerSession(buildConsumerNextPath("/me/wallet", params));
  if (session.status === "unavailable") return <ConsumerPortalUnavailable />;
  
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
      title="Mi billetera"
      subtitle="Tus productos y los puntos de cada marca, en un solo lugar."
    >
      <div className="v3-space-y-6">
        <section aria-labelledby="wallet-brand-points-title" className="rounded-3xl border border-[color:var(--portal-border)] bg-[var(--portal-surface)] p-5 text-[var(--portal-text)] sm:p-6">
          <div className="flex items-start gap-3">
            <Coins className="mt-0.5 h-6 w-6 shrink-0 text-[var(--portal-accent)]" aria-hidden="true" />
            <div>
              <h2 id="wallet-brand-points-title" className="text-xl font-extrabold">Tus puntos por marca</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--portal-muted)]">Cada saldo pertenece a su marca. No se suman ni se transfieren entre empresas.</p>
              <Link href="/me/rewards" prefetch={false} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--portal-accent)] px-4 py-2 text-sm font-bold text-[var(--portal-base)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--portal-accent)]">
                Ver mis beneficios <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {points.brands.status === "unavailable" ? (
            <div role="status" className="mt-5 v3-space-y-3 rounded-2xl border border-[color:var(--portal-border)] bg-[var(--portal-subtle)] p-4">
              <p className="text-sm text-[var(--portal-muted)]">No pudimos cargar tus saldos por marca. No se muestran como cero.</p>
              <ConsumerDataRetryButton />
            </div>
          ) : points.brands.data.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-[var(--portal-subtle)] p-4 text-sm leading-6 text-[var(--portal-muted)]">Todavía no hay saldos por marca asociados a esta cuenta.</p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
              {points.brands.data.map((brand, index) => (
                <article key={`${brand.slug || "brand"}-${index}`} data-wallet-scope="brand" className="min-w-0 rounded-2xl border border-[color:var(--portal-border)] bg-[var(--portal-subtle)] p-4">
                  <h3 className="break-words text-base font-extrabold [overflow-wrap:anywhere]">{brand.name || brand.slug || "Marca no informada"}</h3>
                  <dl className="mt-4 grid grid-cols-2 gap-3">
                    <div><dt className="text-xs font-semibold text-[var(--portal-muted)]">Saldo de esta marca</dt><dd className="mt-1 break-words text-2xl font-extrabold text-[var(--portal-accent)] [overflow-wrap:anywhere]">{brand.balance === null ? <span className="text-sm font-semibold text-[var(--portal-muted)]">No informado</span> : brand.balance}</dd></div>
                    <div><dt className="text-xs font-semibold text-[var(--portal-muted)]">Acumulados en esta marca</dt><dd className="mt-1 break-words text-xl font-bold [overflow-wrap:anywhere]">{brand.lifetime === null ? <span className="text-sm font-semibold text-[var(--portal-muted)]">No informado</span> : brand.lifetime}</dd></div>
                  </dl>
                  <p className="mt-3 text-xs leading-5 text-[var(--portal-muted)]">Puntos reportados. Los beneficios y sus condiciones se consultan por separado.</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="wallet-collection-title" className="rounded-3xl border border-[color:var(--portal-border)] bg-[var(--portal-surface)] p-5 text-[var(--portal-text)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="wallet-collection-title" className="text-xl font-extrabold">Tus productos, siempre a mano</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--portal-muted)]">Volvé a las lecturas que guardaste y consultá los registros disponibles de cada producto.</p>
            </div>
            <Link href="/me/products" prefetch={false} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[color:var(--portal-border)] px-4 py-2 text-sm font-bold text-[var(--portal-accent)]">
              Ver mis productos <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Productos guardados", value: products.length, Icon: PackageCheck },
              { label: "Titularidad registrada", value: claimedProducts.length, Icon: WalletCards },
              { label: "Registros NFT reportados", value: onChainProducts.length, Icon: WalletCards },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="min-w-0 rounded-2xl bg-[var(--portal-subtle)] p-4">
                <dt className="flex items-start gap-2 text-sm font-semibold text-[var(--portal-muted)]"><Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{label}</dt>
                <dd className="mt-2 text-2xl font-extrabold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm leading-6 text-[var(--portal-muted)]">Son registros reportados en tu cuenta. Por sí solos no certifican el estado físico, el contenido ni la procedencia del producto.</p>
        </section>

        <WalletInteractiveClient initialProducts={products} selectedTenant={selectedTenant} />

        <details open={shouldAutoConnectMetaMask} className="rounded-3xl border border-[color:var(--portal-border)] bg-[var(--portal-surface)] p-5 text-[var(--portal-text)] sm:p-6">
          <summary className="min-h-11 cursor-pointer text-base font-bold text-[var(--portal-accent)]">Conectar una billetera externa (opcional)</summary>
          <div className="mt-4 v3-space-y-4">
            <p className="text-sm leading-6 text-[var(--portal-muted)]">Podés consultar tus productos, puntos y beneficios sin conectar una billetera externa. Estas herramientas son opcionales para los registros digitales que habilite cada marca.</p>
            <MetamaskSandboxCard initialWallet={wallet?.blockchainWallet} autoConnect={shouldAutoConnectMetaMask} />
            <details className="rounded-2xl border border-[color:var(--portal-border)] bg-[var(--portal-subtle)] p-4">
              <summary className="min-h-11 cursor-pointer text-sm font-semibold">Qué significa un registro en Polygon</summary>
              <p className="mt-3 text-sm leading-6 text-[var(--portal-muted)]">Cuando la política lo habilita, NexID puede registrar una titularidad digital en Polygon. La transacción prueba ese registro y el control de la billetera; no prueba autenticidad física, procedencia ni custodia del producto.</p>
            </details>
          </div>
        </details>

            <section data-wallet-scope="network" aria-labelledby="wallet-network-points-title" className="rounded-3xl border border-[color:var(--portal-border)] bg-[var(--portal-surface)] p-5 text-[var(--portal-text)]">
              <h3 id="wallet-network-points-title" className="text-base font-extrabold">Puntos de la red nexID</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--portal-muted)]">Cuenta independiente de los saldos por marca.</p>
              {points.network.status === "disabled" ? (
                <p className="mt-4 rounded-xl bg-[var(--portal-subtle)] p-3 text-sm leading-6 text-[var(--portal-muted)]">La red nexID no está habilitada para esta cuenta. Esto no afecta tus puntos de cada marca.</p>
              ) : points.network.status === "unavailable" ? (
                <div role="status" className="mt-4 v3-space-y-3">
                  <p className="text-sm leading-6 text-[var(--portal-muted)]">Saldo de red no disponible. No se reemplaza con cero ni con los puntos de tus marcas.</p>
                  {points.brands.status === "ready" ? <ConsumerDataRetryButton /> : null}
                </div>
              ) : (
                <dl className="mt-4 v3-space-y-4">
                  <div><dt className="text-xs font-semibold text-[var(--portal-muted)]">Saldo reportado de la red</dt><dd className="mt-1 text-xl font-extrabold">{points.network.balance === null ? "No informado" : points.network.balance}</dd></div>
                  <div><dt className="text-xs font-semibold text-[var(--portal-muted)]">Acumulados en la red nexID</dt><dd className="mt-1 break-words text-xl font-bold [overflow-wrap:anywhere]">{points.network.lifetime === null ? "No informado" : points.network.lifetime}</dd></div>
                </dl>
              )}
            </section>
      </div>
    </PortalShell>
  );
}
