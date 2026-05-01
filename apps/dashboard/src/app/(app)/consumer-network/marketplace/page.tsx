"use client";

import { useEffect, useMemo, useState } from "react";

type Visibility = "network" | "private";
type CheckoutMode = "request" | "external" | "direct";

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
  emoji: "🆕",
  name: "",
  priceArs: 0,
  vertical: "",
  checkout: "request",
  visibility: "network",
};

function checkoutChip(mode: CheckoutMode) {
  if (mode === "request") {
    return <span className="inline-flex rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">Request to Buy</span>;
  }
  if (mode === "direct") {
    return <span className="inline-flex rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Direct Checkout</span>;
  }
  return <span className="inline-flex rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">External URL</span>;
}

function visibilityChip(visibility: Visibility) {
  if (visibility === "network") {
    return <span className="inline-flex rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">Público (Network)</span>;
  }
  return <span className="inline-flex rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">Oculto</span>;
}

export default function TenantMarketplacePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | Visibility>("all");
  const [importing, setImporting] = useState(false);

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

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/tenant-marketplace", { cache: "no-store" });
        const data = (await response.json()) as { items: Item[] };
        if (isMounted) setItems(data.items || []);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

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
      const response = await fetch(`/api/tenant-marketplace/${editingId}`, {
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
    const response = await fetch("/api/tenant-marketplace", {
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
    const response = await fetch(`/api/tenant-marketplace/${item.id}`, {
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
    const response = await fetch(`/api/tenant-marketplace/${id}`, { method: "DELETE" });
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
      const response = await fetch("/api/tenant-marketplace", {
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
      setNotice("JSON inválido para importar.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Marketplace & Network</h1>
          <p className="mt-1 text-sm text-slate-400">Publicá, editá y administrá productos en el NexID Consumer Network desde una sola vista.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">
            {importing ? "Importando..." : "Importar JSON"}
            <input suppressHydrationWarning disabled={importing} type="file" accept="application/json" className="hidden" onChange={(event) => importFromJson(event.target.files?.[0])} />
          </label>
          <button suppressHydrationWarning onClick={onCreate} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
            + Publicar Producto
          </button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-200">Items activos: <b className="text-white">{totals.total}</b></div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-sm text-emerald-100">Públicos en network: <b>{totals.publicCount}</b></div>
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-sm text-cyan-100">Direct checkout listos: <b>{totals.directCount}</b></div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <input suppressHydrationWarning value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto o vertical..." className="rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/30" />
        <select suppressHydrationWarning value={visibilityFilter} onChange={(e) => setVisibilityFilter(e.target.value as "all" | Visibility)} className="rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/30">
          <option value="all">Todas las visibilidades</option>
          <option value="network">Público (Network)</option>
          <option value="private">Oculto</option>
        </select>
      </div>

      <div className="flex items-start gap-4 rounded-xl border border-violet-500/20 bg-violet-950/10 p-6 backdrop-blur-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-400">
          <span className="text-xl">🌐</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Estado de la Red: Activo</h3>
          <p className="mt-1 max-w-2xl text-xs text-slate-400">Tus productos públicos son visibles para consumidores verificados de otras marcas. Sin exponer datos sensibles de tus clientes.</p>
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
                </td>
              </tr>
            ))}
            {!loading && filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">Todavía no hay productos. Publicá el primero.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {isEditorOpen ? (
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
              <option value="network">Público (Network)</option>
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
