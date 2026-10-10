import Link from "next/link";
import { ArrowRight, Building2, Gift, History, Mail, Package, Phone, UserRound } from "lucide-react";
import { ConsumerDataRetryButton } from "../_components/me-portal-interactive-client";
import type { PassportAccountModel } from "./passport-account-model";
import styles from "./passport.module.css";

export function PassportAccountPanel({ account, tenant }: { account: Extract<PassportAccountModel, { state: "ready" }>; tenant: string | null }) {
  const scoped = (path: string) => tenant ? `${path}?${new URLSearchParams({ tenant })}` : path;
  return (
    <div className={styles.passport}>
      <section className={styles.card} aria-labelledby="passport-account-title">
        <div className={styles.heading}>
          <span className={styles.icon}><UserRound aria-hidden="true" /></span>
          <div><span className={styles.eyebrow}>Tu espacio NexID</span><h2 id="passport-account-title">{account.name || "Tu cuenta"}</h2></div>
        </div>
        <dl className={styles.contacts}>
          {account.contacts.map(contact => <div key={contact.channel}><dt>{contact.channel === "email" ? <Mail aria-hidden="true" /> : <Phone aria-hidden="true" />}{contact.label}</dt><dd>{contact.value}</dd></div>)}
          <div className={styles.accountState}><dt>Estado de la cuenta</dt><dd data-account-state={account.status.state}>{account.status.label}</dd></div>
        </dl>
        {!account.contacts.length ? <p className={styles.note}>Esta consulta no informó un contacto para mostrar.</p> : null}
        <p className={styles.note}>El estado de tu cuenta no confirma la autenticidad ni el estado de tus productos. Cada lectura muestra sus propias verificaciones.</p>
        <Link className={styles.textLink} href="/me/security" prefetch={false}>Revisar contactos<ArrowRight aria-hidden="true" /></Link>
      </section>

      <nav className={styles.destinations} aria-label="Consultar mis registros">
        {[
          { label: "Mis productos", detail: "Tu colección guardada", count: account.counts.products, countLabel: "Productos guardados", href: "/me/products", Icon: Package },
          { label: "Mis lecturas", detail: "El historial de tus taps", count: account.counts.taps, countLabel: "Lecturas guardadas", href: "/me/taps", Icon: History },
          { label: "Mis marcas y clubes", detail: "Tu relación con cada marca", count: account.counts.memberships, countLabel: "Marcas registradas", href: scoped("/me/brands"), Icon: Building2 },
        ].map(({ label, detail, count, countLabel, href, Icon }) => <Link key={href} href={href} prefetch={false} className={styles.destination}>
          <span className={styles.destinationIcon}><Icon aria-hidden="true" /></span>
          <span className={styles.destinationCopy}><strong>{label}</strong><span>{detail}</span><small>{count === null ? `${countLabel}: no informado` : `${countLabel}: ${count}`}</small></span>
          <ArrowRight aria-hidden="true" />
        </Link>)}
      </nav>

      <section className={styles.benefits} aria-labelledby="passport-benefits-title">
        <Gift aria-hidden="true" />
        <div><h2 id="passport-benefits-title">Las experiencias de tus marcas</h2><p>Consultá los beneficios publicados, sus condiciones y los puntos de cada programa.</p><Link className={styles.textLink} href={scoped("/me/rewards")} prefetch={false}>Ver mis beneficios<ArrowRight aria-hidden="true" /></Link><div className={styles.secondaryActions}><Link className={styles.textLink} href={scoped("/me/wallet")} prefetch={false}>Mis puntos y registros<ArrowRight aria-hidden="true" /></Link><Link className={styles.textLink} href={scoped("/me/marketplace")} prefetch={false}>Explorar catálogo<ArrowRight aria-hidden="true" /></Link></div></div>
      </section>
    </div>
  );
}

export function PassportAccountUnavailable() {
  return <section className={styles.recovery} role="status" aria-labelledby="passport-unavailable-title">
    <h2 id="passport-unavailable-title">No pudimos cargar los datos de tu cuenta</h2>
    <p>Reintentá la consulta para ver tus datos. Tus productos y contactos no se modificaron.</p>
    <div className={styles.recoveryActions}><ConsumerDataRetryButton /><Link className={styles.textLink} href="/me" prefetch={false}>Volver a mi cuenta</Link></div>
  </section>;
}
