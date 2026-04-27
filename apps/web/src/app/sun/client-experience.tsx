"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function TapClientExperience({ result }: { result: any }) {
  const [activeTab, setActiveTab] = useState<"passport" | "loyalty" | "history">("passport");

  const isValid = result.status?.tone === "good";
  const trustScore = result.identity?.trustScore ?? 100;
  const isReplay = result.status?.code === "REPLAY_SUSPECT";
  const isTamper = result.status?.tone === "risk" && !isReplay;

  const primaryColor = isValid ? "emerald" : isReplay ? "amber" : "rose";
  const statusLabel = isValid ? "AUTÉNTICO" : isReplay ? "REPLAY SUSPECT" : "ALERTA DE SEGURIDAD";

  return (
    <div className="flex-1 flex flex-col pt-4 px-4 w-full max-w-[480px] mx-auto">

      {/* 3D Glassmorphic Card */}
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={`relative rounded-[2rem] border border-white/10 bg-slate-900/40 p-1 backdrop-blur-2xl shadow-2xl mb-6`}
      >
         <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] opacity-40 bg-${primaryColor}-500 pointer-events-none`} />
         <div className={`absolute bottom-0 left-0 w-40 h-40 rounded-full blur-[60px] opacity-20 bg-${primaryColor}-600 pointer-events-none`} />

         <div className="relative z-10 bg-slate-950/80 rounded-[1.75rem] border border-white/5 p-6 flex flex-col items-center text-center">

            <div className="relative mb-6">
               <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                  className={`w-24 h-24 rounded-full border-[4px] border-slate-800 bg-slate-900 flex items-center justify-center text-4xl shadow-inner relative z-10`}
               >
                  {isValid ? "🍷" : isReplay ? "⚠️" : "❌"}
               </motion.div>
               {/* Trust score badge */}
               <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className={`absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full border text-[10px] font-bold shadow-xl bg-${primaryColor}-500/20 border-${primaryColor}-500/30 text-${primaryColor}-300 z-20`}
               >
                  Score: {trustScore}
               </motion.div>
            </div>

            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-1">{result.product?.winery || "Bodega Premium"}</p>
            <h1 className="text-2xl font-bold text-white leading-tight mb-2 tracking-tight">{result.product?.name || "Producto Conectado"}</h1>
            <p className="text-xs text-slate-400">{result.product?.region || "Región no especificada"} · {result.product?.varietal || "Blend"}</p>

            <div className="mt-6 inline-flex flex-col items-center">
               <span className={`px-3 py-1 rounded bg-${primaryColor}-500/10 border border-${primaryColor}-500/20 text-[11px] font-bold uppercase tracking-widest text-${primaryColor}-400 shadow-[0_0_15px_rgba(var(--color-${primaryColor}-500),0.1)]`}>
                  {statusLabel}
               </span>
               <span className="text-[10px] text-slate-500 mt-2">NFC Tap #{result.identity?.scanCount ?? 1}</span>
            </div>
         </div>
      </motion.div>

      {/* Custom Animated Tabs */}
      <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-white/5 mb-6 relative">
         {["passport", "loyalty", "history"].map((tab) => (
            <button
               key={tab}
               onClick={() => setActiveTab(tab as any)}
               className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest z-10 transition-colors ${activeTab === tab ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
            >
               {tab}
            </button>
         ))}
         <motion.div
            className="absolute top-1 bottom-1 w-[calc(33.333%-4px)] bg-slate-800 rounded-xl border border-white/10 shadow-lg z-0"
            animate={{
               left: activeTab === "passport" ? "4px" : activeTab === "loyalty" ? "calc(33.333%)" : "calc(66.666% - 4px)"
            }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
         />
      </div>

      {/* Tab Content */}
      <div className="flex-1 relative">
         <AnimatePresence mode="wait">

            {activeTab === "passport" && (
               <motion.div
                  key="passport"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 pb-10"
               >
                  <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-5">
                     <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Specs del Producto</h4>
                     <div className="space-y-3">
                        <div className="flex justify-between border-b border-white/5 pb-2">
                           <span className="text-xs text-slate-500">Cosecha</span>
                           <span className="text-xs font-semibold text-slate-200">2022</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-2">
                           <span className="text-xs text-slate-500">Crianza</span>
                           <span className="text-xs font-semibold text-slate-200">12 Meses en Roble</span>
                        </div>
                        <div className="flex justify-between">
                           <span className="text-xs text-slate-500">Enólogo</span>
                           <span className="text-xs font-semibold text-slate-200">A. Vigil</span>
                        </div>
                     </div>
                  </div>

                  {isValid ? (
                     <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-900/20 to-transparent p-5 text-center shadow-lg relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
                        <div className="absolute inset-0 bg-cyan-500/5 group-hover:bg-cyan-500/10 transition-colors" />
                        <div className="relative z-10">
                           <h3 className="text-sm font-bold text-white mb-2">Ownership & Garantía</h3>
                           <p className="text-[11px] text-cyan-200/70 mb-4 leading-relaxed">Registrá la titularidad de este producto en la red de consumidores para asegurar su garantía y sumar puntos.</p>
                           <a href="/me" className="block w-full py-3.5 rounded-xl bg-white text-slate-900 text-sm font-bold shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-transform hover:scale-[1.02] active:scale-95">
                              Reclamar Producto
                           </a>
                        </div>
                     </div>
                  ) : (
                     <div className="rounded-2xl border border-rose-500/20 bg-rose-950/20 p-5 text-center">
                        <p className="text-[11px] text-rose-300 mb-4">Acciones premium bloqueadas por políticas de seguridad debido a riesgo de replay o tamper.</p>
                        <button className="block w-full py-3.5 rounded-xl bg-slate-800 text-white text-sm font-bold transition-colors hover:bg-slate-700">
                           Contactar Soporte
                        </button>
                     </div>
                  )}
               </motion.div>
            )}

            {activeTab === "loyalty" && (
               <motion.div
                  key="loyalty"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 pb-10"
               >
                  <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-5 relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[40px] rounded-full group-hover:bg-indigo-500/20 transition-colors" />
                     <div className="flex items-center gap-3 mb-4 relative z-10">
                        <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-xl shadow-inner">
                           🌟
                        </div>
                        <div>
                           <h3 className="text-sm font-bold text-white">Club Premium</h3>
                           <p className="text-[10px] text-indigo-300 uppercase tracking-widest mt-0.5">BENEFICIOS</p>
                        </div>
                     </div>
                     <div className="space-y-3 mb-5 relative z-10">
                        <div className="flex items-start gap-3 bg-slate-950/50 p-3 rounded-xl border border-white/5">
                           <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0 mt-0.5">
                              <span className="text-emerald-400 font-bold text-xs">+10</span>
                           </div>
                           <p className="text-xs text-slate-300 leading-relaxed">Ganá 10 puntos registrando este producto auténtico a tu cuenta.</p>
                        </div>
                        <div className="flex items-start gap-3 bg-slate-950/50 p-3 rounded-xl border border-white/5">
                           <div className="w-8 h-8 rounded bg-violet-500/10 flex items-center justify-center border border-violet-500/20 shrink-0 mt-0.5">
                              <span className="text-violet-400 text-sm">🎟️</span>
                           </div>
                           <p className="text-xs text-slate-300 leading-relaxed">Sumando puntos podés canjear upgrades en catas y envíos sin cargo.</p>
                        </div>
                     </div>
                     <a href="/me" className="block w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-center text-sm font-bold transition-colors shadow-lg relative z-10">
                        Ir al Portal Loyalty
                     </a>
                  </div>
               </motion.div>
            )}

            {activeTab === "history" && (
               <motion.div
                  key="history"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 pb-10"
               >
                  <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-5">
                     <div className="flex justify-between items-center mb-6">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Trazabilidad</h4>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">UID: {result.identity?.uid?.substring(0, 8)}...</span>
                     </div>

                     <div className="relative pl-4 space-y-6 before:absolute before:inset-y-0 before:left-[7px] before:w-[2px] before:bg-slate-800">
                        <div className="relative">
                           <div className={`absolute -left-[20px] top-1 w-3 h-3 rounded-full border-2 border-slate-900 bg-${primaryColor}-400 shadow-[0_0_10px_rgba(var(--color-${primaryColor}-400),0.5)]`} />
                           <p className="text-[10px] text-slate-500 font-mono mb-0.5">Ahora</p>
                           <p className="text-xs font-bold text-white">Escaneo Actual</p>
                           <p className="text-[11px] text-slate-400 mt-1">Verificación en vivo. {isValid ? "Resultado seguro." : "Riesgo detectado."}</p>
                        </div>
                        <div className="relative opacity-60">
                           <div className="absolute -left-[20px] top-1 w-3 h-3 rounded-full border-2 border-slate-900 bg-slate-600" />
                           <p className="text-[10px] text-slate-500 font-mono mb-0.5">Hace 3 meses</p>
                           <p className="text-xs font-bold text-white">Primer Enrolamiento</p>
                           <p className="text-[11px] text-slate-400 mt-1">Mendoza, Argentina (Origen)</p>
                        </div>
                        <div className="relative opacity-40">
                           <div className="absolute -left-[20px] top-1 w-3 h-3 rounded-full border-2 border-slate-900 bg-slate-700" />
                           <p className="text-[10px] text-slate-500 font-mono mb-0.5">Febrero 2026</p>
                           <p className="text-xs font-bold text-white">Activación Criptográfica</p>
                           <p className="text-[11px] text-slate-400 mt-1">Lote DEMO-2026-02</p>
                        </div>
                     </div>
                  </div>
               </motion.div>
            )}

         </AnimatePresence>
      </div>
    </div>
  );
}
