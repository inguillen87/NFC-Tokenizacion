import Link from "next/link";
import { buildConsumerNextPath, fetchConsumerMe, requireConsumerSession } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";

type Passport = { ok?: boolean; consumer?: { display_name?: string | null; email?: string | null; passport_status?: string | null } };

export default async function PassportPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me/passport", params));
  const payload = (await fetchConsumerMe()) as Passport | null;
  const status = String(payload?.consumer?.passport_status || "pending").toLowerCase();
  const tone = status === "verified" ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : "border-amber-300/30 bg-amber-500/10 text-amber-100";
  const tenant = typeof params.tenant === "string" ? params.tenant : "";

  return (
    <PortalShell title="NexID Premium Passport" subtitle="Identidad validada, memberships, productos verificados, ownership y actividad de autenticidad.">
      <section className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white">Perfil de identidad</p>
          <span className={`rounded-full border px-2 py-1 text-xs ${tone}`}>{status.toUpperCase()}</span>
        </div>
        <p className="mt-3 text-sm text-slate-200">{payload?.consumer?.display_name || "Usuario NexID"}</p>
        <p className="text-xs text-slate-400">{payload?.consumer?.email || "Sin email validado"}</p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          ["Memberships", "Activo por tenant", "Unite a marcas desde un tap verificado."],
          ["Ownership", "Producto + NFT", "Reclama productos y consulta certificado en Wallet."],
          ["Nivel", status === "verified" ? "Premium" : "Starter", "Se actualiza automaticamente con tus taps."],
        ].map(([k, v, d]) => (
          <article key={k} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{k}</p>
            <p className="mt-2 text-xl font-semibold text-cyan-100">{v}</p>
            <p className="mt-1 text-xs text-slate-400">{d}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/me/products" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10">Ver productos</Link>
        <Link href={tenant ? `/me/wallet?tenant=${encodeURIComponent(tenant)}` : "/me/wallet"} className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20">Wallet / NFT</Link>
        <Link href={tenant ? `/me/marketplace?tenant=${encodeURIComponent(tenant)}` : "/me/marketplace"} className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20">Marketplace</Link>
      </section>
    </PortalShell>
  );
}
