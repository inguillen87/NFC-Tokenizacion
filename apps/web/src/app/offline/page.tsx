import type { Metadata } from "next";
import { OfflineQueueClient } from "./offline-queue-client";

export const metadata: Metadata = {
  title: "Verificación pendiente · nexID",
  description: "Cola local de lecturas SUN pendientes de validación online.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return <OfflineQueueClient />;
}
