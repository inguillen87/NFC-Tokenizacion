import { StaticBrandHomeLink } from "../../components/brand-home-link-static";
import styles from "./portal-state.module.css";

export default function ConsumerPortalLoading() {
  return (
    <main className={styles.root} data-testid="consumer-portal-loading" aria-busy="true">
      <div className={styles.content}>
        <header className={styles.brandRow}>
          <StaticBrandHomeLink size={44} theme="light" ariaLabel="Ir al inicio de nexID" />
          <span>Mi espacio</span>
        </header>
        <section className={styles.card} aria-labelledby="consumer-loading-title">
          <span className={styles.eyebrow}>Tu pasaporte</span>
          <h1 id="consumer-loading-title">Abriendo tu espacio</h1>
          <p role="status">Estamos consultando tu cuenta y tus productos.</p>
          <div className={styles.skeleton} aria-hidden="true">
            <div className={styles.preview}><span /><div><i /><i /><i /></div></div>
            <div className={styles.rows}><span /><span /></div>
          </div>
          <p className={styles.note}>Si la consulta no responde, podrás reintentar.</p>
        </section>
      </div>
    </main>
  );
}
