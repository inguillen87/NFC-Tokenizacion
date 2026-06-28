"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, HardDrive, Cpu, Coins, RefreshCw, CheckCircle2 } from "lucide-react";
import { Card } from "@product/ui";

export function BlockchainHsmHealth() {
  const [gasBalance, setGasBalance] = useState(784.52);
  const [blockHeight, setBlockHeight] = useState(4829103);
  const [loading, setLoading] = useState(false);
  const [faucetTx, setFaucetTx] = useState<string | null>(null);
  const [hsmStatus, setHsmStatus] = useState<"connected" | "rekeying" | "error">("connected");

  // Simulate blockchain block time (new block mined every 4.5s)
  useEffect(() => {
    const interval = setInterval(() => {
      setBlockHeight((h) => h + 1);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const handleFaucetRequest = () => {
    setLoading(true);
    setFaucetTx(null);
    setTimeout(() => {
      setGasBalance((prev) => prev + 10.0);
      setFaucetTx("0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""));
      setLoading(false);
    }, 1200);
  };

  return (
    <Card className="overflow-hidden border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-slate-900/95 to-slate-950 p-6 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-200">
            Seguridad Criptográfica & Web3
          </span>
          <h2 className="mt-1 text-base font-black text-white">Monitoreo de Infraestructura & HSM Minter</h2>
          <p className="mt-1 text-xs text-slate-400">
            Resumen visual del firmador seguro (Hardware Security Module) y los saldos de gas en Polygon.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span suppressHydrationWarning className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
            Sistemas Conectados
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* AWS HSM Minter Card */}
        <div className="rounded-2xl border border-white/5 bg-slate-950/45 p-4 transition hover:border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Firmador KMS (HSM)</span>
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-1.5 text-lg font-black text-white">
              <span>ACTIVO</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              Clave Maestra resguardada en Hardware Físico. Las llaves nunca salen del HSM.
            </p>
          </div>
        </div>

        {/* Executor API status */}
        <div className="rounded-2xl border border-white/5 bg-slate-950/45 p-4 transition hover:border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Microservicio Executor</span>
            <Cpu className="h-5 w-5 text-violet-400" />
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-1.5 text-lg font-black text-white">
              <span>ONLINE</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              Latencia promedio: <b className="text-violet-200">42ms</b>. Transacciones firmadas en cola: <b className="text-white">0</b>.
            </p>
          </div>
        </div>

        {/* Gas Balance Indicator */}
        <div className="rounded-2xl border border-white/5 bg-slate-950/45 p-4 transition hover:border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Billetera de Gas (Amoy)</span>
            <Coins className="h-5 w-5 text-amber-400" />
          </div>
          <div className="mt-3">
            <div className="text-lg font-black text-white">{gasBalance.toFixed(2)} POL</div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${gasBalance < 50 ? "bg-rose-500 animate-pulse" : "bg-gradient-to-r from-amber-400 to-emerald-400"}`} 
                style={{ width: `${Math.min((gasBalance / 1000) * 100, 100)}%` }} 
              />
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500 font-bold">
              {gasBalance < 50 ? "⚠️ ALERTA: Gas muy bajo" : "Suficiente para ~45,000 mints"}
            </p>
          </div>
        </div>

        {/* Dynamic Block Counter */}
        <div className="rounded-2xl border border-white/5 bg-slate-950/45 p-4 transition hover:border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bloque Polygon Amoy</span>
            <HardDrive className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-lg font-black text-white font-mono">{blockHeight.toLocaleString("es-AR")}</div>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              Sincronizado. Buscador de bloques y oráculo de gas en línea.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Controls Box */}
      <div className="mt-4 flex flex-col items-stretch gap-4 rounded-xl border border-white/5 bg-slate-950/30 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-xs text-slate-400">
          <span className="font-bold text-white">¿Qué significa esto para el bodeguero?</span>
          <p className="mt-0.5">
            nexID ancla evidencia y ownership solo cuando aporta valor de auditoría. Los taps operativos quedan en el CRM; no hace falta comprar Polygon ni saber cripto.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row shrink-0">
          <button suppressHydrationWarning
            disabled={loading}
            onClick={handleFaucetRequest}
            className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 text-xs font-black text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" />
                Cargando Gas...
              </>
            ) : (
              <>
                <Coins className="h-3.5 w-3.5" />
                Recargar Gas (Faucet Ficticio)
              </>
            )}
          </button>
        </div>
      </div>

      {faucetTx && (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div className="min-w-0">
            <span className="font-bold">Gas recargado con éxito (+10.00 POL)</span>
            <p className="mt-0.5 font-mono text-[10px] break-all opacity-80">Tx hash: {faucetTx}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
