import { asArray, fetchConsumerPath } from "../_components/consumer-api";
import { PortalShell } from "../_components/portal-shell";

type Brand = { name?: string; tier?: string; points?: number; status?: string };

export default async function BrandsPage() {
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
              <p className="mt-1 text-xs text-slate-400">Tier {brand.tier || "Starter"} · {brand.points || 0} pts</p>
              <p className="mt-2 text-[11px] text-cyan-100">Estado: {(brand.status || "active").toString().toUpperCase()}</p>
            </article>
          ))}
        </section>
      )}
    </PortalShell>
  );
}
