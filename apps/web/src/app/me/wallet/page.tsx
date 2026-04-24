import { fetchConsumerPath } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";

type WalletPayload = { balance_points?: number; memberships?: number; saved_products?: number; trust_score?: number };

export default async function WalletLedgerPage() {
  const wallet = (await fetchConsumerPath("wallet")) as WalletPayload | null;

  return (
    <PortalShell
      title="Billetera de Puntos"
      subtitle="El detalle de tus transacciones, puntos ganados y beneficios canjeados en cada marca."
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">

         {/* Main Ledger */}
         <div className="space-y-6">
            <div className="flex items-center justify-between">
               <h2 className="text-lg font-bold text-white">Movimientos Recientes</h2>
               <select className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2 py-1">
                  <option>Todas las marcas</option>
               </select>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden">
               <table className="w-full text-left text-sm text-slate-300">
                  <thead className="border-b border-white/10 bg-slate-800/50 text-xs uppercase tracking-widest text-slate-400">
                     <tr>
                        <th className="px-4 py-3 font-medium">Fecha</th>
                        <th className="px-4 py-3 font-medium">Concepto</th>
                        <th className="px-4 py-3 font-medium">Marca</th>
                        <th className="px-4 py-3 font-medium text-right">Puntos</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     <tr className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-400" colSpan={4} align="center">No hay movimientos recientes.</td>
                     </tr>
                  </tbody>
               </table>
            </div>
         </div>

         {/* Sidebar Balances */}
         <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Saldos Activos</h3>

            <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
               <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs">⭐</div>
                  <p className="text-sm font-bold text-white">Consolidado</p>
               </div>
               <p className="text-2xl font-bold text-white">{wallet?.balance_points || 0} <span className="text-xs text-slate-500">pts</span></p>
            </div>

            <div className="mt-6 p-4 rounded-xl border border-cyan-500/20 bg-cyan-950/20 text-center">
               <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1">NexID Network</h4>
               <p className="text-[10px] text-cyan-200/70">Pronto vas a poder utilizar créditos globales para ofertas cruzadas en el marketplace.</p>
            </div>
         </div>

      </div>
    </PortalShell>
  );
}
