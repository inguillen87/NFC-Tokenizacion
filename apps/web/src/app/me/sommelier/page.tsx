import { buildConsumerNextPath, requireConsumerSession } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";
import SommelierClient from "./sommelier-client";
import { sommelierSelection } from "../../../lib/sommelier-conversation";

export default async function SommelierPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me/sommelier", params));

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
