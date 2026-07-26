"use client";

import React, { useState } from "react";
import { Sparkles, Check, BarChart3, HelpCircle } from "lucide-react";

type Poll = {
  id: string;
  brand: string;
  question: string;
  description: string;
  options: Array<{ id: string; label: string; votes: number }>;
  votedOptionId?: string;
};

export function BrandsVotingClient() {
  const votingDemoEnabled = process.env.NEXT_PUBLIC_BRANDS_VOTING_DEMO_ENABLED === "true";
  const [polls, setPolls] = useState<Poll[]>(() => votingDemoEnabled ? [
    {
      id: "poll-label-2027",
      brand: "Gran Reserva",
      question: "Diseño de la Etiqueta para la Edición Especial Magnum 2027",
      description: "Los poseedores de botellas Magnum de cosechas anteriores eligen el estilo de la próxima añada de colección.",
      options: [
        { id: "opt-a", label: "Tradicional Grabado Metálico Cobre", votes: 142 },
        { id: "opt-b", label: "Minimalista Negro Holográfico (Securizado)", votes: 198 }
      ]
    },
    {
      id: "poll-blend-2026",
      brand: "Viñedos Altamira",
      question: "Composición Final del Blend Gran Corte 2026",
      description: "Votación de ensamble de barricas para el club de fidelidad Altamira.",
      options: [
        { id: "blend-a", label: "70% Malbec / 30% Cabernet Franc", votes: 215 },
        { id: "blend-b", label: "50% Malbec / 40% Syrah / 10% Petit Verdot", votes: 112 }
      ]
    },
    {
      id: "poll-event-2026",
      brand: "Imperial Bodega",
      question: "Próxima Experiencia de Degustación Exclusiva",
      description: "Sondeo para determinar la locación del próximo encuentro presencial del Club.",
      options: [
        { id: "loc-mza", label: "Fin de semana en Bodega (Mendoza) con Cava Privada", votes: 340 },
        { id: "loc-ba", label: "Cena maridaje en Cava Subterránea (Buenos Aires)", votes: 289 }
      ]
    }
  ] : []);

  function handleVote(pollId: string, optionId: string) {
    if (!votingDemoEnabled) return;
    setPolls(prevPolls =>
      prevPolls.map(poll => {
        if (poll.id !== pollId || poll.votedOptionId) return poll;
        return {
          ...poll,
          votedOptionId: optionId,
          options: poll.options.map(opt =>
            opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
          )
        };
      })
    );
  }

  if (!votingDemoEnabled) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/60 p-6">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Votaciones no disponibles</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">No hay encuestas tenant-scoped reportadas por el backend. La interfaz no inventa propuestas, votos ni resultados.</p>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.15),transparent_50%),linear-gradient(135deg,#0a0a0c,#131316)] p-6 shadow-2xl">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-purple-500/5 blur-3xl animate-pulse" />
      
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4">
        <div>
          <span className="rounded-full border border-purple-400/25 bg-purple-400/5 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-purple-300 inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 animate-spin" />
            Demo de votaciones de club
          </span>
          <h2 className="text-xl font-black text-white tracking-tight mt-2">Simulación local de encuesta</h2>
          <p className="text-xs text-slate-400 mt-1">
            DEMO SIMULADA · propuestas, conteos y selección ficticios. No se registra un voto ni se ejecuta gobernanza.
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-900/50 border border-white/5 rounded-xl px-3.5 py-2 shrink-0 self-start sm:self-center">
          <BarChart3 className="h-4 w-4 text-purple-400" />
          <span>Sin persistencia</span>
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {polls.map(poll => {
          const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
          const hasVoted = Boolean(poll.votedOptionId);

          return (
            <article key={poll.id} className="rounded-2xl border border-white/5 bg-slate-950/65 p-4 flex flex-col justify-between transition duration-300 hover:border-white/10">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 font-mono">{poll.brand}</span>
                  <span className="rounded bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-[8px] font-bold text-purple-300">
                    {hasVoted ? "Selección simulada" : "Demo abierta"}
                  </span>
                </div>
                
                <h3 className="mt-2 text-sm font-black text-white leading-snug tracking-tight">{poll.question}</h3>
                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">{poll.description}</p>

                {/* Options List */}
                <div className="mt-4 space-y-2.5">
                  {poll.options.map(option => {
                    const percentage = totalVotes ? Math.round((option.votes / totalVotes) * 100) : 0;
                    const isSelected = poll.votedOptionId === option.id;

                    return (
                      <button
                        suppressHydrationWarning
                        key={option.id}
                        disabled={hasVoted}
                        onClick={() => handleVote(poll.id, option.id)}
                        className={`w-full relative overflow-hidden rounded-xl border p-3 text-left transition duration-200 ${
                          isSelected
                            ? "border-purple-500/40 bg-purple-500/10 text-purple-200"
                            : hasVoted
                            ? "border-white/5 bg-slate-900/20 text-slate-500"
                            : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10"
                        }`}
                      >
                        {/* Interactive vote fill background */}
                        {hasVoted && (
                          <div
                            className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ${
                              isSelected ? "bg-purple-500/10" : "bg-white/5"
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        )}

                        <div className="relative flex items-center justify-between gap-2 text-[11px] font-bold">
                          <span className="truncate flex items-center gap-1.5">
                            {isSelected && <Check className="h-3.5 w-3.5 text-purple-400 shrink-0" />}
                            {hasVoted ? option.label : `Simular voto: ${option.label}`}
                          </span>
                          <span className="shrink-0 font-mono text-slate-400">
                            {hasVoted ? `${percentage}%` : `${option.votes} v.`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status info */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[9px] text-slate-500 font-bold">
                <span className="flex items-center gap-1">
                  <HelpCircle className="h-3 w-3 text-slate-600" />
                  Escenario ficticio
                </span>
                <span>{totalVotes} votos ficticios</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
