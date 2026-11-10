import Link from "next/link";
import { ArrowUpRight, Coins, Store } from "lucide-react";
import { buildConsumerNextPath, fetchConsumerPath, readConsumerSession } from "../_components/consumer-api";
import { ConsumerPortalUnavailable } from "../_components/consumer-portal-recovery";
import { buildConsumerWalletPointsModel } from "../_components/consumer-wallet-points-model";
import { buildConsumerRewardsModel, findRequestedVoucher, REWARD_STATE_LABELS, rewardDateLabel, rewardTenant } from "../_components/consumer-rewards-model";
import { ConsumerDataRetryButton } from "../_components/me-portal-interactive-client";
import { PortalShell } from "../_components/portal-shell";
import { brandTenantSlug } from "../brands/brands-model";
import { ConsumerRewardsClient } from "./rewards-client";
import { readLastRewardReceipt, type LastRewardReceipt } from "./last-receipt";
import styles from "./rewards.module.css";

const receiptGuidance: Record<LastRewardReceipt["status"], string> = {
  claimed: "La marca informa las condiciones para usar el voucher.",
  redeemed: "El canje queda registrado en tu cuenta.",
  cancelled: "Este voucher ya no se puede usar.",
  expired: "Terminó la vigencia de este voucher.",
  unknown: "Todavía hace falta confirmar si podés usar el voucher.",
};

export default async function RewardsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const tenant = rewardTenant(params.tenant);
  const session = await readConsumerSession(buildConsumerNextPath("/me/rewards", params));
  if (session.status === "unavailable") return <ConsumerPortalUnavailable />;
  const [rewardsPayload, walletPayload, lastReceipt] = await Promise.all([
    fetchConsumerPath("rewards"),
    fetchConsumerPath("wallet"),
    params.voucher || (params.tenant && !tenant) ? null : readLastRewardReceipt(),
  ]);
  const rewards = buildConsumerRewardsModel(rewardsPayload, new Date().toISOString());
  const points = buildConsumerWalletPointsModel(walletPayload).brands;
  const selectedVoucher = findRequestedVoucher(rewards, params.voucher, params.tenant);
  const receipt = lastReceipt && (!tenant || tenant === lastReceipt.tenant) ? lastReceipt : null;
  const receiptItems = receipt && rewards.status === "ready" ? rewards.items.filter(item =>
    item.hasClaim && item.key.toLowerCase() === "claim-" + receipt.id && item.id.toLowerCase() === receipt.rewardId
    && item.tenant === receipt.tenant
  ) : [];
  const receiptItem = receiptItems.length === 1 && receiptItems[0].state === receipt?.status ? receiptItems[0] : null;
  const receiptTenant = brandTenantSlug(receipt?.tenant);
  const receiptBrandHref = receiptTenant && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(receiptTenant)
    ? "/me/brands?" + new URLSearchParams({ tenant: receiptTenant }).toString()
    : null;
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
        {receipt ? <section className={`${styles.notice} ${styles.receipt}`} aria-labelledby="last-reward-receipt-title">
          <h2 id="last-reward-receipt-title" className={styles.receiptHeading}>Última reserva en este navegador</h2>
          {receiptItem ? <p>{receiptItem.title} · {receiptItem.brand}</p> : null}
          <dl className={styles.receiptMeta}>
            <div><dt>Estado registrado</dt><dd><span className={styles.badge} data-state={receipt.status}>{REWARD_STATE_LABELS[receipt.status]}</span></dd></div>
            {receipt.expiresAt ? <div><dt>Vencimiento informado</dt><dd>{rewardDateLabel(receipt.expiresAt)}</dd></div> : null}
          </dl>
          {!receiptItem ? <p>{rewards.status === "unavailable"
            ? "Podés consultar esta reserva aunque el listado de vouchers no se pudo cargar."
            : receiptItems.length > 0
              ? "El listado todavía no coincide con el estado de esta reserva."
              : "Podés consultar esta reserva aunque el voucher no figure en el listado actual."}</p> : null}
          <p>{receiptGuidance[receipt.status]}</p>
          {receiptItem ? <a className={styles.primaryLink} href={"#voucher-" + receiptItem.key}>{receipt.status === "claimed" ? "Ver detalle del voucher" : "Ver registro del voucher"}</a>
            : receiptBrandHref ? <Link className={styles.primaryLink} href={receiptBrandHref} prefetch={false}>Ver mi relación con la marca</Link> : null}
        </section> : null}
        {params.voucher ? <div role="status" className={styles.notice}>{selectedVoucher ? "Encontramos el voucher en tu cuenta. Abrí sus detalles para consultar el código y el vencimiento."
          : rewards.status === "unavailable" ? "No pudimos verificar el voucher de este enlace. Reintentá la carga."
            : "No encontramos un voucher vigente que corresponda a este enlace y a tu cuenta. Revisá la marca y el vencimiento del mensaje original."}</div> : null}
        {rewards.status === "unavailable" ? <section className={styles.unavailable} role="status"><h2>No pudimos cargar tus beneficios</h2><p>Tus vouchers no se borraron. La información no está disponible en este momento.</p><ConsumerDataRetryButton /></section>
          : <ConsumerRewardsClient items={rewards.items} initialTenant={tenant} selectedVoucher={selectedVoucher ?? receiptItem?.key ?? null} />}
      </div>
    </PortalShell>
  );
}
