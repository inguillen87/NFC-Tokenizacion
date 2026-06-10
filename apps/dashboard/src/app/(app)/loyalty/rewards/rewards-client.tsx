"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, StatusChip } from "@product/ui";
import {
  Plus,
  Edit2,
  Image as ImageIcon,
  Trophy,
  Layers,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  X,
  Sparkles,
  Wine
} from "lucide-react";

interface Reward {
  code: string;
  title: string;
  points: number;
  status: string;
  description?: string;
  type?: string;
  image_url?: string;
  stock_total?: number;
  stock_remaining?: number;
  requires_age_gate?: boolean;
  network_visible?: boolean;
}

interface RewardsClientProps {
  initialRewards: Reward[];
  tenantScope: string;
}

const PRESET_IMAGES = [
  { label: "Degustación Sunset (Mendoza)", value: "/images/wine_tasting.png" },
  { label: "Caja de Madera Premium (Mix 6)", value: "/images/wine_crate.png" },
  { label: "Botella Magnum 1.5L", value: "/images/premium_magnum.png" }
];

const REWARD_TYPES = [
  { value: "WINE_BOX", label: "Caja de Vinos 📦" },
  { value: "WINE_BOTTLE", label: "Botella de Vino 🍷" },
  { value: "TASTING", label: "Degustación 🎟️" },
  { value: "TOUR", label: "Tour de Bodega 🗺️" },
  { value: "EXPERIENCE", label: "Experiencia VIP ✨" },
  { value: "DISCOUNT", label: "Descuento 🏷️" },
  { value: "FREE_SHIPPING", label: "Envío Gratis 🚚" },
  { value: "EARLY_ACCESS", label: "Acceso Anticipado ⏳" },
  { value: "VIP_ACCESS", label: "Acceso VIP 👑" },
  { value: "DIGITAL_COLLECTIBLE", label: "Coleccionable Digital (NFT) 🌐" },
  { value: "GIFT", label: "Regalo de la Casa 🎁" }
];

export default function RewardsClient({ initialRewards, tenantScope }: RewardsClientProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  
  // Form State
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("WINE_BOX");
  const [pointsCost, setPointsCost] = useState(500);
  const [stockTotal, setStockTotal] = useState(100);
  const [imageUrl, setImageUrl] = useState("/images/wine_tasting.png");
  const [status, setStatus] = useState("active");
  const [requiresAgeGate, setRequiresAgeGate] = useState(false);
  const [networkVisible, setNetworkVisible] = useState(true);
  const [customTenant, setCustomTenant] = useState("demobodega");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const openCreateModal = () => {
    setEditingReward(null);
    setCode("");
    setTitle("");
    setDescription("");
    setType("WINE_BOX");
    setPointsCost(500);
    setStockTotal(100);
    setImageUrl("/images/wine_tasting.png");
    setStatus("active");
    setRequiresAgeGate(false);
    setNetworkVisible(true);
    setMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (reward: Reward) => {
    setEditingReward(reward);
    setCode(reward.code);
    setTitle(reward.title);
    setDescription(reward.description || "");
    setType(reward.type || "WINE_BOX");
    setPointsCost(reward.points);
    setStockTotal(reward.stock_total || 100);
    setImageUrl(reward.image_url || "/images/wine_tasting.png");
    setStatus(reward.status || "active");
    setRequiresAgeGate(!!reward.requires_age_gate);
    setNetworkVisible(reward.network_visible !== false);
    setMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const payload = {
      tenant_slug: tenantScope || customTenant,
      code,
      title,
      description,
      type,
      points_cost: pointsCost,
      stock_total: stockTotal,
      stock_remaining: stockTotal,
      image_url: imageUrl,
      status,
      requires_age_gate: requiresAgeGate,
      network_visible: networkVisible
    };

    try {
      const response = await fetch("/api/admin/loyalty/rewards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok && data.ok) {
        setMessage({
          type: "success",
          text: editingReward ? "Beneficio actualizado con éxito" : "Nuevo beneficio creado con éxito"
        });
        setTimeout(() => {
          setIsModalOpen(false);
          router.refresh();
        }, 1500);
      } else {
        setMessage({
          type: "error",
          text: data.error || "Error al procesar la solicitud"
        });
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: "Error de red al conectar con el servidor"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Trophy className="h-6 w-6 text-cyan-400 animate-pulse" />
            Catálogo de Beneficios
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Gestioná los premios, experiencias y beneficios exclusivos que los consumidores obtienen al verificar productos reales.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white text-sm font-semibold rounded-xl transition-all shadow-[0_4px_20px_rgba(6,182,212,0.15)] hover:shadow-[0_4px_25px_rgba(6,182,212,0.3)] hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" />
          Nuevo Beneficio
        </button>
      </header>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-300 flex items-center justify-between">
        <div>
          Scope operativo: <b className="text-cyan-300 font-mono">{tenantScope ? `tenant:${tenantScope}` : "global / multi-tenant"}</b>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>Integrado con motor de recompensas PWA</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {initialRewards.map((item, idx) => {
          const isPaused = item.status === "paused" || item.status === "draft";
          const displayImage = item.image_url || "/images/wine_tasting.png";
          
          return (
            <div
              key={`${item.code}-${idx}`}
              className={`rounded-2xl border border-white/10 bg-slate-950/40 overflow-hidden flex flex-col group transition-all duration-300 hover:border-cyan-500/50 hover:bg-slate-900/40 shadow-lg ${
                isPaused ? "opacity-60 grayscale-[40%]" : ""
              }`}
            >
              {/* Card Header Image */}
              <div className="h-44 bg-slate-900 relative overflow-hidden flex items-center justify-center">
                <img
                  src={displayImage}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback to Wine Icon if image fails to load
                    e.currentTarget.style.display = 'none';
                  }}
                />
                
                {/* Fallback container with icon */}
                <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center group-hover:bg-slate-800/85 transition-colors -z-10">
                  <Wine className="h-12 w-12 text-slate-600 group-hover:text-cyan-500 transition-colors" />
                </div>

                <div className="absolute top-3 right-3 flex gap-1.5">
                  {item.requires_age_gate && (
                    <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-black rounded-lg uppercase tracking-wider backdrop-blur-md">
                      +18
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 border text-[10px] font-bold rounded-lg uppercase tracking-wider backdrop-blur-md ${
                      isPaused
                        ? "bg-slate-500/20 border-slate-500/30 text-slate-400"
                        : "bg-cyan-500/20 border-cyan-500/30 text-cyan-400"
                    }`}
                  >
                    {item.status || "active"}
                  </span>
                </div>
                
                {/* Type Tag */}
                <div className="absolute bottom-3 left-3">
                  <span className="px-2 py-0.5 bg-slate-950/80 border border-white/10 text-white text-[9px] font-medium rounded-md uppercase tracking-wider backdrop-blur-md">
                    {item.type || "EXPERIENCE"}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                    {item.points >= 1000 ? "PREMIO MAYOR" : "BENEFICIO"}
                  </p>
                  <span className="text-xs text-slate-500 font-mono">#{item.code}</span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed flex-1">
                  {item.description || "Sin descripción disponible."}
                </p>

                <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-lg font-black text-white">{item.points} <span className="text-xs font-normal text-slate-400">pts</span></p>
                    <p className="text-[10px] text-slate-500">
                      Stock: {item.stock_remaining ?? item.stock_total ?? "∞"} / {item.stock_total ?? "∞"}
                    </p>
                  </div>
                  <button
                    onClick={() => openEditModal(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 text-xs text-slate-300 hover:text-cyan-400 font-semibold transition-all"
                  >
                    <Edit2 className="h-3 w-3" />
                    Editar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl animate-in fade-in zoom-in duration-200">
            <header className="flex items-center justify-between border-b border-white/10 bg-slate-900/50 px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                {editingReward ? "Editar Beneficio" : "Crear Nuevo Beneficio"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {message && (
                <div
                  className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${
                    message.type === "success"
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-red-500/15 border-red-500/30 text-red-400"
                  }`}
                >
                  {message.type === "success" ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              {/* Scope Selection for Super Admin */}
              {!tenantScope && !editingReward && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Tenant Responsable
                  </label>
                  <select
                    value={customTenant}
                    onChange={(e) => setCustomTenant(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="demobodega">Demo Bodega (demobodega)</option>
                    <option value="demoevents">Demo Events (demoevents)</option>
                    <option value="democosmetics">Demo Cosmetics (democosmetics)</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Código de Control
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    disabled={!!editingReward}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="E.g. WINE-KIT-6B"
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Tipo de Beneficio
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    {REWARD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Título del Beneficio
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="E.g. Caja Madera Edición Limitada"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Descripción Detallada
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explicá claramente qué incluye y cómo se reclama..."
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Costo en Puntos
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={pointsCost}
                    onChange={(e) => setPointsCost(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Stock Disponible
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={stockTotal}
                    onChange={(e) => setStockTotal(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Image selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Imagen Realista (Imágenes premium generadas)
                </label>
                <div className="grid grid-cols-1 gap-2 mb-2">
                  {PRESET_IMAGES.map((img) => (
                    <button
                      key={img.value}
                      type="button"
                      onClick={() => setImageUrl(img.value)}
                      className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl border text-left transition-all ${
                        imageUrl === img.value
                          ? "bg-cyan-500/10 border-cyan-500 text-cyan-300 font-semibold"
                          : "bg-slate-900 border-white/5 text-slate-400 hover:border-white/15"
                      }`}
                    >
                      <span>{img.label}</span>
                      <span className="text-[10px] font-mono opacity-60">{img.value}</span>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="O ingresá una URL personalizada..."
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Estado
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="active">Activo (Publicado)</option>
                    <option value="paused">Pausado</option>
                    <option value="draft">Borrador</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end space-y-2">
                  <label className="flex items-center gap-2 text-slate-300 text-sm select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresAgeGate}
                      onChange={(e) => setRequiresAgeGate(e.target.checked)}
                      className="rounded border-white/10 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span>Requiere Filtro de Edad (+18)</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 text-sm select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={networkVisible}
                      onChange={(e) => setNetworkVisible(e.target.checked)}
                      className="rounded border-white/10 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span>Visible en Red Global</span>
                  </label>
                </div>
              </div>

              <footer className="flex items-center justify-end gap-3 pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-[0_4px_15px_rgba(6,182,212,0.1)]"
                >
                  {loading ? "Guardando..." : "Guardar Beneficio"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
