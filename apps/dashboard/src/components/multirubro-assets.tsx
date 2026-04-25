export function VerticalAsset({ vertical, size = "md" }: { vertical: string, size?: "sm" | "md" | "lg" }) {
   const dimensions = size === "sm" ? "w-8 h-8 text-sm" : size === "lg" ? "w-24 h-24 text-4xl" : "w-12 h-12 text-2xl";
   const config: Record<string, { icon: string, bg: string, border: string, glow: string }> = {
      wine: { icon: "🍷", bg: "bg-emerald-500/10", border: "border-emerald-500/20", glow: "shadow-[0_0_15px_rgba(16,185,129,0.15)]" },
      cosmetics: { icon: "✨", bg: "bg-violet-500/10", border: "border-violet-500/20", glow: "shadow-[0_0_15px_rgba(139,92,246,0.15)]" },
      pharma: { icon: "💊", bg: "bg-cyan-500/10", border: "border-cyan-500/20", glow: "shadow-[0_0_15px_rgba(6,182,212,0.15)]" },
      events: { icon: "🎟️", bg: "bg-amber-500/10", border: "border-amber-500/20", glow: "shadow-[0_0_15px_rgba(245,158,11,0.15)]" },
      agro: { icon: "🌱", bg: "bg-lime-500/10", border: "border-lime-500/20", glow: "shadow-[0_0_15px_rgba(132,204,22,0.15)]" },
      luxury: { icon: "⌚", bg: "bg-slate-400/10", border: "border-slate-400/20", glow: "shadow-[0_0_15px_rgba(148,163,184,0.15)]" },
      default: { icon: "📦", bg: "bg-blue-500/10", border: "border-blue-500/20", glow: "shadow-[0_0_15px_rgba(59,130,246,0.15)]" }
   };

   const style = config[vertical.toLowerCase()] || config.default;

   return (
      <div className={`flex items-center justify-center rounded-2xl border backdrop-blur-md ${dimensions} ${style.bg} ${style.border} ${style.glow} transition-transform hover:scale-105`}>
         {style.icon}
      </div>
   );
}
