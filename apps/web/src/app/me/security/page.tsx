import { fetchConsumerMe } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";
import { SecurityPanel } from "./security-panel";

export default async function SecurityPage() {
  const me = await fetchConsumerMe();
  const consumer = me?.consumer || null;
  const stats = me?.stats || {};

  return (
    <PortalShell
      title="Seguridad y canales de contacto"
      subtitle="Vinculá email y WhatsApp para mejorar entrega y recuperación. El código puede validarse desde cualquiera de los canales configurados; este flujo no es MFA secuencial."
      notificationCount={Number(stats.unread || 0)}
    >
      <SecurityPanel initialConsumer={consumer} />
    </PortalShell>
  );
}
