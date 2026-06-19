import Link from "next/link";
import { asArray, buildConsumerNextPath, fetchConsumerMe, fetchConsumerPath, requireConsumerSession } from "./_components/consumer-api";
import { PortalShell } from "./_components/portal-shell";
import { resolveProductAssetProfile, summarizeAssetReadiness } from "../../lib/product-asset-bank";
import { 
  Award, 
  ShieldCheck, 
  Sparkles, 
  Compass, 
  History, 
  Tag, 
  Box, 
  Clock, 
  UserCheck, 
  ArrowRight,
  ExternalLink,
  ChevronRight,
  MapPin
} from "lucide-react";

type MePayload = {
  ok?: boolean;
  consumer?: { email?: string | null; display_name?: string | null; passport_status?: string | null; preferred_locale?: string | null; status?: string | null };
  stats?: { products?: number; taps?: number; memberships?: number; unread?: number; rewards?: number };
};
type Product = {
  product_name?: string;
  brand_name?: string | null;
  tenant_slug?: string;
  bid?: string | null;
  batch?: string | null;
  sku?: string | null;
  vertical?: string | null;
  category?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  photo_url?: string | null;
  photoUrl?: string | null;
  ownership_record_status?: string | null;
  ownership_status?: string | null;
};
type Tap = { created_at?: string; verdict?: string; tenant_slug?: string; city?: string; country?: string };
type Brand = { slug?: string; name?: string; status?: string };

export default async function MePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me", params));
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
  
  const savedProductProfiles = savedProducts.map((product) => ({
    product,
    profile: resolveProductAssetProfile({
      tenantSlug: product.tenant_slug,
      brandName: product.brand_name || product.tenant_slug,
      productName: product.product_name,
      bid: product.bid || product.batch,
      vertical: product.vertical,
      category: product.category,
      imageUrl: product.imageUrl || product.image_url || product.photoUrl || product.photo_url,
      sku: product.sku,
    }),
  }));

  const featuredAsset = savedProductProfiles[0]?.profile || resolveProductAssetProfile({
    tenantSlug: brands[0]?.slug,
    brandName: brands[0]?.name,
    productName: "Gran Reserva Premium Magnum",
    imageUrl: "/images/premium_magnum.png"
  });
  
  // Use high-end visual if it is a fallback/default malbec
  if (!featuredAsset.primaryImageUrl || featuredAsset.primaryImageUrl.includes("pexels")) {
    featuredAsset.primaryImageUrl = "/images/premium_magnum.png";
  }

  const featuredAssetReadiness = summarizeAssetReadiness(featuredAsset);
  const passportReadiness = Math.min(100, 42 + verifiedProducts * 18 + activeMemberships * 12 + Math.min(20, latestTaps.length * 5));
  
  const journey = [
    { title: "Tap Físico", desc: "Lectura NFC segura desde el celular sobre el producto.", icon: Compass },
    { title: "Verificación", desc: "Validación digital de autenticidad en tiempo real.", icon: ShieldCheck },
    { title: "Ownership", desc: "Propiedad digital registrada en tu Pasaporte.", icon: Award },
    { title: "Marketplace", desc: "Canje de beneficios, preventas y drops premium.", icon: Sparkles },
  ];

  return (
    <PortalShell
      title="Tu Pasaporte de Productos Auténticos"
      subtitle="Todo lo que escaneaste y guardaste: trazabilidad, procedencia, propiedad garantizada, beneficios y marketplace en una sola cuenta premium."
      notificationCount={Number(stats.unread || 0)}
    >
      
      {/* Top Section Grid: Digital Passport & Featured Asset */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        
        {/* Left: Elegant Digital Passport Card */}
        <section className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-[linear-gradient(135deg,#131316_0%,#1e1b18_100%)] p-6 shadow-[0_24px_50px_rgba(245,158,11,0.05)] transition hover:border-amber-500/35">
          {/* Hologram / Golden ambient glows */}
          <div className="absolute -right-20 -top-20 h-44 w-44 rounded-full bg-amber-500/5 blur-3xl" />
          <div className="absolute -left-20 -bottom-20 h-44 w-44 rounded-full bg-amber-600/5 blur-3xl" />
          
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">nexID GLOBAL AUTHENTICITY PASSPORT</p>
              <div className="mt-4 flex items-center gap-2">
                <h2 className="text-2xl font-black text-white tracking-tight">{consumerName}</h2>
                <UserCheck className="h-5 w-5 text-amber-400" aria-hidden="true" />
              </div>
              <p className="mt-1 text-[11px] font-mono text-slate-400">{me?.consumer?.email || "email no verificado"}</p>
            </div>
            
            {/* Hologram Security Chip Indicator */}
            <div className="h-10 w-12 rounded-lg border border-amber-400/30 bg-gradient-to-br from-amber-300/20 to-amber-600/30 p-1.5 flex flex-col justify-between shadow-inner">
              <span className="h-1 w-full bg-amber-300/40 rounded-sm block" />
              <span className="h-1 w-2/3 bg-amber-300/30 rounded-sm block" />
              <span className="h-2 w-full bg-amber-300/20 rounded-sm block" />
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-white/5 bg-black/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Nivel de Pasaporte</p>
                <p className="mt-1 text-xs text-amber-200">
                  {passportReadiness >= 80 ? "Coleccionista Platino" : passportReadiness >= 50 ? "Coleccionista Oro" : "Starter"}
                </p>
              </div>
              <span className="text-2xl font-black tracking-tight text-white">{passportReadiness}%</span>
            </div>
            <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-1000" style={{ width: `${passportReadiness}%` }} />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              Sube de nivel sumando botellas a tu colección, validando taps físicos y uniéndote a los clubes de las bodegas.
            </p>
          </div>
          
          <div className="mt-6 flex flex-wrap gap-4 text-xs font-mono text-slate-400">
            <div>
              <span className="block text-[9px] uppercase tracking-wider text-slate-500">Idioma Preferido</span>
              <span className="text-slate-200">{me?.consumer?.preferred_locale || "es-AR"}</span>
            </div>
            <div className="h-8 w-px bg-white/5" />
            <div>
              <span className="block text-[9px] uppercase tracking-wider text-slate-500">Membresías</span>
              <span className="text-slate-200">{activeMemberships} Activas</span>
            </div>
            <div className="h-8 w-px bg-white/5" />
            <div>
              <span className="block text-[9px] uppercase tracking-wider text-slate-500">Estatus de Cuenta</span>
              {me?.consumer?.status === "verified" ? (
                <span className="text-emerald-400 font-bold">VERIFICADA (2FA)</span>
              ) : (
                <span className="text-amber-400 font-bold">REGISTRADA (Simple)</span>
              )}
            </div>
          </div>
        </section>

        {/* Right: Featured Product Showcase (Real magnum bottle layout) */}
        <section className="relative overflow-hidden rounded-3xl border border-emerald-300/10 bg-slate-950/80 p-5 shadow-xl shadow-black/40">
          <div className="grid gap-4 sm:grid-cols-[1.3fr_0.7fr]">
            <div className="flex flex-col justify-between">
              <div>
                <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">
                  Último Producto Destacado
                </span>
                <h3 className="mt-3 text-xl font-black text-white tracking-tight leading-tight">{featuredAsset.productName}</h3>
                <p className="mt-1 text-xs text-slate-400">Original de {featuredAsset.brandName}</p>
                <p className="mt-3 text-[11px] leading-relaxed text-slate-300">
                  {featuredAsset.ownerStory} Cada botella está firmada digitalmente desde el viñedo de origen.
                </p>
              </div>
              
              <div className="mt-4 flex flex-wrap gap-1.5 text-[10px]">
                <span className="rounded-full border border-white/5 bg-white/5 px-2 py-0.5 text-slate-300">{featuredAsset.batchLabel}</span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-emerald-300 font-medium">{featuredAssetReadiness}</span>
              </div>
            </div>
            
            {/* Magnum Floating Glass Display */}
            <div className="relative min-h-36 flex items-center justify-center rounded-2xl border border-white/5 bg-[linear-gradient(135deg,#0a0a0c,#161619)] p-2 group overflow-hidden">
              <img
                src={featuredAsset.primaryImageUrl || "/images/premium_magnum.png"}
                alt={featuredAsset.productName}
                className="h-32 w-auto object-contain transition duration-500 group-hover:scale-110 drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]"
              />
              <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[8px] font-mono text-slate-500">Real Packshot</span>
            </div>
          </div>
          
          {/* Verification Slots HUD */}
          <div className="mt-4 grid gap-2 sm:grid-cols-2 border-t border-white/5 pt-4">
            {featuredAsset.slots.slice(0, 2).map((slot) => (
              <div key={slot.id} className="rounded-xl border border-white/5 bg-slate-900/30 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white">{slot.label}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                    slot.status === "ready" ? "bg-emerald-500/10 text-emerald-400" : "bg-cyan-500/10 text-cyan-400"
                  }`}>
                    {slot.status === "ready" ? "Verificado" : "Demo"}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-400 leading-normal">{slot.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Main Split Grid */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        
        {/* Left Column (Main stats, collection, taps, quick-links) */}
        <div className="space-y-6">
          {/* Grid of Key Metrics */}
          <section className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
            {[
              ["Vinos Verificados", String(verifiedProducts), "border-emerald-500/10 bg-emerald-500/5 text-emerald-300"],
              ["Escaneos Taps", String(stats.taps || 0), "border-cyan-500/10 bg-cyan-500/5 text-cyan-300"],
              ["Clubes Activos", String(activeMemberships), "border-amber-500/10 bg-amber-500/5 text-amber-300"],
              ["Total Guardados", String(stats.products || 0), "border-violet-500/10 bg-violet-500/5 text-violet-300"],
              ["Alertas / Inbox", String(stats.unread || 0), "border-rose-500/10 bg-rose-500/5 text-rose-300"],
            ].map(([title, value, colorClass]) => (
              <article key={title} className={`rounded-2xl border p-4 text-center transition hover:scale-[1.01] ${colorClass}`}>
                <span className="block text-[9px] uppercase tracking-wider text-slate-400">{title}</span>
                <b className="mt-2 block text-3xl font-black tracking-tight">{value}</b>
              </article>
            ))}
          </section>

          {/* main collections & history */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left: Audit Ledger style Taps History */}
            <article className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-lg shadow-black/20">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div>
                  <h3 className="text-sm font-black text-white">Registro Reciente de Autenticidad (Taps)</h3>
                  <p className="text-[11px] text-slate-400">Verdicts de escaneos geolocalizados.</p>
                </div>
                <Link href="/me/taps" className="text-xs font-bold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1">
                  Ver Historial <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              
              <div className="mt-4 space-y-3">
                {latestTaps.length ? latestTaps.map((tap, index) => {
                  const isVerif = String(tap.verdict || "unknown").toUpperCase().includes("VALID");
                  return (
                    <div key={`${tap.created_at || index}`} className="rounded-2xl border border-white/5 bg-slate-900/30 p-3 flex items-center justify-between gap-3 hover:bg-slate-900/55 transition">
                      <div className="flex items-center gap-2.5">
                        <span className={`h-2 w-2 rounded-full ${isVerif ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"}`} />
                        <div>
                          <p className="text-xs font-black text-white">{String(tap.verdict || "Desconocido").toUpperCase()}</p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-2.5 w-2.5 text-slate-500" />
                            {tap.city || "Ubicación demo"}, {tap.country || "AR"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] uppercase font-mono text-slate-500">Tenant</span>
                        <p className="text-[10px] font-mono text-slate-300 font-bold">{tap.tenant_slug || "n/a"}</p>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-xs text-slate-500 py-4 text-center">Todavía no has realizado escaneos de botellas.</p>
                )}
              </div>
            </article>

            {/* Right: Consumer Product Collection Grid */}
            <article className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-lg shadow-black/20">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div>
                  <h3 className="text-sm font-black text-white">Colección Guardada en Passport</h3>
                  <p className="text-[11px] text-slate-400">Tus botellas con garantía activa.</p>
                </div>
                <Link href="/me/products" className="text-xs font-bold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1">
                  Ver Colección <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              
              <div className="mt-4 space-y-3">
                {savedProducts.length ? savedProducts.map((product, index) => {
                  const status = String(product.ownership_record_status || product.ownership_status || "viewed").toLowerCase();
                  return (
                    <div key={`${product.product_name || index}`} className="rounded-2xl border border-white/5 bg-slate-900/30 p-3 flex items-center justify-between gap-3 hover:bg-slate-900/55 transition">
                      <div>
                        <p className="text-xs font-black text-white">{product.product_name || "Producto"}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Marca: {product.brand_name || product.tenant_slug}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                        status === "claimed" ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-300" : "border-cyan-300/30 bg-cyan-500/10 text-cyan-300"
                      }`}>
                        {status}
                      </span>
                    </div>
                  );
                }) : (
                  <p className="text-xs text-slate-500 py-4 text-center">Aún no tienes botellas registradas en tu Pasaporte.</p>
                )}
              </div>
            </article>
          </div>

          {/* Bottom Quick Links / Navigation Cards */}
          <section className="grid gap-4 md:grid-cols-3">
            {[
              ["/me/products", "Mis Vinos & Productos", "Explora la biblioteca completa de botellas, garantías y certificados de autenticidad.", "text-emerald-400 bg-emerald-500/5 border-emerald-500/15 hover:border-emerald-500/35"],
              ["/me/brands", "Mis Clubes de Fidelización", "Accede a las membresías premium, niveles de puntos y novedades directas de bodegas.", "text-amber-400 bg-amber-500/5 border-amber-500/15 hover:border-amber-500/35"],
              ["/me/marketplace", "Marketplace Exclusivo", "Accede al catálogo de recompra, drops exclusivos y subastas de botellas limitadas.", "text-cyan-400 bg-cyan-500/5 border-cyan-500/15 hover:border-cyan-500/35"],
            ].map(([href, title, desc, customClass]) => (
              <Link key={href} href={href} className={`rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-0.5 ${customClass}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-white">{title}</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-300">{desc}</p>
              </Link>
            ))}
          </section>
        </div>

        {/* Right Column (2FA info, Step by step explanation, rewards/ad space) */}
        <div className="space-y-6">
          {/* 2FA Incentive Banner */}
          {me?.consumer?.status !== "verified" && (
            <div className="rounded-3xl border border-amber-500/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.07)_0%,rgba(194,65,12,0.03)_100%)] p-5 flex flex-col items-stretch gap-4 transition hover:border-amber-500/35 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white tracking-tight">¡Doble Factor de Seguridad!</h4>
                  <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                    Asociá tu Email + WhatsApp. Te regalamos 100 puntos automáticos para canjear en tus clubes.
                  </p>
                </div>
              </div>
              <Link href="/me/security" className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 px-4 py-2.5 text-center text-xs font-black text-slate-950 transition uppercase tracking-wider shadow-md">
                Activar 2FA (+100 pts)
              </Link>
            </div>
          )}

          {/* Interactive Stepper Navigation (Journey) */}
          <article className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-lg">
            <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 mb-4">¿Cómo funciona nexID?</h3>
            <div className="space-y-4">
              {journey.map((step, index) => {
                const StepIcon = step.icon;
                return (
                  <div key={step.title} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-[9px] font-black text-amber-200">
                      {index + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black text-white">{step.title}</p>
                        <StepIcon className="h-3 w-3 text-slate-500" />
                      </div>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </div>

      </div>

    </PortalShell>
  );
}
