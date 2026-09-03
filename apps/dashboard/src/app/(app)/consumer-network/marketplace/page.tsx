"use client";

import { useEffect, useMemo, useState } from "react";

type Visibility = "network" | "private";
type CheckoutMode = "request" | "external" | "direct";
type MarketplaceAvailability = "loading" | "ready" | "tenant_required" | "upstream_error" | "unreachable" | "invalid_payload";
type MarketplaceSource = "demo" | "production" | "unconfirmed" | "unavailable";

type Item = {
  id: string;
  emoji: string;
  name: string;
  priceArs: number;
  vertical: string;
  checkout: CheckoutMode;
  visibility: Visibility;
};

type Draft = Omit<Item, "id">;

const emptyDraft: Draft = {
  emoji: "NX",
  name: "",
  priceArs: 0,
  vertical: "",
  checkout: "request",
  visibility: "network",
};

const verifiedSignals = [
  { label: "Política de experiencias", value: "Owner-only", body: "Capacidad configurable: tap, contacto u ownership según tenant." },
  { label: "Trust visible", value: "0-100", body: "Score visible para marca y auditor." },
  { label: "Feedback global", value: "Multi-idioma", body: "Traducción automática por mercado." },
];

const socialPreviewExamples = [
  {
    product: "Gran Reserva Malbec",
    stars: "5.0 ejemplo",
    badge: "Ejemplo: titularidad digital confirmada",
    quote: "Ejemplo de cómo se vería una review aprobada con evidencia.",
  },
  {
    product: "Serum premium",
    stars: "4.8 ejemplo",
    badge: "Ejemplo: compra validada",
    quote: "Ejemplo visual de garantía y sello; no es actividad publicada.",
  },
];

function checkoutChip(mode: CheckoutMode) {
  if (mode === "request") {
    return <span className="inline-flex rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">Request to Buy</span>;
  }
  if (mode === "direct") {
    return <span className="inline-flex rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Flujo directo simulado</span>;
  }
  return <span className="inline-flex rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">External URL</span>;
}

function visibilityChip(visibility: Visibility) {
  if (visibility === "network") {
    return <span className="inline-flex rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">Visible en simulación</span>;
  }
  return <span className="inline-flex rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">Oculto</span>;
}

export default function TenantMarketplacePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<MarketplaceAvailability>("loading");
  const [dataSource, setDataSource] = useState<MarketplaceSource>("unavailable");
  const [canWrite, setCanWrite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | Visibility>("all");
  const [importing, setImporting] = useState(false);
  const [tenantScope, setTenantScope] = useState("");
  const [tenantDraft, setTenantDraft] = useState("");
  const [scopeResolved, setScopeResolved] = useState(false);

  const marketplaceApiUrl = (itemId?: string) => {
    const path = itemId ? `/api/tenant-marketplace/${encodeURIComponent(itemId)}` : "/api/tenant-marketplace";
    return tenantScope ? `${path}?tenant=${encodeURIComponent(tenantScope)}` : path;
  };

  const totals = useMemo(() => {
    const publicCount = items.filter((item) => item.visibility === "network").length;
    const directCount = items.filter((item) => item.checkout === "direct").length;
    return { total: items.length, publicCount, directCount };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesVisibility = visibilityFilter === "all" ? true : item.visibility === visibilityFilter;
      const matchesText = q
        ? item.name.toLowerCase().includes(q) || item.vertical.toLowerCase().includes(q)
        : true;
      return matchesVisibility && matchesText;
    });
  }, [items, query, visibilityFilter]);
  const sourceLabel = availability === "loading"
    ? "Cargando fuente"
    : availability !== "ready"
      ? "Fuente no disponible"
      : dataSource === "demo"
        ? "Sandbox / datos demo"
        : dataSource === "production"
          ? "Fuente operativa confirmada"
          : "Fuente sin confirmar";
  const sourceDetail = availability === "ready"
    ? dataSource === "demo"
      ? "Catálogo temporal del sandbox: no representa inventario ni ventas reales y puede reiniciarse con un despliegue."
      : dataSource === "production"
        ? "La API confirmó la procedencia del catálogo."
        : "La API respondió, pero no declaró la procedencia del catálogo."
    : "No se muestran ceros como inventario confirmado mientras la API no esté disponible.";

  useEffect(() => {
    const tenant = new URLSearchParams(window.location.search).get("tenant")?.trim().toLowerCase() || "";
    setTenantScope(tenant);
    setTenantDraft(tenant);
    setScopeResolved(true);
  }, []);

  useEffect(() => {
    if (!scopeResolved) return;
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setAvailability("loading");
      setDataSource("unavailable");
      setCanWrite(false);
      let response: Response;
      try {
        response = await fetch(marketplaceApiUrl(), { cache: "no-store" });
      } catch {
        if (isMounted) {
          setItems([]);
          setAvailability("unreachable");
          setLoading(false);
        }
        return;
      }
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { reason?: unknown } | null;
        if (isMounted) {
          setItems([]);
          if (response.status === 403 && failure?.reason === "tenant_scope_required") {
            setAvailability("tenant_required");
          } else {
            setAvailability("upstream_error");
          }
          setLoading(false);
        }
        return;
      }

      const data = await response.json().catch(() => null) as { items?: unknown; canWrite?: boolean; demoMode?: boolean; dataSource?: string } | null;
      if (!data || !Array.isArray(data.items)) {
        if (isMounted) {
          setItems([]);
          setAvailability("invalid_payload");
          setLoading(false);
        }
        return;
      }
      if (isMounted) {
        setItems(data.items as Item[]);
        setCanWrite(data.canWrite === true);
        setDataSource(data.demoMode === true || data.dataSource === "demo" ? "demo" : data.dataSource === "production" ? "production" : "unconfirmed");
        setAvailability("ready");
        setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [scopeResolved, tenantScope]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const resetEditor = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setIsEditorOpen(false);
  };

  const onCreate = () => {
    if (!canWrite) return;
    setEditingId(null);
    setDraft(emptyDraft);
    setIsEditorOpen(true);
  };

  const onEdit = (item: Item) => {
    setEditingId(item.id);
    setDraft({
      emoji: item.emoji,
      name: item.name,
      priceArs: item.priceArs,
      vertical: item.vertical,
      checkout: item.checkout,
      visibility: item.visibility,
    });
    setIsEditorOpen(true);
  };

  const saveItem = async () => {
    if (!draft.name.trim() || !draft.vertical.trim()) return;
    setSaving(true);
    if (editingId) {
      const response = await fetch(marketplaceApiUrl(editingId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        setNotice("No se pudo guardar el producto.");
        setSaving(false);
        return;
      }
      const data = (await response.json()) as { item: Item };
      setItems((prev) => prev.map((item) => (item.id === editingId ? data.item : item)));
      setNotice("Producto actualizado.");
      resetEditor();
      setSaving(false);
      return;
    }
    const response = await fetch(marketplaceApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!response.ok) {
      setNotice("No se pudo crear el producto.");
      setSaving(false);
      return;
    }
    const data = (await response.json()) as { item: Item };
    setItems((prev) => [data.item, ...prev]);
    setNotice("Producto publicado.");
    resetEditor();
    setSaving(false);
  };

  const toggleVisibility = async (item: Item) => {
    const nextVisibility: Visibility = item.visibility === "network" ? "private" : "network";
    const response = await fetch(marketplaceApiUrl(item.id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: nextVisibility }),
    });
    if (!response.ok) {
      setNotice("No se pudo cambiar la visibilidad.");
      return;
    }
    const data = (await response.json()) as { item: Item };
    setItems((prev) => prev.map((existing) => (existing.id === item.id ? data.item : existing)));
  };

  const deleteItem = async (id: string) => {
    const response = await fetch(marketplaceApiUrl(id), { method: "DELETE" });
    if (!response.ok) {
      setNotice("No se pudo eliminar el producto.");
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
    setNotice("Producto eliminado.");
  };

  const importFromJson = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Array<Omit<Item, "id">>;
      const response = await fetch(marketplaceApiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!response.ok) {
        setNotice("No se pudo importar el JSON.");
        return;
      }
      const data = (await response.json()) as { items: Item[]; imported: number };
      setItems((prev) => [...data.items, ...prev]);
      setNotice(`${data.imported} productos importados.`);
    } catch {
      setNotice("JSON invalido para importar.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6" data-marketplace-availability={availability} data-marketplace-source={dataSource}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Catálogo conectado · Sandbox</h1>
          <p className="mt-1 text-sm text-slate-400">Simulá cómo se configuraría un catálogo por tenant. Nada de esta vista publica inventario ni ventas reales.</p>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">
              {importing ? "Importando..." : "Importar JSON"}
              <input suppressHydrationWarning disabled={importing} type="file" accept="application/json" className="hidden" onChange={(event) => importFromJson(event.target.files?.[0])} />
            </label>
            <button suppressHydrationWarning onClick={onCreate} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
              + Crear producto de prueba
            </button>
          </div>
        ) : (
          <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-200">
            Solo lectura · falta marketplace:write
          </span>
        )}
      </header>

      {availability === "tenant_required" ? (
        <form
          className="grid gap-3 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-5 md:grid-cols-[1fr_auto_auto] md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const nextTenant = tenantDraft.trim().toLowerCase();
            if (!/^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/.test(nextTenant)) {
              setNotice("Ingresá el slug exacto de un tenant.");
              return;
            }
            const url = new URL(window.location.href);
            url.searchParams.set("tenant", nextTenant);
            window.history.replaceState({}, "", url);
            setTenantScope(nextTenant);
          }}
        >
          <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-amber-100">
            Tenant requerido para aislar el catálogo
            <input value={tenantDraft} onChange={(event) => setTenantDraft(event.target.value)} placeholder="Ej.: demobodega" className="rounded-xl border border-amber-200/20 bg-slate-950/70 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-amber-200/50" />
          </label>
          <button type="submit" className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950">Abrir tenant</button>
          <a href="/tenants" className="rounded-xl border border-amber-200/25 px-4 py-2 text-center text-sm font-bold text-amber-50">Ver directorio</a>
        </form>
      ) : null}

      {availability === "ready" && dataSource === "demo" ? (
        <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">
          <strong>Simulación no persistente.</strong> Los productos, estados y totales siguientes sirven para probar el flujo del tenant seleccionado; pueden reiniciarse con un despliegue.
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-200">Productos en este escenario: <b className="text-white">{availability === "ready" ? totals.total : "—"}</b></div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-sm text-emerald-100">Visibles en la simulación: <b>{availability === "ready" ? totals.publicCount : "—"}</b></div>
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-sm text-cyan-100">Flujo directo configurado: <b>{availability === "ready" ? totals.directCount : "—"}</b></div>
      </div>

      <section className="rounded-2xl border border-violet-500/20 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.18),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">Vista previa · ejemplos de prueba social</p>
            <h2 className="mt-2 text-xl font-black text-white">Diseño de reputación sujeto a evidencia y moderación.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Las tarjetas siguientes son fixtures de UX, no reviews del tenant. En producción, una experiencia sólo puede publicarse
              cuando la API confirma evidencia, identidad y política de compra o club.
            </p>
          </div>
          <button suppressHydrationWarning onClick={() => window.location.assign("/loyalty/experiences")} className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-100">
            Gestionar experiencias
          </button>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {verifiedSignals.map((signal) => (
              <div key={signal.label} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{signal.label}</p>
                <p className="mt-2 text-2xl font-black text-white">{signal.value}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{signal.body}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {socialPreviewExamples.map((review) => (
              <article key={review.product} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{review.product}</p>
                    <p className="mt-1 text-xs text-emerald-200">{review.badge}</p>
                  </div>
                  <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-xs font-black text-amber-100">{review.stars}</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-200">&quot;{review.quote}&quot;</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-cyan-100">
                  <span className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-2 py-1">tap</span>
                  <span className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-2 py-1">club</span>
                  <span className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-2 py-1">safe</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <input suppressHydrationWarning value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto o vertical..." className="rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/30" />
        <select suppressHydrationWarning value={visibilityFilter} onChange={(e) => setVisibilityFilter(e.target.value as "all" | Visibility)} className="rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/30">
          <option value="all">Todas las visibilidades</option>
          <option value="network">Visible en simulación</option>
          <option value="private">Oculto</option>
        </select>
      </div>

      <div className="flex items-start gap-4 rounded-xl border border-violet-500/20 bg-violet-950/10 p-6 backdrop-blur-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-400">
          <span className="text-xs font-black">NX</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Estado del catálogo: {sourceLabel}</h3>
          <p className="mt-1 max-w-2xl text-xs text-slate-400">{sourceDetail}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/50">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="border-b border-white/10 bg-slate-800/50 text-xs uppercase tracking-widest text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Tipo / Vertical</th>
              <th className="px-4 py-3 font-medium">Checkout</th>
              <th className="px-4 py-3 font-medium">Visibilidad</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">Cargando productos...</td>
              </tr>
            ) : null}
            {!loading && availability !== "ready" ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-amber-200">{availability === "tenant_required" ? "Elegí un tenant para abrir su sandbox aislado." : "Fuente de marketplace no disponible. Este estado no representa inventario cero."}</td>
              </tr>
            ) : null}
            {filteredItems.map((item) => (
              <tr key={item.id} className="transition-colors hover:bg-white/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded border border-white/10 bg-slate-800">{item.emoji}</div>
                    <div>
                      <p className="font-bold text-white">{item.name}</p>
                      <p className="text-[10px] text-slate-500">${item.priceArs.toLocaleString("es-AR")} ARS</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">{item.vertical}</td>
                <td className="px-4 py-3">{checkoutChip(item.checkout)}</td>
                <td className="px-4 py-3">{visibilityChip(item.visibility)}</td>
                <td className="px-4 py-3 text-right">
                  {canWrite ? (
                    <div className="inline-flex gap-2">
                      <button suppressHydrationWarning onClick={() => toggleVisibility(item)} className="rounded-md border border-white/15 px-2 py-1 text-xs text-slate-200 hover:bg-white/10">
                        {item.visibility === "network" ? "Ocultar" : "Publicar"}
                      </button>
                      <button suppressHydrationWarning onClick={() => onEdit(item)} className="rounded-md border border-cyan-500/20 px-2 py-1 text-xs font-medium text-cyan-400 hover:bg-cyan-500/10">
                        Editar
                      </button>
                      <button suppressHydrationWarning onClick={() => deleteItem(item.id)} className="rounded-md border border-rose-500/20 px-2 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/10">
                        Eliminar
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-slate-500">Solo lectura</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && availability === "ready" && filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">Todavía no hay productos en este escenario.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {isEditorOpen && canWrite ? (
        <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/90 p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-cyan-300">{editingId ? "Editar producto" : "Nuevo producto"}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input suppressHydrationWarning value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nombre del producto" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40" />
            <input suppressHydrationWarning value={draft.vertical} onChange={(e) => setDraft((prev) => ({ ...prev, vertical: e.target.value }))} placeholder="Vertical (Wine, Events, Pharma...)" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40" />
            <input suppressHydrationWarning value={draft.emoji} onChange={(e) => setDraft((prev) => ({ ...prev, emoji: e.target.value }))} placeholder="Emoji" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40" />
            <input suppressHydrationWarning type="number" min={0} value={draft.priceArs} onChange={(e) => setDraft((prev) => ({ ...prev, priceArs: Number(e.target.value) || 0 }))} placeholder="Precio ARS" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40" />
            <select suppressHydrationWarning value={draft.checkout} onChange={(e) => setDraft((prev) => ({ ...prev, checkout: e.target.value as CheckoutMode }))} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40">
              <option value="request">Request to Buy</option>
              <option value="direct">Direct Checkout</option>
              <option value="external">External URL</option>
            </select>
            <select suppressHydrationWarning value={draft.visibility} onChange={(e) => setDraft((prev) => ({ ...prev, visibility: e.target.value as Visibility }))} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40">
              <option value="network">Visible en simulación</option>
              <option value="private">Oculto</option>
            </select>
          </div>
          <div className="mt-4 flex gap-2">
            <button suppressHydrationWarning disabled={saving} onClick={saveItem} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70">
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button suppressHydrationWarning onClick={resetEditor} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/10">
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/30 px-3 py-2 text-xs text-cyan-100">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
