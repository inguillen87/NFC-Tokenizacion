import { roles } from "@product/config";

export function Topbar() {
  return (
    <header className="border-b border-white/10 bg-slate-950/70 px-4 py-4 backdrop-blur-xl lg:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">Multi-tenant operations</div>
          <div className="mt-1 text-xl font-bold text-white">Dashboard shell</div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          {roles.map((role) => (
            <span key={role.slug} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{role.name}</span>
          ))}
        </div>
      </div>
    </header>
  );
}
