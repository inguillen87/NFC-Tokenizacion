"use client";

import { useState } from "react";
import { Button, Card } from "@product/ui";

type BatchConfigFormClientProps = {
  bid: string;
  initialData: {
    product_name?: string | null;
    sku?: string | null;
    winery?: string | null;
    region?: string | null;
    grape_varietal?: string | null;
    vintage?: string | null;
    harvest_year?: string | number | null;
    barrel_months?: string | number | null;
    temperature_storage?: string | null;
    image_url?: string | null;
    target_market?: string | null;
    // Extended properties from sdm_config
    altitude?: string | null;
    oak_type?: string | null;
    alcohol?: string | null;
    bottle?: string | null;
    serving?: string | null;
    notes?: string | null;
    maridaje?: string | null;
    simulated_temp_c?: string | number | null;
    simulated_humidity_pct?: string | number | null;
    simulated_light?: string | null;
    simulated_shock?: string | null;
  };
};

export function BatchConfigFormClient({ bid, initialData }: BatchConfigFormClientProps) {
  const [formData, setFormData] = useState({
    product_name: initialData.product_name || "",
    sku: initialData.sku || "",
    winery: initialData.winery || "",
    region: initialData.region || "",
    grape_varietal: initialData.grape_varietal || "",
    vintage: initialData.vintage || "",
    harvest_year: initialData.harvest_year || "",
    barrel_months: initialData.barrel_months || "",
    temperature_storage: initialData.temperature_storage || "",
    image_url: initialData.image_url || "",
    target_market: initialData.target_market || "",
    altitude: initialData.altitude || "",
    oak_type: initialData.oak_type || "",
    alcohol: initialData.alcohol || "",
    bottle: initialData.bottle || "",
    serving: initialData.serving || "",
    notes: initialData.notes || "",
    maridaje: initialData.maridaje || "",
    simulated_temp_c: initialData.simulated_temp_c || "",
    simulated_humidity_pct: initialData.simulated_humidity_pct || "",
    simulated_light: initialData.simulated_light || "",
    simulated_shock: initialData.simulated_shock || "",
  });

  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSuccess(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setSuccess(false);
    setError(null);

    const payload = {
      ...formData,
      harvest_year: formData.harvest_year ? Number(formData.harvest_year) : null,
      barrel_months: formData.barrel_months ? Number(formData.barrel_months) : null,
      simulated_temp_c: formData.simulated_temp_c ? Number(formData.simulated_temp_c) : null,
      simulated_humidity_pct: formData.simulated_humidity_pct ? Number(formData.simulated_humidity_pct) : null,
    };

    try {
      const response = await fetch(`/api/admin/batches/${encodeURIComponent(bid)}/product-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || result.ok === false) {
        throw new Error(result.reason || "Error al actualizar la configuración.");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="p-6 border border-cyan-500/15 bg-slate-950/80 shadow-2xl rounded-3xl">
      <div className="border-b border-white/10 pb-4 mb-6">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
          Personalización y Onboarding
        </span>
        <h2 className="text-xl font-black text-white mt-1">Configurar Ficha Comercial e IoT</h2>
        <p className="text-xs text-slate-400 mt-1">
          Define la identidad del vino y simula valores de telemetría hasta conectar sensores físicos reales en el pallet o la góndola.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Grid 1: Basic product attributes */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 border-b border-white/5 pb-1">1. Identidad Comercial</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Nombre del Producto</label>
              <input
                type="text"
                name="product_name"
                value={formData.product_name}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="Gran Reserva Malbec"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">SKU</label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="GRM-2022-L1"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Bodega / Productor</label>
              <input
                type="text"
                name="winery"
                value={formData.winery}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="Bodega del Valle"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Región de Origen</label>
              <input
                type="text"
                name="region"
                value={formData.region}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="Valle de Uco, Mendoza"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Variedad de Uva</label>
              <input
                type="text"
                name="grape_varietal"
                value={formData.grape_varietal}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="Malbec"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Vintage / Añada</label>
              <input
                type="text"
                name="vintage"
                value={formData.vintage}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="2022"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Año de Cosecha</label>
              <input
                type="number"
                name="harvest_year"
                value={formData.harvest_year}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="2022"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Meses en Barrica</label>
              <input
                type="number"
                name="barrel_months"
                value={formData.barrel_months}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="14"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Temperatura de Guarda</label>
              <input
                type="text"
                name="temperature_storage"
                value={formData.temperature_storage}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="14-16°C"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Mercado Destino</label>
              <input
                type="text"
                name="target_market"
                value={formData.target_market}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="US, BR, EU"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">URL de Imagen del Producto</label>
              <input
                type="text"
                name="image_url"
                value={formData.image_url}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="https://example.com/foto.png"
              />
            </div>
          </div>
        </div>

        {/* Grid 2: Premium wine elements (Sommelier, Terroir, Oak) */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 border-b border-white/5 pb-1">2. Detalles del Sommelier & Terroir (Vinos)</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Altitud del Terroir</label>
              <input
                type="text"
                name="altitude"
                value={formData.altitude}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="1200 metros snm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Tipo de Madera / Barrica</label>
              <input
                type="text"
                name="oak_type"
                value={formData.oak_type}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="Roble Francés de 2do uso"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Graduación Alcohólica</label>
              <input
                type="text"
                name="alcohol"
                value={formData.alcohol}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="14.5%"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Formato de Botella</label>
              <input
                type="text"
                name="bottle"
                value={formData.bottle}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="750ml / Standard"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Temperatura de Servicio</label>
              <input
                type="text"
                name="serving"
                value={formData.serving}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="16-18°C"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Maridaje Recomendado</label>
              <input
                type="text"
                name="maridaje"
                value={formData.maridaje}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="Carnes rojas asadas, pastas trufadas"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Notas de Cata del Sommelier</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition resize-y"
                placeholder="Entrada dulce y carnosa, con taninos maduros y redondos..."
              />
            </div>
          </div>
        </div>

        {/* Grid 3: Simulated IoT data */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 border-b border-white/5 pb-1">3. Simulación de Sensores IoT (Envasado/Tránsito)</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Temperatura Simulada (°C)</label>
              <input
                type="number"
                step="0.1"
                name="simulated_temp_c"
                value={formData.simulated_temp_c}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="15.2"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Humedad Simulada (%)</label>
              <input
                type="number"
                name="simulated_humidity_pct"
                value={formData.simulated_humidity_pct}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="62"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Exposición a la Luz</label>
              <input
                type="text"
                name="simulated_light"
                value={formData.simulated_light}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="Low / protected"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">Registro de Impactos / G-Force</label>
              <input
                type="text"
                name="simulated_shock"
                value={formData.simulated_shock}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
                placeholder="No critical shocks detected"
              />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-6">
          <div className="flex-1 mr-4">
            {success && (
              <span className="text-emerald-400 text-xs font-bold block animate-pulse">
                ✓ ¡Configuración comercial e IoT guardada con éxito!
              </span>
            )}
            {error && (
              <span className="text-rose-400 text-xs font-bold block">
                ✗ Error: {error}
              </span>
            )}
          </div>
          <Button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-6 py-2.5 transition disabled:opacity-50"
          >
            {pending ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
