"use client";

import { useMemo, useState } from "react";

type Listing = {
  id: string;
  title?: string;
  brand_name?: string;
  brand?: string;
  points_price?: number;
  cash_price?: number;
  price_amount?: number;
  stock_status?: string;
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

function productVisualClass(item: Listing, index: number) {
  const blob = `${item.title || ""} ${item.brand_name || item.brand || ""}`.toLowerCase();
  if (blob.includes("wine") || blob.includes("vino") || blob.includes("malbec") || blob.includes("reserva")) return "marketplace-product-visual marketplace-product-visual--bottle";
  if (blob.includes("ticket") || blob.includes("vip") || blob.includes("event") || blob.includes("pulsera")) return "marketplace-product-visual marketplace-product-visual--wristband";
  if (blob.includes("serum") || blob.includes("sérum") || blob.includes("cosmetic") || blob.includes("cosmetica")) return "marketplace-product-visual marketplace-product-visual--cosmetic";
  return `marketplace-product-visual ${index % 3 === 0 ? "marketplace-product-visual--bottle" : index % 3 === 1 ? "marketplace-product-visual--wristband" : "marketplace-product-visual--cosmetic"}`;
}

export function MarketplaceGridClient({ items }: { items: Listing[] }) {
  const [busyById, setBusyById] = useState<Record<string, boolean>>({});
  const [feedbackById, setFeedbackById] = useState<Record<string, string>>({});

  const stats = useMemo(() => {
    const available = items.filter((item) => String(item.stock_status || "available") !== "out_of_stock").length;
    const gated = items.filter((item) => item.age_gate_required).length;
    const requestable = items.filter((item) => item.request_to_buy_enabled !== false).length;
    return { available, gated, requestable };
  }, [items]);

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
      <div className="rounded-2xl border border-violet-300/20 bg-violet-950/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">Network marketplace</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Drops conectados a ownership verificado</h2>
            <p className="mt-1 text-xs leading-5 text-violet-100/75">Cada solicitud queda ligada al Passport del consumidor, tenant y estado del producto.</p>
          </div>
          <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-100">sandbox commerce</span>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-200 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3"><span className="text-slate-400">Disponibles</span><b className="mt-1 block text-lg text-white">{stats.available}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3"><span className="text-slate-400">Request-to-buy</span><b className="mt-1 block text-lg text-white">{stats.requestable}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3"><span className="text-slate-400">Age gate</span><b className="mt-1 block text-lg text-white">{stats.gated}</b></div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item, idx) => {
          const status = String(item.stock_status || "available");
          const requestDisabled = status === "out_of_stock" || item.request_to_buy_enabled === false;
          const cta = requestDisabled ? "No disponible" : busyById[item.id] ? "Enviando..." : "Solicitar compra";
          return (
            <article key={item.id || `${item.title || idx}`} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-xl shadow-black/20">
              <div className="relative h-40 border-b border-white/10 bg-[linear-gradient(135deg,#111827,#020617)]">
                <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-slate-950/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-200">
                  {status.replaceAll("_", " ")}
                </div>
                <div className="absolute right-4 top-4 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
                  passport-linked
                </div>
                <div className={productVisualClass(item, idx)} />
              </div>

              <div className="p-4">
                <p className="text-sm font-semibold text-white">{item.title || "Item premium"}</p>
                <p className="mt-1 text-xs text-slate-400">{item.brand_name || item.brand || "Brand"}</p>
                <p className="mt-3 text-lg font-black text-white">{priceLabel(item)}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                  <span className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-center font-semibold uppercase tracking-[0.08em] text-cyan-100">owner</span>
                  <span className="rounded-lg border border-violet-300/20 bg-violet-500/10 px-2 py-1 text-center font-semibold uppercase tracking-[0.08em] text-violet-100">token</span>
                  <span className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-center font-semibold uppercase tracking-[0.08em] text-emerald-100">escrow</span>
                </div>
                {item.age_gate_required ? (
                  <p className="mt-2 rounded-lg border border-amber-300/20 bg-amber-500/10 p-2 text-[11px] text-amber-100">
                    Requiere confirmacion de edad antes de solicitar.
                  </p>
                ) : null}
                <button
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
      </div>
    </section>
  );
}
