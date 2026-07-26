import { ExternalLink, KeyRound, Network, Server, ShieldAlert, WalletCards } from "lucide-react";
import { Card } from "@product/ui";

const custodyFacts = [
  {
    label: "Arquitectura piloto prevista",
    value: "KMS-wrapped SOFTWARE · NO VERIFICADO",
    body: "El diseño admite material envuelto por Google Cloud KMS y firma efímera en el executor. Esta tarjeta no consulta configuración ni demuestra que el entorno actual lo tenga habilitado.",
    icon: KeyRound,
    tone: "text-cyan-300",
  },
  {
    label: "Firma HSM directa",
    value: "NO CONFIGURADA",
    body: "Esta implementación no es Cloud HSM ni una clave asimétrica no exportable. Ese upgrade queda reservado para mainnet o contratos que lo exijan.",
    icon: ShieldAlert,
    tone: "text-amber-300",
  },
  {
    label: "Executor blockchain",
    value: "VERIFICAR RUNTIME",
    body: "El estado, la latencia y la cola deben provenir del endpoint operativo. Esta tarjeta no inventa salud ni rendimiento cuando esa telemetría no está disponible.",
    icon: Server,
    tone: "text-violet-300",
  },
  {
    label: "Gas y red",
    value: "TESTNET PREVISTA · VERIFICAR",
    body: "Polygon Amoy e IOTA testnet sólo se consideran operativos con health, recibos y RPC públicos. El balance de gas no se infiere sin consultar la wallet configurada.",
    icon: WalletCards,
    tone: "text-emerald-300",
  },
] as const;

export function BlockchainHsmHealth() {
  return (
    <Card className="overflow-hidden border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-slate-900/95 to-slate-950 p-6 shadow-2xl">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div className="max-w-3xl">
          <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-200">
            Estado de custodia · piloto / testnet
          </span>
          <h2 className="mt-2 text-base font-black text-white">Custodia y ejecución blockchain</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Arquitectura piloto prevista, no una consola HSM ni prueba de configuración. La custodia, red y métricas operativas requieren una fuente runtime verificable.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-200">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          Sin HSM declarado
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {custodyFacts.map((fact) => {
          const Icon = fact.icon;
          return (
            <article key={fact.label} className="rounded-2xl border border-white/5 bg-slate-950/45 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{fact.label}</span>
                <Icon className={`h-5 w-5 ${fact.tone}`} aria-hidden="true" />
              </div>
              <strong className={`mt-3 block text-sm font-black ${fact.tone}`}>{fact.value}</strong>
              <p className="mt-2 text-[11px] leading-5 text-slate-400">{fact.body}</p>
            </article>
          );
        })}
      </div>

      <div role="note" className="mt-4 flex flex-col gap-4 rounded-xl border border-cyan-300/15 bg-cyan-400/5 p-4 text-xs text-slate-300 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <strong className="inline-flex items-center gap-2 text-white">
            <Network className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            Qué significa para una empresa
          </strong>
          <p className="mt-1 leading-5 text-slate-400">
            Los taps NFC siguen validándose sin una transacción on-chain por lectura. IOTA y Polygon se usan únicamente cuando una política de auditoría, propiedad o transferencia lo requiere.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <a href="/proof" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 text-xs font-black text-cyan-100 hover:bg-cyan-400/20">
            Abrir Trust Operations <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <a href="/tokenization" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-black text-slate-100 hover:bg-white/10">
            Revisar tokenización <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </Card>
  );
}
