import { fetchConsumerPath } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";
import { MetamaskSandboxCard } from "./metamask-sandbox-card";

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
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] font-black text-cyan-200">NX</div>
                  <p className="text-sm font-bold text-white">Consolidado</p>
               </div>
               <p className="text-2xl font-bold text-white">{wallet?.balance_points || 0} <span className="text-xs text-slate-500">pts</span></p>
            </div>

            <div className="mt-6 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
               <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-400">NexID Network</h4>
               <p className="mt-1 text-[11px] leading-5 text-cyan-200/75">Creditos globales, beneficios cruzados y ownership transferible para marketplace.</p>
               <div className="mt-3 grid gap-2 text-[10px] text-slate-200">
                 {["Tap valido", "Request token", "Mint sandbox", "Passport link"].map((step) => (
                   <div key={step} className="rounded-lg border border-white/10 bg-slate-950/55 px-2 py-1.5">{step}</div>
                 ))}
               </div>
            </div>
            <MetamaskSandboxCard />
         </div>

      </div>
    </PortalShell>
  );
}
