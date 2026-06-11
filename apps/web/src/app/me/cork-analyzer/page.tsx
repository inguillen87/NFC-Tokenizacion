import { buildConsumerNextPath, requireConsumerSession } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";
import CorkClient from "./cork-client";

export default async function CorkAnalyzerPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me/cork-analyzer", params));

  return (
    <PortalShell 
      title="Diagnóstico de Corcho & Cápsula" 
      subtitle="Analizá el estado de conservación de tus botellas guardadas mediante inspección óptica asistida por IA."
    >
      <CorkClient />
    </PortalShell>
  );
}
