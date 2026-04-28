"use client";

import { useState } from "react";

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

export function MarketplaceGridClient({ items }: { items: Listing[] }) {
  const [busyById, setBusyById] = useState<Record<string, boolean>>({});
  const [feedbackById, setFeedbackById] = useState<Record<string, string>>({});

  async function requestToBuy(item: Listing) {
    if (!item.id || busyById[item.id]) return;
    const needsAgeGate = item.age_gate_required === true;
    const ageGateAccepted = !needsAgeGate || window.confirm("Este producto requiere confirmación de mayoría de edad. ¿Confirmas que cumples con el requisito?");
    if (needsAgeGate && !ageGateAccepted) {
      setFeedbackById((prev) => ({ ...prev, [item.id]: "Confirmación de mayoría de edad requerida." }));
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

    setFeedbackById((prev) => ({ ...prev, [item.id]: "Solicitud enviada. El equipo de la marca te contactará." }));
    setBusyById((prev) => ({ ...prev, [item.id]: false }));
  }

  return (
    <section className="grid gap-3 md:grid-cols-2">
      {items.map((item, idx) => {
        const status = String(item.stock_status || "available");
        const requestDisabled = status === "out_of_stock" || item.request_to_buy_enabled === false;
        const cta = requestDisabled ? "No disponible" : busyById[item.id] ? "Enviando..." : "Solicitar compra";
        return (
          <article key={item.id || `${item.title || idx}`} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-sm font-semibold text-white">{item.title || "Item premium"}</p>
            <p className="mt-1 text-xs text-slate-400">{item.brand_name || item.brand || "Brand"}</p>
            <p className="mt-2 text-xs text-slate-300">{item.points_price || 0} pts · ${item.cash_price || item.price_amount || 0}</p>
            {item.age_gate_required ? (
              <p className="mt-2 text-[11px] text-amber-200">Requiere validación de mayoría de edad antes de solicitar.</p>
            ) : null}
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <span className="rounded-full border border-white/20 px-2 py-0.5 text-slate-200">{status.toUpperCase()}</span>
              <button
                disabled={requestDisabled || busyById[item.id]}
                onClick={() => requestToBuy(item)}
                className="rounded border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100 disabled:opacity-50"
              >
                {cta}
              </button>
            </div>
            {feedbackById[item.id] ? <p className="mt-2 text-[11px] text-cyan-100">{feedbackById[item.id]}</p> : null}
          </article>
        );
      })}
    </section>
  );
}
