"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { StaticBrandHomeLink } from "../../components/brand-home-link-static";
import styles from "./portal-state.module.css";

export default function ConsumerPortalError({ reset, retry }: { error: Error & { digest?: string }; reset: () => void; retry?: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return (
    <main className={styles.root} data-testid="consumer-portal-error">
      <div className={styles.content}>
        <header className={styles.brandRow}>
          <StaticBrandHomeLink size={44} theme="light" ariaLabel="Ir al inicio de nexID" />
          <span>Mi espacio</span>
        </header>
        <section className={styles.card} aria-labelledby="consumer-error-title">
          <span className={styles.eyebrow}>Tu pasaporte</span>
          <h1 ref={heading} tabIndex={-1} id="consumer-error-title">No pudimos abrir tu espacio</h1>
          <p>La consulta no respondió como esperábamos. Reintentá para revisar tu cuenta.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.retry} onClick={retry ?? reset}>Reintentar</button>
            <Link href="/" prefetch={false} className={styles.home}>Volver al inicio</Link>
          </div>
          <p className={styles.note}>Esta pantalla no confirma si el último producto quedó guardado. Revisalo en tu colección cuando vuelva a cargar.</p>
        </section>
      </div>
    </main>
  );
}
