import { randomUUID } from "node:crypto";
import { buildConsumerNextPath, fetchConsumerPath, readConsumerSession } from "../_components/consumer-api";
import { ConsumerPortalUnavailable } from "../_components/consumer-portal-recovery";
import { buildConsumerWalletPointsModel } from "../_components/consumer-wallet-points-model";
import { ConsumerRewardBrandPoints } from "../_components/consumer-reward-brand-points-client";
import { buildConsumerRewardsSnapshot, findRequestedVoucher, rewardTenant } from "../_components/consumer-rewards-model";
import { ConsumerDataRetryButton } from "../_components/me-portal-interactive-client";
import { PortalShell } from "../_components/portal-shell";
import { ConsumerRewardsClient } from "./rewards-client";
import styles from "./rewards.module.css";

export default async function RewardsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const tenant = rewardTenant(params.tenant);
  const session = await readConsumerSession(buildConsumerNextPath("/me/rewards", params));
  if (session.status === "unavailable") return <ConsumerPortalUnavailable />;
  const [rewardsPayload, walletPayload] = await Promise.all([fetchConsumerPath("rewards"), fetchConsumerPath("wallet")]);
  const rewards = buildConsumerRewardsSnapshot(rewardsPayload);
  const points = buildConsumerWalletPointsModel(walletPayload).brands;
  // Opaque per-render UI lifetime only; never an account identifier or read grant.
  const brandPointsEpoch = randomUUID();
  const selectedVoucher = findRequestedVoucher(rewards, params.voucher, params.tenant);
  return (
    <PortalShell title="Tus beneficios" subtitle="Tus marcas, tus puntos y tus vouchers. Todo en un lugar, con el estado de cada beneficio a la vista.">
      <div className={styles.rewards}>
        <ConsumerRewardBrandPoints key={brandPointsEpoch} sourceEpoch={brandPointsEpoch} initialPoints={points} tenant={tenant} />
        {params.voucher ? <div role="status" className={styles.notice}>{selectedVoucher ? "Encontramos el voucher en tu cuenta. Abrí sus detalles para consultar el código y el vencimiento."
          : rewards.status === "unavailable" ? "No pudimos verificar el voucher de este enlace. Reintentá la carga."
            : "No encontramos un voucher vigente que corresponda a este enlace y a tu cuenta. Revisá la marca y el vencimiento del mensaje original."}</div> : null}
        {rewards.status === "unavailable" ? <section className={styles.unavailable} role="status"><h2>No pudimos cargar tus beneficios</h2><p>Tus vouchers no se borraron. La información no está disponible en este momento.</p><ConsumerDataRetryButton /></section>
          : <ConsumerRewardsClient items={rewards.items} checkedAt={rewards.checkedAt} initialTenant={tenant} selectedVoucher={selectedVoucher} />}
      </div>
    </PortalShell>
  );
}
