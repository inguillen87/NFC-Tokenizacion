"use client";

import { useEffect } from "react";
import { EnterpriseOpsState } from "../../components/enterprise-ops-state";

export default function DashboardWorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Dashboard workspace render failed", error);
  }, [error]);

  return (
    <main className="space-y-6" data-testid="dashboard-workspace-error">
      <EnterpriseOpsState
        variant="error"
        title="No pudimos abrir esta vista operativa"
        description="La pantalla falló antes de confirmar sus datos. No mostramos métricas parciales como si fueran definitivas. Reintentá la carga o volvé al inicio del workspace."
        checklist={[
          error.digest ? `Referencia técnica: ${error.digest}` : "La referencia técnica quedó registrada en observabilidad",
          "Tu sesión y tus cambios guardados no se modificaron",
        ]}
        action={(
          <>
            <button type="button" onClick={reset} className="rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100 hover:bg-cyan-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
              Reintentar
            </button>
            <a href="/" className="rounded-xl border border-white/10 bg-slate-950/65 px-4 py-2 text-sm font-black text-slate-200 hover:border-white/25 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
              Volver al inicio
            </a>
          </>
        )}
      />
    </main>
  );
}
