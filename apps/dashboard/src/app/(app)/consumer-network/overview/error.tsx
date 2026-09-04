"use client";

import { EnterpriseOpsState } from "../../../../components/enterprise-ops-state";

export default function ConsumerNetworkOverviewError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="space-y-6">
      <EnterpriseOpsState
        variant="error"
        title="No se pudo abrir clientes y campañas"
        description="La vista falló antes de completar el contrato de datos. Reintentar conserva la URL actual y su tenant; no reemplazamos el fallo con métricas en cero."
        action={(
          <button type="button" onClick={reset} className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs font-black text-rose-100">
            Reintentar
          </button>
        )}
        testId="consumer-network-error"
      />
    </main>
  );
}
