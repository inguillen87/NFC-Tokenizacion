import Link from "next/link";
import { ArrowLeft, CheckCircle2, Mail, Phone, ShieldCheck } from "lucide-react";
import { buildConsumerContactSecurityModel, type ConsumerSecurityContacts } from "./consumer-contact-security-policy";
import styles from "./security-panel.module.css";

export function SecurityPanel({ initialConsumer }: { initialConsumer: ConsumerSecurityContacts }) {
  const model = buildConsumerContactSecurityModel(initialConsumer);

  return (
    <div className={styles.panel}>
      <section className={styles.card} aria-labelledby="security-contacts-title">
        <div className={styles.heading}>
          <span className={styles.icon}><ShieldCheck aria-hidden="true" /></span>
          <div>
            <h2 id="security-contacts-title">Contactos de esta cuenta</h2>
            <p>Revisá qué email o WhatsApp está asociado a tu espacio.</p>
          </div>
        </div>
        {model.contacts.length ? (
          <dl className={styles.contacts}>
            {model.contacts.map((contact) => (
              <div key={contact.channel}>
                <dt>{contact.channel === "email" ? <Mail aria-hidden="true" /> : <Phone aria-hidden="true" />}{contact.label}</dt>
                <dd>{contact.value}</dd>
              </div>
            ))}
          </dl>
        ) : <p className={styles.note}>No pudimos mostrar tus contactos. Podés volver a tu cuenta y reintentar la consulta.</p>}
        {model.hasBothLinkedChannels ? (
          <p className={styles.confirmation}><CheckCircle2 aria-hidden="true" />Tu email y tu WhatsApp figuran en la misma cuenta.</p>
        ) : null}
        <p className={styles.note}>Entrar con un código confirma el contacto que usaste para acceder. Tener dos contactos asociados no agrega una segunda verificación al ingreso.</p>
      </section>

      <section className={styles.availability} aria-labelledby="security-linking-title" data-contact-linking-state={model.linking.state}>
        <span className={styles.status}>Por ahora no disponible</span>
        <h2 id="security-linking-title">Vincular otro contacto</h2>
        <p>{model.linking.message}</p>
        <p className={styles.note}>Si entrás con un email o WhatsApp que todavía no está vinculado, podés abrir otra cuenta. Para volver a tus productos, usá el mismo contacto con el que los guardaste.</p>
      </section>

      <Link href="/me" prefetch={false} className={styles.back}><ArrowLeft aria-hidden="true" />Volver a mi cuenta</Link>
    </div>
  );
}
