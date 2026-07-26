"use client";

import { useState } from "react";
import Link from "next/link";
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
  MapPin,
  Layers,
  Coins,
  PackageCheck,
  Share2,
  TrendingUp,
  ShoppingBag,
  Info,
  HelpCircle
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
  tokenization_tx_hash?: string | null;
  tokenization_token_id?: string | number | null;
  tokenization_status?: string | null;
  latest_tap_event_id?: string | null;
  first_tap_event_id?: string | null;
};

type Tap = { created_at?: string; verdict?: string; tenant_slug?: string; city?: string; country?: string };
type Brand = { slug?: string; name?: string; status?: string };

type MePortalInteractiveClientProps = {
  me: MePayload | null;
  products: Product[];
  taps: Tap[];
  brands: Brand[];
  passportReadiness: number | null;
  featuredAsset: any | null;
  featuredAssetReadiness: string | null;
};

type TabType = "passport" | "nfts" | "trades" | "drops";

export function MePortalInteractiveClient({
  me,
  products,
  taps,
  brands,
  passportReadiness,
  featuredAsset,
  featuredAssetReadiness,
}: MePortalInteractiveClientProps) {
  const commerceDemoEnabled = process.env.NEXT_PUBLIC_ME_PORTAL_COMMERCE_DEMO_ENABLED === "true";
  const [activeTab, setActiveTab] = useState<TabType>("passport");
  const [dropsCategory, setDropsCategory] = useState<"scanned" | "synergy">("scanned");
  const [p2pPrice, setP2pPrice] = useState<Record<string, string>>({});
  const [listedProducts, setListedProducts] = useState<Record<string, number>>({});
  const [trades, setTrades] = useState<Array<{ id: string; assetName: string; type: "claim" | "mint" | "list" | "sell" | "buy" | "transfer"; from: string; to: string; price?: string; at: string }>>([]);

  // Web3 Checkout & MetaMask Simulation States
  const [checkoutDrop, setCheckoutDrop] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"points" | "usdt">("points");
  const [isWeb3Connecting, setIsWeb3Connecting] = useState(false);
  const [isWeb3Paying, setIsWeb3Paying] = useState(false);
  const [web3Address, setWeb3Address] = useState("");
  const [web3Error, setWeb3Error] = useState("");
  const [txSuccess, setTxSuccess] = useState(false);

  const stats = me?.stats || {};
  const activeMemberships = brands.filter((item) => String(item.status || "").toLowerCase() === "active").length;
  const claimedProducts = products.filter((item) => String(item.ownership_record_status || item.ownership_status || "").toLowerCase() === "claimed").length;
  const latestTaps = taps.slice(0, 5);
  const consumerName = String(me?.consumer?.display_name || "").trim() || String(me?.consumer?.email || "Nombre no reportado");

  const journey = [
    { title: "Lectura NFC", desc: "El celular envía el mensaje y la referencia del evento.", icon: Compass },
    { title: "Mensaje Validado", desc: "SUN/NFC valida evidencia digital, no el objeto físico.", icon: ShieldCheck },
    { title: "Solicitar Ownership", desc: "Requiere identidad, compra y política del tenant.", icon: Award },
    { title: "Marketplace", desc: "Canje de beneficios, preventas y drops premium.", icon: Sparkles },
  ];

  const scannedDrops = [
    { id: "drop-1", name: "Estuche Colección Ícono Malbec 2020", winery: "Bodega Balmec", price: "4,000 pts", cashPrice: "$120 USDT", stock: "6 unidades", img: "/images/wine_crate.png", label: "Vino de Lote", rawPriceUsd: 120 },
    { id: "drop-2", name: "Gran Reserva Cabernet Franc 2021", winery: "Bodega Balmec", price: "3,000 pts", cashPrice: "$85 USDT", stock: "14 unidades", img: "/images/premium_magnum.png", label: "Preventa Limitada", rawPriceUsd: 85 },
  ];

  const synergyDrops = [
    { id: "syn-1", name: "Pack Sinergia: Cata a Ciegas + Traslado Seguro en Combi", winery: "Bodega Alta Cima & Traslados", price: "6,000 pts", cashPrice: "$180 USDT", stock: "6 packs", img: "/images/wine_tasting.png", label: "Cata + Traslado Seguro", rawPriceUsd: 180 },
    { id: "syn-2", name: "Pack Sinergia: Estadía Luxury + Traslado de Turistas VIP", winery: "Valle de Uco Resorts & Mendoza Tours", price: "15,000 pts", cashPrice: "$420 USDT", stock: "4 packs", img: "/images/wine_crate.png", label: "Hotel + Chofer Privado", rawPriceUsd: 420 },
    { id: "syn-3", name: "Zapatillas Urban Limited Edition (NFC Chip)", winery: "NexID Wearables", price: "8,000 pts", cashPrice: "$220 USDT", stock: "12 pares", img: "/images/sneaker.png", label: "Indumentaria Partner", rawPriceUsd: 220 },
  ];

  const currentDrops = commerceDemoEnabled ? (dropsCategory === "scanned" ? scannedDrops : synergyDrops) : [];

  const connectMetaMask = async () => {
    if (!commerceDemoEnabled) return;
    setIsWeb3Connecting(true);
    setWeb3Error("");
    try {
      if (typeof window !== "undefined" && window.ethereum) {
        const accounts: any = await window.ethereum.request({ method: "eth_requestAccounts" });
        if (accounts && accounts[0]) {
          setWeb3Address(accounts[0]);
        }
      } else {
        setWeb3Error("No se detectó una wallet EVM. La demo no inventa una dirección de respaldo.");
      }
    } catch (e) {
      console.error(e);
      setWeb3Address("");
      setWeb3Error("La wallet no autorizó la conexión. No se creó ninguna operación.");
    } finally {
      setIsWeb3Connecting(false);
    }
  };

  const handleCheckoutPayment = async () => {
    if (!commerceDemoEnabled) return;
    if (paymentMethod === "usdt" && !web3Address) {
      alert("Por favor conecta tu MetaMask primero.");
      return;
    }

    setIsWeb3Paying(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setTxSuccess(true);

      setTrades((prev) => [
        {
          id: `sim-${Date.now()}`,
          assetName: checkoutDrop.name,
          type: "buy",
          from: paymentMethod === "usdt" ? web3Address.slice(0, 8) + "..." : "Tus Puntos",
          to: "Escenario local sin escrow",
          price: paymentMethod === "usdt" ? `${checkoutDrop.cashPrice} (hipótesis)` : `${checkoutDrop.price} (hipótesis)`,
          at: "Simulado ahora",
        },
        ...prev,
      ]);
    } catch (e) {
      alert("Ocurrió un error al procesar el pago.");
    } finally {
      setIsWeb3Paying(false);
    }
  };

  const handleListForSale = (uid: string, productName: string) => {
    if (!commerceDemoEnabled) return;
    const price = p2pPrice[uid] || "3,500 pts";
    setListedProducts((prev) => ({ ...prev, [uid]: Number(price.replace(/[^\d]/g, "")) || 3500 }));
    setTrades((prev) => [
      {
        id: `sim-${Date.now()}`,
        assetName: productName,
        type: "list",
        from: "Tu Billetera",
        to: "Escenario P2P local",
        price,
        at: "Simulado ahora",
      },
      ...prev,
    ]);
  };

  const certificateHref = (product: Product) => {
    const eventId = String(product.latest_tap_event_id || product.first_tap_event_id || "").trim();
    return eventId ? `/certificado/${encodeURIComponent(eventId)}` : "";
  };

  return (
    <div className="space-y-6">
      
      {/* Category/Tabs Navigation Bar */}
      <div className="flex border-b border-white/10 bg-slate-950/60 p-2 rounded-2xl backdrop-blur-xl sticky top-[72px] z-[40] overflow-x-auto gap-2">
        {[
          { id: "passport", label: "Pasaporte Digital", icon: Award },
          { id: "nfts", label: "Bodega & NFTs Reclamados", icon: PackageCheck },
          { id: "trades", label: "Libro de Trades & P2P", icon: History },
          { id: "drops", label: "Drops & Tienda Exclusiva", icon: ShoppingBag },
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition shrink-0 ${
                isActive
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <TabIcon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="status" className={`rounded-2xl border p-3 text-xs leading-5 ${commerceDemoEnabled ? "border-amber-300/30 bg-amber-500/10 text-amber-100" : "border-slate-700 bg-slate-900/60 text-slate-300"}`}>
        {commerceDemoEnabled
          ? "DEMO COMERCIO SIMULADO · catálogo, precios, movimientos y checkout ficticios. Ninguna acción crea pagos, escrow, listings o transacciones on-chain."
          : "Comercio demo deshabilitado. Trades y drops solo aparecen con datos reales del backend; no se generan productos, wallets ni transacciones de relleno."}
      </div>

      {/* Tab Contents: PASSPORT (Dashboard View) */}
      {activeTab === "passport" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left: Golden Passport Card */}
            <section className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-[linear-gradient(135deg,#131316_0%,#1e1b18_100%)] p-6 shadow-2xl transition hover:border-amber-500/35">
              <div className="absolute -right-20 -top-20 h-44 w-44 rounded-full bg-amber-500/5 blur-3xl" />
              <div className="absolute -left-20 -bottom-20 h-44 w-44 rounded-full bg-amber-600/5 blur-3xl" />
              
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">nexID GLOBAL DIGITAL PASSPORT</p>
                  <div className="mt-4 flex items-center gap-2">
                    <h2 className="text-2xl font-black text-white tracking-tight">{consumerName}</h2>
                    <UserCheck className="h-5 w-5 text-amber-400" />
                  </div>
                  <p className="mt-1 text-[11px] font-mono text-slate-400">{me?.consumer?.email || "email no verificado"}</p>
                </div>
                
                {/* Hologram security chip */}
                <div className="h-10 w-12 rounded-lg border border-amber-400/30 bg-gradient-to-br from-amber-300/20 to-amber-600/30 p-1.5 flex flex-col justify-between shadow-inner">
                  <span className="h-1 w-full bg-amber-300/40 rounded-sm block" />
                  <span className="h-1 w-2/3 bg-amber-300/30 rounded-sm block" />
                  <span className="h-2 w-full bg-amber-300/20 rounded-sm block" />
                </div>
              </div>

              <div className="mt-8 rounded-2xl border border-white/5 bg-black/40 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Checklist de preparación</p>
                    <p className="mt-1 text-xs text-amber-200">
                      {passportReadiness === null ? "Sin datos suficientes" : "Cuenta, identidad, productos, ownership y membresía"}
                    </p>
                  </div>
                  <span className="text-2xl font-black tracking-tight text-white">{passportReadiness === null ? "N/D" : `${passportReadiness}%`}</span>
                </div>
                <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-1000" style={{ width: `${passportReadiness || 0}%` }} />
                </div>
              </div>
              
              <div className="mt-6 flex flex-wrap gap-4 text-xs font-mono text-slate-400">
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-slate-500">Membresías</span>
                  <span className="text-slate-200">{activeMemberships} Activas</span>
                </div>
                <div className="h-8 w-px bg-white/5" />
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-slate-500">Estatus de Cuenta</span>
                  {me?.consumer?.status === "verified" ? (
                    <span className="text-emerald-400 font-bold">CUENTA VALIDADA</span>
                  ) : (
                    <span className="text-amber-400 font-bold">REGISTRADA (Simple)</span>
                  )}
                </div>
              </div>
            </section>

            {/* Right: Featured Product Showcase */}
            {featuredAsset ? <section className="relative overflow-hidden rounded-3xl border border-emerald-300/10 bg-slate-950/80 p-5 shadow-xl">
              <div className="grid gap-4 sm:grid-cols-[1.3fr_0.7fr]">
                <div className="flex flex-col justify-between">
                  <div>
                    <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">
                      Último producto reportado
                    </span>
                    <h3 className="mt-3 text-xl font-black text-white tracking-tight leading-tight">{featuredAsset.productName}</h3>
                    <p className="mt-1 text-xs text-slate-400">Asociado a {featuredAsset.brandName}</p>
                    <p className="mt-3 text-[11px] leading-relaxed text-slate-300">
                      El Passport vincula evidencia digital y un registro de ownership a tu cuenta. No garantiza autenticidad física, procedencia ni control del objeto.
                    </p>
                  </div>
                  
                  <div className="mt-4 flex flex-wrap gap-1.5 text-[10px]">
                    <span className="rounded-full border border-white/5 bg-white/5 px-2 py-0.5 text-slate-300">{featuredAsset.batchLabel}</span>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-emerald-300 font-medium">{featuredAssetReadiness || "Preparación no reportada"}</span>
                  </div>
                </div>
                
                <div className="relative min-h-36 flex items-center justify-center rounded-2xl border border-white/5 bg-[linear-gradient(135deg,#0a0a0c,#161619)] p-2 group overflow-hidden">
                  <img
                    src={featuredAsset.primaryImageUrl}
                    alt={featuredAsset.productName}
                    className="h-32 w-auto object-contain transition duration-500 group-hover:scale-110 drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]"
                  />
                </div>
              </div>
            </section> : (
              <section className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-slate-700 bg-slate-950/60 p-6 text-center">
                <div>
                  <PackageCheck className="mx-auto h-8 w-8 text-slate-600" />
                  <h3 className="mt-3 text-sm font-black text-white">Todavía no hay productos reportados</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400">Cuando el backend devuelva un producto asociado, su identidad digital y estado real aparecerán acá. No mostramos un producto de ejemplo como si fuera tuyo.</p>
                </div>
              </section>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              {/* Metrics Grid */}
              <section className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
                {[
                  ["Ownership Registrado", String(claimedProducts), "border-emerald-500/10 bg-emerald-500/5 text-emerald-300"],
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

              {/* History & Saved Timeline */}
              <div className="grid gap-6 md:grid-cols-2">
                <article className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-lg">
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div>
                      <h3 className="text-sm font-black text-white">Últimos Eventos NFC</h3>
                      <p className="text-[11px] text-slate-400">Resultados digitales reportados por el backend.</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {latestTaps.map((tap, idx) => (
                      <div key={idx} className="rounded-2xl border border-white/5 bg-slate-900/30 p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                          <div>
                            <p className="text-xs font-black text-white">{String(tap.verdict || "SIN DATO").toUpperCase()}</p>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="h-2.5 w-2.5 text-slate-500" />
                              {[tap.city, tap.country].filter(Boolean).join(", ") || "Ubicación no reportada"}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-300 font-bold">{tap.tenant_slug || "tenant no reportado"}</span>
                      </div>
                    ))}
                    {latestTaps.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-700 p-4 text-xs text-slate-400">No hay eventos NFC reportados.</p> : null}
                  </div>
                </article>

                <article className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-lg">
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div>
                      <h3 className="text-sm font-black text-white">Colección Reciente</h3>
                      <p className="text-[11px] text-slate-400">Productos que el backend asoció a tu cuenta.</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {products.slice(0, 4).map((product, idx) => (
                      <div key={idx} className="rounded-2xl border border-white/5 bg-slate-900/30 p-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black text-white truncate max-w-40">{product.product_name || "Producto no reportado"}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{product.brand_name || "Marca no reportada"}</p>
                        </div>
                        <span className="rounded-full border border-slate-600 bg-slate-800/60 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-slate-300">
                          {product.ownership_record_status || product.ownership_status || "Ownership no reportado"}
                        </span>
                      </div>
                    ))}
                    {products.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-700 p-4 text-xs text-slate-400">No hay productos asociados a esta cuenta.</p> : null}
                  </div>
                </article>
              </div>
            </div>

            {/* Stepper info */}
            <article className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-lg self-start">
              <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 mb-4">Funcionamiento</h3>
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
      )}

      {/* Tab Contents: NFTS (Digital Wine Cellar Grid) */}
      {activeTab === "nfts" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h2 className="text-lg font-black text-white">Mi Bodega Digital (NFTs & Registros)</h2>
              <p className="text-xs text-slate-400">Registros digitales Polygon cuando existe una transacción; no autentican el producto físico ni su procedencia.</p>
            </div>
            <Link href="/me/wallet" className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20 transition">
              Administrar Billetera Web3
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product, idx) => {
              const thumbnailImg = product.imageUrl || product.image_url || product.photoUrl || product.photo_url || "";
              const isClaimed = String(product.ownership_record_status || product.ownership_status || "").toLowerCase() === "claimed";
              const txHash = product.tokenization_tx_hash;
              const hasOnChain = txHash && !txHash.includes("DEMO");
              const isListed = listedProducts[product.bid || ""] !== undefined;

              return (
                <div key={idx} className="relative rounded-3xl border border-white/10 bg-slate-950/80 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/30 hover:shadow-[0_12px_30px_rgba(245,158,11,0.06)] group flex flex-col justify-between min-h-[360px]">
                  {/* Glowing halo */}
                  <div className="absolute inset-0 bg-gradient-to-b from-amber-500/0 via-amber-500/0 to-amber-500/5 opacity-0 group-hover:opacity-100 transition rounded-3xl pointer-events-none" />

                  {/* Thumbnail */}
                  <div className="h-44 w-full rounded-2xl border border-white/5 bg-[linear-gradient(135deg,#0a0a0c,#161619)] p-4 flex items-center justify-center relative overflow-hidden">
                    {thumbnailImg ? <img
                      src={thumbnailImg}
                      alt={product.product_name || "Producto reportado"}
                      className="h-36 w-auto object-contain transition duration-500 group-hover:scale-105 drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
                    /> : <span className="text-[10px] text-slate-500">Imagen no reportada</span>}
                    <span className="absolute bottom-2 right-2 rounded bg-black/85 px-2 py-0.5 text-[8px] font-mono text-slate-500 border border-white/5">
                      {product.sku || "SKU no reportado"}
                    </span>
                  </div>

                  {/* Title & Metadata */}
                  <div className="mt-4 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-300 border border-amber-500/10">
                        {product.brand_name || "Marca no reportada"}
                      </span>
                      {hasOnChain && (
                        <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-violet-400 border border-violet-500/10">
                          Polygon NFT
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-sm font-black text-white leading-snug group-hover:text-amber-200 transition">{product.product_name || "Producto asociado"}</h3>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">Lote: {product.bid || "No reportado"}</p>
                  </div>

                  {/* Actions / Public Cert */}
                  <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">Estado:</span>
                      <span className="text-emerald-400 font-bold uppercase">{isClaimed ? "Ownership registrado" : "Registro disponible"}</span>
                    </div>

                    <div className="grid gap-1.5">
                      {certificateHref(product) ? (
                        <Link
                          href={certificateHref(product)}
                          className="w-full text-center rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-white px-3 py-2 text-[10px] font-black transition flex items-center justify-center gap-1.5 border border-white/5"
                        >
                          Ver Certificado Público <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="w-full text-center rounded-xl bg-slate-900/50 text-slate-600 px-3 py-2 text-[10px] font-black border border-white/5 cursor-not-allowed">
                          Certificado No Disponible
                        </span>
                      )}

                      {/* Selling / Marketplace Simulator */}
                      {isClaimed && commerceDemoEnabled && (
                        <div className="pt-2">
                          {isListed ? (
                            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-2 text-center text-[10px] font-bold text-emerald-300">
                              Publicación demo por {listedProducts[product.bid || ""]} pts · sin listing real
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                placeholder="Precio (puntos)"
                                name={product.bid || ""}
                                value={p2pPrice[product.bid || ""] || ""}
                                onChange={(e) => setP2pPrice((prev) => ({ ...prev, [product.bid || ""]: e.target.value }))}
                                className="w-2/3 bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] text-white focus:outline-none focus:border-amber-400"
                              />
                              <button
                                onClick={() => handleListForSale(product.bid || "", product.product_name || "Producto sin nombre reportado")}
                                className="w-1/3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 px-2 py-1.5 text-[9px] font-black transition uppercase tracking-wider"
                              >
                                Simular publicación
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {products.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">No hay productos ni registros Polygon reportados por el backend.</p> : null}
          </div>
        </div>
      )}

      {/* Tab Contents: TRADES (Simulated Ledger) */}
      {activeTab === "trades" && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
            <h2 className="text-lg font-black text-white">Simulación Local de Movimientos</h2>
            <p className="text-xs text-slate-400 mt-1">
              {commerceDemoEnabled ? "Escenario visual de acciones iniciadas con CTA Simular. No es un ledger público ni prueba transacciones, ownership o pagos reales." : "Demo deshabilitada. Los movimientos aparecerán cuando exista un origen real del backend."}
            </p>

            <div className="mt-6 space-y-4">
              {trades.map((trade) => (
                <div key={trade.id} className="rounded-2xl border border-white/5 bg-slate-900/25 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-900/40 transition">
                  <div className="flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black ${
                      trade.type === "mint"
                        ? "bg-violet-500/10 text-violet-400 border border-violet-500/15"
                        : trade.type === "claim"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                        : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/15"
                    }`}>
                      {trade.type === "mint" ? "🪙" : trade.type === "claim" ? "✓" : "🔄"}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">{trade.assetName}</h4>
                      <p className="text-[10px] text-slate-500 mt-1 font-mono">
                        De: <span className="text-slate-300">{trade.from}</span> · Para: <span className="text-slate-300">{trade.to}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex sm:flex-col sm:items-end justify-between items-center shrink-0">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      trade.type === "mint"
                        ? "bg-violet-400/15 text-violet-300"
                        : trade.type === "claim"
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-cyan-400/15 text-cyan-300"
                    }`}>
                      {trade.type}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 mt-1">{trade.at}</span>
                  </div>
                </div>
              ))}
              {trades.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-700 p-5 text-xs text-slate-400">No hay movimientos reportados ni simulados.</p> : null}
            </div>
          </div>
        </div>
      )}

      {/* Tab Contents: DROPS (Online Store Boutique drops) */}
      {activeTab === "drops" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h2 className="text-lg font-black text-white">Drops y preventas</h2>
              <p className="text-xs text-slate-400">{commerceDemoEnabled ? "Catálogo ficticio para simular la UX. Precios, stock y disponibilidad no son ofertas reales." : "No hay catálogo real reportado por el backend."}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/30 px-3 py-1.5 flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-amber-300" />
              <span className="text-xs font-black text-white">Consultar saldo en Wallet</span>
            </div>
          </div>

          {/* nexID Synergy Explanation Card */}
          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-slate-950 to-slate-950 p-4 text-[11px] leading-5 text-slate-300 flex items-start gap-3 shadow-xl">
            <Sparkles className="h-5 w-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <strong className="text-white">¡Club nexID de Sinergia de Marcas Aliadas!</strong>
              <p className="mt-0.5">
                Al interactuar con productos conectados de la red nexID, podés acceder a beneficios según la política de cada marca. La lectura NFC registra evidencia digital; no certifica autenticidad física ni habilita beneficios por sí sola.
              </p>
            </div>
          </div>

          {/* Drops Category Selector Sub-tabs */}
          <div className="flex bg-slate-900/80 p-1 rounded-xl border border-white/5 max-w-sm gap-1">
            <button
              onClick={() => setDropsCategory("scanned")}
              className={`flex-1 text-center py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                dropsCategory === "scanned"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Marcas en tu Historial
            </button>
            <button
              onClick={() => setDropsCategory("synergy")}
              className={`flex-1 text-center py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                dropsCategory === "synergy"
                  ? "bg-cyan-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Sinergia nexID (Demo)
            </button>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {currentDrops.map((drop) => (
              <div key={drop.id} className={`rounded-3xl border border-white/10 bg-slate-950/80 p-5 transition duration-300 flex flex-col justify-between min-h-[320px] ${
                dropsCategory === "synergy" ? "hover:border-cyan-400/30" : "hover:border-amber-500/30"
              }`}>
                <div className="flex gap-4 items-start">
                  <div className="h-20 w-16 shrink-0 rounded-2xl border border-white/10 bg-black/40 p-1 flex items-center justify-center overflow-hidden">
                    <img
                      src={drop.img}
                      alt={drop.name}
                      className="h-16 w-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
                    />
                  </div>
                  <div>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        dropsCategory === "synergy" 
                          ? "text-cyan-300 bg-cyan-500/10 border-cyan-500/10" 
                          : "text-amber-300 bg-amber-500/10 border-amber-500/10"
                      }`}>
                        {drop.winery}
                      </span>
                      <span className="text-[8px] font-bold text-slate-500">{drop.label}</span>
                    </div>
                    <h3 className="mt-2 text-sm font-black text-white leading-snug">{drop.name}</h3>
                    <p className="text-[10px] text-slate-500 mt-1">Disponibilidad: <span className="text-slate-300 font-bold">{drop.stock}</span></p>
                  </div>
                </div>

                <div className="mt-6 border-t border-white/5 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Precio</span>
                      <strong className={`text-sm font-black ${dropsCategory === "synergy" ? "text-cyan-300" : "text-amber-300"}`}>{drop.price} <span className="text-[10px] font-normal text-slate-400 font-mono">o {drop.cashPrice}</span></strong>
                    </div>
                    <button
                      onClick={() => {
                        setCheckoutDrop(drop);
                        setTxSuccess(false);
                        setPaymentMethod("points");
                      }}
                      className={`rounded-xl px-4 py-2 text-xs font-black transition uppercase tracking-wider shadow-md ${
                        dropsCategory === "synergy"
                          ? "bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950"
                          : "bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950"
                      }`}
                    >
                      Simular checkout
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {currentDrops.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">Demo deshabilitada y sin drops reales reportados.</p> : null}
          </div>
        </div>
      )}

      {/* Glassmorphic Web3 Checkout Modal with MetaMask & nexID Synergy Fee */}
      {commerceDemoEnabled && checkoutDrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative max-w-md w-full bg-[linear-gradient(135deg,#0f0f12_0%,#1a191d_100%)] border border-amber-500/20 p-6 rounded-3xl text-white shadow-2xl">
            
            {/* Close Button */}
            {!isWeb3Paying && (
              <button
                onClick={() => setCheckoutDrop(null)}
                className="absolute right-4 top-4 text-slate-400 hover:text-white text-xs uppercase font-black"
              >
                Cerrar
              </button>
            )}

            {!txSuccess ? (
              <>
                <h3 className="text-base font-black tracking-tight text-white pr-8">{checkoutDrop.name}</h3>
                <p className="text-[11px] text-slate-400 mt-1">{checkoutDrop.winery} · {checkoutDrop.label}</p>
                <p className="mt-2 rounded-lg border border-amber-300/25 bg-amber-500/10 p-2 text-[10px] font-bold text-amber-100">SIMULACIÓN: no se cobrará, reservará stock ni creará escrow o transacción.</p>

                {/* Payment Method Selector */}
                <div className="mt-5 grid grid-cols-2 bg-slate-900/60 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => setPaymentMethod("points")}
                    className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                      paymentMethod === "points"
                        ? "bg-amber-500 text-slate-950 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Puntos NexID
                  </button>
                  <button
                    onClick={() => {
                      setPaymentMethod("usdt");
                      if (!web3Address) connectMetaMask();
                    }}
                    className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                      paymentMethod === "usdt"
                        ? "bg-cyan-500 text-slate-950 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    USDT (MetaMask)
                  </button>
                </div>

                {/* Billing Details Pane */}
                <div className="mt-4 rounded-2xl bg-black/40 border border-white/5 p-4 space-y-3">
                  {paymentMethod === "points" ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Puntos demo disponibles:</span>
                        <strong className="text-white">2,500 pts</strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Costo de Canje:</span>
                        <strong className="text-amber-400">{checkoutDrop.price}</strong>
                      </div>
                      <div className="h-px bg-white/5 my-2" />
                      {Number(checkoutDrop.price.replace(/[^\d]/g, "")) > 2500 ? (
                        <p className="text-[10px] text-red-400 font-bold">Puntos insuficientes. Prueba con el método de pago USDT.</p>
                      ) : (
                        <div className="flex justify-between text-white font-bold">
                        <span>Saldo demo estimado:</span>
                          <span>{(2500 - Number(checkoutDrop.price.replace(/[^\d]/g, ""))).toLocaleString()} pts</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Precio ficticio:</span>
                        <strong className="text-white">{checkoutDrop.rawPriceUsd} USDT</strong>
                      </div>
                      <div className="flex justify-between text-slate-400 items-center">
                        <span className="flex items-center gap-1">
                          Fee hipotético (1.5%):
                          <span title="Fee cobrado por nexID para sostener la red de beneficios cruzados.">
                            <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
                          </span>
                        </span>
                        <strong className="text-cyan-400">{(checkoutDrop.rawPriceUsd * 0.015).toFixed(2)} USDT</strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Gas ilustrativo (no cotizado):</span>
                        <strong className="text-slate-300">0.15 POL</strong>
                      </div>
                      <div className="h-px bg-white/5 my-2" />
                      <div className="flex justify-between text-white font-bold text-sm">
                        <span>Total ficticio:</span>
                        <span className="text-cyan-300">{(checkoutDrop.rawPriceUsd * 1.015 + 0.15).toFixed(2)} USDT</span>
                      </div>

                      {/* MetaMask Connection HUD */}
                      <div className="mt-3 pt-3 border-t border-white/5">
                        {web3Address ? (
                          <div className="flex items-center justify-between text-[10px] font-mono bg-slate-900/60 px-3 py-2 rounded-xl border border-white/5">
                            <span className="text-slate-400">MetaMask:</span>
                            <span className="text-emerald-400 font-bold">{web3Address.slice(0, 6)}...{web3Address.slice(-4)}</span>
                          </div>
                        ) : (
                          <button
                            onClick={connectMetaMask}
                            disabled={isWeb3Connecting}
                            className="w-full py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-xl transition animate-pulse"
                          >
                            {isWeb3Connecting ? "Abriendo MetaMask..." : "Conectar MetaMask 🦊"}
                          </button>
                        )}
                        {web3Error ? <p className="mt-2 text-[10px] text-rose-300">{web3Error}</p> : null}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex gap-3">
                  <button
                    disabled={isWeb3Paying}
                    onClick={() => setCheckoutDrop(null)}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-black uppercase tracking-wider text-slate-400 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={isWeb3Paying || (paymentMethod === "points" && Number(checkoutDrop.price.replace(/[^\d]/g, "")) > 2500)}
                    onClick={handleCheckoutPayment}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-950 transition shadow-md ${
                      paymentMethod === "usdt"
                        ? "bg-gradient-to-r from-cyan-400 to-cyan-300 hover:from-cyan-300 hover:to-cyan-200"
                        : "bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300"
                    }`}
                  >
                    {isWeb3Paying ? "Simulando..." : paymentMethod === "usdt" ? "Simular con wallet detectada" : "Simular canje"}
                  </button>
                </div>
              </>
            ) : (
              /* Success Screen */
              <div className="text-center py-4 space-y-4 animate-fade-in">
                <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/35 flex items-center justify-center text-emerald-400 text-2xl font-bold animate-bounce">
                  ✓
                </div>
                <div>
                  <h4 className="text-base font-black text-white">Simulación completada</h4>
                  <p className="text-[11px] text-slate-400 mt-1">No se creó una compra, orden, pago, reserva, escrow ni transacción on-chain.</p>
                </div>

                <div className="rounded-2xl bg-black/40 border border-white/5 p-4 text-[10px] space-y-2 text-left">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Producto:</span>
                    <strong className="text-white truncate max-w-48">{checkoutDrop.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Método:</span>
                    <strong className="text-white uppercase">{paymentMethod}</strong>
                  </div>
                  {paymentMethod === "usdt" && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fee simulado (1.5%):</span>
                      <strong className="text-cyan-400">{(checkoutDrop.rawPriceUsd * 0.015).toFixed(2)} USDT</strong>
                    </div>
                  )}
                  <div className="flex justify-between">
                      <span className="text-slate-500">Recibo de red:</span>
                      <strong className="text-slate-300">No generado</strong>
                  </div>
                </div>

                <button
                  onClick={() => setCheckoutDrop(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-black uppercase tracking-wider text-slate-200 transition"
                >
                  Cerrar
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
