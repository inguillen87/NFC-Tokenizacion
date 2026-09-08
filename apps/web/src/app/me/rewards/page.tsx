import Link from "next/link";
import { ArrowUpRight, Coins, Store } from "lucide-react";
import { buildConsumerNextPath, fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import { buildConsumerWalletPointsModel } from "../_components/consumer-wallet-points-model";
import { buildConsumerRewardsModel, findRequestedVoucher, rewardTenant } from "../_components/consumer-rewards-model";
import { ConsumerDataRetryButton } from "../_components/me-portal-interactive-client";
import { PortalShell } from "../_components/portal-shell";
import { ConsumerRewardsClient } from "./rewards-client";
import styles from "./rewards.module.css";

export default async function RewardsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const tenant = rewardTenant(params.tenant);
  await requireConsumerSession(buildConsumerNextPath("/me/rewards", params));
  const [rewardsPayload, walletPayload] = await Promise.all([fetchConsumerPath("rewards"), fetchConsumerPath("wallet")]);
  const rewards = buildConsumerRewardsModel(rewardsPayload, new Date().toISOString());
  const points = buildConsumerWalletPointsModel(walletPayload).brands;
  const selectedVoucher = findRequestedVoucher(rewards, params.voucher, params.tenant);
  return (
    <PortalShell title="Tus beneficios" subtitle="Tus marcas, tus puntos y tus vouchers. Todo en un lugar, con el estado de cada beneficio a la vista.">
      <div className={styles.rewards}>
        <section aria-labelledby="benefits-points-title" className={styles.pointsSection}>
          <div className={styles.sectionHeading}>
            <div className={styles.headingIcon}><Coins aria-hidden="true" /><div><h2 id="benefits-points-title">Puntos por marca</h2><p>Cada marca tiene su propio saldo y condiciones.</p></div></div>
            <Link className={styles.textLink} href="/me/wallet">Ver mi billetera <ArrowUpRight aria-hidden="true" /></Link>
          </div>
          {points.status === "unavailable" ? <div role="status" className={styles.notice}><p>No pudimos cargar tus puntos. Tus saldos no se muestran como cero.</p><ConsumerDataRetryButton /></div>
            : points.data.length === 0 ? <p className={styles.notice}>Todavía no tenés puntos por marca registrados en esta cuenta.</p>
              : <div className={styles.brandGrid}>{points.data.map((brand, index) => <article key={`${brand.slug}-${index}`} className={styles.brandCard} data-benefit-points="brand">
                <Store aria-hidden="true" /><div><h3>{brand.name || brand.slug || "Marca no informada"}</h3><span>Saldo reportado</span></div>
                <strong>{brand.balance === null ? "No informado" : <>{brand.balance}<small> pts</small></>}</strong>
              </article>)}</div>}
        </section>
        {params.voucher ? <div role="status" className={styles.notice}>{selectedVoucher ? "Encontramos el voucher en tu cuenta. Abrí sus detalles para consultar el código y el vencimiento."
          : rewards.status === "unavailable" ? "No pudimos verificar el voucher de este enlace. Reintentá la carga."
            : "No encontramos un voucher vigente que corresponda a este enlace y a tu cuenta. Revisá la marca y el vencimiento del mensaje original."}</div> : null}
        {rewards.status === "unavailable" ? <section className={styles.unavailable} role="status"><h2>No pudimos cargar tus beneficios</h2><p>Tus vouchers no se borraron. La información no está disponible en este momento.</p><ConsumerDataRetryButton /></section>
          : <ConsumerRewardsClient items={rewards.items} initialTenant={tenant} selectedVoucher={selectedVoucher} />}
      </div>
    </PortalShell>
  );
}
