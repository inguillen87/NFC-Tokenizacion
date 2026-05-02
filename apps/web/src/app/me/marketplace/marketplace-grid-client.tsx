"use client";

import { useMemo, useState } from "react";

type Listing = {
  id: string;
  title?: string;
  brand_name?: string;
  brand?: string;
  tenant_slug?: string;
  kind?: string;
  vertical?: string;
  points_price?: number;
  cash_price?: number;
  price_amount?: number;
  stock_status?: string;
  status?: string;
  request_to_buy_enabled?: boolean;
  age_gate_required?: boolean;
};

function priceLabel(item: Listing) {
  const points = item.points_price || 0;
  const cash = item.cash_price || item.price_amount || 0;
  if (points && cash) return `${points} pts + $${cash}`;
  if (points) return `${points} pts`;
  if (cash) return `$${cash}`;
  return "Member drop";
}

function brandLabel(item: Listing) {
  return item.brand_name || item.brand || item.tenant_slug || "Network";
}

function productVisualClass(item: Listing, index: number) {
  const blob = `${item.title || ""} ${item.brand_name || item.brand || ""} ${item.kind || ""} ${item.vertical || ""}`.toLowerCase();
  if (blob.includes("wine") || blob.includes("vino") || blob.includes("malbec") || blob.includes("reserva")) return "marketplace-product-visual marketplace-product-visual--bottle";
  if (blob.includes("ticket") || blob.includes("vip") || blob.includes("event") || blob.includes("pulsera") || blob.includes("wristband")) return "marketplace-product-visual marketplace-product-visual--wristband";
  if (blob.includes("serum") || blob.includes("cosmetic") || blob.includes("cosmetica") || blob.includes("pharma")) return "marketplace-product-visual marketplace-product-visual--cosmetic";
  return `marketplace-product-visual ${index % 3 === 0 ? "marketplace-product-visual--bottle" : index % 3 === 1 ? "marketplace-product-visual--wristband" : "marketplace-product-visual--cosmetic"}`;
}

const filterOptions = [
  { value: "all", label: "Todo" },
  { value: "bottle", label: "Vino" },
  { value: "wristband", label: "Eventos" },
  { value: "cosmetic", label: "Beauty" },
  { value: "gated", label: "Age gate" },
];

export function MarketplaceGridClient({ items }: { items: Listing[] }) {
  const [busyById, setBusyById] = useState<Record<string, boolean>>({});
  const [feedbackById, setFeedbackById] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");

  const stats = useMemo(() => {
    const available = items.filter((item) => String(item.stock_status || item.status || "available").toLowerCase() !== "out_of_stock").length;
    const gated = items.filter((item) => item.age_gate_required).length;
    const requestable = items.filter((item) => item.request_to_buy_enabled !== false).length;
    const brands = new Set(items.map((item) => String(brandLabel(item)).trim()).filter(Boolean));
    const points = items.filter((item) => Number(item.points_price || 0) > 0).length;
    return { available, gated, requestable, brands: brands.size, points };
  }, [items]);

  const brandUpdates = useMemo(() => {
    const map = new Map<string, { brand: string; total: number; gated: number; points: number }>();
    items.forEach((item) => {
      const brand = String(brandLabel(item)).trim();
      const current = map.get(brand) || { brand, total: 0, gated: 0, points: 0 };
      current.total += 1;
      if (item.age_gate_required) current.gated += 1;
      current.points += Number(item.points_price || 0);
      map.set(brand, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 4);
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item, index) => {
      const blob = `${item.title || ""} ${brandLabel(item)} ${item.kind || ""} ${item.vertical || ""}`.toLowerCase();
      const visual = productVisualClass(item, index);
      const byQuery = q ? blob.includes(q) : true;
      const byKind = kind === "all" ? true : kind === "gated" ? item.age_gate_required === true : visual.includes(kind);
      return byQuery && byKind;
    });
  }, [items, kind, query]);

  async function requestToBuy(item: Listing) {
    if (!item.id || busyById[item.id]) return;
    const needsAgeGate = item.age_gate_required === true;
    const ageGateAccepted = !needsAgeGate || window.confirm("Este producto requiere confirmacion de mayoria de edad. Confirmas que cumples con el requisito?");
    if (needsAgeGate && !ageGateAccepted) {
      setFeedbackById((prev) => ({ ...prev, [item.id]: "Confirmacion de edad requerida para continuar." }));
      return;
    }

    setBusyById((prev) => ({ ...prev, [item.id]: true }));
    setFeedbackById((prev) => ({ ...prev, [item.id]: "" }));

    const res = await fetch(`/api/marketplace/products/${encodeURIComponent(item.id)}/request-to-buy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quantity: 1, ageGateAccepted }),
    }).catch(() => null);

    if (!res) {
      setFeedbackById((prev) => ({ ...prev, [item.id]: "No se pudo conectar con el servicio." }));
      setBusyById((prev) => ({ ...prev, [item.id]: false }));
      return;
    }

    const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !payload?.ok) {
      const errorLabel = payload?.error ? `Error: ${payload.error}` : "No fue posible registrar la solicitud.";
      setFeedbackById((prev) => ({ ...prev, [item.id]: errorLabel }));
      setBusyById((prev) => ({ ...prev, [item.id]: false }));
      return;
    }

    setFeedbackById((prev) => ({ ...prev, [item.id]: "Solicitud enviada. La marca te contactara desde el portal." }));
    setBusyById((prev) => ({ ...prev, [item.id]: false }));
  }

  return (
    <section className="space-y-5">
      <div className="consumer-marketplace-hero rounded-3xl border border-violet-300/20 bg-violet-950/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">Network marketplace</p>
            <h2 className="mt-1 text-2xl font-black text-white">Drops conectados a ownership verificado</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-violet-100/75">
              Cada canje, reserva o solicitud queda ligada al Passport del consumidor, al tenant y al estado del producto que habilito la experiencia.
            </p>
          </div>
          <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-100">sandbox commerce</span>
        </div>

        <div className="mt-4 grid gap-2 text-xs text-slate-200 sm:grid-cols-5">
          {[
            ["Disponibles", stats.available],
            ["Marcas", stats.brands],
            ["Con puntos", stats.points],
            ["Request-to-buy", stats.requestable],
            ["Age gate", stats.gated],
          ].map(([label, value]) => (
            <div key={String(label)} className="consumer-market-stat rounded-xl border border-white/10 bg-slate-950/55 p-3">
              <span className="text-slate-400">{label}</span>
              <b className="mt-1 block text-lg text-white">{value}</b>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
          <input
            suppressHydrationWarning
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por producto, marca o beneficio"
            className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/40"
          />
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                suppressHydrationWarning
                key={option.value}
                type="button"
                onClick={() => setKind(option.value)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold ${kind === option.value ? "border-cyan-300/40 bg-cyan-500/15 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {brandUpdates.length ? (
        <div className="consumer-market-feed grid gap-3 md:grid-cols-4">
          {brandUpdates.map((item) => (
            <article key={item.brand} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">Tenant update</p>
              <p className="mt-2 text-sm font-black text-white">{item.brand}</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">
                {item.total} beneficios activos - {item.points} pts en canjes - {item.gated} con age gate.
              </p>
            </article>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {filteredItems.map((item, idx) => {
          const status = String(item.stock_status || item.status || "available");
          const requestDisabled = status === "out_of_stock" || item.request_to_buy_enabled === false;
          const cta = requestDisabled ? "No disponible" : busyById[item.id] ? "Enviando..." : "Solicitar compra";
          return (
            <article key={item.id || `${item.title || idx}`} className="marketplace-card overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-xl shadow-black/20">
              <div className="relative h-44 border-b border-white/10 bg-[linear-gradient(135deg,#111827,#020617)]">
                <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-slate-950/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-200">
                  {status.replaceAll("_", " ")}
                </div>
                <div className="absolute right-4 top-4 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
                  passport-linked
                </div>
                <div className={productVisualClass(item, idx)} />
              </div>

              <div className="p-4">
                <p className="text-sm font-black text-white">{item.title || "Item premium"}</p>
                <p className="mt-1 text-xs text-slate-400">{brandLabel(item)}</p>
                <p className="mt-3 text-lg font-black text-white">{priceLabel(item)}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                  <span className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-center font-semibold uppercase tracking-[0.08em] text-cyan-100">owner</span>
                  <span className="rounded-lg border border-violet-300/20 bg-violet-500/10 px-2 py-1 text-center font-semibold uppercase tracking-[0.08em] text-violet-100">token</span>
                  <span className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-center font-semibold uppercase tracking-[0.08em] text-emerald-100">crm</span>
                </div>
                <p className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] leading-5 text-slate-300">
                  Se habilita por passport, queda trazado al tenant y crea una solicitud operativa para ventas o fidelizacion.
                </p>
                {item.age_gate_required ? (
                  <p className="mt-2 rounded-lg border border-amber-300/20 bg-amber-500/10 p-2 text-[11px] text-amber-100">
                    Requiere confirmacion de edad antes de solicitar.
                  </p>
                ) : null}
                <button
                  suppressHydrationWarning
                  disabled={requestDisabled || busyById[item.id]}
                  onClick={() => requestToBuy(item)}
                  className="mt-4 w-full rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cta}
                </button>
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
    </section>
  );
}
