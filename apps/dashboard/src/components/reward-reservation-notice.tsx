import { rewardReservationNotice } from "../lib/reward-reservation-notices";
import styles from "./reward-reservation-notice.module.css";

type Props = {
  reward: unknown;
  tenantScope: string;
  dataSource: "production" | "demo" | "unavailable";
};

export default function RewardReservationNotice({ reward, tenantScope, dataSource }: Props) {
  const notice = rewardReservationNotice(reward, { tenantScope, dataSource });
  return (
    <details className={styles.notice} data-reservation-notice={notice.state}>
      <summary className={styles.summary}>
        <span className={styles.heading}>Condiciones de acceso</span>
        <span className={styles.status}>{notice.summary}</span>
      </summary>
      <div className={styles.body}>
        {notice.rows.length > 0 ? (
          <dl className={styles.rows}>
            {notice.rows.map(row => (
              <div key={row.label} className={styles.row} data-attention={row.attention ? "true" : undefined}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <p className={styles.note}>{notice.note}</p>
      </div>
    </details>
  );
}
