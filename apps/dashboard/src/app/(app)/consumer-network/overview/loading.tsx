import { EnterpriseOpsState } from "../../../../components/enterprise-ops-state";

export default function ConsumerNetworkOverviewLoading() {
  return (
    <main className="space-y-6" aria-label="Cargando clientes y campañas">
      <EnterpriseOpsState
        variant="loading"
        title="Consultando clientes y campañas"
        description="Validamos scope, permisos y el contrato de cada fuente. Durante la carga no mostramos ceros ni estados operativos provisionales."
        checklist={["Resumen del tenant", "Miembros y consentimientos", "Productos y taps"]}
        testId="consumer-network-loading"
      />
      <div aria-hidden="true" className="grid animate-pulse gap-4 motion-reduce:animate-none md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 rounded-xl border border-white/10 bg-slate-900/50" />)}
      </div>
    </main>
  );
}
