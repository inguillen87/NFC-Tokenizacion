import { asArray, fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";

type Brand = { tenant_id?: string; slug?: string; name?: string; status?: string; points_balance?: number; lifetime_points?: number; joined_at?: string };

export default async function BrandsPage() {
  await requireConsumerSession("/me/brands");
  const payload = await fetchConsumerPath("brands");
  const brands = asArray<Brand>(payload);

  return (
    <PortalShell title="Marcas" subtitle="Tenants con los que ya interactuaste y progreso loyalty por marca.">
      {!brands.length ? (
        <section className="rounded-xl border border-white/10 bg-slate-950/70 p-5 text-sm text-slate-300">Todavía no seguís marcas. Tocá productos para activar memberships automáticamente.</section>
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {brands.map((brand, idx) => (
            <article key={`${brand.name || idx}`} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-sm font-semibold text-white">{brand.name || "Brand"}</p>
              <p className="mt-1 text-xs text-slate-400">tenant {brand.slug || "n/a"} · {brand.points_balance || 0} pts ({brand.lifetime_points || 0} lifetime)</p>
              <p className="mt-2 text-[11px] text-cyan-100">Estado: {(brand.status || "active").toString().toUpperCase()} · joined {brand.joined_at ? new Date(brand.joined_at).toLocaleDateString() : "n/a"}</p>
            </article>
          ))}
        </section>
      )}
    </PortalShell>
  );
}
