import { buildConsumerNextPath, readConsumerSession } from "../_components/consumer-api";
import { ConsumerPortalUnavailable } from "../_components/consumer-portal-recovery";
import { PortalShell } from "../_components/portal-shell";
import CorkClient from "./cork-client";

export default async function CorkAnalyzerPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const session = await readConsumerSession(buildConsumerNextPath("/me/cork-analyzer", params));
  if (session.status === "unavailable") return <ConsumerPortalUnavailable />;

  return (
    <PortalShell 
      title="Diagnóstico de Corcho & Cápsula" 
      subtitle="Analizá el estado de conservación de tus botellas guardadas mediante inspección óptica asistida por IA."
    >
      <CorkClient />
    </PortalShell>
  );
}
