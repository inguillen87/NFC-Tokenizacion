import { buildConsumerNextPath, fetchConsumerMe, fetchConsumerPath, requireConsumerSession } from "./_components/consumer-api";
import { PortalShell } from "./_components/portal-shell";
import { buildConsumerHomeModel } from "./_components/consumer-home-model";
import { MePortalInteractiveClient } from "./_components/me-portal-interactive-client";

export default async function MePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me", params));
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
