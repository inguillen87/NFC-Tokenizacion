"use client";

import { useMemo, useRef, useState } from "react";
import { Minus, PackageCheck, Plus, Search, ShoppingCart } from "lucide-react";
import styles from "./marketplace.module.css";
import { sendMarketplaceRequest } from "./marketplace-request";
import { normalizeSafeReturnPath } from "@product/config/safe-return-path";
import { normalizeConsumerAuthReturnPath } from "../../login/consumer-login-continuation";

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

const money = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

const filterOptions = [
  { value: "all", label: "Todo" },
  { value: "wine", label: "Vinos" },
  { value: "olive", label: "Oliva" },
  { value: "experience", label: "Experiencias" },
  { value: "membership", label: "Club" },
  { value: "gated", label: "Con confirmación de edad" },
];

function priceValue(item: Listing) {
  return Number(item.cash_price || item.price_amount || 0);
}

function priceLabel(item: Listing) {
  const points = Number(item.points_price || 0);
  const cash = priceValue(item);
  const currency = item.price_currency || "ARS";
  if (points && cash) return `${points} puntos + ${currency} ${money.format(cash)}`;
  if (points) return `${points} puntos`;
  if (cash) return `${currency} ${money.format(cash)}`;
  return "Precio a consultar";
}

function brandLabel(item: Listing) {
  return item.brand_name || item.brand || item.tenant_slug || "Marca";
}

function itemKind(item: Listing) {
  const blob = `${item.title || ""} ${brandLabel(item)} ${item.kind || ""} ${item.vertical || ""} ${item.category || ""}`.toLowerCase();
  if (blob.includes("oliva") || blob.includes("olive") || blob.includes("arbequina")) return "olive";
  if (blob.includes("cata") || blob.includes("tour") || blob.includes("paseo") || blob.includes("experience")) return "experience";
  if (blob.includes("club") || blob.includes("vip") || blob.includes("membership")) return "membership";
  if (blob.includes("wine") || blob.includes("vino") || blob.includes("malbec") || blob.includes("reserva") || blob.includes("cabernet") || blob.includes("chardonnay")) return "wine";
  return "other";
}

function availabilityLabel(status: string) {
  if (["available", "active", "in_stock"].includes(status.toLowerCase())) return "Disponible según la marca";
  if (["sold_out", "out_of_stock", "unavailable"].includes(status.toLowerCase())) return "Sin disponibilidad";
  return "Disponibilidad no informada";
}

export function MarketplaceGridClient({ items, postTapEventId }: { items: Listing[]; postTapEventId?: string }) {
  const validTapContext = typeof postTapEventId === "string" && /^[1-9]\d{0,15}$/.test(postTapEventId) && Number.isSafeInteger(Number(postTapEventId));
  const [tapContextDenied, setTapContextDenied] = useState(false);
  const tapContextDeniedRef = useRef(false);
  const contextUnavailable = postTapEventId !== undefined && (!validTapContext || tapContextDenied);
  const [busyById, setBusyById] = useState<Record<string, boolean>>({});
  const [feedbackById, setFeedbackById] = useState<Record<string, string>>({});
  const [ageGateById, setAgeGateById] = useState<Record<string, boolean>>({});
  const [acceptedAgeById, setAcceptedAgeById] = useState<Record<string, boolean>>({});
  const [ageGateActionById, setAgeGateActionById] = useState<Record<string, "request" | "list">>({});
  const [requestedById, setRequestedById] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartStatus, setCartStatus] = useState("");
  const [cartBusy, setCartBusy] = useState(false);
  const inFlight = useRef(new Set<string>());

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const blob = `${item.title || ""} ${brandLabel(item)} ${item.kind || ""} ${item.vertical || ""} ${item.category || ""}`.toLowerCase();
      const currentKind = itemKind(item);
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
        const currency = line.item.price_currency || "ARS";
        const cash = priceValue(line.item) * line.quantity;
        if (cash) acc.cashByCurrency[currency] = (acc.cashByCurrency[currency] || 0) + cash;
        acc.points += Number(line.item.points_price || 0) * line.quantity;
        return acc;
      },
      { units: 0, cashByCurrency: {} as Record<string, number>, points: 0 },
    );
  }, [cartLines]);

  function addToCart(item: Listing, ageGateAccepted = acceptedAgeById[item.id] === true) {
    if (contextUnavailable || !item.id) return;
    if (item.age_gate_required === true && !ageGateAccepted) {
      setAgeGateById((prev) => ({ ...prev, [item.id]: true }));
      setAgeGateActionById((prev) => ({ ...prev, [item.id]: "list" }));
      setFeedbackById((prev) => ({ ...prev, [item.id]: "Confirmá mayoría de edad para agregar este producto a la lista." }));
      return;
    }
    setCart((prev) => ({ ...prev, [item.id]: Math.min(24, Number(prev[item.id] || 0) + 1) }));
    setCartStatus(`${item.title || "Producto"} agregado a la lista de solicitudes.`);
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
    if (contextUnavailable || tapContextDeniedRef.current || !item.id || inFlight.current.has(item.id) || requestedById[item.id]) return false;
    const needsAgeGate = item.age_gate_required === true;
    const ageGateAccepted = options.ageGateAccepted === true || acceptedAgeById[item.id] === true;
    if (needsAgeGate && !ageGateAccepted) {
      setAgeGateById((prev) => ({ ...prev, [item.id]: true }));
      setAgeGateActionById((prev) => ({ ...prev, [item.id]: "request" }));
      setFeedbackById((prev) => ({ ...prev, [item.id]: "Confirmá mayoría de edad para enviar la solicitud a la marca." }));
      return false;
    }

    inFlight.current.add(item.id);
    setBusyById((prev) => ({ ...prev, [item.id]: true }));
    setFeedbackById((prev) => ({ ...prev, [item.id]: "" }));

    try {
      const result = await sendMarketplaceRequest(`/api/marketplace/products/${encodeURIComponent(item.id)}/request-to-buy`, {
        quantity: options.quantity || 1, message: options.message || null, ageGateAccepted,
        ...(validTapContext ? { postTapEventId } : {}),
      });
      if (result.kind === "uncertain") {
        setFeedbackById((prev) => ({ ...prev, [item.id]: "No pudimos confirmar si se registró. Revisá tus solicitudes antes de volver a enviar." }));
        return false;
      }
      const { status, ok, payload } = result;
      if (status === 401) {
        setFeedbackById((prev) => ({ ...prev, [item.id]: "Entrá al portal para enviar tu solicitud a la marca." }));
        const next = normalizeConsumerAuthReturnPath(normalizeSafeReturnPath(window.location.pathname + window.location.search, "/me/marketplace"));
        window.setTimeout(() => {
          window.location.assign(`/login?consumer=1&next=${encodeURIComponent(next)}`);
        }, 650);
        return false;
      }
      if (!ok || !payload.ok) {
        if (validTapContext && ["marketplace_configuration_changed", "marketplace_tap_context_required", "invalid_post_tap_event_id"].includes(payload.error || "")) {
          tapContextDeniedRef.current = true;
          setTapContextDenied(true);
          setFeedbackById(prev => ({ ...prev, [item.id]: "Esta consulta ya no está habilitada para tu lectura. Conservamos tu lista; revisá el catálogo antes de volver a enviar." }));
          return false;
        }
        const errorLabel = status === 403 && payload.error === "passport_context_required"
          ? "Primero asociá una lectura a tu Passport desde el formulario de esta página y luego volvé a intentar."
          : status === 429
            ? "Se enviaron varias solicitudes. Esperá un momento y volvé a intentar."
            : "No fue posible registrar la solicitud. Revisá la disponibilidad o volvé a intentar más tarde.";
        setFeedbackById((prev) => ({ ...prev, [item.id]: errorLabel }));
        return false;
      }
      setRequestedById((prev) => ({ ...prev, [item.id]: true }));
      setFeedbackById((prev) => ({
        ...prev,
        [item.id]: payload.deduplicated
          ? "Ya tenías una solicitud activa para este producto."
          : "Solicitud registrada. La marca debe confirmar disponibilidad y condiciones.",
      }));
      setAgeGateById((prev) => ({ ...prev, [item.id]: false }));
      return true;
    } finally {
      inFlight.current.delete(item.id);
      setBusyById((prev) => ({ ...prev, [item.id]: false }));
    }
  }
  async function checkoutCart() {
    if (contextUnavailable || !cartLines.length || cartBusy) return;
    const unconfirmed = cartLines.find(({ item }) => item.age_gate_required === true && acceptedAgeById[item.id] !== true);
    if (unconfirmed) {
      setAgeGateById((prev) => ({ ...prev, [unconfirmed.item.id]: true }));
      setAgeGateActionById((prev) => ({ ...prev, [unconfirmed.item.id]: "list" }));
      setCartStatus("Confirmá mayoría de edad en el producto indicado antes de enviar la lista.");
      return;
    }
    setCartBusy(true);
    setCartStatus("Enviando solicitudes a la marca...");
    const orderRef = `cart-${Date.now().toString(36)}`;
    const successfulIds = new Set<string>();
    let okCount = 0;
    for (const line of cartLines) {
      const ok = await requestToBuy(line.item, {
        ageGateAccepted: acceptedAgeById[line.item.id] === true,
        quantity: line.quantity,
        message: `Lista de solicitudes ${orderRef}. Cantidad: ${line.quantity}. Consultar disponibilidad y condiciones.`,
      });
      if (ok) {
        successfulIds.add(line.item.id);
        okCount += 1;
      }
    }
    if (okCount) {
      setCart((prev) => {
        const remaining = { ...prev };
        for (const line of cartLines) {
          if (successfulIds.has(line.item.id)) delete remaining[line.item.id];
        }
        return remaining;
      });
      setCartStatus(`${okCount} solicitud${okCount === 1 ? " registrada" : "es registradas"}. La marca debe confirmar disponibilidad y condiciones.${okCount < cartLines.length ? " Los productos pendientes siguen en tu lista." : ""}`);
    } else {
      setCartStatus("No se pudieron enviar las solicitudes. Revisá los avisos de cada producto.");
    }
    setCartBusy(false);
  }

  function confirmAge(item: Listing) {
    setAcceptedAgeById((prev) => ({ ...prev, [item.id]: true }));
    setAgeGateById((prev) => ({ ...prev, [item.id]: false }));
    setFeedbackById((prev) => ({ ...prev, [item.id]: "" }));
    if (ageGateActionById[item.id] === "list") addToCart(item, true);
    else void requestToBuy(item, { ageGateAccepted: true });
  }

  return (
    <section className={styles.catalog} data-marketplace-catalog>
      <header className={styles.intro}>
        <div>
          <h2>Productos publicados</h2>
          <p>Elegí un producto y solicitá contacto con la marca para consultar disponibilidad y condiciones.</p>
        </div>
        <p className={styles.note}>Las solicitudes no realizan un pago ni reservan stock.</p>
      </header>
      {contextUnavailable ? <div role="status" className={styles.intro}><p>Las consultas desde esta lectura ya no están disponibles. Tu lista se conserva en esta pantalla.</p><a href="/me/marketplace" className={styles.button}>Consultar el catálogo general</a></div> : null}
      <div className={styles.layout}>
        <aside className={styles.filters} aria-label="Filtros del catálogo">
          <div className={styles.panel}>
            <label htmlFor="marketplace-search" className={styles.label}>Buscar productos</label>
            <div className={styles.search}>
              <Search className={styles.icon} aria-hidden="true" />
              <input id="marketplace-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Producto o marca" className={styles.input} type="search" />
            </div>
            <div className={styles.filterList} aria-label="Rubros">
              {filterOptions.map((option) => (
                <button key={option.value} type="button" onClick={() => setKind(option.value)} aria-pressed={kind === option.value} className={`${styles.button} ${styles.filterButton}`}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
        <div>
          <p className={styles.resultCount} aria-live="polite">{filteredItems.length} producto{filteredItems.length === 1 ? "" : "s"}</p>
          <div className={styles.products}>
            {filteredItems.map((item, idx) => {
              const status = String(item.stock_status || item.status || "not_reported");
              const requestDisabled = contextUnavailable || !["available", "active", "in_stock"].includes(status.toLowerCase()) || item.request_to_buy_enabled !== true;
              const requestAlreadySent = requestedById[item.id] === true;
              const displayImg = item.imageUrl || item.image_url || item.photoUrl || item.photo_url;
              return (
                <article key={item.id || `${item.title || idx}`} className={styles.product} data-marketplace-product={item.id}>
                  <div className={styles.media} data-marketplace-media>
                    {displayImg ? <img src={displayImg} alt={item.title || "Producto publicado"} className={styles.photo} loading="lazy" /> : <p className={styles.noPhoto}>Foto no publicada</p>}
                  </div>
                  <div className={styles.productBody}>
                    <p className={styles.brand}>{brandLabel(item)}</p>
                    <h3>{item.title || "Producto publicado"}</h3>
                    {item.bid || item.batch ? <p className={styles.muted}>Lote publicado: {item.bid || item.batch}</p> : null}
                    <p className={styles.availability}>{availabilityLabel(status)}</p>
                    <p className={styles.price}>{priceLabel(item)}</p>
                    {item.age_gate_required ? <p className={styles.note}>Requiere confirmación de mayoría de edad.</p> : null}
                    {ageGateById[item.id] ? (
                      <div className={styles.confirmation}>
                        <p>Confirmá que sos mayor de edad para enviar esta solicitud.</p>
                        <div className={styles.actions}>
                          <button type="button" onClick={() => confirmAge(item)} className={`${styles.button} ${styles.primary}`}>Soy mayor de edad</button>
                          <button type="button" onClick={() => { setAgeGateById((prev) => ({ ...prev, [item.id]: false })); setFeedbackById((prev) => ({ ...prev, [item.id]: "" })); }} className={styles.button}>Cancelar</button>
                        </div>
                      </div>
                    ) : null}
                    <div className={styles.actions}>
                      <button type="button" disabled={requestDisabled || busyById[item.id] || requestAlreadySent} onClick={() => requestToBuy(item)} aria-busy={busyById[item.id] || false} className={`${styles.button} ${styles.primary}`}>
                        {requestAlreadySent ? "Solicitud enviada" : busyById[item.id] ? "Enviando..." : "Solicitar contacto"}
                      </button>
                      <button type="button" disabled={requestDisabled || requestAlreadySent} onClick={() => addToCart(item)} className={styles.button}><Plus className={styles.icon} aria-hidden="true" /> Agregar a la lista</button>
                    </div>
                    {feedbackById[item.id] ? <p className={styles.feedback} role="status">{feedbackById[item.id]}</p> : null}
                  </div>
                </article>
              );
            })}
            {!filteredItems.length ? <p className={styles.empty}>No hay productos para ese filtro. Probá otra búsqueda.</p> : null}
          </div>
        </div>
        <aside className={styles.requestList} aria-label="Lista de solicitudes">
          <div className={styles.panel}>
            <div className={styles.listHeading}><ShoppingCart className={styles.icon} aria-hidden="true" /><h3>Tu lista de solicitudes</h3></div>
            <p className={styles.muted}>{cartTotals.units} unidad{cartTotals.units === 1 ? "" : "es"}</p>
            <div className={styles.lines}>
              {cartLines.length ? cartLines.map(({ item, quantity }) => (
                <div key={item.id} className={styles.line}>
                  <p className={styles.lineTitle}>{item.title || "Producto publicado"}</p>
                  <p className={styles.muted}>{priceLabel(item)}</p>
                  <div className={styles.quantityRow}>
                    <div className={styles.quantity}>
                      <button type="button" onClick={() => setCartQuantity(item.id, quantity - 1)} className={styles.iconButton} aria-label={`Quitar una unidad de ${item.title || "producto"}`}><Minus className={styles.icon} aria-hidden="true" /></button>
                      <span aria-label="Cantidad">{quantity}</span>
                      <button type="button" onClick={() => setCartQuantity(item.id, quantity + 1)} className={styles.iconButton} aria-label={`Agregar una unidad de ${item.title || "producto"}`}><Plus className={styles.icon} aria-hidden="true" /></button>
                    </div>
                    <button type="button" onClick={() => setCartQuantity(item.id, 0)} className={styles.button}>Quitar</button>
                  </div>
                </div>
              )) : <p className={styles.empty}>Agregá productos para consultar por varios en una sola lista.</p>}
            </div>
            {cartLines.length ? (
              <div className={styles.estimate}>
                <p className={styles.label}>Precios publicados de la selección</p>
                {Object.entries(cartTotals.cashByCurrency).map(([currency, cash]) => <p key={currency}>{currency} {money.format(cash)}</p>)}
                {cartTotals.points ? <p>{cartTotals.points} puntos según el catálogo</p> : null}
                <p className={styles.note}>La marca confirma el precio final y la disponibilidad. No se realiza ningún cobro desde esta lista.</p>
              </div>
            ) : null}
            <button type="button" disabled={contextUnavailable || !cartLines.length || cartBusy} onClick={checkoutCart} aria-busy={cartBusy} className={`${styles.button} ${styles.primary} ${styles.sendList}`}><PackageCheck className={styles.icon} aria-hidden="true" />{cartBusy ? "Enviando..." : "Enviar solicitudes"}</button>
            {cartStatus ? <p className={styles.feedback} role="status">{cartStatus}</p> : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
