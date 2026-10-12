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
      title="Simulación visual de corcho y cápsula"
      subtitle="Explorá escenarios visuales de ejemplo. La foto no se analiza ni ofrece un diagnóstico del corcho o del vino."
    >
      <CorkClient />
    </PortalShell>
  );
}
