import { Suspense } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Coins, Store } from "lucide-react";
import { buildConsumerNextPath, fetchConsumerPath, readConsumerSession } from "../_components/consumer-api";
import { ConsumerPortalUnavailable } from "../_components/consumer-portal-recovery";
import { buildConsumerWalletPointsModel } from "../_components/consumer-wallet-points-model";
import { buildConsumerRewardsModel, findRequestedVoucher, rewardTenant } from "../_components/consumer-rewards-model";
import { ConsumerDataRetryButton } from "../_components/me-portal-interactive-client";
import { PortalShell } from "../_components/portal-shell";
import { ConsumerRewardsClient } from "./rewards-client";
import styles from "./rewards.module.css";

type ConsumerRead = ReturnType<typeof fetchConsumerPath>;

async function BrandPoints({ request }: { request: ConsumerRead }) {
  const points = buildConsumerWalletPointsModel(await request).brands;
  if (points.status === "unavailable") {
    return <div role="status" className={styles.notice}><p>No pudimos cargar tus puntos.</p><ConsumerDataRetryButton /></div>;
  }
  if (points.data.length === 0) {
    return <p className={styles.notice}>Todavía no tenés puntos por marca registrados en esta cuenta.</p>;
  }
  return <div className={styles.brandGrid}>{points.data.map((brand, index) => <article key={`${brand.slug}-${index}`} className={styles.brandCard} data-benefit-points="brand">
    <Store aria-hidden="true" /><div><h3>{brand.name || brand.slug || "Marca no informada"}</h3><span>Saldo reportado</span></div>
    <strong>{brand.balance === null ? "No informado" : <>{brand.balance}<small> pts</small></>}</strong>
  </article>)}</div>;
}

async function RewardResults({ request, voucher, requestedTenant, tenant }: {
  request: ConsumerRead; voucher: unknown; requestedTenant: unknown; tenant: string;
}) {
  const rewardsPayload = await request;
  const rewards = buildConsumerRewardsModel(rewardsPayload, new Date().toISOString());
  const selectedVoucher = findRequestedVoucher(rewards, voucher, requestedTenant);
  return <>
    {voucher && !selectedVoucher && rewards.status === "ready" ? <p role="status" className={styles.notice}>No encontramos un voucher vigente para este enlace. Revisá la marca y el vencimiento en el mensaje original.</p> : null}
    {rewards.status === "unavailable" ? <section className={styles.unavailable} role="status"><h2>No pudimos cargar tus beneficios</h2><p>{voucher ? "Reintentá para verificar el voucher de este enlace." : "Reintentá para consultar tus beneficios y vouchers."}</p><ConsumerDataRetryButton /></section>
      : <ConsumerRewardsClient items={rewards.items} initialTenant={tenant} selectedVoucher={selectedVoucher} />}
  </>;
}

export default async function RewardsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const tenant = rewardTenant(params.tenant);
  const session = await readConsumerSession(buildConsumerNextPath("/me/rewards", params));
  if (session.status === "unavailable") return <ConsumerPortalUnavailable />;
  const rewardsRequest = fetchConsumerPath("rewards");
  const walletRequest = fetchConsumerPath("wallet");
  return (
    <PortalShell title="Tus beneficios" subtitle="Consultá los beneficios, vouchers y puntos de tus marcas.">
      <div className={styles.rewards}>
        <a href="#benefits-points-title" className={`${styles.textLink} ${styles.pointsShortcut}`}>Puntos por marca <ArrowDown aria-hidden="true" /></a>
        <Suspense fallback={<p className={styles.notice} role="status">Cargando tus beneficios…</p>}>
          <RewardResults request={rewardsRequest} voucher={params.voucher} requestedTenant={params.tenant} tenant={tenant} />
        </Suspense>
        <section aria-labelledby="benefits-points-title" className={styles.pointsSection}>
          <div className={styles.sectionHeading}>
            <div className={styles.headingIcon}><Coins aria-hidden="true" /><div><h2 id="benefits-points-title" className={styles.pointsHeading} tabIndex={-1}>Puntos por marca</h2><p>Cada marca tiene su propio saldo y condiciones.</p></div></div>
            <Link className={styles.textLink} href="/me/wallet">Ver mi billetera <ArrowUpRight aria-hidden="true" /></Link>
          </div>
          <Suspense fallback={<p className={styles.notice} role="status">Cargando puntos por marca…</p>}>
            <BrandPoints request={walletRequest} />
          </Suspense>
        </section>
      </div>
    </PortalShell>
  );
}
