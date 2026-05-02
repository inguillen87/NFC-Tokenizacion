import Link from "next/link";
import { Gift, PackageCheck, ShieldCheck, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { asArray, fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import { formatPortalDate, ownershipTone, type ConsumerPortalProduct, type ConsumerTap } from "../_components/consumer-portal-model";
import { PortalShell } from "../_components/portal-shell";

function productVisualKind(product: ConsumerPortalProduct, index: number) {
  const blob = `${product.product_name || ""} ${product.brand_name || ""}`.toLowerCase();
  if (blob.includes("vino") || blob.includes("wine") || blob.includes("malbec") || blob.includes("reserva")) return "bottle";
  if (blob.includes("pulsera") || blob.includes("ticket") || blob.includes("vip")) return "wristband";
  if (blob.includes("serum") || blob.includes("cosmet")) return "cosmetic";
  return index % 3 === 0 ? "bottle" : index % 3 === 1 ? "wristband" : "cosmetic";
}

function statusClasses(status: string) {
  const tone = ownershipTone(status);
  if (tone === "success") return "border-emerald-300/30 bg-emerald-500/10 text-emerald-100";
  if (tone === "danger") return "border-rose-300/30 bg-rose-500/10 text-rose-100";
  return "border-cyan-300/30 bg-cyan-500/10 text-cyan-100";
}

export default async function ProductsPage() {
  await requireConsumerSession("/me/products");
  const [productsPayload, tapsPayload] = await Promise.all([
    fetchConsumerPath("products"),
    fetchConsumerPath("taps"),
  ]);
  const products = asArray<ConsumerPortalProduct>(productsPayload);
  const taps = asArray<ConsumerTap>(tapsPayload);
  const claimed = products.filter((p) => String(p.ownership_record_status || p.ownership_status || "").toLowerCase() === "claimed").length;
  const tenants = new Set(products.map((p) => p.tenant_slug).filter(Boolean)).size;
  const metrics: Array<{ label: string; value: number; Icon: LucideIcon }> = [
    { label: "Productos", value: products.length, Icon: PackageCheck },
    { label: "Claimed", value: claimed, Icon: ShieldCheck },
    { label: "Tenants", value: tenants, Icon: Gift },
    { label: "Taps", value: taps.length, Icon: WalletCards },
  ];

  return (
    <PortalShell title="Productos guardados" subtitle="Biblioteca verificable de productos que tocaste, guardaste o reclamaste en tu Passport.">
      {!products.length ? (
        <section className="consumer-empty-state rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-6 text-sm text-cyan-50">
          Aun no tenes productos guardados. Toca un producto NFC y elegi guardar para activar ownership, garantia, beneficios y marketplace contextual.
        </section>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            {metrics.map(({ label, value, Icon }) => (
              <article key={label} className="consumer-metric-card rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
                  <Icon className="h-4 w-4 text-cyan-200" aria-hidden="true" />
                </div>
                <p className="mt-2 text-3xl font-black text-white">{value}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-4">
            {products.map((product, idx) => {
              const status = String(product.ownership_record_status || product.ownership_status || "viewed").toLowerCase();
              const visual = productVisualKind(product, idx);
              const tenant = product.tenant_slug || "";
              return (
                <article key={`${product.product_name || "product"}-${idx}`} className="consumer-product-card overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70">
                  <div className="grid gap-0 lg:grid-cols-[0.82fr_1.18fr]">
                    <div className="consumer-product-visual-panel relative min-h-64 border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
                      <div className={`consumer-product-visual consumer-product-visual--${visual}`} />
                      <div className="absolute left-5 top-5 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
                        Passport item
                      </div>
                      <span className={`absolute bottom-5 left-5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusClasses(status)}`}>{status}</span>
                    </div>

                    <div className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-2xl font-black text-white">{product.product_name || "Producto autenticado"}</h2>
                          <p className="mt-1 text-sm text-slate-300">{product.brand_name || "Marca"} - tenant {tenant || "n/a"}</p>
                          <p className="mt-1 text-xs text-slate-500">BID {product.bid || "n/a"} - guardado {formatPortalDate(product.created_at)}</p>
                        </div>
                        <Link href={tenant ? `/me/marketplace?tenant=${encodeURIComponent(tenant)}` : "/me/marketplace"} className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-500/20">
                          Beneficios
                        </Link>
                      </div>

                      <div className="mt-5 grid gap-2 sm:grid-cols-4">
                        {[
                          ["1", "Autenticidad", "Tap validado contra reglas del tenant."],
                          ["2", "Ownership", status === "claimed" ? "Producto asociado al consumidor." : "Listo para reclamar ownership."],
                          ["3", "Marketplace", "Promos y vouchers segun marca."],
                          ["4", "Wallet", "Tokenizacion opcional si aplica."],
                        ].map(([step, title, desc]) => (
                          <div key={step} className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                            <span className="grid h-7 w-7 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-500/10 text-xs font-black text-cyan-100">{step}</span>
                            <p className="mt-2 text-xs font-black text-white">{title}</p>
                            <p className="mt-1 text-[11px] leading-4 text-slate-400">{desc}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 grid gap-2 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-300 sm:grid-cols-3">
                        <p><span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Primer tap</span>#{product.first_tap_event_id || "n/a"}</p>
                        <p><span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Ultimo tap</span>#{product.latest_tap_event_id || "n/a"}</p>
                        <p><span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Proxima accion</span>{status === "claimed" ? "Abrir beneficios" : "Reclamar"}</p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}
    </PortalShell>
  );
}
