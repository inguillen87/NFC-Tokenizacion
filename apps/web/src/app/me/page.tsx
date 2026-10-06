import { buildConsumerNextPath, fetchConsumerMe, fetchConsumerPath, readConsumerHomeSession } from "./_components/consumer-api";
import { PortalShell } from "./_components/portal-shell";
import { buildConsumerHomeModel } from "./_components/consumer-home-model";
import { MePortalInteractiveClient } from "./_components/me-portal-interactive-client";
import { ConsumerPortalUnavailable } from "./_components/consumer-portal-recovery";

export default async function MePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const session = await readConsumerHomeSession(buildConsumerNextPath("/me", params));
  if (session.status === "unavailable") return <ConsumerPortalUnavailable />;
  const [account, products, taps, brands] = await Promise.all([
    fetchConsumerMe(), fetchConsumerPath("products"), fetchConsumerPath("taps"), fetchConsumerPath("brands"),
  ]);
  const model = buildConsumerHomeModel({ account, products, taps, brands });
  return (
    <PortalShell title="Tus productos, más cerca." subtitle="Volvé a tus lecturas, consultá beneficios y elegí cómo conectar con cada marca.">
      <MePortalInteractiveClient model={model} />
    </PortalShell>
  );
}
