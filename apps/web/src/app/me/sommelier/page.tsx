import { buildConsumerNextPath, requireConsumerSession } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";
import SommelierClient from "./sommelier-client";

export default async function SommelierPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me/sommelier", params));

  const product = String(params.product || "Gran Reserva Seleccionada");
  const brand = String(params.brand || "Bodega nexID Partner");

  return (
    <PortalShell 
      title="Sommelier Virtual" 
      subtitle={`Orientación general para ${product}. El nombre indicado no prueba autenticidad ni reemplaza la ficha de la marca.`}
    >
      <SommelierClient productName={product} brandName={brand} />
    </PortalShell>
  );
}
