"use client";

import { useMemo, useState } from "react";

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

const initialItems: Item[] = [
  {
    id: "wine-01",
    emoji: "🍷",
    name: "Lote Experimental Malbec",
    priceArs: 45000,
    vertical: "Vino Premium",
    checkout: "request",
    visibility: "network",
  },
  {
    id: "box-01",
    emoji: "📦",
    name: "Caja Degustación Terroir",
    priceArs: 120000,
    vertical: "Caja / Combo",
    checkout: "external",
    visibility: "private",
  },
];

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
  const [items, setItems] = useState<Item[]>(initialItems);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const totals = useMemo(() => {
    const publicCount = items.filter((item) => item.visibility === "network").length;
    const directCount = items.filter((item) => item.checkout === "direct").length;
    return { total: items.length, publicCount, directCount };
  }, [items]);

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

  const saveItem = () => {
    if (!draft.name.trim() || !draft.vertical.trim()) return;
    if (editingId) {
      setItems((prev) => prev.map((item) => (item.id === editingId ? { ...item, ...draft } : item)));
      resetEditor();
      return;
    }
    const newItem: Item = {
      id: `item-${Date.now()}`,
      ...draft,
    };
    setItems((prev) => [newItem, ...prev]);
    resetEditor();
  };

  const toggleVisibility = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, visibility: item.visibility === "network" ? "private" : "network" }
          : item
      )
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Marketplace & Network</h1>
          <p className="mt-1 text-sm text-slate-400">Publicá, editá y administrá productos en el NexID Consumer Network desde una sola vista.</p>
        </div>
        <button onClick={onCreate} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
          + Publicar Producto
        </button>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-200">Items activos: <b className="text-white">{totals.total}</b></div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-sm text-emerald-100">Públicos en network: <b>{totals.publicCount}</b></div>
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-sm text-cyan-100">Direct checkout listos: <b>{totals.directCount}</b></div>
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
            {items.map((item) => (
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
                    <button onClick={() => toggleVisibility(item.id)} className="rounded-md border border-white/15 px-2 py-1 text-xs text-slate-200 hover:bg-white/10">
                      {item.visibility === "network" ? "Ocultar" : "Publicar"}
                    </button>
                    <button onClick={() => onEdit(item)} className="rounded-md border border-cyan-500/20 px-2 py-1 text-xs font-medium text-cyan-400 hover:bg-cyan-500/10">
                      Editar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isEditorOpen ? (
        <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/90 p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-cyan-300">{editingId ? "Editar producto" : "Nuevo producto"}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nombre del producto" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40" />
            <input value={draft.vertical} onChange={(e) => setDraft((prev) => ({ ...prev, vertical: e.target.value }))} placeholder="Vertical (Wine, Events, Pharma...)" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40" />
            <input value={draft.emoji} onChange={(e) => setDraft((prev) => ({ ...prev, emoji: e.target.value }))} placeholder="Emoji" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40" />
            <input type="number" min={0} value={draft.priceArs} onChange={(e) => setDraft((prev) => ({ ...prev, priceArs: Number(e.target.value) || 0 }))} placeholder="Precio ARS" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40" />
            <select value={draft.checkout} onChange={(e) => setDraft((prev) => ({ ...prev, checkout: e.target.value as CheckoutMode }))} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40">
              <option value="request">Request to Buy</option>
              <option value="direct">Direct Checkout</option>
              <option value="external">External URL</option>
            </select>
            <select value={draft.visibility} onChange={(e) => setDraft((prev) => ({ ...prev, visibility: e.target.value as Visibility }))} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40">
              <option value="network">Público (Network)</option>
              <option value="private">Oculto</option>
            </select>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={saveItem} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Guardar
            </button>
            <button onClick={resetEditor} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/10">
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
