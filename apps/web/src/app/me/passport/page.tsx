import { buildConsumerNextPath, fetchConsumerMe, readConsumerSession } from "../_components/consumer-api";
import { ConsumerPortalUnavailable } from "../_components/consumer-portal-recovery";
import { PortalShell } from "../_components/portal-shell";
import { passportAccountModel, passportTenant } from "./passport-account-model";
import { PassportAccountPanel, PassportAccountUnavailable } from "./passport-account-panel";

export default async function PassportPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const session = await readConsumerSession(buildConsumerNextPath("/me/passport", params));
  if (session.status === "unavailable") return <ConsumerPortalUnavailable />;
  const account = passportAccountModel(await fetchConsumerMe());
  const tenant = passportTenant(params.tenant);

  return (
    <PortalShell title="Mi cuenta y mis registros" subtitle="Tus contactos, tus productos y tu relación con las marcas, en un solo lugar.">
      {account.state === "ready" ? <PassportAccountPanel account={account} tenant={tenant} /> : <PassportAccountUnavailable />}
    </PortalShell>
  );
}
