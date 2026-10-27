"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, Minus, PackageCheck, Plus, Search, ShoppingCart, X } from "lucide-react";
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
  cash_price?: number | string | null;
  price_amount?: number | string | null;
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

function publishedCash(item: Listing) {
  const raw = item.cash_price ?? item.price_amount;
  const currency = item.price_currency;
  if ((typeof raw !== "number" && typeof raw !== "string") || raw === "" ||
      (typeof raw === "string" && !/^\d+(?:\.\d+)?$/.test(raw)) ||
      typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 ? { amount, currency } : null;
}

function priceLabel(item: Listing) {
  const points = Number(item.points_price || 0);
  const cash = publishedCash(item);
  if (points && cash) return `${points} puntos + ${cash.currency} ${money.format(cash.amount)}`;
  if (points) return `${points} puntos`;
  if (cash) return `${cash.currency} ${money.format(cash.amount)}`;
  return "Precio a consultar";
}

function brandLabel(item: Listing) {
  return item.brand_name || item.brand || item.tenant_slug || "Marca";
}

function searchText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function itemKind(item: Listing) {
  // Published category metadata takes precedence over words in a brand name.
  const metadata = searchText(`${item.kind || ""} ${item.vertical || ""} ${item.category || ""}`);
  if (/\b(wine|vino|vinos)\b/.test(metadata)) return "wine";
  if (/\b(olive|oliva)\b/.test(metadata)) return "olive";
  if (/\b(experience|experiencia|experiencias)\b/.test(metadata)) return "experience";
  if (/\b(membership|club|vip)\b/.test(metadata)) return "membership";
  const blob = searchText(item.title || "");
  if (blob.includes("oliva") || blob.includes("olive") || blob.includes("arbequina")) return "olive";
  if (blob.includes("cata") || blob.includes("tour") || blob.includes("paseo") || blob.includes("experience")) return "experience";
  if (blob.includes("club") || blob.includes("vip") || blob.includes("membership")) return "membership";
  if (blob.includes("wine") || blob.includes("vino") || blob.includes("malbec") || blob.includes("reserva") || blob.includes("cabernet") || blob.includes("chardonnay")) return "wine";
  return "other";
}

function availabilityLabel(status: string) {
  if (["available", "in_stock"].includes(status.toLowerCase())) return "Disponible según la marca";
  if (status.toLowerCase() === "active") return "Publicado · disponibilidad a confirmar";
  if (["sold_out", "out_of_stock", "unavailable"].includes(status.toLowerCase())) return "Sin disponibilidad";
  return "Disponibilidad no informada";
}

/** Public copy only. Unknown details never leave the response object. */
export function marketplaceRequestErrorLabel(status: number, payload: unknown) {
  const record = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as { error?: unknown; reason?: unknown } : {};
  const error = typeof record.error === "string" ? record.error : "";
  const reason = typeof record.reason === "string" ? record.reason : "";
  const uncertain = "No pudimos confirmar si se registró. Revisá tus solicitudes antes de volver a enviar.";
  if (status === 429) return "Se enviaron varias solicitudes. Esperá un momento y volvé a intentar.";
  if (status === 403 && error === "passport_context_required") {
    return "Para enviar solicitudes a esta marca necesitás una lectura asociada, un producto reclamado o una membresía activa. Revisá tus productos y lecturas antes de volver a enviarla.";
  }
  switch (`${status}:${error}`) {
    case "404:product_not_found":
    case "409:product_not_active":
      return "Este producto ya no está disponible para solicitudes de contacto. Conservamos tu lista; consultá otros productos del catálogo.";
    case "409:brand_not_visible_in_network":
      return "La marca ya no está habilitada para recibir solicitudes desde este catálogo. Conservamos tu lista; consultá otras marcas.";
    case "409:request_to_buy_disabled":
      return "La marca deshabilitó las solicitudes de contacto para este producto. Conservamos tu lista; consultá otro producto del catálogo.";
    case "400:age_gate_ack_required":
      return "La marca requiere confirmación de mayoría de edad. Revisá las condiciones de este producto antes de enviar la solicitud.";
    case "409:marketplace_source_attribution_mismatch":
      return "No pudimos validar la lectura asociada a esta solicitud. Conservamos tu lista; revisá tus lecturas antes de volver a enviarla.";
    case "503:commercial_asset_scope_migration_required":
      return "Las solicitudes de contacto no están habilitadas en este momento. Conservamos tu lista; podés seguir consultando el catálogo.";
    case "503:api_unavailable":
    case "409:request_creation_conflict":
      return uncertain;
  }
  if (status === 503 && ["rate_limit_policy_mismatch", "rate_limit_unavailable"].includes(reason)) {
    return "No podemos recibir solicitudes de contacto en este momento. Conservamos tu lista; podés seguir consultando el catálogo.";
  }
  return uncertain;
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
  const [failedPhotos, setFailedPhotos] = useState<Record<string, string>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const inFlight = useRef(new Set<string>());
  const agePanelPrefix = useId();
  const ageHeadingRefs = useRef(new Map<string, HTMLHeadingElement>());
  const ageInitiators = useRef(new Map<string, HTMLButtonElement>());
  const productHeadingRefs = useRef(new Map<string, HTMLHeadingElement>());
  const listActionRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingAgeFocus = useRef<string | null>(null);
  const pendingAgeReturn = useRef<{ id: string; from: HTMLElement } | null>(null);

  useEffect(() => {
    const openedId = pendingAgeFocus.current;
    pendingAgeFocus.current = null;
    if (openedId && ageGateById[openedId]) {
      const heading = ageHeadingRefs.current.get(openedId);
      if (heading) {
        // A held opening key must not repeat onto the affirmative action.
        heading.focus({ preventScroll: true });
        heading.scrollIntoView({ block: "center", behavior: "instant" });
      }
    }
    const returning = pendingAgeReturn.current;
    pendingAgeReturn.current = null;
    // Only restore focus for this explicit close. A network response must not
    // pull focus away from another control the customer has since chosen.
    if (returning && !ageGateById[returning.id] &&
        (document.activeElement === returning.from || document.activeElement === document.body)) {
      const initiator = ageInitiators.current.get(returning.id);
      const listAction = listActionRefs.current.get(returning.id);
      const target = initiator?.isConnected && !initiator.disabled ? initiator
        : listAction?.isConnected && !listAction.disabled ? listAction : productHeadingRefs.current.get(returning.id);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [ageGateById]);

  function openAgeConfirmation(item: Listing, action: "request" | "list", initiator?: HTMLButtonElement) {
    if (initiator) ageInitiators.current.set(item.id, initiator);
    pendingAgeFocus.current = item.id;
    setAgeGateById((prev) => ({ ...prev, [item.id]: true }));
    setAgeGateActionById((prev) => ({ ...prev, [item.id]: action }));
  }

  function cancelAgeConfirmation(item: Listing, from: HTMLButtonElement) {
    pendingAgeReturn.current = { id: item.id, from };
    setAgeGateById((prev) => ({ ...prev, [item.id]: false }));
    setFeedbackById((prev) => ({ ...prev, [item.id]: "" }));
  }

  const filteredItems = useMemo(() => {
    const q = searchText(query.trim());
    return items.filter((item) => {
      const blob = searchText(`${item.title || ""} ${brandLabel(item)} ${item.kind || ""} ${item.vertical || ""} ${item.category || ""}`);
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
        const cash = publishedCash(line.item);
        if (cash) acc.cashByCurrency[cash.currency] = (acc.cashByCurrency[cash.currency] || 0) + cash.amount * line.quantity;
        acc.points += Number(line.item.points_price || 0) * line.quantity;
        return acc;
      },
      { units: 0, cashByCurrency: {} as Record<string, number>, points: 0 },
    );
  }, [cartLines]);

  function revealList() {
    const heading = listHeadingRef.current;
    if (!heading) return;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: "center", behavior: "instant" });
  }

  function clearFilters() {
    setQuery("");
    setKind("all");
    searchRef.current?.focus({ preventScroll: true });
    searchRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }

  function addToCart(item: Listing, ageGateAccepted = acceptedAgeById[item.id] === true, initiator?: HTMLButtonElement) {
    if (contextUnavailable || cartBusy || busyById[item.id] || !item.id) return;
    if (item.age_gate_required === true && !ageGateAccepted) {
      openAgeConfirmation(item, "list", initiator);
      setFeedbackById((prev) => ({ ...prev, [item.id]: "Confirmá mayoría de edad para agregar este producto a la lista." }));
      return;
    }
    setCart((prev) => ({ ...prev, [item.id]: Math.min(24, Number(prev[item.id] || 0) + 1) }));
    setCartStatus(`${item.title || "Producto"} agregado a la lista de solicitudes.`);
  }

  function setCartQuantity(id: string, quantity: number) {
    if (cartBusy || busyById[id]) return;
    setCart((prev) => {
      const next = { ...prev };
      const normalized = Math.max(0, Math.min(24, quantity));
      if (!normalized) delete next[id];
      else next[id] = normalized;
      return next;
    });
  }

  async function requestToBuy(item: Listing, options: { ageGateAccepted?: boolean; quantity?: number; message?: string } = {}, initiator?: HTMLButtonElement) {
    if (contextUnavailable || tapContextDeniedRef.current || !item.id || inFlight.current.has(item.id) || requestedById[item.id]) return false;
    const needsAgeGate = item.age_gate_required === true;
    const ageGateAccepted = options.ageGateAccepted === true || acceptedAgeById[item.id] === true;
    if (needsAgeGate && !ageGateAccepted) {
      openAgeConfirmation(item, "request", initiator);
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
        const errorLabel = marketplaceRequestErrorLabel(status, payload);
        setFeedbackById((prev) => ({ ...prev, [item.id]: errorLabel }));
        return false;
      }
      setRequestedById((prev) => ({ ...prev, [item.id]: true }));
      if (cart[item.id]) {
        setCart(prev => {
          const remaining = { ...prev };
          delete remaining[item.id];
          return remaining;
        });
        setCartStatus(payload.deduplicated ? "Ya tenías una solicitud activa para este producto." : "Solicitud registrada. La marca debe confirmar disponibilidad y condiciones.");
      }
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
  async function checkoutCart(initiator: HTMLButtonElement) {
    if (contextUnavailable || !cartLines.length || cartBusy) return;
    const unconfirmed = cartLines.find(({ item }) => item.age_gate_required === true && acceptedAgeById[item.id] !== true);
    if (unconfirmed) {
      openAgeConfirmation(unconfirmed.item, "list", initiator);
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

  function confirmAge(item: Listing, from: HTMLButtonElement) {
    if (cartBusy || busyById[item.id]) return;
    pendingAgeReturn.current = { id: item.id, from };
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
      <div className={styles.selectionBar} data-marketplace-selection>
        <div>
          <p className={styles.label}>Tu selección</p>
          <p className={styles.muted} role="status">{cartTotals.units ? `${cartTotals.units} unidad${cartTotals.units === 1 ? "" : "es"} en tu lista` : "Agregá productos para consultar a la marca."}</p>
        </div>
        <button type="button" disabled={!cartLines.length} onClick={revealList} aria-controls="marketplace-request-list" className={styles.button}>
          <ShoppingCart className={styles.icon} aria-hidden="true" /> Ver mi lista <ArrowDown className={styles.icon} aria-hidden="true" />
        </button>
      </div>
      {contextUnavailable ? <div role="status" className={styles.intro}><p>Las consultas desde esta lectura ya no están disponibles. Tu lista se conserva en esta pantalla.</p><a href="/me/marketplace" className={styles.button}>Volver al catálogo</a></div> : null}
      <div className={styles.layout}>
        <aside className={styles.filters} aria-label="Filtros del catálogo">
          <div className={styles.panel}>
            <label htmlFor="marketplace-search" className={styles.label}>Buscar productos</label>
            <div className={styles.search}>
              <Search className={styles.icon} aria-hidden="true" />
              <input ref={searchRef} id="marketplace-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Producto o marca" className={styles.input} type="search" />
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
          <div className={styles.resultBar}>
            <p className={styles.resultCount} aria-live="polite">{filteredItems.length} producto{filteredItems.length === 1 ? "" : "s"}</p>
            {query || kind !== "all" ? <button type="button" onClick={clearFilters} className={styles.button}><X className={styles.icon} aria-hidden="true" /> Limpiar filtros</button> : null}
          </div>
          <div className={styles.products}>
            {filteredItems.map((item, idx) => {
              const status = String(item.stock_status || item.status || "not_reported");
              const requestDisabled = contextUnavailable || !["available", "active", "in_stock"].includes(status.toLowerCase()) || item.request_to_buy_enabled !== true;
              const requestAlreadySent = requestedById[item.id] === true;
              const displayImg = item.imageUrl || item.image_url || item.photoUrl || item.photo_url;
              const photoFailed = Boolean(displayImg && failedPhotos[item.id] === displayImg);
              const agePanelId = `${agePanelPrefix}-${encodeURIComponent(item.id)}-age`;
              const disabledReason = contextUnavailable ? "Las consultas de esta lectura ya no están habilitadas."
                : !["available", "active", "in_stock"].includes(status.toLowerCase()) ? "La marca debe confirmar disponibilidad antes de habilitar consultas."
                : item.request_to_buy_enabled !== true ? "La marca no habilitó solicitudes de contacto para este producto." : null;
              return (
                <article key={item.id || `${item.title || idx}`} className={styles.product} data-marketplace-product={item.id}>
                  <div className={styles.media} data-marketplace-media>
                    {displayImg && !photoFailed ? <img src={displayImg} alt={item.title || "Producto publicado"} className={styles.photo} loading="lazy" decoding="async" onError={() => setFailedPhotos(prev => ({ ...prev, [item.id]: displayImg }))} /> : <p className={styles.noPhoto} role={photoFailed ? "status" : undefined}>{photoFailed ? "No pudimos cargar la foto" : "Foto no publicada"}</p>}
                  </div>
                  <div className={styles.productBody}>
                    <p className={styles.brand}>{brandLabel(item)}</p>
                    <h3 ref={node => { if (node) productHeadingRefs.current.set(item.id, node); else productHeadingRefs.current.delete(item.id); }} tabIndex={-1}>{item.title || "Producto publicado"}</h3>
                    {item.bid || item.batch ? <p className={styles.muted}>Lote publicado: {item.bid || item.batch}</p> : null}
                    <p className={styles.availability}>{availabilityLabel(status)}</p>
                    <p className={styles.price}>{priceLabel(item)}</p>
                    {item.age_gate_required ? <p className={styles.note}>Requiere confirmación de mayoría de edad.</p> : null}
                    {ageGateById[item.id] ? (
                      <div id={agePanelId} className={styles.confirmation} role="group" aria-labelledby={`${agePanelId}-title`}>
                        <h4 id={`${agePanelId}-title`} ref={node => { if (node) ageHeadingRefs.current.set(item.id, node); else ageHeadingRefs.current.delete(item.id); }} tabIndex={-1} className={styles.ageHeading}>{ageGateActionById[item.id] === "list" ? "Confirmá que sos mayor de edad para agregar este producto a tu lista." : "Confirmá que sos mayor de edad para enviar esta solicitud."}</h4>
                        <div className={styles.actions}>
                          <button type="button" aria-describedby={`${agePanelId}-title`} disabled={cartBusy || busyById[item.id]} onClick={event => confirmAge(item, event.currentTarget)} className={`${styles.button} ${styles.primary}`}>Soy mayor de edad</button>
                          <button type="button" onClick={event => cancelAgeConfirmation(item, event.currentTarget)} className={styles.button}>Cancelar</button>
                        </div>
                      </div>
                    ) : null}
                    <div className={styles.actions}>
                      <button type="button" disabled={requestDisabled || cartBusy || busyById[item.id] || requestAlreadySent} onClick={event => requestToBuy(item, { quantity: cart[item.id] || 1 }, event.currentTarget)} aria-expanded={item.age_gate_required === true ? Boolean(ageGateById[item.id]) : undefined} aria-controls={ageGateById[item.id] ? agePanelId : undefined} aria-busy={busyById[item.id] || false} className={`${styles.button} ${styles.primary}`}>
                        {requestAlreadySent ? "Solicitud enviada" : busyById[item.id] ? "Enviando..." : "Solicitar contacto"}
                      </button>
                      {cart[item.id] ? <button type="button" ref={node => { if (node) listActionRefs.current.set(item.id, node); else listActionRefs.current.delete(item.id); }} onClick={revealList} className={styles.button}><ShoppingCart className={styles.icon} aria-hidden="true" /> Ver mi lista · {cart[item.id]} unidad{cart[item.id] === 1 ? "" : "es"}</button>
                        : <button type="button" ref={node => { if (node) listActionRefs.current.set(item.id, node); else listActionRefs.current.delete(item.id); }} disabled={requestDisabled || cartBusy || busyById[item.id] || requestAlreadySent} onClick={event => addToCart(item, undefined, event.currentTarget)} aria-expanded={item.age_gate_required === true ? Boolean(ageGateById[item.id]) : undefined} aria-controls={ageGateById[item.id] ? agePanelId : undefined} className={styles.button}><Plus className={styles.icon} aria-hidden="true" /> Agregar a la lista</button>}
                    </div>
                    {disabledReason ? <p className={styles.note}>{disabledReason}</p> : null}
                    {feedbackById[item.id] ? <p className={styles.feedback} role="status">{feedbackById[item.id]}</p> : null}
                  </div>
                </article>
              );
            })}
            {!filteredItems.length ? <p className={styles.empty}>No encontramos productos con esos filtros. Podés limpiarlos para ver todo el catálogo.</p> : null}
          </div>
        </div>
        <aside id="marketplace-request-list" className={styles.requestList} aria-label="Lista de solicitudes">
          <div className={styles.panel}>
            <div className={styles.listHeading}><ShoppingCart className={styles.icon} aria-hidden="true" /><h3 ref={listHeadingRef} tabIndex={-1}>Tu lista de solicitudes</h3></div>
            <p className={styles.muted}>{cartTotals.units} unidad{cartTotals.units === 1 ? "" : "es"}</p>
            <div className={styles.lines}>
              {cartLines.length ? cartLines.map(({ item, quantity }) => (
                <div key={item.id} className={styles.line} data-marketplace-request-item={item.id}>
                  <p className={styles.lineTitle}>{item.title || "Producto publicado"}</p>
                  <p className={styles.muted}>{priceLabel(item)}</p>
                  <div className={styles.quantityRow}>
                    <div className={styles.quantity}>
                      <button type="button" disabled={cartBusy || busyById[item.id]} onClick={() => setCartQuantity(item.id, quantity - 1)} className={styles.iconButton} aria-label={`Quitar una unidad de ${item.title || "producto"}`}><Minus className={styles.icon} aria-hidden="true" /></button>
                      <span aria-label="Cantidad">{quantity}</span>
                      <button type="button" disabled={cartBusy || busyById[item.id] || quantity >= 24} onClick={() => setCartQuantity(item.id, quantity + 1)} className={styles.iconButton} aria-label={`Agregar una unidad de ${item.title || "producto"}`}><Plus className={styles.icon} aria-hidden="true" /></button>
                    </div>
                    <button type="button" disabled={cartBusy || busyById[item.id]} onClick={() => setCartQuantity(item.id, 0)} className={styles.button} aria-label={`Quitar ${item.title || "producto"} de la lista`}>Quitar</button>
                  </div>
                  {feedbackById[item.id] ? <p className={styles.feedback}>{feedbackById[item.id]}</p> : null}
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
            <button type="button" disabled={contextUnavailable || !cartLines.length || cartBusy} onClick={event => void checkoutCart(event.currentTarget)} aria-busy={cartBusy} className={`${styles.button} ${styles.primary} ${styles.sendList}`}><PackageCheck className={styles.icon} aria-hidden="true" />{cartBusy ? "Enviando..." : "Enviar solicitudes"}</button>
            {cartStatus ? <p className={styles.feedback} role="status">{cartStatus}</p> : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
