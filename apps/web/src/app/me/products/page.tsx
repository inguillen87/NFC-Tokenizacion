import Link from "next/link";
import { ExternalLink, Gift, MessageSquareText, PackageCheck, ShieldCheck, WalletCards, ArrowRight, Award, MapPin, CheckCircle2, Sparkles, Camera } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { asArray, buildConsumerNextPath, fetchConsumerPath, requireConsumerSession } from "../_components/consumer-api";
import { formatPortalDate, ownershipTone, type ConsumerPortalProduct, type ConsumerTap } from "../_components/consumer-portal-model";
import { PortalShell } from "../_components/portal-shell";
import { resolveProductAssetProfile } from "../../../lib/product-asset-bank";

function productVisualKind(product: ConsumerPortalProduct, index: number) {
  const blob = `${product.product_name || ""} ${product.brand_name || ""}`.toLowerCase();
  if (blob.includes("vino") || blob.includes("wine") || blob.includes("malbec") || blob.includes("reserva")) return "bottle";
  if (blob.includes("pulsera") || blob.includes("ticket") || blob.includes("vip")) return "wristband";
  if (blob.includes("serum") || blob.includes("cosmet")) return "cosmetic";
  return index % 3 === 0 ? "bottle" : index % 3 === 1 ? "wristband" : "cosmetic";
}

function statusClasses(status: string) {
  const tone = ownershipTone(status);
  if (tone === "success") return "border-emerald-500/35 bg-emerald-500/10 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)] font-black";
  if (tone === "danger") return "border-rose-500/35 bg-rose-500/10 text-rose-300 font-black";
  return "border-amber-500/35 bg-amber-500/10 text-amber-300 font-black";
}

function certificateHref(product: ConsumerPortalProduct) {
  const eventId = String(product.latest_tap_event_id || product.first_tap_event_id || "").trim();
  return eventId ? `/certificado/${encodeURIComponent(eventId)}` : "";
}

function experienceHref(product: ConsumerPortalProduct) {
  const eventId = String(product.latest_tap_event_id || product.first_tap_event_id || "").trim();
  const tenant = String(product.tenant_slug || "").trim();
  const productName = String(product.product_name || "Producto verificado").trim();
  const query = new URLSearchParams();
  if (tenant) query.set("tenant", tenant);
  if (eventId) query.set("eventId", eventId);
  if (productName) query.set("product", productName);
  const suffix = query.toString();
  return suffix ? `/me/experiences?${suffix}` : "/me/experiences";
}

export default async function ProductsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me/products", params));
  
  const [productsPayload, tapsPayload] = await Promise.all([
    fetchConsumerPath("products"),
    fetchConsumerPath("taps"),
  ]);
  
  const products = asArray<ConsumerPortalProduct>(productsPayload);
  const taps = asArray<ConsumerTap>(tapsPayload);
  const claimed = products.filter((p) => String(p.ownership_record_status || p.ownership_status || "").toLowerCase() === "claimed").length;
  const tenants = new Set(products.map((p) => p.tenant_slug).filter(Boolean)).size;
  
  const metrics: Array<{ label: string; value: number; Icon: LucideIcon; color: string }> = [
    { label: "Colección Total", value: products.length, Icon: PackageCheck, color: "text-violet-400" },
    { label: "Propiedades Registradas", value: claimed, Icon: ShieldCheck, color: "text-emerald-400" },
    { label: "Bodegas / Tenants", value: tenants, Icon: Gift, color: "text-amber-400" },
    { label: "Escaneos Realizados", value: taps.length, Icon: WalletCards, color: "text-cyan-400" },
  ];

  return (
    <PortalShell title="Productos Guardados" subtitle="Biblioteca digital verificable de botellas y productos que escaneaste, guardaste o reclamaste en tu cuenta.">
      {!products.length ? (
        <section className="rounded-3xl border border-amber-500/20 bg-slate-950/80 p-8 text-center shadow-lg shadow-black/40">
          <PackageCheck className="mx-auto h-12 w-12 text-slate-600 animate-pulse" />
          <h3 className="mt-4 text-base font-black text-white">No hay productos guardados todavía</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400 max-w-md mx-auto">
            Escanea una botella con etiqueta NFC nexID y presiona "Reclamar Dueño" para vincular su pasaporte original a tu cuenta.
          </p>
        </section>
      ) : (
        <>
          {/* Top Metric Stats */}
          <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {metrics.map(({ label, value, Icon, color }) => (
              <article key={label} className="rounded-2xl border border-white/5 bg-slate-950/60 p-4 transition-all duration-300 hover:border-white/10">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
                  <Icon className={`h-4.5 w-4.5 ${color}`} aria-hidden="true" />
                </div>
                <p className="mt-2 text-2xl font-black text-white">{value}</p>
              </article>
            ))}
          </section>

          {/* Products List */}
          <section className="grid gap-6">
            {products.map((product, idx) => {
              const status = String(product.ownership_record_status || product.ownership_status || "viewed").toLowerCase();
              const visual = productVisualKind(product, idx);
              const tenant = product.tenant_slug || "";
              const tokenStatus = String(product.tokenization_status || "none").toLowerCase();
              const txHash = String(product.tokenization_tx_hash || "");
              const hasTokenProof = Boolean(txHash && tokenStatus !== "none" && !txHash.toUpperCase().includes("DEMO"));
              const tokenExplorerHref = hasTokenProof ? `https://amoy.polygonscan.com/tx/${encodeURIComponent(txHash)}` : "";
              const certificateUrl = certificateHref(product);
              
              const assetProfile = resolveProductAssetProfile({
                tenantSlug: product.tenant_slug,
                brandName: product.brand_name,
                productName: product.product_name,
                bid: product.bid,
                imageUrl: product.image_url,
              });

              // Fallback to beautiful local assets for premium look
              let displayImg = assetProfile.primaryImageUrl;
              if (!displayImg || displayImg.includes("pexels") || displayImg.includes("demo/")) {
                displayImg = visual === "bottle" ? "/images/premium_magnum.png" : "/images/wine_crate.png";
              }

              const isClaimed = status === "claimed";

              return (
                <article key={`${product.product_name || "product"}-${idx}`} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80 shadow-2xl transition duration-300 hover:border-white/20">
                  <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
                    
                    {/* Left: Interactive Visual Display (floating bottle mockup) */}
                    <div className="relative min-h-64 border-b border-white/5 p-6 flex items-center justify-center bg-[linear-gradient(135deg,#0e0e11,#1a1a1f)] lg:border-b-0 lg:border-r">
                      <img
                        src={displayImg}
                        alt={assetProfile.productName}
                        className="h-48 w-auto object-contain transition duration-500 hover:scale-105 drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]"
                      />
                      
                      <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-slate-950/70 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-slate-300">
                        Passport Item
                      </div>
                      
                      <span className="absolute right-4 top-4 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[8px] font-semibold text-emerald-300">
                        {assetProfile.assetScore}/100 score
                      </span>
                      
                      <span className={`absolute bottom-4 left-4 rounded-full border px-3 py-1 text-[9px] uppercase tracking-wider ${statusClasses(status)}`}>
                        {status}
                      </span>
                    </div>

                    {/* Right: Technical Details & Ledger info */}
                    <div className="p-6 flex flex-col justify-between">
                      <div>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Bodega Asociada</span>
                            <h2 className="text-xl font-black text-white tracking-tight mt-0.5">{product.product_name || "Gran Reserva"}</h2>
                            <p className="mt-1 text-xs text-slate-400">
                              Marca: <span className="text-slate-200 font-bold">{product.brand_name || "nexID Partner"}</span> · Tenant: <span className="font-mono text-slate-300">{tenant || "n/a"}</span>
                            </p>
                            <p className="mt-1 text-[10px] font-mono text-slate-500">
                              BID {product.bid || "n/a"} · Guardado el {formatPortalDate(product.created_at)}
                            </p>
                          </div>
                          
                          {/* Quick Action triggers */}
                          <div className="flex flex-wrap gap-2 shrink-0">
                            {certificateUrl && (
                              <Link href={certificateUrl} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20 transition">
                                Certificado <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            )}
                            <Link href={`/me/sommelier?product=${encodeURIComponent(product.product_name || "")}&brand=${encodeURIComponent(product.brand_name || "")}`} className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/35 bg-purple-500/10 px-3.5 py-2 text-xs font-bold text-purple-200 hover:bg-purple-500/20 transition">
                              Sommelier AI <Sparkles className="h-3.5 w-3.5" />
                            </Link>
                            {visual === "bottle" && (
                              <Link href="/me/cork-analyzer" className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/35 bg-indigo-500/10 px-3.5 py-2 text-xs font-bold text-indigo-200 hover:bg-indigo-500/20 transition">
                                Analizar Corcho <Camera className="h-3.5 w-3.5" />
                              </Link>
                            )}
                            <Link href={tenant ? `/me/marketplace?tenant=${encodeURIComponent(tenant)}` : "/me/marketplace"} className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20 transition">
                              Club & Promos
                            </Link>
                            <Link href={experienceHref(product)} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20 transition">
                              Opiniones <MessageSquareText className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </div>

                        {/* Interactive Step-by-Step Lifecycle (Lights up dynamically based on state) */}
                        <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-4">
                          {[
                            { 
                              step: "1", 
                              title: "Autenticidad", 
                              desc: "Validación digital de procedencia.", 
                              active: true, 
                              color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" 
                            },
                            { 
                              step: "2", 
                              title: "Ownership", 
                              desc: isClaimed ? "Propiedad vinculada al Passport." : "Registrar dueño con tap físico.", 
                              active: isClaimed, 
                              color: isClaimed 
                                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" 
                                : "border-amber-500/20 bg-amber-500/5 text-amber-300" 
                            },
                            { 
                              step: "3", 
                              title: "Marketplace", 
                              desc: "Acceso a drops y catálogos de canjes.", 
                              active: isClaimed, 
                              color: isClaimed 
                                ? "border-cyan-500/30 bg-cyan-500/5 text-cyan-300" 
                                : "border-white/5 bg-slate-900/40 text-slate-500" 
                            },
                            { 
                              step: "4", 
                              title: "Wallet Web3", 
                              desc: hasTokenProof ? "NFT acuñado en Polygon." : "Tokenización lista en red.", 
                              active: hasTokenProof, 
                              color: hasTokenProof 
                                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" 
                                : tokenStatus !== "none" 
                                ? "border-cyan-500/30 bg-cyan-500/5 text-cyan-300" 
                                : "border-white/5 bg-slate-900/40 text-slate-500" 
                            },
                          ].map((item) => (
                            <div key={item.step} className={`rounded-2xl border p-3 flex flex-col justify-between min-h-24 ${
                              item.active ? item.color : "border-white/5 bg-slate-900/20 text-slate-500"
                            }`}>
                              <div className="flex items-center justify-between">
                                <span className={`grid h-5 w-5 place-items-center rounded-lg text-[10px] font-black ${
                                  item.active ? "bg-white/10" : "bg-white/5"
                                }`}>{item.step}</span>
                                {item.active && <CheckCircle2 className="h-3.5 w-3.5" />}
                              </div>
                              <div className="mt-2">
                                <p className={`text-xs font-black ${item.active ? "text-white" : "text-slate-500"}`}>{item.title}</p>
                                <p className="mt-0.5 text-[9px] leading-tight">{item.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Technical Info & Faucet block */}
                      <div className="mt-5">
                        <div className="grid gap-2 rounded-2xl border border-white/5 bg-slate-900/40 p-4 text-[10px] text-slate-400 sm:grid-cols-3">
                          <p><span className="block uppercase tracking-wider text-slate-600 font-bold mb-0.5">Primer Escaneo</span>#{product.first_tap_event_id || "n/a"}</p>
                          <p><span className="block uppercase tracking-wider text-slate-600 font-bold mb-0.5">Último Reportado</span>{product.latest_verdict || `#${product.latest_tap_event_id || "n/a"}`} {product.latest_city ? `- ${product.latest_city}` : ""}</p>
                          <p><span className="block uppercase tracking-wider text-slate-600 font-bold mb-0.5">Siguiente Acción</span>{isClaimed ? "Canjear Beneficios" : "Escanear y Reclamar"}</p>
                        </div>
                        
                        {/* Blockchain Proof Indicator */}
                        <div className="mt-3 rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-4 text-xs">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Certificación Criptográfica</p>
                              <p className="mt-0.5 font-bold text-white">
                                {hasTokenProof 
                                  ? `Acuñado en Polygon Amoy · Token #${product.tokenization_token_id}` 
                                  : tokenStatus !== "none" 
                                  ? `Estado de Tokenización: ${tokenStatus}` 
                                  : "Disponible cuando el tenant habilite la acuñación premium."}
                              </p>
                            </div>
                            
                            {certificateUrl ? (
                              <Link href={certificateUrl} className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-[10px] font-black text-cyan-200 hover:bg-cyan-500/20 transition text-center shrink-0">
                                Ver Firma Digital
                              </Link>
                            ) : hasTokenProof ? (
                              <a href={tokenExplorerHref} target="_blank" rel="noreferrer" className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-[10px] font-black text-emerald-200 hover:bg-emerald-500/20 transition text-center shrink-0">
                                Ver en Polygonscan
                              </a>
                            ) : (
                              <Link href="/me/wallet" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black text-slate-300 hover:bg-white/10 transition text-center shrink-0">
                                Abrir Billetera
                              </Link>
                            )}
                          </div>
                        </div>
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
