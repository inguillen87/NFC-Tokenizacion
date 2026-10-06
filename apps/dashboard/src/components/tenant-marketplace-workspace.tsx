"use client";

import { useEffect, useRef, useState } from "react";
import { productUrls } from "@product/config";
import { blankCatalogFields, buildCatalogCommand, CATALOG_PROTOCOL, catalogErrorCopy, catalogFieldsOf, catalogManaged, catalogReconciliation, catalogState, catalogVisible, isCatalogResource, parseTenantCatalog, type CatalogAction, type CatalogBrand, type CatalogCommand, type CatalogFields, type CatalogKind, type CatalogProduct, type CatalogResource, type TenantCatalog } from "../lib/tenant-marketplace";
import styles from "./tenant-marketplace-workspace.module.css";

const fieldNames: Record<keyof CatalogFields, string> = { title: "Título", description: "Descripción", vertical: "Vertical", category: "Categoría", imageUrl: "Imagen", priceAmount: "Precio", priceCurrency: "Moneda", externalCheckoutUrl: "Compra externa", requestEnabled: "Consultas", ageGateRequired: "Mayoría de edad", displayName: "Nombre de marca", brandSlug: "Identificador público", country: "País", city: "Ciudad" };
function FieldSummary({ kind, fields }: { kind: CatalogKind; fields: CatalogFields }) {
  const keys: Array<keyof CatalogFields> = kind === "brand" ? ["displayName", "brandSlug", "vertical", "description", "country", "city"] : ["title", "description", "vertical", "category", "imageUrl", "priceAmount", "priceCurrency", "requestEnabled", "externalCheckoutUrl", "ageGateRequired"];
  return <dl>{keys.map(key => <div key={key}><dt>{fieldNames[key]}</dt><dd>{fields[key] === "true" ? "Sí" : fields[key] === "false" ? "No" : fields[key] || "Sin informar"}</dd></div>)}</dl>;
}
function putResource(data: TenantCatalog, kind: CatalogKind, item: CatalogResource): TenantCatalog {
  return kind === "brand" ? { ...data, brand: item as CatalogBrand } : { ...data, items: [item as CatalogProduct, ...data.items.filter(row => row.id !== item.id)] };
}

export default function TenantMarketplaceWorkspace({ tenant, canWrite, canSelectTenant, initialData, initialReason = "", isDemo = false }: {
  tenant: string; canWrite: boolean; canSelectTenant: boolean; initialData: TenantCatalog | null; initialReason?: string; isDemo?: boolean;
}) {
  const [data, setData] = useState(initialData), [kind, setKind] = useState<CatalogKind>("product");
  const [resource, setResource] = useState<CatalogResource | null>(initialData?.items[0] || null);
  const [fields, setFields] = useState<CatalogFields>(initialData?.items[0] ? catalogFieldsOf(initialData.items[0], "product") : { ...blankCatalogFields });
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState(initialReason ? catalogErrorCopy(initialReason) : ""), [error, setError] = useState(Boolean(initialReason));
  const [pending, setPending] = useState<{ command: CatalogCommand; baseline: CatalogResource } | null>(null);
  const [reviewed, setReviewed] = useState<CatalogResource | null>(null), [didRead, setDidRead] = useState(false);
  const [confirmAction, setConfirmAction] = useState<CatalogAction | null>(null);
  const lock = useRef(false), notice = useRef<HTMLDivElement>(null);
  const endpoint = `/api/tenant-marketplace?${new URLSearchParams({ tenant })}`;
  const active = resource?.status === "active", restricted = resource ? !catalogManaged(resource) : false;
  const editable = canWrite && !isDemo && Boolean(data && resource) && !active && !restricted && !busy && !uncertain && !conflict;
  const publishable = Boolean(resource?.updatedAt && !active && !restricted && !dirty && !busy && !uncertain && !conflict
    && (kind === "brand" ? "display_name" in resource && resource.display_name.trim() : "title" in resource && resource.title.trim() && catalogVisible(data?.brand || null) && (resource.request_to_buy_enabled || resource.external_checkout_url)));
  useEffect(() => { if (message && error) notice.current?.focus(); }, [message, error]);
  useEffect(() => {
    if (!dirty && !uncertain) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent); return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, uncertain]);
  function inform(text: string, isError = false) { setMessage(text); setError(isError); }
  function adopt(next: CatalogResource | null, nextKind = kind) {
    setKind(nextKind); setResource(next); setFields(next ? catalogFieldsOf(next, nextKind) : { ...blankCatalogFields }); setDirty(false);
    setUncertain(false); setConflict(false); setPending(null); setReviewed(null); setDidRead(false); setConfirmAction(null);
  }
  function choose(next: CatalogResource | null, nextKind = kind) {
    if (busy || dirty || uncertain || conflict) { inform("Tu formulario sigue aquí. Guardá o descartá los cambios antes de cambiar de producto o sección.", true); return; }
    adopt(next, nextKind); inform("");
  }
  function change<K extends keyof CatalogFields>(key: K, value: CatalogFields[K]) {
    if (!editable) return; setFields(current => ({ ...current, [key]: value })); setDirty(true); setConfirmAction(null);
  }
  function create(nextKind: CatalogKind) {
    if (!data || !canWrite || isDemo || busy || dirty || uncertain || conflict) return;
    const common = { id: crypto.randomUUID(), status: "draft", vertical: "", description: null, updatedAt: null };
    const item: CatalogResource = nextKind === "brand" ? { ...common, display_name: "", slug: "", country: null, city: null, visible_in_network: false }
      : { ...common, title: "", category: null, image_url: null, price_amount: null, price_currency: null, external_checkout_url: null, request_to_buy_enabled: false, age_gate_required: false };
    adopt(item, nextKind); setFields({ ...blankCatalogFields }); setDirty(true); inform("Nuevo borrador sin guardar. Todavía no se muestra a clientes.");
  }
  function accepted(item: CatalogResource, action: CatalogAction, nextData: TenantCatalog, text: string) {
    setData(putResource(nextData, kind, item));
    if (action === "withdraw" && dirty) {
      setResource(item); setUncertain(false); setConflict(false); setPending(null); setReviewed(null); setDidRead(false); setConfirmAction(null);
      inform(`${text} Tu formulario se conserva para guardarlo como borrador.`);
    } else { adopt(item); inform(text); }
  }
  async function send(action: CatalogAction, retry = false) {
    if (!canWrite || !data || !resource || isDemo || lock.current || (!retry && (uncertain || conflict))) return;
    let command: CatalogCommand;
    try { command = retry && pending ? pending.command : buildCatalogCommand(kind, action, resource, fields); }
    catch (e) { inform(catalogErrorCopy(e instanceof Error ? e.message : "catalog_invalid"), true); setConfirmAction(null); return; }
    const baseline = retry && pending ? pending.baseline : resource;
    lock.current = true; setBusy(true); setPending({ command, baseline }); setConfirmAction(null); setDidRead(false); setReviewed(null);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command), cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok === true && body.protocol === CATALOG_PROTOCOL && body.tenant === tenant && body.kind === kind && isCatalogResource(kind, body.item) && body.item.id === command.id && catalogReconciliation(body.item, command, baseline) === "matches") {
        accepted(body.item, action, data, action === "publish" ? "Publicación confirmada. El catálogo del cliente aplica también la visibilidad de la marca y sus políticas de acceso." : action === "withdraw" ? "Retiro confirmado. Se conserva el historial de consultas." : "Borrador guardado. Todavía no está publicado.");
      } else if (response.status < 500 && body?.ok === false && typeof body.reason === "string") {
        setPending(null); setUncertain(false); setConflict(response.status === 409); inform(catalogErrorCopy(body.reason), true);
      } else { setUncertain(true); inform("No se confirmó la respuesta. Tu formulario sigue aquí. Consultá el estado guardado antes de continuar; no se reenvía automáticamente.", true); }
    } catch { setUncertain(true); inform("Se interrumpió la respuesta. Tu formulario sigue aquí. Consultá el estado guardado antes de continuar.", true); }
    finally { lock.current = false; setBusy(false); }
  }
  async function refresh() {
    if (!tenant || isDemo || lock.current) return;
    lock.current = true; setBusy(true); setConfirmAction(null); setDidRead(false);
    try {
      const url = new URL(endpoint, window.location.origin);
      if (kind === "product" && resource) url.searchParams.set("id", resource.id);
      const response = await fetch(url.pathname + url.search, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      const body = await response.json().catch(() => null), next = response.ok ? parseTenantCatalog(body, tenant) : null;
      if (!next) { inform(catalogErrorCopy(body?.reason), true); return; }
      const merged = kind === "product" && resource && data ? { ...data, brand: next.brand, items: [...next.items, ...data.items.filter(item => item.id !== resource.id)] } : next;
      setData(merged);
      const saved = kind === "brand" ? next.brand : resource ? next.items.find(item => item.id === resource.id) || null : next.items[0] || null;
      if (uncertain && pending && saved && catalogReconciliation(saved, pending.command, pending.baseline) === "matches"
        && (pending.command.kind !== "product" || pending.command.action !== "publish" || catalogVisible(next.brand))) {
        accepted(saved, pending.command.action, merged, "El estado guardado coincide con el cambio solicitado. No se volvió a enviar.");
      } else if (dirty || uncertain || conflict || resource && saved?.updatedAt !== resource.updatedAt) {
        setReviewed(saved); setDidRead(true); inform("Consulta completada. Tu formulario se conserva; comparalo con la versión guardada antes de continuar.");
      } else { adopt(saved); inform("Estado guardado actualizado."); }
    } catch { inform("No pudimos consultar el estado guardado. Tu formulario sigue aquí; reintentá la consulta.", true); }
    finally { lock.current = false; setBusy(false); }
  }
  function rebase() {
    if (!reviewed || busy) return;
    setResource(reviewed); setConflict(false); setUncertain(false); setPending(null); setReviewed(null); setDidRead(false); setDirty(true);
    inform(reviewed.status === "active" ? "Tu formulario se conserva sobre la versión consultada. Retirá esta publicación antes de guardarlo." : "Tu formulario se conserva sobre la versión consultada. Revisalo y guardá el borrador.");
  }
  const retryAllowed = uncertain && didRead && pending && catalogReconciliation(reviewed, pending.command, pending.baseline) === "retry_allowed";
  const customerUrl = `${productUrls.web}/me/marketplace?${new URLSearchParams({ tenant })}`;
  return <main className={styles.root} data-testid="tenant-marketplace-workspace">
    <header className={styles.header}><div><p className={styles.eyebrow}>Catálogo de la marca</p><h1>Productos para tus clientes</h1><p>Guardá un borrador, revisá su contenido y publicalo cuando esté listo. Una consulta no realiza un pago ni reserva stock.</p></div><span className={styles.scope}>{tenant || "Empresa sin seleccionar"}</span></header>
    {canSelectTenant && <form action="/consumer-network/marketplace" method="GET" className={styles.tenantForm}><label>Empresa autorizada<input name="tenant" defaultValue={tenant} maxLength={128} required placeholder="Identificador de la empresa" /></label><button type="submit" disabled={dirty || uncertain || busy}>Consultar empresa</button><a className={styles.link} href="/tenants">Ver empresas</a></form>}
    {isDemo ? <p className={styles.notice}>La demostración no consulta ni modifica el catálogo de clientes.</p> : !tenant ? <p className={styles.notice}>Elegí una empresa para consultar su catálogo. No se usa un catálogo global como reemplazo.</p> : <>
      {!canWrite && <p className={styles.notice}>Tenés acceso de consulta. Este perfil no puede guardar, publicar ni retirar productos o marcas.</p>}
      <div className={styles.toolbar}><button type="button" disabled={busy} onClick={() => void refresh()}>{busy ? "Consultando…" : "Consultar estado guardado"}</button><a className={styles.link} href={customerUrl} target="_blank" rel="noopener noreferrer">Abrir catálogo del cliente</a></div>
      {message && <div ref={notice} tabIndex={-1} role={error ? "alert" : "status"} className={error ? styles.error : styles.notice} data-testid="tenant-catalog-message">{message}</div>}
      {!data ? <section className={styles.empty} data-testid="tenant-catalog-unavailable"><h2>Catálogo no disponible</h2><p>No recibimos una colección válida. Reintentá la consulta; este estado no significa que no haya productos.</p></section> : <>
        <section className={styles.notice} data-testid="tenant-catalog-brand-dependency"><strong>{catalogVisible(data.brand) ? "Marca publicada y visible en la red" : "Falta publicar una marca visible en la red"}</strong><p>El cliente solo ve productos activos de una marca activa y visible. Habilitar el servicio de compra después de una lectura requiere además el catálogo y una lectura apta.</p><button type="button" disabled={busy} onClick={() => choose(data.brand, "brand")}>Revisar perfil de la marca</button></section>
        <div className={styles.tabs} aria-label="Sección del catálogo"><button type="button" aria-pressed={kind === "product"} onClick={() => choose(data.items[0] || null, "product")}>Productos</button><button type="button" aria-pressed={kind === "brand"} onClick={() => choose(data.brand, "brand")}>Perfil de la marca</button></div>
        {kind === "product" && <section aria-label="Productos guardados"><div className={styles.title}><h2>Productos guardados</h2>{canWrite && <button type="button" disabled={busy || dirty || uncertain || conflict} onClick={() => create("product")}>Crear borrador de producto</button>}</div>{data.hasMore && <p className={styles.notice}>Se muestran los primeros 100 productos. La consulta de estado verifica el identificador del producto seleccionado.</p>}{!data.items.length && <p className={styles.empty}>La fuente confirmó que todavía no hay productos guardados para esta empresa.</p>}<div className={styles.products}>{data.items.map(item => <article key={item.id} className={styles.product}><span className={styles.badge}>{catalogState(item, data.brand)}</span><h3>{item.title || "Borrador sin título"}</h3><p>{item.vertical || "Vertical sin informar"}</p><button type="button" aria-pressed={resource?.id === item.id} disabled={busy || uncertain || conflict} onClick={() => choose(item)}>Revisar {item.title || "borrador"}</button></article>)}</div></section>}
        {kind === "brand" && !resource && <section className={styles.empty}><h2>Perfil de marca pendiente</h2><p>Creá un borrador con el nombre y el identificador público que verá el cliente. Publicarlo hará visible la marca en la red.</p>{canWrite && <button type="button" disabled={busy} onClick={() => create("brand")}>Crear borrador de marca</button>}</section>}
        {resource && <section className={styles.card} data-testid="tenant-catalog-editor"><div className={styles.title}><h2>{kind === "brand" ? "Perfil de la marca" : "Contenido del producto"}</h2><span className={styles.badge}>{resource.updatedAt ? catalogState(resource, data.brand) : "Borrador sin guardar"}</span></div>{active && <p className={styles.notice}>Esta versión está publicada. Retirala antes de editar; el historial de consultas se conserva.</p>}{restricted && <p className={styles.notice} data-testid="tenant-catalog-restricted">Esta versión requiere revisión autorizada. Este editor no puede modificar, publicar ni reactivar su estado.</p>}
          <fieldset disabled={!editable} className={styles.fields}><legend className={styles.note}>Los cambios se muestran a clientes después de guardar y publicar.</legend>
            {kind === "brand" ? <><label>Nombre de la marca<input value={fields.displayName} maxLength={160} onChange={e => change("displayName", e.target.value)} /></label><label>Identificador público de la marca<input value={fields.brandSlug} maxLength={120} onChange={e => change("brandSlug", e.target.value)} /><span className={styles.note}>Minúsculas, números, punto, guion o guion bajo. No cambia la empresa autorizada de esta sesión.</span></label></> : <label>Título del producto<input value={fields.title} maxLength={160} onChange={e => change("title", e.target.value)} /></label>}
            <label>Vertical<input value={fields.vertical} maxLength={40} placeholder="Por ejemplo: wine, events o cosmetics" onChange={e => change("vertical", e.target.value)} /></label><label>Descripción<textarea value={fields.description} maxLength={6000} onChange={e => change("description", e.target.value)} /></label>
            {kind === "brand" ? <div className={styles.grid}><label>País (opcional)<input value={fields.country} maxLength={80} onChange={e => change("country", e.target.value)} /></label><label>Ciudad (opcional)<input value={fields.city} maxLength={120} onChange={e => change("city", e.target.value)} /></label></div> : <>
              <label>Categoría (opcional)<input value={fields.category} maxLength={120} onChange={e => change("category", e.target.value)} /></label><label>Imagen (opcional)<input value={fields.imageUrl} maxLength={2048} onChange={e => change("imageUrl", e.target.value)} /><span className={styles.note}>URL pública HTTPS o una ruta existente bajo /assets/. La vista previa no descarga imágenes externas.</span></label>
              <div className={styles.grid}><label>Precio informado (opcional)<input inputMode="decimal" value={fields.priceAmount} onChange={e => change("priceAmount", e.target.value)} placeholder="0.00" /></label><label>Moneda del precio<input value={fields.priceCurrency} maxLength={3} onChange={e => change("priceCurrency", e.target.value.toUpperCase())} placeholder="Código de tres letras" /></label></div><p className={styles.note}>Informá precio y moneda juntos, o dejá ambos vacíos. No se ejecuta un cobro.</p>
              <label>¿Permitir consultas a la marca?<select value={fields.requestEnabled} onChange={e => change("requestEnabled", e.target.value as CatalogFields["requestEnabled"])}><option value="">Elegí una opción</option><option value="true">Sí, permitir solicitudes de contacto</option><option value="false">No permitir solicitudes de contacto</option></select></label><label>Enlace de compra externo (opcional)<input value={fields.externalCheckoutUrl} maxLength={2048} onChange={e => change("externalCheckoutUrl", e.target.value)} /><span className={styles.note}>URL pública HTTPS. La operación ocurre en ese sitio; NexID no la confirma ni reserva stock.</span></label><label>¿Exigir confirmación de mayoría de edad?<select value={fields.ageGateRequired} onChange={e => change("ageGateRequired", e.target.value as CatalogFields["ageGateRequired"])}><option value="">Elegí una opción</option><option value="true">Sí, exigir confirmación</option><option value="false">No exigir confirmación</option></select></label>
            </>}
          </fieldset>
          {canWrite && !restricted && <div className={styles.actions}>{active ? <button type="button" disabled={busy || uncertain || conflict} onClick={() => setConfirmAction("withdraw")}>Retirar publicación</button> : <><button type="button" disabled={!editable || !dirty} onClick={() => void send("save_draft")}>Guardar borrador</button><button type="button" className={styles.primary} disabled={!publishable} onClick={() => setConfirmAction("publish")}>Publicar versión guardada</button></>}{dirty && <p className={styles.note}>Tu formulario tiene cambios sin guardar. Publicar utiliza una versión guardada.</p>}{dirty && !uncertain && !conflict && <button type="button" disabled={busy} onClick={() => { const saved = kind === "brand" ? data.brand : data.items.find(item => item.id === resource.id) || null; adopt(saved); inform("Cambios del formulario descartados. La versión guardada se conserva."); }}>Descartar cambios del formulario</button>}</div>}
          {kind === "product" && !catalogVisible(data.brand) && <p className={styles.notice}>Para publicar este producto, guardá y publicá primero el perfil de la marca con visibilidad en la red.</p>}
          {confirmAction && <section className={styles.confirm} role="group" aria-label="Confirmar publicación del catálogo"><h3>{confirmAction === "withdraw" ? "Retirar esta publicación" : kind === "brand" ? "Publicar la marca en la red" : "Publicar este producto"}</h3><p>{confirmAction === "withdraw" ? kind === "brand" ? "La marca dejará de estar visible y sus productos se ocultarán del catálogo público. Las solicitudes anteriores conservan su historial." : "Este producto dejará de aparecer en el catálogo público. Las solicitudes anteriores conservan su historial." : kind === "brand" ? "Publicará la versión guardada y habilitará explícitamente su visibilidad en la red. Los productos requieren su propia publicación." : "La versión guardada aparecerá en el catálogo de esta marca. Aplican sus opciones de consulta, sitio externo y mayoría de edad; no crea una compra, saldo ni recompensa."}</p><div className={styles.actions}><button type="button" className={styles.primary} disabled={busy} onClick={() => void send(confirmAction)}>{confirmAction === "withdraw" ? "Confirmar retiro" : "Confirmar publicación"}</button><button type="button" disabled={busy} onClick={() => setConfirmAction(null)}>Cancelar</button></div></section>}
        </section>}
        {resource && <section className={styles.preview} data-testid="tenant-catalog-preview"><span className={styles.badge}>Vista previa del formulario · sin publicar</span><h2>{kind === "brand" ? fields.displayName || "Marca sin nombre" : fields.title || "Producto sin título"}</h2><p className={styles.note}>Permite revisar el contenido escrito. El catálogo abierto del cliente muestra la versión publicada y aplica sus reglas de acceso.</p><FieldSummary kind={kind} fields={fields} /></section>}
        {didRead && <section className={styles.compare} data-testid="tenant-catalog-comparison"><h2>Comparar antes de continuar</h2><div className={styles.columns}><div><h3>Tu formulario</h3><FieldSummary kind={kind} fields={fields} /></div><div><h3>Versión guardada</h3>{reviewed ? <><p>{catalogState(reviewed, data.brand)}</p><FieldSummary kind={kind} fields={catalogFieldsOf(reviewed, kind)} /></> : <p>No se encontró este identificador en el catálogo de la empresa.</p>}</div></div><div className={styles.actions}>{retryAllowed && <button type="button" disabled={busy} onClick={() => pending && void send(pending.command.action, true)}>Reintentar el mismo cambio</button>}{reviewed && catalogManaged(reviewed) && <button type="button" disabled={busy} onClick={rebase}>Mantener mi formulario sobre esta versión</button>}<button type="button" disabled={busy} onClick={() => { adopt(reviewed); inform("Se usa la versión consultada; los cambios del formulario se descartaron."); }}>Usar versión guardada y descartar mi formulario</button></div></section>}
      </>}
    </>}
  </main>;
}
