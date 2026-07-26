"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, Button } from "@product/ui";
import { 
  ArrowLeft, 
  Camera, 
  Sparkles, 
  Upload, 
  ShieldCheck, 
  Gauge, 
  Droplet,
  Compass,
  AlertTriangle,
  RotateCcw,
  HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CorkAnalysisResult {
  humidity: number;
  sealTightness: number;
  conservationScore: number;
  verdict: string;
  verdictDescription: string;
  status: "success" | "warn" | "danger";
}

export default function CorkClient() {
  const demoEnabled = process.env.NEXT_PUBLIC_CORK_ANALYZER_DEMO_ENABLED === "true";
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<CorkAnalysisResult | null>(null);

  // Explicit UI simulation. Values are random and never derived from the image.
  const handleAnalyzeImage = () => {
    if (!selectedImage || !demoEnabled) return;
    setIsScanning(true);
    setResult(null);

    setTimeout(() => {
      // Random scenarios exercise the UI only; they are not image analysis.
      const rand = Math.random();
      let analysisResult: CorkAnalysisResult;

      if (rand > 0.4) {
        analysisResult = {
          humidity: Math.round(62 + Math.random() * 10),
          sealTightness: Math.round(90 + Math.random() * 8),
          conservationScore: Math.round(88 + Math.random() * 10),
          verdict: "Escenario visual A",
          verdictDescription: "Valores aleatorios para probar la interfaz. No describen el corcho, la cápsula ni el vino.",
          status: "success"
        };
      } else if (rand > 0.15) {
        analysisResult = {
          humidity: Math.round(45 + Math.random() * 12),
          sealTightness: Math.round(75 + Math.random() * 10),
          conservationScore: Math.round(70 + Math.random() * 12),
          verdict: "Escenario visual B",
          verdictDescription: "Valores aleatorios para probar estados intermedios de la interfaz; no son una medición.",
          status: "warn"
        };
      } else {
        analysisResult = {
          humidity: Math.round(25 + Math.random() * 15),
          sealTightness: Math.round(50 + Math.random() * 15),
          conservationScore: Math.round(45 + Math.random() * 15),
          verdict: "Escenario visual C",
          verdictDescription: "Valores aleatorios para probar alertas visuales. No detectan oxidación, grietas ni hermeticidad.",
          status: "danger"
        };
      }

      setResult(analysisResult);
      setIsScanning(false);
    }, 2000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const loadSampleImage = () => {
    // Premium sample cork image
    setSelectedImage("/images/wine_crate.png");
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Top navigation */}
      <header className="flex items-center justify-between border-b border-white/5 pb-4">
        <Link 
          href="/me/products" 
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a mis productos
        </Link>
        <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-amber-200">
          <Sparkles className="w-3 h-3" /> Demo simulada
        </span>
      </header>

      <div role="status" className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 text-amber-100">
        <p className="text-xs font-black uppercase tracking-[0.14em]">Demo simulado · valores aleatorios · no diagnóstico</p>
        <p className="mt-1 text-xs leading-5 text-amber-100/80">
          La imagen solo sirve como preview. Esta pantalla no ejecuta IA ni mide humedad, hermeticidad, conservación, oxidación o aptitud de consumo.
          {demoEnabled ? " La simulación está habilitada para probar la UX." : " La simulación está deshabilitada; un administrador debe activar NEXT_PUBLIC_CORK_ANALYZER_DEMO_ENABLED."}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        {/* Image upload and scan display */}
        <Card className="p-6 flex flex-col items-center justify-center min-h-[350px] relative overflow-hidden">
          <AnimatePresence mode="wait">
            {!selectedImage ? (
              <motion.div 
                key="uploader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-4 w-full"
              >
                <div className="mx-auto w-16 h-16 rounded-3xl bg-slate-900 border border-white/10 flex items-center justify-center text-slate-400">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Cargar imagen para la simulación visual</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    La foto no se analiza: se usa como fondo para recorrer una experiencia de producto claramente simulada.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row justify-center gap-2 pt-2">
                  <label className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white transition ${demoEnabled ? "cursor-pointer bg-purple-600 hover:bg-purple-500" : "cursor-not-allowed bg-slate-700 opacity-60"}`}>
                    <Upload className="w-4 h-4" />
                    <span>Seleccionar Archivo</span>
                    <input type="file" accept="image/*" disabled={!demoEnabled} onChange={handleImageUpload} className="hidden" />
                  </label>
                  
                  <button 
                    onClick={loadSampleImage} 
                    disabled={!demoEnabled}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 hover:bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cargar Muestra de Cava
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full flex flex-col items-center gap-4 relative"
              >
                <div className="relative rounded-2xl overflow-hidden border border-white/10 max-h-64 max-w-sm w-full bg-slate-950 flex items-center justify-center">
                  <img src={selectedImage} alt="Cork Preview" className="max-h-60 object-contain w-auto" />
                  
                  {/* Scanning Animation laser line */}
                  {isScanning && (
                    <motion.div 
                      className="absolute left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500 shadow-[0_0_15px_rgba(168,85,247,0.8)] z-10"
                      initial={{ top: "0%" }}
                      animate={{ top: "100%" }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </div>

                {!isScanning && !result && (
                  <div className="flex gap-2 w-full max-w-xs">
                    <Button 
                      onClick={handleAnalyzeImage}
                      disabled={!demoEnabled}
                      className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 border-none text-white font-bold gap-2 text-xs"
                    >
                      <Sparkles className="w-4 h-4 text-purple-200" /> Ejecutar simulación
                    </Button>
                    <button 
                      onClick={() => { setSelectedImage(null); setResult(null); }}
                      className="p-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-slate-400 transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Results / Telemetry */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Gauge className="w-4 h-4 text-purple-400" /> Simulador visual de corcho y cápsula
            </h3>
            <p className="text-xs text-slate-400">Escenarios aleatorios para validar la interfaz; no son resultados de análisis óptico.</p>
          </div>

          <Card className="p-5 min-h-[300px] flex flex-col justify-center">
            {isScanning ? (
              <div className="text-center space-y-3">
                <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-3 border-purple-500 border-t-transparent" />
                <p className="text-xs text-slate-300 font-mono">Generando escenario visual aleatorio...</p>
                <p className="text-[10px] text-slate-500 font-mono">No se está analizando la imagen.</p>
              </div>
            ) : result ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Header state verdict */}
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div>
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                      result.status === "success" 
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                        : result.status === "warn"
                        ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                        : "border-rose-500/25 bg-rose-500/10 text-rose-300"
                    }`}>
                      {result.verdict}
                    </span>
                    <p className="text-xs text-white font-bold mt-1.5 leading-relaxed">{result.verdictDescription}</p>
                  </div>
                </div>

                {/* Metrics */}
                <div className="space-y-3 pt-1">
                  {/* Score */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> Score aleatorio simulado
                      </span>
                      <span className="font-mono text-purple-300 font-black">{result.conservationScore}/100</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className={`h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500`}
                        style={{ width: `${result.conservationScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Humidity */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                        <Droplet className="w-3.5 h-3.5 text-cyan-400" /> Humedad aleatoria simulada
                      </span>
                      <span className="font-mono text-cyan-300 font-bold">{result.humidity}%</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className={`h-full rounded-full bg-cyan-500`}
                        style={{ width: `${result.humidity}%` }}
                      />
                    </div>
                    <p className="text-[8px] text-slate-500">No medida · no usar para decisiones de guarda o consumo.</p>
                  </div>

                  {/* Seal tightness */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                        <Compass className="w-3.5 h-3.5 text-amber-400" /> Hermeticidad aleatoria simulada
                      </span>
                      <span className="font-mono text-amber-300 font-bold">{result.sealTightness}%</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className={`h-full rounded-full bg-amber-500`}
                        style={{ width: `${result.sealTightness}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Persistent evidence boundary */}
                <div className="rounded-xl bg-slate-950/60 border border-white/5 p-3 flex gap-2.5 items-start">
                  <AlertTriangle className="w-4.5 h-4.5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-wider text-purple-300">Límite de la demo</span>
                    <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed">Estos valores aleatorios no son un diagnóstico ni una recomendación de guarda o consumo. Una capacidad real requeriría un modelo validado, mediciones instrumentales, QA y revisión experta.</p>
                  </div>
                </div>

                <Button 
                  onClick={() => { setSelectedImage(null); setResult(null); }}
                  variant="secondary"
                  className="w-full text-xs py-1.5"
                >
                  Reiniciar simulación
                </Button>
              </motion.div>
            ) : (
              <div className="text-center text-slate-500 space-y-2 py-8">
                <HelpCircle className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs max-w-xs mx-auto">
                  {demoEnabled ? "Cargá una imagen para ejecutar la simulación visual." : "Demo deshabilitada. No hay análisis disponible."}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
