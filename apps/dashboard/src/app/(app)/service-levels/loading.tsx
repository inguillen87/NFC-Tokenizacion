import styles from "../../../components/usage-health.module.css";
export default function LoadingUsageHealth() {
  return <main className={styles.page} aria-busy="true" aria-label="Cargando uso y estado"><p className={styles.eyebrow}>Supervisión operativa</p><h1 className={styles.title}>Uso y estado</h1><p className={styles.subtitle} role="status">Consultando las fuentes autorizadas. Las métricas aparecen cuando se confirma su respuesta.</p><div className={styles.strip} aria-hidden="true">{[1,2,3,4].map(n=><div key={n} className={styles.metric}><span>Esperando datos</span><strong>—</strong></div>)}</div></main>;
}
