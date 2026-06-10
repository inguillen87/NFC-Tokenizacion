import Link from "next/link";
import { buildConsumerNextPath, fetchConsumerMe, requireConsumerSession } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";
import { ShieldCheck, UserCheck, Award, Sparkles, WalletCards, PackageCheck, ChevronRight } from "lucide-react";

type Passport = { ok?: boolean; consumer?: { display_name?: string | null; email?: string | null; passport_status?: string | null } };

export default async function PassportPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me/passport", params));
  const payload = (await fetchConsumerMe()) as Passport | null;
  const status = String(payload?.consumer?.passport_status || "pending").toLowerCase();
  
  const isVerif = status === "verified";
  const tone = isVerif 
    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.08)]" 
    : "border-amber-500/35 bg-amber-500/10 text-amber-300";
    
  const tenant = typeof params.tenant === "string" ? params.tenant : "";

  return (
    <PortalShell title="NexID Premium Passport" subtitle="Identidad digital validada, memberships activas, propiedad de botellas y reputación de autenticidad.">
      
      {/* Golden Passport Identity Document */}
      <section className="relative overflow-hidden rounded-3xl border border-amber-500/25 bg-[linear-gradient(135deg,#131316_0%,#1e1b18_100%)] p-6 shadow-[0_20px_50px_rgba(245,158,11,0.05)] transition hover:border-amber-500/35">
        <div className="absolute -right-20 -top-20 h-44 w-44 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-44 w-44 rounded-full bg-amber-600/5 blur-3xl" />
        
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">DOCUMENTO DE IDENTIDAD DIGITAL</p>
              <h2 className="text-xl font-black text-white mt-0.5">{payload?.consumer?.display_name || "Usuario NexID"}</h2>
              <p className="text-[11px] font-mono text-slate-400">{payload?.consumer?.email || "email no validado"}</p>
            </div>
          </div>
          
          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider self-start sm:self-center ${tone}`}>
            {status.toUpperCase()}
          </span>
        </div>

        <div className="mt-4 grid gap-3 text-xs text-slate-300 sm:grid-cols-2">
          <p><span className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Tipo de Credencial</span>Pasaporte Criptográfico Personal</p>
          <p><span className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Fecha de Emisión</span>Junio 2026 (nexID Network)</p>
        </div>
      </section>

      {/* Passport Features Specs Grid */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Memberships", value: "Activo por Tenant", desc: "Te unes automáticamente a las bodegas al escanear botellas físicas.", Icon: Award, colorClass: "text-amber-400" },
          { title: "Propiedad Digital", value: "Vino + Certificado NFT", desc: "Garantía de procedencia encriptada e inmutable en tu Wallet.", Icon: WalletCards, colorClass: "text-cyan-400" },
          { title: "Estatus de Reputación", value: isVerif ? "Premium Collector" : "Starter Account", desc: "Nivel de confianza calculado según tus interacciones y reclamos.", Icon: ShieldCheck, colorClass: "text-emerald-400" }
        ].map(({ title, value, desc, Icon, colorClass }) => {
          const FeatureIcon = Icon;
          return (
            <article key={title} className="rounded-3xl border border-white/5 bg-slate-950/60 p-5 transition duration-300 hover:border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{title}</span>
                <FeatureIcon className={`h-4.5 w-4.5 ${colorClass}`} />
              </div>
              <p className="mt-3 text-lg font-black text-white leading-tight">{value}</p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">{desc}</p>
            </article>
          );
        })}
      </section>

      {/* Navigation triggers */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/me/products" className="rounded-2xl border border-white/5 bg-slate-900/30 px-4 py-3.5 text-xs font-bold text-slate-200 transition hover:bg-slate-900/50 flex items-center justify-between">
          <span>Ver Colección de Productos</span>
          <ChevronRight className="h-4 w-4 text-slate-500" />
        </Link>
        <Link href={tenant ? `/me/wallet?tenant=${encodeURIComponent(tenant)}` : "/me/wallet"} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3.5 text-xs font-bold text-emerald-300 transition hover:border-emerald-500/15 flex items-center justify-between">
          <span>Pasaporte Criptográfico / NFTs</span>
          <ChevronRight className="h-4 w-4 text-emerald-400" />
        </Link>
        <Link href={tenant ? `/me/marketplace?tenant=${encodeURIComponent(tenant)}` : "/me/marketplace"} className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3.5 text-xs font-bold text-cyan-300 transition hover:border-cyan-500/15 flex items-center justify-between">
          <span>Canjear Beneficios & Marketplace</span>
          <ChevronRight className="h-4 w-4 text-cyan-400" />
        </Link>
      </section>
      
    </PortalShell>
  );
}
