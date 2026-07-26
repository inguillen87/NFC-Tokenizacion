import { EnterpriseOpsState } from "../../components/enterprise-ops-state";

export default function DashboardWorkspaceLoading() {
  return (
    <main className="space-y-6" aria-label="Cargando workspace operativo">
      <EnterpriseOpsState
        variant="loading"
        title="Sincronizando el workspace"
        description="Estamos cargando el alcance autorizado, los indicadores y la actividad operativa. Los datos no se reemplazan por valores simulados durante la espera."
        checklist={["Validando scope y permisos", "Consultando fuentes operativas", "Preparando filtros y visualizaciones"]}
        testId="dashboard-workspace-loading"
      />
      <div aria-hidden="true" className="grid animate-pulse gap-4 motion-reduce:animate-none sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 rounded-2xl border border-white/8 bg-slate-900/55" />
        ))}
      </div>
      <div aria-hidden="true" className="h-[24rem] animate-pulse rounded-2xl border border-white/8 bg-slate-900/45 motion-reduce:animate-none" />
    </main>
  );
}
