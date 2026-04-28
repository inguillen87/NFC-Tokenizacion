import Link from "next/link";
import { asArray, fetchConsumerMe, fetchConsumerPath, requireConsumerSession } from "./_components/consumer-api";
import { PortalShell } from "./_components/portal-shell";

type MePayload = {
  ok?: boolean;
  consumer?: { email?: string | null; display_name?: string | null; passport_status?: string | null; preferred_locale?: string | null };
  stats?: { products?: number; taps?: number; memberships?: number; unread?: number; rewards?: number };
};
type Product = { product_name?: string; tenant_slug?: string; ownership_record_status?: string | null; ownership_status?: string | null; };
type Tap = { created_at?: string; verdict?: string; tenant_slug?: string; city?: string; country?: string };
type Brand = { slug?: string; name?: string; status?: string };

export default async function MePage() {
  await requireConsumerSession("/me");
  const me = (await fetchConsumerMe()) as MePayload | null;
  const products = asArray<Product>(await fetchConsumerPath("products"));
  const taps = asArray<Tap>(await fetchConsumerPath("taps"));
  const brands = asArray<Brand>(await fetchConsumerPath("brands"));
  const stats = me?.stats || {};
  const activeMemberships = brands.filter((item) => String(item.status || "").toLowerCase() === "active").length;
  const verifiedProducts = products.filter((item) => String(item.ownership_record_status || item.ownership_status || "").toLowerCase() === "claimed").length;
  const latestTaps = taps.slice(0, 4);
  const savedProducts = products.slice(0, 4);
  const consumerName = String(me?.consumer?.display_name || "").trim() || String(me?.consumer?.email || "Consumer");

  return (
    <PortalShell
      title="Tu pasaporte de productos auténticos"
      subtitle="Perfil premium conectado a tus taps reales, ownership verificable, memberships por tenant y marketplace contextual."
    >
      <section className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Consumer profile</p>
        <p className="mt-2 text-lg font-semibold text-white">{consumerName}</p>
        <p className="text-xs text-cyan-50/90">{me?.consumer?.email || "email no disponible"} · locale {me?.consumer?.preferred_locale || "es-AR"}</p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["Productos verificados", String(verifiedProducts)],
          ["Taps registrados", String(stats.taps || 0)],
          ["Marcas unidas", String(activeMemberships)],
          ["Productos guardados", String(stats.products || 0)],
          ["Alertas", String(stats.unread || 0)],
        ].map(([title, value]) => (
          <article key={title} className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{title}</p>
            <p className="mt-2 text-3xl font-semibold text-cyan-200">{value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Últimos taps</p>
            <Link href="/me/taps" className="text-xs text-cyan-200 hover:text-cyan-100">Ver todos</Link>
          </div>
          <div className="mt-2 space-y-2">
            {latestTaps.length ? latestTaps.map((tap, index) => (
              <p key={`${tap.created_at || index}`} className="text-xs text-slate-300">
                <span className="font-semibold text-cyan-100">{String(tap.verdict || "unknown").toUpperCase()}</span> · {tap.city || "Unknown"}, {tap.country || "--"} · tenant {tap.tenant_slug || "n/a"}
              </p>
            )) : <p className="text-xs text-slate-400">Todavía no hay taps asociados.</p>}
          </div>
        </article>
        <article className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Productos guardados</p>
            <Link href="/me/products" className="text-xs text-cyan-200 hover:text-cyan-100">Ver colección</Link>
          </div>
          <div className="mt-2 space-y-2">
            {savedProducts.length ? savedProducts.map((product, index) => (
              <p key={`${product.product_name || index}`} className="text-xs text-slate-300">
                <span className="font-semibold text-white">{product.product_name || "Producto"}</span> · tenant {product.tenant_slug || "n/a"} · estado {String(product.ownership_record_status || product.ownership_status || "viewed")}
              </p>
            )) : <p className="text-xs text-slate-400">Aún no hay productos guardados.</p>}
          </div>
        </article>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {[
          ["/me/products", "Mis productos", "Biblioteca real de productos guardados/claimados."],
          ["/me/brands", "Mis marcas", "Membresías activas por tenant y estado."],
          ["/me/marketplace", "Ir al marketplace", "Abrí catálogo contextual según tenant asociado."],
        ].map(([href, title, desc]) => (
          <Link key={href} href={href} className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-4 transition hover:border-cyan-300/40 hover:bg-cyan-500/15">
            <p className="text-sm font-semibold text-cyan-100">{title}</p>
            <p className="mt-1 text-xs text-cyan-50/90">{desc}</p>
          </Link>
        ))}
      </section>
    </PortalShell>
  );
}
