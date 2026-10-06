"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { StaticBrandHomeLink } from "../../../components/brand-home-link-static";
import styles from "../portal-state.module.css";

export function ConsumerPortalRecovery({ retry, pending = false, unavailable = false }: { retry: () => void; pending?: boolean; unavailable?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = unavailable ? "consumer-session-unavailable-title" : "consumer-error-title";
  useEffect(() => { heading.current?.focus(); }, []);
  return (
    <main className={styles.root} data-testid={unavailable ? "consumer-portal-unavailable" : "consumer-portal-error"}>
      <div className={styles.content}>
        <header className={styles.brandRow}>
          <StaticBrandHomeLink size={44} theme="light" ariaLabel="Ir al inicio de nexID" />
          <span>Mi espacio</span>
        </header>
        <section className={styles.card} aria-labelledby={titleId}>
          <span className={styles.eyebrow}>Tu pasaporte</span>
          <h1 ref={heading} tabIndex={-1} id={titleId}>No pudimos abrir tu espacio</h1>
          <p>La consulta no respondió como esperábamos. Reintentá para revisar tu cuenta.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.retry} disabled={pending} aria-busy={pending} onClick={retry}>{pending ? "Consultando…" : "Reintentar"}</button>
            <Link href="/" prefetch={false} className={styles.home}>Volver al inicio</Link>
          </div>
          <p className={styles.note}>Esta pantalla no confirma si el último producto quedó guardado. Revisalo en tu colección cuando vuelva a cargar.</p>
        </section>
      </div>
    </main>
  );
}

export function ConsumerPortalUnavailable() {
  const router = useRouter();
  const [pending, startRefresh] = useTransition();
  const retry = () => { if (!pending) startRefresh(() => router.refresh()); };
  return <ConsumerPortalRecovery unavailable pending={pending} retry={retry} />;
}
