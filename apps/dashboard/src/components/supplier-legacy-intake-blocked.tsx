import Link from "next/link";
import { ArrowRight, LockKeyhole, ShieldCheck, TimerReset } from "lucide-react";
import styles from "./supplier-legacy-intake-blocked.module.css";

type SupplierLegacyIntakeBlockedProps = {
  context?: "supplier" | "onboarding";
};

const safeguards = [
  {
    Icon: ShieldCheck,
    title: "Sin llaves en claro",
    body: "El frontend no pide secretos de lote. El proveedor recibe el ZIP cifrado y la clave viaja por un canal separado.",
  },
  {
    Icon: TimerReset,
    title: "Pack de un solo uso",
    body: "Una segunda exportacion queda bloqueada. La correccion exige rotacion de lote o un pedido nuevo.",
  },
  {
    Icon: LockKeyhole,
    title: "Manifest verificable",
    body: "El manifiesto importado no se pisa. Las correcciones quedan auditadas como un nuevo sub-batch.",
  },
];

export function SupplierLegacyIntakeBlocked({ context = "supplier" }: SupplierLegacyIntakeBlockedProps) {
  const isOnboarding = context === "onboarding";

  return (
    <section className={styles.guardrail} data-testid="supplier-intake-guardrail" aria-labelledby="supplier-intake-title">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            <LockKeyhole aria-hidden="true" />
            Legacy intake bloqueado
          </span>
          <h2 id="supplier-intake-title">Las llaves de fabrica ya no se pegan en el navegador.</h2>
          <p>
            Supplier Order genera llaves batch cifradas en servidor, crea sub-batches, exporta un pack de un solo uso
            y registra evidencia en Tenant Vault.
            {isOnboarding ? " El rollout empieza contra un pedido industrial trazable." : ""}
          </p>
        </div>
        <Link href="/batches/supplier#supplier-order-console" className={styles.action}>
          Abrir Supplier Order
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      <div className={styles.safeguards} aria-label="Controles del intake industrial">
        {safeguards.map(({ Icon, title, body }) => (
          <div key={title}>
            <Icon aria-hidden="true" />
            <div><h3>{title}</h3><p>{body}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}
