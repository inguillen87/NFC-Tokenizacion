"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@product/ui";

type AssetItem = {
  tenantSlug?: string | null;
  bid?: string | null;
  uidHex?: string | null;
  uidMasked?: string | null;
  profile?: {
    tenantSlug?: string | null;
    bid?: string | null;
    productName?: string | null;
    brandName?: string | null;
    primaryImageUrl?: string | null;
    labelImageUrl?: string | null;
    modelUrl?: string | null;
    galleryUrls?: string[];
    assetScore?: number;
  };
  productName?: string | null;
  brandName?: string | null;
  primaryImageUrl?: string | null;
  imageUrl?: string | null;
  labelImageUrl?: string | null;
  modelUrl?: string | null;
  galleryUrls?: string[];
  assetScore?: number;
};

type AssetForm = {
  tenantSlug: string;
  bid: string;
  uidHex: string;
  productName: string;
  brandName: string;
  imageUrl: string;
  labelImageUrl: string;
  modelUrl: string;
  galleryUrls: string;
};

const initialForm: AssetForm = {
  tenantSlug: "demobodega",
  bid: "DEMO-2026-02",
  uidHex: "",
  productName: "Gran Reserva Malbec",
  brandName: "Bodega Balmec",
  imageUrl: "",
  labelImageUrl: "",
  modelUrl: "",
  galleryUrls: "",
};

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, reason: "invalid json", raw: text };
  }
}

function splitGallery(value: string) {
  return value
    .split(/[\n,|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ProductAssetBankPanel({ canWrite = true, tenantSlug = "" }: { canWrite?: boolean; tenantSlug?: string }) {
  const [form, setForm] = useState<AssetForm>(() => ({ ...initialForm, tenantSlug: tenantSlug || initialForm.tenantSlug }));
  const [items, setItems] = useState<AssetItem[]>([]);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("Banco de assets listo: consulta por tenant/lote o carga fotos/modelos reales.");
  const [lastResponse, setLastResponse] = useState("{}");

  function patchForm(key: keyof AssetForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function loadAssets() {
    setPending(true);
    try {
      const query = new URLSearchParams();
      if (form.tenantSlug.trim()) query.set("tenantSlug", form.tenantSlug.trim());
      if (form.bid.trim()) query.set("bid", form.bid.trim());
      if (form.uidHex.trim()) query.set("uidHex", form.uidHex.trim());
      const response = await fetch(`/api/admin/product-assets?${query.toString()}`, { cache: "no-store" });
      const data = await parseJsonSafe(response);
      setLastResponse(JSON.stringify(data, null, 2));
      if (!response.ok || data?.ok === false) throw new Error(String(data?.reason || data?.error || "asset_bank_load_failed"));
      setItems(Array.isArray(data.items) ? data.items : []);
      setStatus(`Assets cargados: ${Array.isArray(data.items) ? data.items.length : 0} perfiles.`);
    } catch (error) {
      setItems([]);
      setStatus(error instanceof Error ? error.message : "asset_bank_load_failed");
    } finally {
      setPending(false);
    }
  }

  async function saveAsset() {
    setPending(true);
    try {
      const payload = {
        tenantSlug: form.tenantSlug.trim(),
        bid: form.bid.trim(),
        uidHex: form.uidHex.trim() || undefined,
        productName: form.productName.trim(),
        brandName: form.brandName.trim(),
        imageUrl: form.imageUrl.trim() || undefined,
        labelImageUrl: form.labelImageUrl.trim() || undefined,
        modelUrl: form.modelUrl.trim() || undefined,
        galleryUrls: splitGallery(form.galleryUrls),
      };
      const response = await fetch("/api/admin/product-assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonSafe(response);
      setLastResponse(JSON.stringify(data, null, 2));
      if (!response.ok || data?.ok === false) throw new Error(String(data?.reason || data?.error || "asset_bank_save_failed"));
      setStatus("Asset bank guardado. El tap, certificado, portal y marketplace pueden mostrar los assets aprobados de este producto.");
      await loadAssets();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "asset_bank_save_failed");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    void loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Banco de assets del tenant</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Carga la foto del producto, etiqueta, tag aplicado y modelo 3D por tenant/lote/UID. Es la fuente visual que usan el tap mobile, el certificado, la wallet y el marketplace.
          </p>
        </div>
        <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">
          tenant asset bank
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <Field disabled={!canWrite} label="Tenant" value={form.tenantSlug} onChange={(value) => patchForm("tenantSlug", value)} placeholder="demobodega" />
        <Field disabled={!canWrite} label="BID / lote" value={form.bid} onChange={(value) => patchForm("bid", value)} placeholder="DEMO-2026-02" />
        <Field disabled={!canWrite} label="UID requerido" value={form.uidHex} onChange={(value) => patchForm("uidHex", value)} placeholder="04A7..." />
        <Field disabled={!canWrite} label="Producto" value={form.productName} onChange={(value) => patchForm("productName", value)} placeholder="Gran Reserva Malbec" />
        <Field disabled={!canWrite} label="Marca" value={form.brandName} onChange={(value) => patchForm("brandName", value)} placeholder="Bodega Demo" />
        <Field disabled={!canWrite} label="Foto producto" value={form.imageUrl} onChange={(value) => patchForm("imageUrl", value)} placeholder="https://cdn.../producto.png" />
        <Field disabled={!canWrite} label="Etiqueta frontal" value={form.labelImageUrl} onChange={(value) => patchForm("labelImageUrl", value)} placeholder="https://cdn.../etiqueta.png" />
        <Field disabled={!canWrite} label="Modelo GLB" value={form.modelUrl} onChange={(value) => patchForm("modelUrl", value)} placeholder="https://cdn.../producto.glb" />
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Galeria / tag aplicado</span>
          <textarea
            suppressHydrationWarning
            disabled={!canWrite}
            className="mt-1 min-h-20 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500"
            value={form.galleryUrls}
            onChange={(event) => patchForm("galleryUrls", event.target.value)}
            placeholder="Una URL por linea o separadas por coma"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={!canWrite || pending || !form.bid.trim() || !form.uidHex.trim()} onClick={() => void saveAsset()}>{pending ? "Guardando..." : canWrite ? "Guardar assets" : "Solo lectura"}</Button>
        <Button variant="secondary" disabled={pending} onClick={() => void loadAssets()}>Consultar</Button>
      </div>

      <p className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-xs leading-5 text-cyan-100">{status}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.slice(0, 6).map((item, index) => {
          const profile = item.profile || item;
          const imageUrl = profile.primaryImageUrl || item.imageUrl;
          const rawAssetScore = profile.assetScore;
          const assetScore = rawAssetScore === null || rawAssetScore === undefined || String(rawAssetScore).trim() === ""
            ? null
            : Number(rawAssetScore);
          return (
            <article key={`${item.tenantSlug || profile.tenantSlug || "tenant"}-${item.bid || profile.bid || "bid"}-${item.uidHex || item.uidMasked || index}`} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-xs text-slate-300">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{item.tenantSlug || profile.tenantSlug || "tenant"} / {item.bid || profile.bid || "lote"}</p>
                  <h3 className="mt-1 text-base font-black text-white">{profile.productName || "Producto sin nombre"}</h3>
                  <p className="mt-1 text-slate-400">{profile.brandName || "Marca"} {item.uidHex || item.uidMasked ? `- UID ${item.uidMasked || item.uidHex}` : ""}</p>
                </div>
                <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[10px] font-black text-cyan-100">{assetScore !== null && Number.isFinite(assetScore) ? `${assetScore}/100` : "Sin score"}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <AssetFlag label="Producto" ready={Boolean(imageUrl)} />
                <AssetFlag label="Etiqueta" ready={Boolean(profile.labelImageUrl || item.labelImageUrl)} />
                <AssetFlag label="Modelo 3D" ready={Boolean(profile.modelUrl || item.modelUrl)} />
                <AssetFlag label="Galeria/tag" ready={Boolean(profile.galleryUrls?.length || item.galleryUrls?.length)} />
              </div>
            </article>
          );
        })}
        {!items.length ? <p className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-xs text-slate-400">Sin perfiles para este filtro todavia.</p> : null}
      </div>

      <details className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-slate-300">
        <summary className="cursor-pointer font-semibold text-slate-100">Ultima respuesta API</summary>
        <pre className="mt-2 max-h-72 overflow-auto">{lastResponse}</pre>
      </details>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder, disabled = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input
        suppressHydrationWarning
        disabled={disabled}
        className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function AssetFlag({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${ready ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100" : "border-amber-300/20 bg-amber-500/10 text-amber-100"}`}>
      <span className="block text-[10px] uppercase tracking-[0.12em] opacity-75">{label}</span>
      <b className="mt-1 block">{ready ? "real" : "pendiente"}</b>
    </div>
  );
}
