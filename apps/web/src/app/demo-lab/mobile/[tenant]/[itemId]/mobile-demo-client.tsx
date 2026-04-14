"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Card } from "@product/ui";

type DemoMode = "consumer_tap" | "consumer_opened" | "consumer_tamper" | "consumer_duplicate";

type EventItem = { type: string; note: string; at: string };

type SeedItem = {
  uidHex?: string;
  uid_hex?: string;
  productName?: string;
  sku?: string;
  vintage?: string | number;
  region?: string;
  notes?: string;
};

const MODE_STATE: Record<DemoMode, { label: string; tone: "green" | "amber" | "cyan" | "red"; message: string }> = {
  consumer_tap: { label: "VALID", tone: "green", message: "Producto auténtico. Escaneo válido y trazabilidad activa." },
  consumer_opened: { label: "OPENED", tone: "cyan", message: "Producto abierto y ownership disponible." },
  consumer_tamper: { label: "TAMPER ALERT", tone: "amber", message: "Riesgo de manipulación detectado en el sello." },
  consumer_duplicate: { label: "REPLAY SUSPECT", tone: "red", message: "Lectura sospechosa de clon o repetición anómala." },
};

function nowIso() {
  return new Date().toISOString();
}

function storeKey(tenant: string, itemId: string, pack: string) {
  return `nexid:mobile:${tenant}:${itemId}:${pack}`;
}

export function MobileDemoClient({
  tenant,
  itemId,
  pack,
  mode,
  locale,
  seedItems,
}: {
  tenant: string;
  itemId: string;
  pack: string;
  mode: DemoMode;
  locale: string;
  seedItems: SeedItem[];
}) {
  const [statusLabel, setStatusLabel] = useState(mode);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [warrantyName, setWarrantyName] = useState("");
  const [warrantySaved, setWarrantySaved] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const current = MODE_STATE[statusLabel];
  const activeItem = useMemo(() => seedItems.find((item) => (item.uidHex || item.uid_hex || "").length > 0) || seedItems[0] || {}, [seedItems]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storeKey(tenant, itemId, pack));
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as EventItem[];
      if (Array.isArray(parsed)) setEvents(parsed.slice(0, 12));
    } catch {
      // ignore corrupted local demo state
    }
  }, [tenant, itemId, pack]);

  function pushEvent(type: string, note: string) {
    const next = [{ type, note, at: nowIso() }, ...events].slice(0, 12);
    setEvents(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storeKey(tenant, itemId, pack), JSON.stringify(next));
    }
  }

  function activateOwnership() {
    setStatusLabel("consumer_opened");
    pushEvent("OWNERSHIP_CLAIMED", "Ownership activado para este producto demo.");
  }

  function saveWarranty() {
    if (!warrantyName.trim()) return;
    setWarrantySaved(true);
    pushEvent("WARRANTY_REGISTERED", `Garantía registrada para ${warrantyName.trim()}.`);
  }

  function requestTokenization() {
    pushEvent("TOKENIZATION_REQUESTED", "Solicitud registrada. Anchoring pending (demo mode).");
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="mx-auto w-full max-w-[420px] rounded-[2.3rem] border border-cyan-300/20 bg-slate-950 p-2.5 shadow-[0_24px_90px_rgba(2,6,23,0.65)]">
        <div className="mx-auto mb-2 h-1.5 w-20 rounded-full bg-slate-700" />
        <div className="space-y-4 rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.10),transparent_30%),#020617] p-4">
          <Card className="border border-white/10 bg-slate-950/95 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Estado comercial · {locale}</p>
                <h1 className="mt-1 text-xl font-semibold text-white">{current.label}</h1>
                <p className="mt-2 text-sm text-slate-300">{current.message}</p>
              </div>
              <Badge tone={current.tone}>{current.label}</Badge>
            </div>
            <p className="mt-3 text-xs text-cyan-200">Tenant: {tenant} · Item: {itemId} · Pack: {pack}</p>
          </Card>

          <Card className="p-4 text-xs text-slate-300">
            <h2 className="text-sm font-semibold text-white">Producto</h2>
            <p className="mt-2 text-white">{activeItem.productName || "Demo item"}</p>
            <p className="mt-1">SKU {activeItem.sku || "-"} · Vintage {String(activeItem.vintage || "-")}</p>
            <p className="mt-1">{activeItem.region || "-"}</p>
            <p className="mt-1 text-slate-400">{activeItem.notes || "Passport activo para experiencia pública."}</p>
          </Card>

          <Card className="p-4 text-xs text-slate-300">
            <h2 className="text-sm font-semibold text-white">CTA comerciales</h2>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <button type="button" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-left text-cyan-100" onClick={activateOwnership}>Activar ownership</button>
              <button type="button" className="rounded-lg border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-left text-violet-100" onClick={saveWarranty}>Registrar garantía</button>
              <button type="button" className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-left text-amber-100" onClick={() => setTimelineOpen((value) => !value)}>Ver provenance</button>
              <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-left text-white" onClick={requestTokenization}>Tokenización opcional</button>
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-900 p-2">
              <input value={warrantyName} onChange={(event) => setWarrantyName(event.target.value)} placeholder="Nombre para garantía" className="w-full rounded border border-white/10 bg-slate-950 px-2 py-1 text-white" />
              {warrantySaved ? <p className="mt-2 text-emerald-300">Garantía guardada.</p> : null}
            </div>
          </Card>

          {timelineOpen ? (
            <Card className="p-4 text-xs text-slate-300">
              <h3 className="text-sm font-semibold text-white">Provenance timeline</h3>
              <div className="mt-2 space-y-2">
                {events.length ? events.map((event, index) => (
                  <div key={`${event.type}-${index}`} className="rounded-lg border border-white/10 bg-slate-900 p-2">
                    <p className="font-semibold text-white">{event.type}</p>
                    <p>{event.note}</p>
                    <p className="text-slate-400">{event.at}</p>
                  </div>
                )) : <p className="text-slate-400">Sin eventos todavía.</p>}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </main>
  );
}
