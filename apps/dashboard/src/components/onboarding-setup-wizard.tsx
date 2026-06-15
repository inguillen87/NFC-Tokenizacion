"use client";

import { useState } from "react";
import { 
  Wine, 
  Activity, 
  Gem, 
  Sprout, 
  FileCheck, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Loader2, 
  Globe, 
  MapPin, 
  Building2 
} from "lucide-react";
import type { DashboardSession } from "../lib/session";

type Props = {
  session: DashboardSession;
};

type VerticalInfo = {
  key: string;
  name: string;
  description: string;
  icon: any;
  tone: string;
  defaultClub: string;
  defaultProduct: string;
  defaultOrigin: string;
  defaultAddress: string;
  defaultLat: number;
  defaultLng: number;
};

const VERTICALS: VerticalInfo[] = [
  {
    key: "wine",
    name: "Bodega / Vino",
    description: "Carga de lotes, control de precinto de seguridad abierto/cerrado, y portal del consumidor con catas virtuales.",
    icon: Wine,
    tone: "border-rose-500/25 bg-rose-500/5 text-rose-300 hover:border-rose-500/50 hover:bg-rose-500/10",
    defaultClub: "Club Terroir",
    defaultProduct: "Gran Reserva Cabernet",
    defaultOrigin: "Valle de Uco, Mendoza, AR",
    defaultAddress: "Ruta Provincial 94, Km 12, Los Chacayes, Mendoza",
    defaultLat: -33.6267,
    defaultLng: -69.2558,
  },
  {
    key: "pharma",
    name: "Farmacia / Pharma",
    description: "Trazabilidad completa de cadena de frío y autenticidad del empaque cerrado del medicamento.",
    icon: Activity,
    tone: "border-emerald-500/25 bg-emerald-500/5 text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-500/10",
    defaultClub: "Pharma Trust Program",
    defaultProduct: "Vacuna Termosensible",
    defaultOrigin: "Laboratorio Central, Buenos Aires, AR",
    defaultAddress: "Av. de los Constituyentes 3100, CABA",
    defaultLat: -34.5772,
    defaultLng: -58.4878,
  },
  {
    key: "luxury",
    name: "Artículos de Lujo",
    description: "Registro de autenticidad para ediciones limitadas con certificado de propiedad único y transferible.",
    icon: Gem,
    tone: "border-amber-500/25 bg-amber-500/5 text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/10",
    defaultClub: "Luxury Collectors Club",
    defaultProduct: "Reloj Edición Limitada Chrono",
    defaultOrigin: "Atelier Central, Madrid, ES",
    defaultAddress: "Calle de Serrano 45, Madrid",
    defaultLat: 40.4278,
    defaultLng: -3.6872,
  },
  {
    key: "agro",
    name: "Agroindustrial",
    description: "Trazabilidad de lotes de semillas y palets de exportación con origen geográfico certificado.",
    icon: Sprout,
    tone: "border-teal-500/25 bg-teal-500/5 text-teal-300 hover:border-teal-500/50 hover:bg-teal-500/10",
    defaultClub: "Agro Certificado S.A.",
    defaultProduct: "Semilla de Girasol Fiscalizada",
    defaultOrigin: "Pampa Húmeda, Córdoba, AR",
    defaultAddress: "Ruta Nacional 9, Km 550, Villa María, Córdoba",
    defaultLat: -32.4116,
    defaultLng: -63.2435,
  },
  {
    key: "documents",
    name: "Credenciales y Diplomas",
    description: "Emisión y verificación de documentos públicos o académicos infalsificables mediante NFC.",
    icon: FileCheck,
    tone: "border-blue-500/25 bg-blue-500/5 text-blue-300 hover:border-blue-500/50 hover:bg-blue-500/10",
    defaultClub: "Certificaciones Globales",
    defaultProduct: "Diploma de Grado Universitario",
    defaultOrigin: "Campus Central Universitario, Santiago, CL",
    defaultAddress: "Av. Libertador Bernardo O'Higgins 340, Santiago",
    defaultLat: -33.4429,
    defaultLng: -70.6439,
  },
];

export function OnboardingSetupWizard({ session }: Props) {
  const [step, setStep] = useState(1);
  const [selectedVertical, setSelectedVertical] = useState<VerticalInfo>(VERTICALS[0]);
  
  // Fields for Step 2
  const [tenantName, setTenantName] = useState("");
  const [clubName, setClubName] = useState(selectedVertical.defaultClub);
  const [productLabel, setProductLabel] = useState(selectedVertical.defaultProduct);
  const [originLabel, setOriginLabel] = useState(selectedVertical.defaultOrigin);
  const [originAddress, setOriginAddress] = useState(selectedVertical.defaultAddress);
  const [originLat, setOriginLat] = useState(selectedVertical.defaultLat);
  const [originLng, setOriginLng] = useState(selectedVertical.defaultLng);
  
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function handleSelectVertical(vertical: VerticalInfo) {
    setSelectedVertical(vertical);
    setClubName(vertical.defaultClub);
    setProductLabel(vertical.defaultProduct);
    setOriginLabel(vertical.defaultOrigin);
    setOriginAddress(vertical.defaultAddress);
    setOriginLat(vertical.defaultLat);
    setOriginLng(vertical.defaultLng);
  }

  async function handleSubmit() {
    if (!tenantName.trim()) {
      setError("Por favor ingresa el nombre de tu marca o empresa.");
      return;
    }
    setError("");
    setPending(true);

    try {
      const res = await fetch("/api/tenant/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantName: tenantName.trim(),
          vertical: selectedVertical.key,
          clubName: clubName.trim(),
          productLabel: productLabel.trim(),
          originLabel: originLabel.trim(),
          originAddress: originAddress.trim(),
          originLat: Number(originLat),
          originLng: Number(originLng),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.reason || "Error al guardar la configuración.");
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 backdrop-blur-xl p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900/50 p-6 md:p-8 shadow-2xl backdrop-blur-2xl overflow-hidden">
        
        {/* Glow Effects */}
        <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -right-20 -bottom-20 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        {success ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 mb-6 animate-pulse">
              <Check className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">¡Configuración Guardada!</h2>
            <p className="mt-2 text-slate-300 max-w-sm">Estamos preparando tu entorno multi-tenant de nexID. Redireccionando...</p>
            <Loader2 className="mt-6 h-6 w-6 animate-spin text-cyan-400" />
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="border-b border-white/5 pb-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Onboarding de Tenant</span>
                <span className="text-xs text-slate-400">Paso {step} de 2</span>
              </div>
              <h1 className="mt-2 text-2xl font-bold bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                {step === 1 ? "Selecciona tu Rubro Vertical" : "Detalles de tu Marca y Origen"}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {step === 1 
                  ? "Configura las reglas criptográficas, políticas de tokenización y ciclo de vida de los chips NFC adaptados a tu industria." 
                  : "Brinda los datos por defecto para el registro de origen y claim de dueños."}
              </p>
            </div>

            {/* Step 1: Vertical Selector */}
            {step === 1 && (
              <div className="grid gap-3 max-h-[380px] overflow-y-auto pr-1">
                {VERTICALS.map((v) => {
                  const Icon = v.icon;
                  const isSelected = selectedVertical.key === v.key;
                  return (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => handleSelectVertical(v)}
                      className={`flex items-start gap-4 rounded-2xl border p-4 text-left transition ${
                        isSelected 
                          ? "border-cyan-400 bg-cyan-500/10 shadow-[0_0_15px_rgba(34,211,238,0.15)] text-cyan-100" 
                          : "border-white/5 bg-slate-950/40 text-slate-300 hover:border-white/10 hover:bg-slate-900/50"
                      }`}
                    >
                      <div className={`mt-0.5 rounded-xl border p-2.5 ${v.tone}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">{v.name}</p>
                          {isSelected && (
                            <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 border border-cyan-400/20">
                              Seleccionado
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-400 leading-relaxed">{v.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Step 2: Details Form */}
            {step === 2 && (
              <div className="grid gap-4 max-h-[380px] overflow-y-auto pr-1">
                {/* Brand Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-cyan-400" />
                    Nombre de la Marca o Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    className="rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    placeholder="Ej. Bodega Gran Reserva S.A."
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                  />
                </div>

                {/* Product/Asset Label */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    Etiqueta de Producto Default
                  </label>
                  <input
                    type="text"
                    className="rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    placeholder="Ej. Vino Premium de Bodega"
                    value={productLabel}
                    onChange={(e) => setProductLabel(e.target.value)}
                  />
                  <span className="text-[10px] text-slate-500">Categoría del activo que verán los consumidores.</span>
                </div>

                {/* Club / Program Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    Programa de Fidelidad / Club de Socios
                  </label>
                  <input
                    type="text"
                    className="rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    placeholder="Ej. Club de Bodegas"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                  />
                </div>

                {/* Origin Location Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-cyan-400" />
                    Región de Origen (Label)
                  </label>
                  <input
                    type="text"
                    className="rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    placeholder="Ej. Valle de Uco, Mendoza, AR"
                    value={originLabel}
                    onChange={(e) => setOriginLabel(e.target.value)}
                  />
                </div>

                {/* Origin Address */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                    Dirección Física del Establecimiento
                  </label>
                  <input
                    type="text"
                    className="rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    placeholder="Calle, Número, Localidad"
                    value={originAddress}
                    onChange={(e) => setOriginAddress(e.target.value)}
                  />
                </div>

                {/* Coordinates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-300">Latitud</label>
                    <input
                      type="number"
                      step="any"
                      className="rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                      placeholder="-33.6267"
                      value={originLat}
                      onChange={(e) => setOriginLat(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-300">Longitud</label>
                    <input
                      type="number"
                      step="any"
                      className="rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                      placeholder="-69.2558"
                      value={originLng}
                      onChange={(e) => setOriginLng(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
                {error}
              </p>
            )}

            {/* Actions Footer */}
            <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
              {step === 2 ? (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={pending}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Atrás
                </button>
              ) : (
                <div />
              )}

              {step === 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 px-5 py-2 text-xs font-semibold text-slate-950 transition ml-auto"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleSubmit}
                  className="flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 px-5 py-2 text-xs font-semibold text-slate-950 transition disabled:opacity-50"
                >
                  {pending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      Finalizar Configuración
                      <Check className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
