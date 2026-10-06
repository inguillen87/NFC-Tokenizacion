import { buildConsumerNextPath, readConsumerSession } from "../_components/consumer-api";
import { ConsumerPortalUnavailable } from "../_components/consumer-portal-recovery";
import { PortalShell } from "../_components/portal-shell";
import SommelierClient from "./sommelier-client";
import { sommelierSelection } from "../../../lib/sommelier-conversation";

export default async function SommelierPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const session = await readConsumerSession(buildConsumerNextPath("/me/sommelier", params));
  if (session.status === "unavailable") return <ConsumerPortalUnavailable />;

  const { productName = "", brandName = "" } = sommelierSelection(params);

  return (
    <PortalShell 
      title="Asistente de vinos"
      subtitle="Una guía para servir, conservar y acompañar tus vinos. Consultá la ficha de la marca para los datos de cada producto."
    >
      <SommelierClient productName={productName} brandName={brandName} />
    </PortalShell>
  );
}
