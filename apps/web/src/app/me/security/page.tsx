import { fetchConsumerMe } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";
import { SecurityPanel } from "./security-panel";

export default async function SecurityPage() {
  const me = await fetchConsumerMe();
  const consumer = me?.consumer || null;
  const stats = me?.stats || {};

  return (
    <PortalShell
      title="Seguridad y Doble Factor"
      subtitle="Protegé tu Pasaporte de Productos vinculando tu WhatsApp y Email para obtener tu estatus Verificado (2FA) y bonificar tus puntos."
      notificationCount={Number(stats.unread || 0)}
    >
      <SecurityPanel initialConsumer={consumer} />
    </PortalShell>
  );
}
