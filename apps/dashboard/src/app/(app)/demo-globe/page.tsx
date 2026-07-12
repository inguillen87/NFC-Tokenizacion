"use client";

import React, { useState } from "react";
import { Card, SectionHeading } from "@product/ui";
import { Globe3dMap, type GlobePoint, type GlobeRoute } from "../../../../../../packages/ui/src/globe-3d-map";
import { 
  Sparkles, Sprout, Ticket, Pill, Gem, Truck, ShieldCheck, 
  MapPin, RefreshCw, Compass, ArrowRight, Play, Server
} from "lucide-react";

// Puntos de telemetría de ejemplo alineados con los 4 sectores
const samplePoints: GlobePoint[] = [
  { city: "Mendoza", country: "Argentina", lat: -32.8895, lng: -68.8458, scans: 4820, vertical: "wine", status: "origin" },
  { city: "Buenos Aires", country: "Argentina", lat: -34.6037, lng: -58.3816, scans: 8940, vertical: "events", status: "tap" },
  { city: "Sao Paulo", country: "Brasil", lat: -23.5505, lng: -46.6333, scans: 2190, vertical: "events", risk: 3, status: "risk" },
  { city: "Miami", country: "USA", lat: 25.7617, lng: -80.1918, scans: 3180, vertical: "luxury", status: "export" },
  { city: "Zurich", country: "Suiza", lat: 47.3769, lng: 8.5417, scans: 980, vertical: "wine", status: "passport" },
  { city: "Madrid", country: "España", lat: 40.4168, lng: -3.7038, scans: 1680, vertical: "logistics", status: "dpp" },
  { city: "Bogotá", country: "Colombia", lat: 4.711, lng: -74.0721, scans: 740, vertical: "pharma", status: "cold-chain" },
];

const sampleRoutes: GlobeRoute[] = [
  { fromLat: -32.8895, fromLng: -68.8458, toLat: 47.3769, toLng: 8.5417, tone: "info", label: "Mendoza -> Zurich (Vino Premium)" },
  { fromLat: 4.711, fromLng: -74.0721, toLat: 40.4168, toLng: -3.7038, tone: "success", label: "Bogotá -> Madrid (Pharma Cold-Chain)" },
  { fromLat: -34.6037, fromLng: -58.3816, toLat: -23.5505, toLng: -46.6333, tone: "warn", label: "Buenos Aires -> Sao Paulo (Replay Attack Alert)" },
];

export default function DemoGlobePage() {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [currentRoutes, setCurrentRoutes] = useState<GlobeRoute[]>(sampleRoutes);
  const [simulating, setSimulating] = useState(false);

  const handleSimulateTap = () => {
    setSimulating(true);
    // Simula un evento logístico en tiempo real agregando una ruta dinámica
    const newRoute: GlobeRoute = {
      fromLat: -32.8895, // Mendoza
      fromLng: -68.8458,
      toLat: 25.7617, // Miami
      toLng: -80.1918,
      tone: "success",
      label: "Mendoza -> Miami (Emisión de pasaporte Web3)"
    };
    setCurrentRoutes([newRoute, ...sampleRoutes]);

    setTimeout(() => {
      setSimulating(false);
    }, 3000);
  };

  return (
    <main className="space-y-8 pb-12">
      {/* Cabecera */}
      <SectionHeading 
        eyebrow="Laboratorio de Visualización" 
        title="Ecosistema Global 3D & Sectores Sincronizados" 
        description="Demo interactiva del nuevo globo 3D holográfico con trazabilidad física en tiempo real y la unificación de los 4 pilares de marca de nexID." 
      />

      <div className="grid gap-8 lg:grid-cols-12">
        {/* COLUMNA MAPA: GLOBO 3D */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border border-cyan-500/20 bg-slate-950/80 p-6 flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 h-32 w-32 rounded-full bg-cyan-500/5 blur-2xl" />
            
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 self-start flex items-center gap-2">
              <Compass className="h-4.5 w-4.5 text-cyan-400 animate-spin" />
              Trazabilidad 3D del Origen al Destino
            </h3>
            
            <p className="text-xs text-slate-400 self-start mb-6 leading-relaxed">
              Interactúa arrastrando el globo con el ratón. Observa las conexiones de exportación de Mendoza a Zúrich, Pharma de Bogotá a Madrid y alertas en tiempo real de São Paulo.
            </p>

            {/* GLOBO 3D CANVAS */}
            <Globe3dMap 
              points={samplePoints} 
              routes={currentRoutes} 
              width={560} 
              height={440} 
              mode="globe"
              className="border border-white/5 shadow-2xl bg-black/40"
            />

            {/* Panel de Simulación Rápida */}
            <div className="mt-6 w-full flex flex-col sm:flex-row justify-between items-center border-t border-white/5 pt-4 gap-4">
              <div className="text-left">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Acción rápida</span>
                <span className="text-xs text-slate-300">Simular escaneo de importación (Mendoza ➔ Miami)</span>
              </div>
              <button
                onClick={handleSimulateTap}
                disabled={simulating}
                className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition"
              >
                <Play className="h-3.5 w-3.5" />
                {simulating ? "Transmitiendo Telemetría..." : "Emitir Escaneo Realtime"}
              </button>
            </div>
          </Card>
        </div>

        {/* COLUMNA COMPAÑÍA: SECTORES SINCRONIZADOS */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border border-white/5 bg-slate-950 p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pilares de Rubros Unificados</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Estos son los 4 rubros core que sincronizaremos transversalmente en la Landing, Demo Lab, Investor y SDK, asegurando consistencia total de marca e imágenes.
              </p>
            </div>

            <div className="space-y-4">
              {/* Agro */}
              <div className="flex items-start gap-4 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Sprout className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Agro & Alimentos</h4>
                  <p className="text-[11px] text-slate-300 mt-1 leading-normal">
                    Trazabilidad de origen y germinación en semillas. Sensores IoT de humedad de suelo y origen geográfico certificado.
                  </p>
                  <span className="text-[9px] font-mono text-emerald-400 mt-2 block">Imagen: sacos de semillas en tierra fértil</span>
                </div>
              </div>

              {/* Eventos */}
              <div className="flex items-start gap-4 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Ticket className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Eventos & Tickets</h4>
                  <p className="text-[11px] text-slate-300 mt-1 leading-normal">
                    Pulseras NFC y pases VIP anticopia. Validación instantánea de acceso y control de reventa en tiempo real.
                  </p>
                  <span className="text-[9px] font-mono text-amber-400 mt-2 block">Imagen: pulsera NFC VIP al lado de smartphone</span>
                </div>
              </div>

              {/* Pharma */}
              <div className="flex items-start gap-4 p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Pill className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Pharma & Salud</h4>
                  <p className="text-[11px] text-slate-300 mt-1 leading-normal">
                    Verificación de medicamentos auténticos, prospectos dinámicos y control de temperatura de vacunas en tránsito.
                  </p>
                  <span className="text-[9px] font-mono text-indigo-400 mt-2 block">Imagen: caja blanca con sello NFC y vial de vidrio</span>
                </div>
              </div>

              {/* Lujo */}
              <div className="flex items-start gap-4 p-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Gem className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Vinos & Lujo</h4>
                  <p className="text-[11px] text-slate-300 mt-1 leading-normal">
                    Sellos de seguridad TagTamper en corchos de vinos premium. Certificados de propiedad (NFT) para retail de lujo.
                  </p>
                  <span className="text-[9px] font-mono text-cyan-400 mt-2 block">Imagen: botella con precinto anticopia NTAG 424 DNA</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
