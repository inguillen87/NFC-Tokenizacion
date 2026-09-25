import styles from './runtime-readiness-panel.module.css';

type Reason = 'tenant' | 'restricted';
/** Information about the access boundary only. No diagnostic data is fetched. */
export function RuntimeAccessNotice({ reason = 'restricted' }: { reason?: Reason }) {
  return <main className={styles.root} data-testid="runtime-access-restricted">
    <header className={styles.hero}><div>
      <p className={styles.eyebrow}>Administración global de NexID</p>
      <h1>Esta consola requiere acceso global</h1>
      <p className={styles.muted}>La página existe. Tu sesión actual no tiene acceso a este diagnóstico interno.</p>
    </div></header>
    <section className={styles.card} aria-labelledby="runtime-access-heading">
      <h2 id="runtime-access-heading">{reason === 'tenant' ? 'Estás dentro del espacio de una empresa' : 'La sesión no está autorizada para este diagnóstico'}</h2>
      <p>{reason === 'tenant'
        ? 'Administrar una empresa no otorga acceso a las conexiones, usuarios SQL y requisitos internos de toda la plataforma.'
        : 'Se necesita una cuenta global de superadministrador con acceso a auditoría. Una sesión demo o con permisos restringidos no puede consultar estos datos.'}</p>
      <div className={styles.notice} role="status">No se consultaron datos del diagnóstico ni se modificaron tus permisos.</div>
      <p>Para consultar esta consola, iniciá sesión con una cuenta global ya autorizada. No cambies los permisos de la empresa para resolver este acceso.</p>
      <div className={styles.actions}>
        <a className={`${styles.button} ${styles.primary}`} href="/settings">Volver a configuración</a>
        <a className={styles.button} href="/">Volver al panel</a>
      </div>
    </section>
  </main>;
}
