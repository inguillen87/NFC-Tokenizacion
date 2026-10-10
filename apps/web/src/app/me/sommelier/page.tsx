import Link from "next/link";
import { buildConsumerNextPath, fetchConsumerPath, readConsumerSession } from "../_components/consumer-api";
import { ConsumerPortalUnavailable } from "../_components/consumer-portal-recovery";
import { PortalShell } from "../_components/portal-shell";
import SommelierClient from "./sommelier-client";
import { readPublicTenantConfiguration } from "../../../lib/public-tenant-configuration";
import { consumerSommelierEventId, consumerSommelierScope } from "./consumer-sommelier-scope";
import styles from "./sommelier.module.css";

export default async function SommelierPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const session = await readConsumerSession(buildConsumerNextPath("/me/sommelier", params));
  if (session.status === "unavailable") return <ConsumerPortalUnavailable />;

  const hasEventContext = params.eventId !== undefined;
  const eventId = consumerSommelierEventId(params.eventId);
  const [reading, configuration] = eventId ? await Promise.all([
    fetchConsumerPath(`taps/${encodeURIComponent(eventId)}`), readPublicTenantConfiguration(eventId),
  ]) : [null, null];
  const scope = consumerSommelierScope(hasEventContext, eventId, reading, configuration);

  return (
    <PortalShell 
      title="Asistente de vinos"
      subtitle="Una guía para servir, conservar y acompañar tus vinos. Consultá la ficha de la marca para los datos de cada producto."
    >
      {scope.state === "ready" ? <SommelierClient key={scope.eventId || "general"} productName={scope.productName} brandName={scope.brandName} eventId={scope.eventId} />
        : <section className={`${styles.assistant} ${styles.panel}`} role="status"><h2>El asistente de este producto no está disponible</h2><p>{scope.state === "unpublished" ? "La marca no habilitó el asistente para esta lectura. Podés volver a consultar las opciones del producto." : "No pudimos confirmar la lectura y las opciones de su marca. Volvé a abrirla desde tu cuenta."}</p><Link className={styles.back} href="/me/products" prefetch={false}>Volver a mis productos</Link></section>}
    </PortalShell>
  );
}
