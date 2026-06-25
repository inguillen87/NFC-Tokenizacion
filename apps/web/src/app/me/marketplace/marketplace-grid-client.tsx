"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, MapPin, Minus, PackageCheck, Plus, Search, ShieldCheck, ShoppingCart, Sparkles, WalletCards } from "lucide-react";
import { resolveProductAssetProfile } from "../../../lib/product-asset-bank";

type Listing = {
  id: string;
  title?: string;
  brand_name?: string;
  brand?: string;
  tenant_slug?: string;
  bid?: string;
  batch?: string;
  sku?: string;
  kind?: string;
  vertical?: string;
  category?: string;
  image_url?: string;
  imageUrl?: string;
  photo_url?: string;
  photoUrl?: string;
  points_price?: number;
  cash_price?: number;
  price_amount?: number;
  price_currency?: string;
  stock_status?: string;
  status?: string;
  request_to_buy_enabled?: boolean;
  age_gate_required?: boolean;
};

type PaymentMethod = "mercadopago" | "stripe" | "metamask" | "transfer" | "escrow";

const money = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

const filterOptions = [
  { value: "all", label: "Todo" },
  { value: "wine", label: "Vinos" },
  { value: "olive", label: "Oliva" },
  { value: "experience", label: "Experiencias" },
  { value: "membership", label: "Club" },
  { value: "gated", label: "Age gate" },
];

const paymentMethods: Array<{
  id: PaymentMethod;
  label: string;
  detail: string;
  Icon: typeof CreditCard;
}> = [
  { id: "mercadopago", label: "MercadoPago", detail: "Link de pago local AR/UY/CL", Icon: CreditCard },
  { id: "stripe", label: "Stripe", detail: "Tarjeta internacional", Icon: CreditCard },
  { id: "metamask", label: "MetaMask / USDC", detail: "Wallet para NFT y ownership", Icon: WalletCards },
  { id: "transfer", label: "Transferencia", detail: "CBU/alias validado por la marca", Icon: Banknote },
  { id: "escrow", label: "P2P escrow", detail: "Reserva tipo Binance P2P", Icon: ShieldCheck },
];

const MARKETPLACE_SHOWCASE_SLIDES = [
  {
    title: "Gran Reserva Malbec",
    kicker: "Drop verificado por tap",
    body: "Botella premium con trazabilidad, club, voucher post-tap y ownership listo para transferir.",
    image: "/images/premium_wine_mendoza_nfc.png",
    tag: "Wine pass",
    place: "Mendoza",
  },
  {
    title: "Cata privada + copa",
    kicker: "Experiencia del club",
    body: "Reserva desde el Passport, valida en el comercio y deja el lead listo para CRM.",
    image: "/images/wine_tasting.png",
    tag: "Experiencia",
    place: "Bodega",
  },
  {
    title: "Aceite de oliva premium",
    kicker: "Producto cross-sell",
    body: "Ideal para sumar regalos, bundles gastronómicos y recompra por WhatsApp/marketplace.",
    image: "/images/wine_crate.png",
    tag: "Oliva",
    place: "Tienda",
  },
] as const;

function priceValue(item: Listing) {
  return Number(item.cash_price || item.price_amount || 0);
}

function priceLabel(item: Listing) {
  const points = Number(item.points_price || 0);
  const cash = priceValue(item);
  const currency = item.price_currency || "ARS";
  if (points && cash) return `${points} pts + ${currency} ${money.format(cash)}`;
  if (points) return `${points} pts`;
  if (cash) return `${currency} ${money.format(cash)}`;
  return "Beneficio member";
}

function brandLabel(item: Listing) {
  if (item.brand_name || item.brand) return item.brand_name || item.brand || "Marca premium";
  if (String(item.tenant_slug || "").toLowerCase() === "demobodega") return "Bodega Balmec";
  return item.tenant_slug || "Marca premium";
}

function itemKind(item: Listing, index = 0) {
  const blob = `${item.title || ""} ${brandLabel(item)} ${item.kind || ""} ${item.vertical || ""} ${item.category || ""}`.toLowerCase();
  if (blob.includes("oliva") || blob.includes("olive") || blob.includes("arbequina")) return "olive";
  if (blob.includes("cata") || blob.includes("tour") || blob.includes("paseo") || blob.includes("experience")) return "experience";
  if (blob.includes("club") || blob.includes("vip") || blob.includes("membership")) return "membership";
  if (blob.includes("wine") || blob.includes("vino") || blob.includes("malbec") || blob.includes("reserva") || blob.includes("cabernet") || blob.includes("chardonnay")) return "wine";
  return index % 3 === 0 ? "wine" : index % 3 === 1 ? "experience" : "olive";
}

function productVisualClass(kind: string) {
  if (kind === "experience" || kind === "membership") return "marketplace-product-visual marketplace-product-visual--wristband";
  if (kind === "olive") return "marketplace-product-visual marketplace-product-visual--cosmetic";
  return "marketplace-product-visual marketplace-product-visual--bottle";
}

export function MarketplaceGridClient({ items }: { items: Listing[] }) {
  const [busyById, setBusyById] = useState<Record<string, boolean>>({});
  const [feedbackById, setFeedbackById] = useState<Record<string, string>>({});
  const [ageGateById, setAgeGateById] = useState<Record<string, boolean>>({});
  const [requestedById, setRequestedById] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutMethod, setCheckoutMethod] = useState<PaymentMethod>("mercadopago");
  const [cartStatus, setCartStatus] = useState("");
  const [cartBusy, setCartBusy] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % MARKETPLACE_SHOWCASE_SLIDES.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const available = items.filter((item) => String(item.stock_status || item.status || "available").toLowerCase() !== "out_of_stock").length;
    const gated = items.filter((item) => item.age_gate_required).length;
    const requestable = items.filter((item) => item.request_to_buy_enabled !== false).length;
    const brands = new Set(items.map((item) => String(brandLabel(item)).trim()).filter(Boolean));
    const points = items.filter((item) => Number(item.points_price || 0) > 0).length;
    return { available, gated, requestable, brands: brands.size, points };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item, index) => {
      const blob = `${item.title || ""} ${brandLabel(item)} ${item.kind || ""} ${item.vertical || ""} ${item.category || ""}`.toLowerCase();
      const currentKind = itemKind(item, index);
      const byQuery = q ? blob.includes(q) : true;
      const byKind = kind === "all" ? true : kind === "gated" ? item.age_gate_required === true : currentKind === kind;
      return byQuery && byKind;
    });
  }, [items, kind, query]);

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([id, quantity]) => ({ item: items.find((entry) => entry.id === id), quantity }))
      .filter((line): line is { item: Listing; quantity: number } => Boolean(line.item) && line.quantity > 0);
  }, [cart, items]);

  const cartTotals = useMemo(() => {
    return cartLines.reduce(
      (acc, line) => {
        acc.units += line.quantity;
        acc.cash += priceValue(line.item) * line.quantity;
        acc.points += Number(line.item.points_price || 0) * line.quantity;
        return acc;
      },
      { units: 0, cash: 0, points: 0 },
    );
  }, [cartLines]);

  const selectedPayment = paymentMethods.find((method) => method.id === checkoutMethod) || paymentMethods[0];
  const showcase = MARKETPLACE_SHOWCASE_SLIDES[activeSlide] || MARKETPLACE_SHOWCASE_SLIDES[0];

  function addToCart(item: Listing) {
    if (!item.id) return;
    setCart((prev) => ({ ...prev, [item.id]: Math.min(24, Number(prev[item.id] || 0) + 1) }));
    setCartStatus(`${item.title || "Producto"} agregado al carrito.`);
  }

  function setCartQuantity(id: string, quantity: number) {
    setCart((prev) => {
      const next = { ...prev };
      const normalized = Math.max(0, Math.min(24, quantity));
      if (!normalized) delete next[id];
      else next[id] = normalized;
      return next;
    });
  }

  async function requestToBuy(item: Listing, options: { ageGateAccepted?: boolean; quantity?: number; message?: string } = {}) {
    if (!item.id || busyById[item.id] || requestedById[item.id]) return false;
    const needsAgeGate = item.age_gate_required === true;
    const ageGateAccepted = !needsAgeGate || options.ageGateAccepted === true;
    if (needsAgeGate && !ageGateAccepted) {
      setAgeGateById((prev) => ({ ...prev, [item.id]: true }));
      setFeedbackById((prev) => ({ ...prev, [item.id]: "Confirmá mayoría de edad para enviar la solicitud a la marca." }));
      return false;
    }

    setBusyById((prev) => ({ ...prev, [item.id]: true }));
    setFeedbackById((prev) => ({ ...prev, [item.id]: "" }));

    const sendRequest = () =>
      fetch(`/api/marketplace/products/${encodeURIComponent(item.id)}/request-to-buy`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quantity: options.quantity || 1,
          message: options.message || null,
          ageGateAccepted,
        }),
      }).catch(() => null);

    let res = await sendRequest();

    if (!res) {
      setFeedbackById((prev) => ({ ...prev, [item.id]: "No se pudo conectar con el servicio." }));
      setBusyById((prev) => ({ ...prev, [item.id]: false }));
      return false;
    }

    const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; deduplicated?: boolean; loyalty?: { pointsAwarded?: number } | null } | null;
    if (res.status === 401) {
      setFeedbackById((prev) => ({ ...prev, [item.id]: "Necesitás entrar al portal para solicitar este beneficio." }));
      setBusyById((prev) => ({ ...prev, [item.id]: false }));
      window.setTimeout(() => {
        window.location.assign(`/login?consumer=1&next=${encodeURIComponent("/me/marketplace")}`);
      }, 650);
      return false;
    }
    if (!res.ok || !payload?.ok) {
      if (res.status === 403 && payload?.error === "passport_context_required") {
        setFeedbackById((prev) => ({
          ...prev,
          [item.id]: "Falta contexto de Passport: asociá un tap verificado o reclamá ownership antes de solicitar este beneficio.",
        }));
        setBusyById((prev) => ({ ...prev, [item.id]: false }));
        return false;
      }
      const errorLabel = payload?.error ? `Error: ${payload.error}` : "No fue posible registrar la solicitud.";
      setFeedbackById((prev) => ({ ...prev, [item.id]: errorLabel }));
      setBusyById((prev) => ({ ...prev, [item.id]: false }));
      return false;
    }

    setRequestedById((prev) => ({ ...prev, [item.id]: true }));
    const pointsAwarded = Number(payload?.loyalty?.pointsAwarded || 0);
    setFeedbackById((prev) => ({
      ...prev,
      [item.id]: payload?.deduplicated
        ? "Ya tenías una solicitud activa. No duplicamos el lead."
        : pointsAwarded > 0
          ? `Solicitud enviada. Sumaste ${pointsAwarded} puntos y la marca te contactará desde el portal.`
          : "Solicitud enviada. La marca te contactará desde el portal.",
    }));
    setAgeGateById((prev) => ({ ...prev, [item.id]: false }));
    setBusyById((prev) => ({ ...prev, [item.id]: false }));
    return true;
  }

  async function checkoutCart() {
    if (!cartLines.length || cartBusy) return;
    setCartBusy(true);
    setCartStatus("Enviando carrito al CRM de la marca...");
    const orderRef = `cart-${Date.now().toString(36)}`;
    let okCount = 0;
    for (const line of cartLines) {
      const ok = await requestToBuy(line.item, {
        ageGateAccepted: true,
        quantity: line.quantity,
        message: `Carrito ${orderRef}. Método elegido: ${selectedPayment.label}. Total estimado: ARS ${money.format(cartTotals.cash)}${cartTotals.points ? ` + ${cartTotals.points} pts` : ""}.`,
      });
      if (ok) okCount += 1;
    }
    if (okCount) {
      setCart({});
      setCartStatus(`Carrito enviado: ${okCount} ítem${okCount === 1 ? "" : "s"} quedaron en el CRM con método ${selectedPayment.label}.`);
    } else {
      setCartStatus("No se pudo enviar el carrito. Revisá los avisos de cada producto.");
    }
    setCartBusy(false);
  }

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_32%),linear-gradient(135deg,rgba(2,6,23,0.96),rgba(11,18,32,0.94))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Marketplace de la marca</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Comprá, reservá o pedí una experiencia desde tu Passport.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-50/80">
              El carrito no expone datos internos: cada ítem genera una solicitud comercial trazable con método de pago elegido, Passport, puntos y contexto de tap.
            </p>
          </div>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">
            CRM-ready checkout
          </span>
        </div>

        <div className="mt-4 grid gap-2 text-xs text-slate-200 grid-cols-2 sm:grid-cols-5">
          {[
            ["Disponibles", stats.available],
            ["Marcas", stats.brands],
            ["Con puntos", stats.points],
            ["Request-to-buy", stats.requestable],
            ["Age gate", stats.gated],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
              <span className="text-slate-400">{label}</span>
              <b className="mt-1 block text-lg text-white">{value}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(5,12,24,0.98),rgba(7,24,36,0.94)_48%,rgba(21,13,42,0.92))] shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
        <div className="grid min-h-[360px] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative flex min-h-[320px] items-end overflow-hidden p-5 sm:p-7">
            <div className="absolute inset-0">
              <img
                src={showcase.image}
                alt={showcase.title}
                className="h-full w-full scale-105 object-cover opacity-70 transition duration-700"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_28%,rgba(34,211,238,0.18),transparent_30%),linear-gradient(90deg,rgba(2,6,23,0.84),rgba(2,6,23,0.2)_56%,rgba(2,6,23,0.9))]" />
            </div>
            <div className="relative z-10 max-w-xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {showcase.kicker}
              </p>
              <h3 className="mt-4 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">{showcase.title}</h3>
              <p className="mt-4 max-w-lg text-sm leading-6 text-cyan-50/85">{showcase.body}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-100">{showcase.tag}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs font-bold text-slate-200">
                  <MapPin className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
                  {showcase.place}
                </span>
              </div>
            </div>
          </div>

          <div className="relative grid content-between gap-5 border-t border-white/10 p-5 sm:p-7 lg:border-l lg:border-t-0">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Passport commerce</p>
              <h3 className="mt-2 text-2xl font-black text-white">Marketplace vivo, carrito y leads comerciales desde cada tap.</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                El usuario compra, reserva o pide beneficios; la empresa recibe contexto de UID, zona, campaña, canal y método de pago preferido.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Carrito", `${cartTotals.units} ítems`],
                ["Pago", selectedPayment.label],
                ["CRM", "Lead trazable"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
                  <b className="mt-2 block text-sm text-white">{value}</b>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1.5">
                {MARKETPLACE_SHOWCASE_SLIDES.map((slide, index) => (
                  <button
                    key={slide.title}
                    type="button"
                    onClick={() => setActiveSlide(index)}
                    title={`Ver ${slide.title}`}
                    className={`h-2.5 rounded-full transition-all ${activeSlide === index ? "w-10 bg-cyan-300" : "w-2.5 bg-white/20 hover:bg-white/40"}`}
                    aria-label={`Ver slide ${index + 1}`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setActiveSlide((activeSlide + MARKETPLACE_SHOWCASE_SLIDES.length - 1) % MARKETPLACE_SHOWCASE_SLIDES.length)} title="Producto anterior" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-slate-950/70 text-slate-200 hover:border-cyan-300/40">
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setActiveSlide((activeSlide + 1) % MARKETPLACE_SHOWCASE_SLIDES.length)} title="Producto siguiente" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-slate-950/70 text-slate-200 hover:border-cyan-300/40">
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr_340px]">
        <aside className="space-y-5">
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-lg">
            <h3 className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Buscar</h3>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                suppressHydrationWarning
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar producto, aceite, cata..."
                className="w-full rounded-xl border border-white/10 bg-slate-950 py-2.5 pl-9 pr-3 text-xs text-white outline-none transition focus:border-cyan-500/45"
                title="Filtrar productos por nombre, rubro o marca."
              />
            </label>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-lg">
            <h3 className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Rubros</h3>
            <div className="flex flex-col gap-1.5">
              {filterOptions.map((option) => (
                <button
                  suppressHydrationWarning
                  key={option.value}
                  type="button"
                  onClick={() => setKind(option.value)}
                  title={`Ver ${option.label.toLowerCase()} del marketplace.`}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-left text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                    kind === option.value
                      ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300 shadow-[0_4px_12px_rgba(6,182,212,0.1)]"
                      : "border-transparent bg-transparent text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-300/15 bg-emerald-500/10 p-5 shadow-lg">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">Regla comercial</p>
            <p className="mt-2 text-sm leading-6 text-emerald-50/85">
              Comprar no transfiere ownership automáticamente. El NFT o certificado cambia de dueño solo con pago confirmado, validación de la marca y evidencia del producto.
            </p>
          </div>
        </aside>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {filteredItems.map((item, idx) => {
              const status = String(item.stock_status || item.status || "available");
              const requestDisabled = status === "out_of_stock" || item.request_to_buy_enabled === false;
              const requestAlreadySent = requestedById[item.id] === true;
              const currentKind = itemKind(item, idx);
              const visualClass = productVisualClass(currentKind);
              const assetProfile = resolveProductAssetProfile({
                tenantSlug: item.tenant_slug,
                brandName: brandLabel(item),
                productName: item.title,
                bid: item.bid || item.batch,
                vertical: item.vertical || item.kind,
                category: item.category,
                imageUrl: item.imageUrl || item.image_url || item.photoUrl || item.photo_url,
                sku: item.sku,
              });

              let displayImg = assetProfile.primaryImageUrl;
              if (!displayImg || displayImg.includes("pexels") || displayImg.includes("demo/")) {
                displayImg = currentKind === "olive" ? "/images/wine_crate.png" : currentKind === "experience" ? "/images/wine_tasting.png" : "/images/premium_magnum.png";
              }

              return (
                <article key={item.id || `${item.title || idx}`} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-2xl transition duration-300 hover:scale-[1.01] hover:border-cyan-500/45 hover:shadow-[0_15px_40px_rgba(6,182,212,0.12)]">
                  <div className={`relative flex h-48 items-center justify-center border-b border-white/5 p-4 ${visualClass}`}>
                    <div className="absolute left-4 top-4 z-10 rounded-full border border-white/10 bg-slate-950/70 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-slate-300">
                      {status.replaceAll("_", " ")}
                    </div>
                    <div className="absolute right-4 top-4 z-10 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-300">
                      Passport item
                    </div>
                    <img
                      src={displayImg}
                      alt={assetProfile.productName}
                      className="h-36 w-auto object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] transition duration-500 hover:scale-105"
                    />
                  </div>

                  <div className="p-4">
                    <p className="text-sm font-black text-white">{item.title || "Ítem premium"}</p>
                    <p className="mt-1 text-xs text-slate-400">{brandLabel(item)}</p>
                    <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-500/10 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em]">
                        <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-1 text-cyan-100">{currentKind}</span>
                        <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-1 text-emerald-100">{assetProfile.assetScore}/100 assets</span>
                        <span className="rounded-full border border-violet-300/25 bg-violet-400/10 px-2 py-1 text-violet-100">{assetProfile.batchLabel}</span>
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-cyan-50/85">{assetProfile.marketplaceLine}</p>
                    </div>
                    <p className="mt-3 text-lg font-black text-white">{priceLabel(item)}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                      <span className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-center font-semibold uppercase tracking-[0.08em] text-cyan-100">owner</span>
                      <span className="rounded-lg border border-violet-300/20 bg-violet-500/10 px-2 py-1 text-center font-semibold uppercase tracking-[0.08em] text-violet-100">token</span>
                      <span className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-center font-semibold uppercase tracking-[0.08em] text-emerald-100">crm</span>
                    </div>
                    {item.age_gate_required ? (
                      <p className="mt-2 rounded-lg border border-amber-300/20 bg-amber-500/10 p-2 text-[11px] text-amber-100">
                        Requiere confirmación de edad antes de solicitar.
                      </p>
                    ) : null}
                    {ageGateById[item.id] ? (
                      <div className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-3">
                        <p className="text-[11px] font-semibold text-amber-100">
                          Este beneficio queda asociado al Passport y puede requerir validación de la marca.
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            suppressHydrationWarning
                            type="button"
                            onClick={() => requestToBuy(item, { ageGateAccepted: true })}
                            className="rounded-xl border border-amber-300/35 bg-amber-300/15 px-3 py-2 text-[11px] font-black text-amber-100 transition hover:bg-amber-300/25"
                          >
                            Confirmo
                          </button>
                          <button
                            suppressHydrationWarning
                            type="button"
                            onClick={() => {
                              setAgeGateById((prev) => ({ ...prev, [item.id]: false }));
                              setFeedbackById((prev) => ({ ...prev, [item.id]: "" }));
                            }}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black text-slate-300 transition hover:bg-white/10"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                      <button
                        suppressHydrationWarning
                        disabled={requestDisabled}
                        onClick={() => addToCart(item)}
                        title="Agregar este producto al carrito verificado."
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                        Agregar
                      </button>
                      <button
                        suppressHydrationWarning
                        disabled={requestDisabled || busyById[item.id] || requestAlreadySent}
                        onClick={() => requestToBuy(item)}
                        title="Enviar solicitud individual al CRM de la marca."
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {requestAlreadySent ? "Enviado" : busyById[item.id] ? "..." : "Lead"}
                      </button>
                    </div>
                    {feedbackById[item.id] ? <p className="mt-2 text-[11px] text-cyan-100">{feedbackById[item.id]}</p> : null}
                  </div>
                </article>
              );
            })}
            {!filteredItems.length ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 text-sm text-slate-300 md:col-span-2">
                No hay productos para ese filtro.
              </div>
            ) : null}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="sticky top-4 rounded-3xl border border-cyan-300/20 bg-slate-950/85 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Carrito verificado</p>
                <h3 className="mt-1 text-xl font-black text-white">{cartTotals.units} ítem{cartTotals.units === 1 ? "" : "s"}</h3>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-500/10 text-cyan-100">
                <ShoppingCart className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {cartLines.length ? cartLines.map(({ item, quantity }) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-black text-white">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{priceLabel(item)}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-slate-950/60">
                      <button suppressHydrationWarning onClick={() => setCartQuantity(item.id, quantity - 1)} className="p-2 text-slate-300 hover:text-white" title="Quitar una unidad">
                        <Minus className="h-3 w-3" aria-hidden="true" />
                      </button>
                      <span className="min-w-8 text-center text-xs font-black text-white">{quantity}</span>
                      <button suppressHydrationWarning onClick={() => setCartQuantity(item.id, quantity + 1)} className="p-2 text-slate-300 hover:text-white" title="Agregar una unidad">
                        <Plus className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                    <button suppressHydrationWarning onClick={() => setCartQuantity(item.id, 0)} className="text-xs font-bold text-rose-200 hover:text-rose-100">
                      Quitar
                    </button>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
                  Agregá productos o experiencias. El checkout crea leads comerciales, no transfiere ownership sin validación.
                </div>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Total estimado</p>
              <p className="mt-2 text-2xl font-black text-white">ARS {money.format(cartTotals.cash)}</p>
              {cartTotals.points ? <p className="mt-1 text-xs text-cyan-100">+ {cartTotals.points} puntos aplicables</p> : null}
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Método de pago preferido</p>
              {paymentMethods.map((method) => {
                const Icon = method.Icon;
                const active = checkoutMethod === method.id;
                return (
                  <button
                    suppressHydrationWarning
                    key={method.id}
                    type="button"
                    onClick={() => setCheckoutMethod(method.id)}
                    title={method.detail}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                      active ? "border-cyan-300/40 bg-cyan-500/15 text-cyan-50" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>
                      <span className="block text-xs font-black">{method.label}</span>
                      <span className="block text-[10px] text-slate-400">{method.detail}</span>
                    </span>
                    {active ? <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-300" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>

            <button
              suppressHydrationWarning
              disabled={!cartLines.length || cartBusy}
              onClick={checkoutCart}
              title="Crear solicitudes comerciales por cada producto del carrito."
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PackageCheck className="h-4 w-4" aria-hidden="true" />
              {cartBusy ? "Enviando..." : "Enviar carrito al CRM"}
            </button>
            {cartStatus ? <p className="mt-3 text-xs leading-5 text-cyan-100">{cartStatus}</p> : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
