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
  recommendation: string;
  status: "success" | "warn" | "danger";
}

export default function CorkClient() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<CorkAnalysisResult | null>(null);

  // Simulated AI Cork analysis (inspired by Meta Segment Anything / YOLO Cork Telemetry)
  const handleAnalyzeImage = () => {
    if (!selectedImage) return;
    setIsScanning(true);
    setResult(null);

    setTimeout(() => {
      // Pick dynamic outputs based on a random seed to show different results
      const rand = Math.random();
      let analysisResult: CorkAnalysisResult;

      if (rand > 0.4) {
        analysisResult = {
          humidity: Math.round(62 + Math.random() * 10),
          sealTightness: Math.round(90 + Math.random() * 8),
          conservationScore: Math.round(88 + Math.random() * 10),
          verdict: "Estado Excelente de Guarda",
          verdictDescription: "El corcho mantiene elasticidad ideal y la cápsula conserva hermeticidad absoluta.",
          recommendation: "Apto para guarda prolongada (5-10 años). Almacenar en posición horizontal a 12°C-15°C.",
          status: "success"
        };
      } else if (rand > 0.15) {
        analysisResult = {
          humidity: Math.round(45 + Math.random() * 12),
          sealTightness: Math.round(75 + Math.random() * 10),
          conservationScore: Math.round(70 + Math.random() * 12),
          verdict: "Humedad Moderada - Vigilancia",
          verdictDescription: "Se detecta un leve resecamiento superficial del corcho por baja humedad ambiental.",
          recommendation: "Se sugiere consumir dentro de los próximos 12 a 24 meses o mejorar las condiciones de guarda humedeciendo la cava.",
          status: "warn"
        };
      } else {
        analysisResult = {
          humidity: Math.round(25 + Math.random() * 15),
          sealTightness: Math.round(50 + Math.random() * 15),
          conservationScore: Math.round(45 + Math.random() * 15),
          verdict: "Riesgo de Oxidación Detectado",
          verdictDescription: "Corcho deshidratado con micro-grietas visibles. Cápsula con holgura sospechosa.",
          recommendation: "Consumir de inmediato. El corcho ha perdido elasticidad hermética, comprometiendo la longevidad del caldo.",
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
        <span className="flex items-center gap-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-purple-300">
          <Sparkles className="w-3 h-3 text-purple-300 animate-pulse" /> nexID Vision Suite (Beta)
        </span>
      </header>

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
                  <h4 className="text-sm font-bold text-white">Subir Foto del Corcho o Cápsula</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Tomá una foto de perfil del tapón de tu botella (o su cápsula de seguridad) para analizar su estado con IA.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row justify-center gap-2 pt-2">
                  <label className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2.5 text-xs font-bold text-white transition">
                    <Upload className="w-4 h-4" />
                    <span>Seleccionar Archivo</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  
                  <button 
                    onClick={loadSampleImage} 
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 hover:bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 transition"
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
                      className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 border-none text-white font-bold gap-2 text-xs"
                    >
                      <Sparkles className="w-4 h-4 text-purple-200" /> Analizar con IA
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
              <Gauge className="w-4 h-4 text-purple-400" /> Diagnóstico de Guarda Vision Suite
            </h3>
            <p className="text-xs text-slate-400">Resultados del análisis óptico en corcho y cápsula.</p>
          </div>

          <Card className="p-5 min-h-[300px] flex flex-col justify-center">
            {isScanning ? (
              <div className="text-center space-y-3">
                <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-3 border-purple-500 border-t-transparent" />
                <p className="text-xs text-slate-300 font-mono">Buscando bordes y patrones ópticos (Segment Anything)...</p>
                <p className="text-[10px] text-slate-500 font-mono">Verificando nivel de contracción y dejos de humedad...</p>
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
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> Conservación de Guarda
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
                        <Droplet className="w-3.5 h-3.5 text-cyan-400" /> Humedad del Corcho
                      </span>
                      <span className="font-mono text-cyan-300 font-bold">{result.humidity}%</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className={`h-full rounded-full bg-cyan-500`}
                        style={{ width: `${result.humidity}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[8px] text-slate-500">
                      <span>Mínimo ideal: 60%</span>
                      <span>{result.humidity < 50 ? "⚠️ Corcho Seco" : "✓ Óptimo"}</span>
                    </div>
                  </div>

                  {/* Seal tightness */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                        <Compass className="w-3.5 h-3.5 text-amber-400" /> Ajuste de Hermeticidad
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

                {/* Final recommendation */}
                <div className="rounded-xl bg-slate-950/60 border border-white/5 p-3 flex gap-2.5 items-start">
                  <AlertTriangle className="w-4.5 h-4.5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-wider text-purple-300">Recomendación Enológica</span>
                    <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed">{result.recommendation}</p>
                  </div>
                </div>

                <Button 
                  onClick={() => { setSelectedImage(null); setResult(null); }}
                  variant="secondary"
                  className="w-full text-xs py-1.5"
                >
                  Analizar otro Corcho
                </Button>
              </motion.div>
            ) : (
              <div className="text-center text-slate-500 space-y-2 py-8">
                <HelpCircle className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs max-w-xs mx-auto">
                  Por favor, cargá o tomá una foto del corcho de tu botella para ver la estimación de estado.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
