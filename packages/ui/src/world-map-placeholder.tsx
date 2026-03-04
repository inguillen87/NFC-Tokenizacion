import { Card } from "./card";

export function WorldMapPlaceholder() {
  return (
    <Card className="relative overflow-hidden p-6">
      <div className="text-sm font-semibold text-white">Global scan footprint</div>
      <div className="mt-1 text-xs text-slate-400">Heatmap placeholder para v1. Reemplazar despues por mapa real.</div>
      <div className="mt-6 grid h-64 place-items-center rounded-2xl border border-white/5 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12),transparent_55%)]">
        <div className="relative h-44 w-full max-w-xl overflow-hidden rounded-[999px] border border-cyan-400/10 bg-slate-950">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          <div className="absolute left-[12%] top-[42%] h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_24px_rgba(103,232,249,0.95)]" />
          <div className="absolute left-[33%] top-[35%] h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_20px_rgba(103,232,249,0.85)]" />
          <div className="absolute left-[52%] top-[40%] h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_24px_rgba(103,232,249,0.95)]" />
          <div className="absolute left-[67%] top-[47%] h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_20px_rgba(103,232,249,0.85)]" />
          <div className="absolute left-[80%] top-[38%] h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_20px_rgba(103,232,249,0.85)]" />
        </div>
      </div>
    </Card>
  );
}
