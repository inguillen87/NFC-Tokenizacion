"use client";

import { useEffect, useState } from "react";
import { RadioTower } from "lucide-react";

export function HeroBackground() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-slate-950 pointer-events-none">
      <div 
        className="absolute inset-[-50%] bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.15),transparent_50%),radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.15),transparent_50%)] animate-pulse"
        style={{ animationDuration: '8s' }}
      />
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[100px]" />
      
      <div className="absolute top-[20%] left-[10%] lg:left-[20%] animate-bounce" style={{ animationDuration: '4s' }}>
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_0_30px_rgba(56,189,248,0.2)]">
          <RadioTower className="h-8 w-8 text-cyan-400 opacity-80" />
        </div>
      </div>
    </div>
  );
}

export function LiveTapsCounter({ locale }: { locale: string }) {
  const [count, setCount] = useState(1420539);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCount(c => c + Math.floor(Math.random() * 3) + 1);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const label = locale === "en" ? "Taps processed today" : locale === "pt-BR" ? "Toques processados hoje" : "Taps procesados hoy";

  return (
    <div className="mt-8 mx-auto inline-flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur-xl shadow-2xl transition-all hover:bg-white/10">
      <div className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
        {count.toLocaleString()}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-widest">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        {label}
      </div>
    </div>
  );
}
