"use client";

import React, { useState, useRef, useEffect } from "react";
import * as THREE from "three";
import { 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  Download, 
  Cpu, 
  ShieldCheck, 
  Award, 
  TrendingUp, 
  Database,
  Smartphone,
  Layers,
  HelpCircle,
  QrCode,
  Lock,
  ArrowRight,
  Bot,
  Zap,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Coins,
  Volume2,
  VolumeX,
  RefreshCw,
  Gift,
  HelpCircle as HelpIcon,
  BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@product/ui";

// Multi-market FAQs object
const faqCategories = [
  {
    id: "bodega-cosmetica",
    label: "Bodegas & Cosmética",
    icon: ShieldCheck,
    items: [
      {
        q: "¿Esto me va a encarecer mucho el costo por botella o empaque premium?",
        a: "El microchip criptográfico representa centavos de dólar por unidad (menos del 1.5% en botellas o perfumes premium). Además, al operar sobre una base de datos SQL híbrida en servidores premium de Render y AWS por defecto, no hay costos de gas fees ni transacciones de blockchain obligatorias para tu línea estándar.",
        ctx: "A cambio de este mínimo costo, eliminas el fraude y adquieres un canal de datos directo al consumidor final (DTC) que te ahorra miles de dólares en intermediarios de marketing."
      },
      {
        q: "¿Me va a ralentizar la línea de empaque industrial o embotellado?",
        a: "No. Los chips se entregan en formato inlay autoadhesivo (rollos industriales estándar). Tus máquinas etiquetadoras automáticas los aplican debajo de la contraetiqueta o bajo el sello del empaque de forma integrada y sin perder milésimas de velocidad.",
        ctx: "La implementación es totalmente transparente para el gerente de operaciones tanto en embotelladoras como en líneas de envasado cosmético."
      },
      {
        q: "En cosmética, ¿cómo evito que rellenen mis envases originales de perfume o cremas?",
        a: "nexID utiliza circuitos micro-electrónicos TagTamper integrados en el cierre. Al abrir la tapa o atomizador, el filamento del chip se rompe físicamente. El sistema registra permanentemente en el servidor SQL que el sello fue violado.",
        ctx: "Si alguien escanea un perfume rellenado, el sistema advertirá inmediatamente al comprador que el envase original ya fue abierto, destruyendo el mercado negro de adulteraciones."
      }
    ]
  },
  {
    id: "pharma-agro",
    label: "Farmacéutica & Agro",
    icon: Layers,
    items: [
      {
        q: "¿Qué ventaja tiene sobre el código de barras que exige la regulación de medicamentos?",
        a: "El código de barras es estático y fácilmente duplicable por fotocopiadoras en empaques apócrifos. El microchip nexID genera una firma criptográfica dinámica de un solo uso que se valida contra nuestro servidor seguro en Render/AWS.",
        ctx: "Si una mafia copia el empaque, el servidor detecta que la firma del chip está ausente, es inválida o reporta ubicaciones geográficas simultáneas imposibles, bloqueando la falsificación de medicamentos de alto costo."
      },
      {
        q: "En el agro, ¿qué valor tiene colocar chips en bolsas de semillas de autor o agroquímicos?",
        a: "El mercado negro de semillas adulteradas y agroquímicos diluidos genera pérdidas millonarias y daña cosechas enteras. El chip nexID certifica el origen del criadero o laboratorio oficial directamente en el campo mediante un tap con el celular.",
        ctx: "El productor escanea el bidón o bolsa con su celular y valida que el agroquímico posee la composición y concentración original, protegiendo los derechos de autor y la producción agrícola."
      }
    ]
  },
  {
    id: "eventos-tickets",
    label: "Eventos & Tickets",
    icon: Smartphone,
    items: [
      {
        q: "Los códigos QR de las entradas se revenden y duplican. ¿Cómo lo soluciona nexID?",
        a: "Reemplazamos el QR digital por pulseras o credenciales VIP físicas inteligentes equipadas con chip NFC nexID. Cada ingreso requiere un tap físico que se procesa en milisegundos contra nuestro servidor Render.",
        ctx: "Al ser imposible clonar la llave criptográfica del chip, se erradica por completo la entrada duplicada o el fraude de accesos en eventos VIP y corporativos."
      }
    ]
  },
  {
    id: "inversores",
    label: "Inversores & SQL Híbrido",
    icon: Coins,
    items: [
      {
        q: "¿Por qué ofrecer una solución híbrida (SQL + Blockchain Opcional)?",
        a: "Muchos clientes B2B tradicionales le temen a la Web3, gas fees y billeteras digitales. Al ofrecer por defecto una arquitectura SQL segura hospedada en AWS y Render, logramos un onboarding inmediato y sin fricciones.",
        ctx: "Si un cliente final lanza una línea ultra-premium o de colección y desea inmutabilidad total para el mercado de subastas, activamos la capa de Polygon on-chain como un add-on premium facturado en el plan SaaS."
      },
      {
        q: "¿Cómo garantizan la seguridad de la base de datos SQL si es centralizada?",
        a: "La seguridad no depende de la base de datos, sino de la criptografía del chip. Cada tap dinámico genera una firma SUN que solo puede ser descifrada por claves maestras almacenadas en un KMS/HSM de nivel bancario.",
        ctx: "Incluso si un hacker vulnera el servidor SQL, no puede generar firmas dinámicas falsas de chips físicos porque no posee las claves criptográficas maestras."
      },
      {
        q: "¿Cómo escala el modelo SaaS en Render y AWS?",
        a: "Operamos un modelo de software de alta rentabilidad: margen por volumen en el hardware programado (chips) + suscripción SaaS mensual por el uso del panel CRM, telemetría y el motor nexID Cognitive AI Engine.",
        ctx: "Esto nos da ingresos predecibles y un moat defensivo basado en el software y la integración criptográfica propietaria."
      }
    ]
  }
];

// Interactive presentation slides array
const slides = [
  {
    title: "1) nexID Thesis",
    tagline: "Propiedad Digital y Autenticidad Física",
    bullets: [
      "nexID convierte productos físicos en activos verificables, trazables y operables.",
      "Arquitectura Híbrida: base SQL segura por defecto para onboarding fácil, con capa blockchain-ready opcional.",
      "Monetización escalable mediante hardware, setup industrial, SaaS recurrente y licencias API."
    ]
  },
  {
    title: "2) El Problema del Mercado",
    tagline: "Falsificación y Pérdida del Cliente",
    bullets: [
      "Los códigos QR estáticos y hologramas son copiables por cualquier estafador mediante fotos.",
      "Las bodegas y marcas premium pierden el rastro de sus productos tras la venta en vinotecas o exportación.",
      "El marketing tradicional (email, newsletter) tiene tasas de conversión mediocres (<2% CTR)."
    ]
  },
  {
    title: "3) La Solución Híbrida",
    tagline: "SQL en Nube Segura + Web3 Opt-in",
    bullets: [
      "Firma Criptográfica dinámica validada contra nuestra base SQL ultra-segura (Render/AWS) por defecto.",
      "Onboarding inmediato para marcas tradicionales sin necesidad de lidiar con criptomonedas o gas fees.",
      "Capa on-chain (Polygon Amoy) para acuñar pasaportes NFT e inmutabilidad en mercados de colección."
    ]
  },
  {
    title: "4) Seguridad Criptográfica",
    tagline: "Monitoreo Activo de Claves",
    bullets: [
      "Cada tap genera una firma dinámica única (SUN) que se descifra con llaves custodiadas en HSM/KMS.",
      "Telemetría de geolocalización activa: alerta si el mismo chip es leído simultáneamente en dos ciudades.",
      "Circuito físico TagTamper: el chip detecta e informa si la cápsula o sello original ya fue abierto."
    ]
  },
  {
    title: "5) nexID Cognitive AI",
    tagline: "Motor de Optimización de Tono",
    bullets: [
      "Reescritura de campañas comerciales en 3 perfiles: Sommelier, Club Privado y Modern Web3.",
      "Telemetría de impacto live: calcula el Prestige Score, Viralidad y la Huella Emocional del texto.",
      "Traducción semántica inteligente de palabras planas a jerga enológica y tecnológica premium."
    ]
  },
  {
    title: "6) Fidelidad & Gamificación VIP",
    tagline: "Estatus y Cava Digital 3D",
    bullets: [
      "Cava digital interactiva donde los consumidores reclaman la propiedad y coleccionan sus botellas.",
      "Categorías de membresía metálica (Bronce, Plata, Oro) con beneficios y preventas exclusivas.",
      "Gobernanza activa: encuestas on-chain para decidir cortes del próximo Blend o diseño de etiquetas."
    ]
  },
  {
    title: "7) Tracción y Modelo B2B",
    tagline: "SaaS Recurrente y Alto Margen",
    bullets: [
      "Ingresos recurrentes por SaaS de acceso al CRM, geolocalización, AI Engine y portal VIP.",
      "Venta del hardware pre-programado en inlays autoadhesivos con margen del 40%.",
      "Ecosistema multimercado aplicable a Bodegas, Cosmética, Farmacéutica, Agro y Eventos."
    ]
  },
  {
    title: "8) Live Demo Checklist",
    tagline: "Demostración Práctica en 3 Minutos",
    bullets: [
      "1. Hackear QR: Demostrar cómo se clona un QR fotocopiándolo desde una pantalla.",
      "2. Tap NFC: Acercar el móvil a una botella con chip nexID y abrir el Portal VIP sin instalar apps.",
      "3. Live CRM: Mostrar en la notebook cómo el tap apareció en vivo en el mapa del panel."
    ]
  }
];

// Three.js 3D Bottle Component with WebGL procedural modeling, glass shaders and mouse rotation
export function ThreeDBottle({ active, tapping }: { active: boolean; tapping: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (typeof window === "undefined" || !mountRef.current) return;
    
    const container = mountRef.current;
    const width = container.clientWidth || 130;
    const height = container.clientHeight || 240;
    
    // Scene
    const scene = new THREE.Scene();
    
    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 6.2, 20);
    camera.lookAt(0, 5.8, 0);
    
    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.3);
    mainLight.position.set(6, 12, 10);
    scene.add(mainLight);
    
    const fillLight = new THREE.DirectionalLight(0x06b6d4, 0.75); // Cyan fill
    fillLight.position.set(-6, 5, -5);
    scene.add(fillLight);
    
    const rimLight = new THREE.DirectionalLight(0x8b5cf6, 0.9); // Purple rim
    rimLight.position.set(0, 10, -8);
    scene.add(rimLight);

    // Glowing hotspot light on neck
    const hotspotLight = new THREE.PointLight(0x06b6d4, 0, 8);
    hotspotLight.position.set(0, 11, 0);
    scene.add(hotspotLight);
    
    // Bottle Geometry (using LatheGeometry for wine bottle shape)
    const points = [];
    // Bottom flat face
    points.push(new THREE.Vector2(0, 0));
    points.push(new THREE.Vector2(1.7, 0));
    points.push(new THREE.Vector2(1.8, 0.1));
    // Main body
    points.push(new THREE.Vector2(1.85, 0.4));
    points.push(new THREE.Vector2(1.85, 6.0));
    // Shoulder curve
    points.push(new THREE.Vector2(1.75, 6.8));
    points.push(new THREE.Vector2(1.5, 7.5));
    points.push(new THREE.Vector2(1.1, 8.2));
    points.push(new THREE.Vector2(0.7, 8.8));
    points.push(new THREE.Vector2(0.55, 9.3));
    // Neck
    points.push(new THREE.Vector2(0.55, 12.0));
    // Collar/Lip at top
    points.push(new THREE.Vector2(0.65, 12.1));
    points.push(new THREE.Vector2(0.65, 12.4));
    points.push(new THREE.Vector2(0.5, 12.5));
    // Inner lip (to close the bottle shape)
    points.push(new THREE.Vector2(0, 12.5));
    
    const bottleGeometry = new THREE.LatheGeometry(points, 32);
    
    // Glass Material
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x061e0e, // dark premium forest green
      roughness: 0.04,
      metalness: 0.1,
      transmission: 0.8, // Transparent glass
      thickness: 0.9,
      ior: 1.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      specularIntensity: 1.0,
      envMapIntensity: 1.0,
    });
    
    const bottleMesh = new THREE.Mesh(bottleGeometry, glassMaterial);
    bottleMesh.position.y = 0.2;
    scene.add(bottleMesh);
    
    // Label geometry (Cylinder wrapped around bottle body)
    const labelGeometry = new THREE.CylinderGeometry(1.86, 1.86, 3.8, 32, 1, true);
    
    // Procedural Label Texture Canvas
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Background: Matte dark charcoal
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, 512, 512);
      
      // Golden borders
      ctx.strokeStyle = "#e2b857";
      ctx.lineWidth = 6;
      ctx.strokeRect(20, 20, 472, 472);
      ctx.lineWidth = 2;
      ctx.strokeRect(30, 30, 452, 452);
      
      // Text
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("N E X I D", 256, 100);
      
      ctx.fillStyle = "#e2b857";
      ctx.font = "italic 700 24px Georgia, serif";
      ctx.fillText("Gran Blend Seleccionado", 256, 160);
      
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "600 16px monospace";
      ctx.fillText("SQL SECURE CORE & POLYGON WEB3", 256, 220);
      
      // Shield logo in gold
      ctx.strokeStyle = "#e2b857";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(256, 260);
      ctx.lineTo(300, 280);
      ctx.lineTo(290, 330);
      ctx.quadraticCurveTo(256, 370, 256, 370);
      ctx.quadraticCurveTo(222, 330, 222, 330);
      ctx.lineTo(212, 280);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = "#e2b857";
      ctx.fill();
      
      // n inside shield
      ctx.fillStyle = "#000000";
      ctx.font = "900 28px sans-serif";
      ctx.fillText("N", 256, 320);
      
      // Details
      ctx.fillStyle = "#e2b857";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("ORIGEN: MENDOZA, ARGENTINA", 256, 410);
      ctx.fillStyle = "#6b7280";
      ctx.font = "14px monospace";
      ctx.fillText("NFC SECURE TAG: 04:A5:8C:12", 256, 440);
    }
    
    const labelTexture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.MeshStandardMaterial({
      map: labelTexture,
      roughness: 0.6,
      metalness: 0.1,
      bumpScale: 0.05,
    });
    
    const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
    labelMesh.position.set(0, 3.4, 0); // aligned to middle of bottle body
    bottleMesh.add(labelMesh);
    
    // NFC Chip hotspot torus at neck
    const hotspotGeometry = new THREE.TorusGeometry(0.6, 0.08, 16, 64);
    const hotspotMaterial = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.7,
    });
    const hotspotMesh = new THREE.Mesh(hotspotGeometry, hotspotMaterial);
    hotspotMesh.rotation.x = Math.PI / 2;
    hotspotMesh.position.set(0, 11.0, 0);
    bottleMesh.add(hotspotMesh);
    
    // Animation loop variables
    let animationFrameId: number;
    let targetRotationY = 0;
    let currentRotationY = 0;
    let isDragging = false;
    let previousMouseX = 0;
    
    // Drag rotation controls
    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMouseX = e.clientX;
    };
    
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMouseX;
      targetRotationY += deltaX * 0.015;
      previousMouseX = e.clientX;
    };
    
    const onMouseUp = () => {
      isDragging = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        previousMouseX = e.touches[0].clientX;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - previousMouseX;
      targetRotationY += deltaX * 0.015;
      previousMouseX = e.touches[0].clientX;
    };

    const onTouchEnd = () => {
      isDragging = false;
    };
    
    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("touchstart", onTouchStart);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);
    
    let clock = new THREE.Clock();
    
    const animate = () => {
      const elapsedTime = clock.getElapsedTime();
      
      // Auto-rotation when not dragging
      if (!isDragging) {
        targetRotationY += 0.003;
      }
      
      // Smooth interpolation for rotation
      currentRotationY += (targetRotationY - currentRotationY) * 0.1;
      bottleMesh.rotation.y = currentRotationY;
      
      // Floating motion
      bottleMesh.position.y = 0.2 + Math.sin(elapsedTime * 1.5) * 0.15;
      
      // Handle active state - spin and shine
      if (active) {
        hotspotMaterial.color.setHex(0xa855f7); // Purple success
        hotspotMesh.scale.setScalar(1 + Math.sin(elapsedTime * 6) * 0.15);
        hotspotMaterial.opacity = 0.9;
        hotspotLight.intensity = 2.0 + Math.sin(elapsedTime * 10) * 0.5;
      } else if (tapping) {
        // Blink light rapidly
        hotspotMaterial.color.setHex(0x06b6d4); // Cyan read
        const speed = Math.sin(elapsedTime * 25) > 0 ? 1 : 0;
        hotspotMaterial.opacity = speed * 0.8 + 0.1;
        hotspotLight.intensity = speed * 2.5;
        hotspotMesh.scale.setScalar(1 + speed * 0.25);
      } else {
        // Idle heartbeat glow
        hotspotMaterial.color.setHex(0x06b6d4); // Cyan idle
        hotspotMaterial.opacity = 0.4 + Math.sin(elapsedTime * 3) * 0.25;
        hotspotLight.intensity = 0.4 + Math.sin(elapsedTime * 3) * 0.25;
        hotspotMesh.scale.setScalar(1 + Math.sin(elapsedTime * 3) * 0.08);
      }
      
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    
    // Resize handler
    const handleResize = () => {
      const w = container.clientWidth || 130;
      const h = container.clientHeight || 240;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    
    window.addEventListener("resize", handleResize);
    
    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      bottleGeometry.dispose();
      glassMaterial.dispose();
      labelGeometry.dispose();
      labelMaterial.dispose();
      labelTexture.dispose();
      hotspotGeometry.dispose();
      hotspotMaterial.dispose();
      
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", handleResize);
    };
  }, [active, tapping]);
  
  return (
    <div ref={mountRef} className="w-full h-full relative cursor-grab active:cursor-grabbing" />
  );
}

// Industry ROI presets data structure
interface IndustryPreset {
  name: string;
  label: string;
  volume: number;
  fraudRate: number;
  icon: string;
  price: number;
}

const INDUSTRY_PRESETS: IndustryPreset[] = [
  { name: "bodegas", label: "Bodegas Premium", volume: 150000, fraudRate: 4.2, icon: "🍷", price: 45 },
  { name: "cosmetica", label: "Cosmética de Lujo", volume: 300000, fraudRate: 5.5, icon: "💄", price: 75 },
  { name: "agro", label: "Agro Premium", volume: 80000, fraudRate: 6.8, icon: "🌾", price: 60 },
  { name: "pharma", label: "Farmacéutica (Alto Costo)", volume: 50000, fraudRate: 3.5, icon: "🧪", price: 120 },
  { name: "eventos", label: "Eventos & Tickets VIP", volume: 25000, fraudRate: 8.5, icon: "🎫", price: 50 },
];

// Interactive ROI & Financial Impact Calculator Component
export function RoiCalculator() {
  const [selectedPreset, setSelectedPreset] = useState<string>("bodegas");
  const [volume, setVolume] = useState<number>(150000);
  const [fraudRate, setFraudRate] = useState<number>(4.2);
  const [retailPrice, setRetailPrice] = useState<number>(45);

  const applyPreset = (presetName: string) => {
    const preset = INDUSTRY_PRESETS.find(p => p.name === presetName);
    if (preset) {
      setSelectedPreset(presetName);
      setVolume(preset.volume);
      setFraudRate(preset.fraudRate);
      setRetailPrice(preset.price);
    }
  };

  const grossLoss = volume * retailPrice * (fraudRate / 100);
  const preventedFraud = grossLoss * 0.98; // 98% efficiency
  const nexIdChipsCost = volume * 0.35; // $0.35 per tag
  const nexIdSaaSYearly = 2400; // $199/month
  const totalNexIdCost = nexIdChipsCost + nexIdSaaSYearly;
  
  const netSavings = preventedFraud - totalNexIdCost;
  const roiMultiplier = totalNexIdCost > 0 ? (netSavings / totalNexIdCost) : 0;
  const dtcClients = Math.round(volume * 0.35); // 35% scan rate

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 lg:p-10 shadow-2xl relative overflow-hidden backdrop-blur-md">
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full filter blur-[100px] pointer-events-none" />
      
      <div className="space-y-8">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 border-b border-white/5 pb-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-300">
              ⚡ Simulador Financiero B2B
            </div>
            <h2 className="text-2xl lg:text-3xl font-black text-white uppercase tracking-tight leading-none">
              Ahorro por Pérdidas y Retorno de Inversión (ROI)
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Descubre cuánto dinero pierde tu marca por fraude y reventa del mercado gris, y cómo la arquitectura híbrida de nexID (SQL + Web3) recupera ese margen con un ROI masivo.
            </p>
          </div>
          
          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/10 shrink-0">
            {INDUSTRY_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset.name)}
                className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                  selectedPreset === preset.name
                    ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-300 shadow-lg"
                    : "text-slate-400 hover:text-white border border-transparent"
                }`}
              >
                <span className="mr-1">{preset.icon}</span>
                {preset.label.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders + Graph Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Column: Sliders */}
          <div className="lg:col-span-4 space-y-6 bg-slate-900/30 p-6 rounded-2xl border border-white/5 flex flex-col justify-between">
            <div className="space-y-6">
              <h3 className="text-xs font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">
                Ajustar Variables de Marca
              </h3>
              
              {/* Slider 1: Volume */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400 uppercase">Producción Anual</span>
                  <span className="text-white font-mono">{volume.toLocaleString()} uds</span>
                </div>
                <input
                  type="range"
                  min="10000"
                  max="1500000"
                  step="10000"
                  value={volume}
                  onChange={(e) => {
                    setVolume(Number(e.target.value));
                    setSelectedPreset(""); // custom
                  }}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                  <span>10K</span>
                  <span>1.5M</span>
                </div>
              </div>

              {/* Slider 2: Fraud Rate */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400 uppercase">Fraude / Pérdida</span>
                  <span className="text-rose-400 font-mono">{fraudRate.toFixed(1)}% línea</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="15.0"
                  step="0.1"
                  value={fraudRate}
                  onChange={(e) => {
                    setFraudRate(Number(e.target.value));
                    setSelectedPreset(""); // custom
                  }}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-rose-400"
                />
                <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                  <span>0.5%</span>
                  <span>15%</span>
                </div>
              </div>

              {/* Slider 3: Price */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400 uppercase">Precio Unitario</span>
                  <span className="text-cyan-400 font-mono">${retailPrice} USD</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="300"
                  step="5"
                  value={retailPrice}
                  onChange={(e) => {
                    setRetailPrice(Number(e.target.value));
                    setSelectedPreset(""); // custom
                  }}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                  <span>$15</span>
                  <span>$300</span>
                </div>
              </div>
            </div>
            
            {/* Cost breakdown */}
            <div className="pt-4 border-t border-white/5 space-y-1.5 text-[9px] text-slate-400 leading-none font-mono">
              <div className="flex justify-between">
                <span>Costo del Chip NFC:</span>
                <span className="text-slate-200">$0.35 USD / unidad</span>
              </div>
              <div className="flex justify-between">
                <span>Costo Base SaaS Anual:</span>
                <span className="text-slate-200">$2,400 USD ($199/mes)</span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-2 text-xs font-bold leading-none">
                <span>Inversión Anual Total:</span>
                <span className="text-white">${totalNexIdCost.toLocaleString(undefined, {maximumFractionDigits:0})} USD</span>
              </div>
            </div>
          </div>

          {/* Right Column: Graphs */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1: Comparative bar chart */}
            <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-5 flex flex-col justify-between h-[310px]">
              <div>
                <span className="text-[9px] font-black uppercase text-slate-500 block">Pérdida vs Ahorro</span>
                <h4 className="text-xs font-black text-white uppercase mt-1 leading-tight">Mapeo de Capital</h4>
              </div>
              
              {/* SVG Bar Chart */}
              <div className="h-[160px] flex items-end justify-around relative pt-4">
                <div className="absolute inset-x-0 bottom-0 h-[120px] border-b border-white/5 pointer-events-none" />
                <div className="absolute inset-x-0 bottom-[60px] h-0 border-b border-dashed border-white/5 pointer-events-none" />
                
                {/* Bar 1: Loss */}
                <div className="flex flex-col items-center w-[40px] z-10 group">
                  <div className="text-[9px] font-mono font-bold text-rose-400 mb-1 leading-none group-hover:scale-105 transition-transform">
                    -${grossLoss >= 1000000 ? `${(grossLoss/1000000).toFixed(1)}M` : `${Math.round(grossLoss/1000)}k`}
                  </div>
                  <motion.div
                    className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-lg shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                    initial={{ height: 0 }}
                    animate={{ height: Math.min(120, (grossLoss / Math.max(grossLoss, netSavings)) * 120) || 5 }}
                    transition={{ type: "spring", stiffness: 85, damping: 15 }}
                  />
                  <span className="text-[8px] font-black text-slate-500 uppercase mt-2">Pérdida</span>
                </div>
                
                {/* Bar 2: Net Savings */}
                <div className="flex flex-col items-center w-[40px] z-10 group">
                  <div className="text-[9px] font-mono font-bold text-emerald-400 mb-1 leading-none group-hover:scale-105 transition-transform">
                    +${netSavings >= 1000000 ? `${(netSavings/1000000).toFixed(1)}M` : `${Math.round(netSavings/1000)}k`}
                  </div>
                  <motion.div
                    className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    initial={{ height: 0 }}
                    animate={{ height: Math.min(120, (netSavings / Math.max(grossLoss, netSavings)) * 120) || 5 }}
                    transition={{ type: "spring", stiffness: 85, damping: 15 }}
                  />
                  <span className="text-[8px] font-black text-slate-500 uppercase mt-2">Ahorro Neto</span>
                </div>
              </div>
              
              <p className="text-[9px] text-slate-400 text-center italic leading-tight">
                *Evita rellenado, copias y fugas del mercado gris al 98%.
              </p>
            </div>

            {/* Card 2: Cumulative Area Chart (DTC Client growth) */}
            <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-5 flex flex-col justify-between h-[310px]">
              <div>
                <span className="text-[9px] font-black uppercase text-slate-500 block">Clientes Conectados DTC</span>
                <h4 className="text-xs font-black text-white uppercase mt-1 leading-tight">Fidelización Directa</h4>
              </div>
              
              {/* Dynamic SVG Line/Area graph */}
              <div className="h-[140px] w-full relative pt-4 overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 100 60" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Lines */}
                  <line x1="0" y1="15" x2="100" y2="15" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                  <line x1="0" y1="35" x2="100" y2="35" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                  <line x1="0" y1="55" x2="100" y2="55" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                  
                  {/* Gradient area */}
                  <path
                    d="M0 60 L10 50 L30 42 L60 28 L100 10 L100 60 Z"
                    fill="url(#areaGrad)"
                  />
                  
                  {/* Glowing line */}
                  <motion.path
                    d="M0 60 L10 50 L30 42 L60 28 L100 10"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                  
                  {/* Nodes */}
                  <circle cx="100" cy="10" r="2" fill="#ffffff" />
                  <circle cx="100" cy="10" r="4" fill="none" stroke="#06b6d4" strokeWidth="1" className="animate-ping origin-center" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
                </svg>
                
                {/* Year indicators */}
                <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-1 px-1">
                  <span>Año 1</span>
                  <span>Año 3</span>
                  <span>Año 5</span>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] text-slate-400">Nuevos Clientes:</span>
                  <span className="text-xs font-black text-white font-mono">{dtcClients.toLocaleString()} /año</span>
                </div>
                <div className="w-full bg-slate-950 h-1 rounded overflow-hidden">
                  <div className="bg-cyan-400 h-full w-[35%]" />
                </div>
                <span className="text-[8px] text-slate-500 block leading-tight">
                  Tasa de contacto directo post-compra del 35% de lecturas.
                </span>
              </div>
            </div>

            {/* Card 3: ROI Multiplier Card */}
            <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-5 flex flex-col justify-between h-[310px] text-center relative overflow-hidden group hover:border-cyan-500/20 transition duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full filter blur-[40px] pointer-events-none" />
              
              <div>
                <span className="text-[9px] font-black uppercase text-slate-500 block">Eficiencia de Inversión</span>
                <h4 className="text-xs font-black text-white uppercase mt-1 leading-tight">Multiplicador ROI</h4>
              </div>
              
              {/* Gold Multiplier Circle */}
              <div className="my-auto py-2">
                <div className="w-28 h-28 rounded-full border-4 border-amber-400/20 bg-amber-500/5 flex flex-col items-center justify-center mx-auto relative shadow-[0_0_30px_rgba(245,158,11,0.05)] group-hover:scale-105 group-hover:border-amber-400/40 transition duration-300">
                  <div className="absolute inset-0 rounded-full border border-dashed border-amber-400/30 animate-spin" style={{ animationDuration: "35s" }} />
                  
                  <span className="text-[8px] font-bold text-amber-300 uppercase tracking-widest leading-none">Múltiplo</span>
                  <span className="text-3xl font-black text-white font-mono mt-0.5 tracking-tighter">
                    {roiMultiplier.toFixed(1)}x
                  </span>
                  <span className="text-[8px] text-emerald-400 font-bold uppercase mt-0.5">Retorno Neto</span>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[9px] text-slate-400 px-1 font-mono">
                  <span>Inversión:</span>
                  <span className="text-slate-200 font-bold">${totalNexIdCost.toLocaleString(undefined, {maximumFractionDigits:0})} USD</span>
                </div>
                <div className="flex justify-between items-center text-[9px] text-slate-400 px-1 font-mono">
                  <span>Ganancia Neta:</span>
                  <span className="text-emerald-400 font-bold">${netSavings.toLocaleString(undefined, {maximumFractionDigits:0})} USD</span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export function InvestorSnapshotClient() {
  const [activeTab, setActiveTab] = useState<"slides" | "playbook" | "downloads">("slides");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [openFaq, setOpenFaq] = useState<string | null>("bodega-cosmetica-0");
  const [faqCatFilter, setFaqCatFilter] = useState("bodega-cosmetica");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Mouse tilt states for 3D card parallax
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const tiltRef = useRef<HTMLDivElement>(null);

  // Phone Simulator states
  const [simStep, setSimStep] = useState<"idle" | "tapping" | "loading" | "active">("idle");
  const [phoneTab, setPhoneTab] = useState<"validate" | "mint" | "rewards" | "market">("validate");
  const [isMinted, setIsMinted] = useState(false);
  const [minting, setMinting] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<Record<string, boolean>>({});

  // Web Audio Synth for NFC Tap Beep & Success chime
  const playSound = (freq: number, type: "sine" | "triangle" | "sawtooth", duration: number) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio context blocked
    }
  };

  const triggerNfcBeep = () => {
    playSound(880, "sine", 0.15); // high B5 note
  };

  const triggerSuccessChime = () => {
    playSound(523.25, "triangle", 0.1); // C5
    setTimeout(() => {
      playSound(659.25, "triangle", 0.1); // E5
    }, 100);
    setTimeout(() => {
      playSound(783.99, "triangle", 0.2); // G5
    }, 200);
  };

  const startTapSimulation = () => {
    if (simStep !== "idle") return;
    setSimStep("tapping");
    
    // Tap event contact beep
    setTimeout(() => {
      triggerNfcBeep();
      setSimStep("loading");
    }, 700);

    // Active state and success chime
    setTimeout(() => {
      setSimStep("active");
      triggerSuccessChime();
    }, 2000);
  };

  const resetSimulation = () => {
    setSimStep("idle");
    setPhoneTab("validate");
    setIsMinted(false);
    setMinting(false);
    setClaimedRewards({});
  };

  const handleMintNft = () => {
    if (minting || isMinted) return;
    setMinting(true);
    playSound(440, "sawtooth", 0.5); // processing rumble
    
    setTimeout(() => {
      setMinting(false);
      setIsMinted(true);
      triggerSuccessChime();
    }, 2200);
  };

  const handleClaimReward = (id: string) => {
    if (claimedRewards[id]) return;
    setClaimedRewards(prev => ({ ...prev, [id]: true }));
    triggerSuccessChime();
  };

  // Card Parallax Tilt handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tiltRef.current) return;
    const rect = tiltRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    // Cap rotation to 8 degrees
    setTiltY((x / (rect.width / 2)) * 8);
    setTiltX(-(y / (rect.height / 2)) * 8);
  };

  const handleMouseLeave = () => {
    setTiltX(0);
    setTiltY(0);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 lg:py-16 space-y-12 relative">
      
      {/* Background Neon Orbs */}
      <div className="absolute top-[10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-500/10 blur-[150px] pointer-events-none" />

      {/* Premium Header */}
      <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 border-b border-white/5 pb-10 relative">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-cyan-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
            Interactive Investor Hub
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-white uppercase leading-none bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
            nexID: Ecosistema Híbrido
          </h1>
          <p className="text-sm lg:text-base text-slate-400 max-w-3xl leading-relaxed">
            Una plataforma de trazabilidad de alto rendimiento. SQL centralizado seguro en Render/AWS por defecto, con capa Polygon Web3 opcional para colecciones exclusivas.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-950/80 p-2 rounded-2xl border border-white/10 gap-1.5 shrink-0 self-stretch lg:self-auto shadow-2xl backdrop-blur-md">
          {[
            { id: "slides", label: "Slides Pitch", icon: Layers },
            { id: "playbook", label: "Playbook Objeciones", icon: HelpIcon },
            { id: "downloads", label: "PDFs", icon: Download }
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  triggerNfcBeep();
                }}
                className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                  isActive 
                    ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/40 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.15)]" 
                    : "text-slate-400 hover:text-white border border-transparent hover:bg-white/[0.03]"
                }`}
              >
                <TabIcon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Split Interactive Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative">
        
        {/* Left Column (Content Canvas) */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <AnimatePresence mode="wait">
            {activeTab === "slides" && (
              <motion.div
                key="slides"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6 flex-1 flex flex-col justify-between"
              >
                <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/90 to-slate-900/60 p-8 lg:p-10 min-h-[460px] flex flex-col justify-between shadow-2xl relative overflow-hidden backdrop-blur-md">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full filter blur-[100px] pointer-events-none" />
                  
                  {/* Slide header info */}
                  <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-white/5 pb-4">
                    <span>{slides[currentSlide].title}</span>
                    <span className="text-cyan-400">Slide {currentSlide + 1} de {slides.length}</span>
                  </div>

                  {/* Slide core layout */}
                  <div className="my-auto py-6 space-y-6">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 block">
                      {slides[currentSlide].tagline}
                    </span>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight leading-none">
                      {slides[currentSlide].title.split(") ")[1] || slides[currentSlide].title}
                    </h2>
                    
                    <div className="grid gap-4 pt-2">
                      {slides[currentSlide].bullets.map((bullet, idx) => (
                        <div key={idx} className="flex items-start gap-4 text-sm text-slate-300 leading-relaxed group">
                          <span className="h-6 w-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                            {idx + 1}
                          </span>
                          <span className="group-hover:text-white transition-colors">{bullet}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Slide controls */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-4">
                    <button
                      onClick={() => {
                        setCurrentSlide(prev => Math.max(0, prev - 1));
                        triggerNfcBeep();
                      }}
                      disabled={currentSlide === 0}
                      className="text-xs font-black uppercase tracking-wider text-slate-400 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </button>

                    <div className="flex gap-2">
                      {slides.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setCurrentSlide(idx);
                            triggerNfcBeep();
                          }}
                          className={`w-2.5 h-2.5 rounded-full transition-all ${
                            currentSlide === idx 
                              ? "bg-cyan-400 w-6 shadow-[0_0_10px_rgba(6,182,212,0.6)]" 
                              : "bg-white/10 hover:bg-white/20"
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1));
                        triggerNfcBeep();
                      }}
                      disabled={currentSlide === slides.length - 1}
                      className="text-xs font-black uppercase tracking-wider text-slate-400 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2"
                    >
                      Siguiente <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Additional Pitch Metrics Widget */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { title: "Arquitectura", value: "Capa Híbrida", desc: "SQL default + Web3 opt-in" },
                    { title: "Soporte Nube", value: "AWS / Render", desc: "Redundancia multinodo" },
                    { title: "Costo por Unidad", value: "Centavos USD", desc: "<1.5% del valor retail" }
                  ].map((item, idx) => (
                    <div key={idx} className="rounded-2xl border border-white/5 bg-slate-900/10 hover:bg-slate-900/30 p-4 text-center transition duration-200">
                      <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">{item.title}</span>
                      <strong className="text-base text-white font-black mt-1 block">{item.value}</strong>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "playbook" && (
              <motion.div
                key="playbook"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6 flex-1 flex flex-col justify-between"
              >
                {/* FAQ categories grid selector */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {faqCategories.map((cat) => {
                    const CatIcon = cat.icon;
                    const isSelected = faqCatFilter === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setFaqCatFilter(cat.id);
                          setOpenFaq(`${cat.id}-0`);
                          triggerNfcBeep();
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all gap-2 ${
                          isSelected 
                            ? "bg-purple-500/10 border-purple-500/40 text-purple-300 shadow-lg" 
                            : "bg-slate-900/40 border-white/5 text-slate-400 hover:text-white hover:border-white/10"
                        }`}
                      >
                        <CatIcon className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-wider leading-none">{cat.label.split(" & ")[0]}</span>
                      </button>
                    );
                  })}
                </div>

                {/* FAQs Container */}
                <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-2xl space-y-4 flex-1 backdrop-blur-md">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4 mb-4">
                    <BookOpen className="w-4 h-4 text-purple-400" /> Respuestas Argumentativas de Venta
                  </h3>

                  <div className="space-y-3">
                    {faqCategories.find(c => c.id === faqCatFilter)?.items.map((item, idx) => {
                      const uniqueId = `${faqCatFilter}-${idx}`;
                      const isOpen = openFaq === uniqueId;
                      return (
                        <div 
                          key={idx}
                          className={`rounded-xl border transition-all duration-300 ${
                            isOpen ? "border-purple-500/40 bg-purple-950/10" : "border-white/5 bg-slate-900/10 hover:border-white/10"
                          }`}
                        >
                          <button
                            onClick={() => {
                              setOpenFaq(isOpen ? null : uniqueId);
                              triggerNfcBeep();
                            }}
                            className="w-full flex items-center justify-between gap-4 p-4 text-left font-black text-xs uppercase text-white tracking-wide"
                          >
                            <span>{item.q}</span>
                            <span className="shrink-0 text-slate-500 font-bold transition-transform duration-300" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}>
                              ▼
                            </span>
                          </button>
                          
                          {isOpen && (
                            <div className="p-4 pt-0 border-t border-white/5 space-y-3 text-xs text-slate-300 leading-relaxed">
                              <p>{item.a}</p>
                              {item.ctx && (
                                <div className="rounded-xl bg-slate-950/80 p-3.5 border-l-2 border-cyan-400/40 flex gap-3 items-start shadow-inner">
                                  <span className="text-cyan-400 shrink-0 text-xs font-mono font-black">ℹ</span>
                                  <p className="text-[11px] text-slate-400 italic leading-relaxed">{item.ctx}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "downloads" && (
              <motion.div
                key="downloads"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6 flex-1 flex flex-col justify-center"
              >
                <div className="rounded-3xl border border-white/10 bg-slate-950/85 p-10 shadow-2xl text-center space-y-8 backdrop-blur-md max-w-xl mx-auto w-full">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 flex items-center justify-center text-3xl mx-auto shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                    📂
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Descarga de PDFs Premium</h2>
                    <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                      Material oficial exportado con las mejores herramientas vectoriales. Listo para adjuntar en correos comerciales o presentar en reuniones.
                    </p>
                  </div>

                  <div className="grid gap-4 max-w-md mx-auto pt-2">
                    <a
                      href="/nexid_pitch_deck.pdf"
                      download="nexid_pitch_deck.pdf"
                      onClick={triggerSuccessChime}
                      className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-slate-900/40 hover:bg-slate-900 text-xs font-bold uppercase tracking-wider text-white hover:border-cyan-500/30 hover:shadow-lg transition-all"
                    >
                      <span className="flex items-center gap-3">
                        <span className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-300">📊</span>
                        <span>nexID Pitch Deck (Apaisado)</span>
                      </span>
                      <Download className="w-4 h-4 text-cyan-400" />
                    </a>

                    <a
                      href="/nexid_sales_playbook.pdf"
                      download="nexid_sales_playbook.pdf"
                      onClick={triggerSuccessChime}
                      className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-slate-900/40 hover:bg-slate-900 text-xs font-bold uppercase tracking-wider text-white hover:border-purple-500/30 hover:shadow-lg transition-all"
                    >
                      <span className="flex items-center gap-3">
                        <span className="p-2.5 rounded-lg bg-purple-500/10 text-purple-300">📖</span>
                        <span>Playbook & FAQs (Retrato)</span>
                      </span>
                      <Download className="w-4 h-4 text-purple-400" />
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column (The 3D Parallax NFC Simulator Arena) */}
        <div className="lg:col-span-5 flex">
          <div 
            ref={tiltRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="w-full rounded-3xl border border-white/10 bg-slate-950/80 p-6 lg:p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between backdrop-blur-md transition-transform duration-200"
            style={{ 
              transform: `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
            }}
          >
            {/* Glossy overlay reflection */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.01] to-white/[0.03] pointer-events-none" />

            {/* Arena Header */}
            <div className="w-full flex items-center justify-between border-b border-white/5 pb-4 mb-4 z-10">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                Live Demo Arena
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Audio</span>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-1.5 rounded-lg border border-white/10 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Tap Stage */}
            <div className="w-full h-[280px] relative border border-white/5 bg-slate-950/60 rounded-2xl overflow-hidden flex items-center justify-center z-10 shadow-inner">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:14px_14px] pointer-events-none" />
              
              {/* Bottle floating container */}
              <div className="absolute left-[8%] w-[130px] h-[240px] flex items-center justify-center bg-white/[0.01] border border-white/5 rounded-3xl backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 via-transparent to-transparent pointer-events-none" />
                <ThreeDBottle 
                  active={simStep === "active"} 
                  tapping={simStep === "tapping" || simStep === "loading"} 
                />
                
                {/* Contact Ripple point */}
                {simStep === "loading" && (
                  <motion.div 
                    initial={{ scale: 0.1, opacity: 1 }}
                    animate={{ scale: 5, opacity: 0 }}
                    transition={{ duration: 0.8, repeat: 1 }}
                    className="absolute top-[32%] w-10 h-10 rounded-full border-2 border-cyan-400 bg-cyan-400/20 z-20"
                  />
                )}
              </div>

              {/* Simulated iPhone Frame */}
              <motion.div
                animate={
                  simStep === "idle"
                    ? { x: 75, y: -20, rotate: 10, scale: 0.95 }
                    : simStep === "tapping"
                    ? { x: -35, y: -45, rotate: -25, scale: 1.05 }
                    : { x: 30, y: 0, rotate: 0, scale: 1.25 } // Centered & zoomed in active state
                }
                transition={
                  simStep === "tapping"
                    ? { type: "spring", stiffness: 220, damping: 14 }
                    : { type: "spring", stiffness: 100, damping: 18 }
                }
                className="absolute right-[10%] w-[130px] h-[220px] border-[4px] border-slate-800 rounded-[28px] bg-slate-950 shadow-2xl z-20 flex flex-col items-center justify-between overflow-hidden shadow-cyan-500/5"
              >
                {/* iPhone Bezel notch */}
                <div className="w-16 h-3.5 bg-slate-900 rounded-b-xl absolute top-0 z-30 flex items-center justify-center">
                  <div className="w-6 h-1 bg-slate-800 rounded-full mb-1" />
                </div>
                
                {simStep === "idle" && (
                  <div className="text-center p-3 my-auto space-y-3">
                    <Smartphone className="w-10 h-10 mx-auto text-slate-500 animate-pulse" />
                    <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest leading-3">Acercá para Tap</span>
                  </div>
                )}

                {simStep === "tapping" && (
                  <div className="text-center p-3 my-auto">
                    <Zap className="w-8 h-8 mx-auto text-cyan-400 animate-pulse" />
                    <span className="text-[8px] font-black uppercase text-cyan-300 block tracking-widest mt-1">Leyendo Chip</span>
                  </div>
                )}

                {simStep === "loading" && (
                  <div className="text-center my-auto space-y-2">
                    <RefreshCw className="w-7 h-7 mx-auto text-purple-400 animate-spin" />
                    <span className="text-[8px] font-mono text-slate-400 block uppercase">Verificando...</span>
                  </div>
                )}

                {simStep === "active" && (
                  <div className="w-full h-full bg-[#020617] flex flex-col justify-between p-2 pt-6 relative select-none">
                    
                    {/* Status bar */}
                    <div className="absolute top-1 left-2.5 right-2.5 flex justify-between items-center text-[5px] text-slate-500 font-mono">
                      <span>12:00</span>
                      <div className="flex gap-1 items-center">
                        <span>5G</span>
                        <div className="w-2.5 h-1.5 border border-slate-600 rounded-sm bg-emerald-500" />
                      </div>
                    </div>

                    <div className="text-center shrink-0">
                      <span className="text-[7px] font-black tracking-widest text-cyan-400 block uppercase">nexID VIP PORTAL</span>
                      <strong className="text-[8px] text-white block mt-0.5 uppercase truncate leading-none">Gran Blend 2026</strong>
                    </div>

                    {/* Sim Phone Screen Content */}
                    <div className="flex-1 my-2 rounded bg-slate-900/60 p-2 flex flex-col justify-between text-[7.5px] leading-relaxed text-slate-300 overflow-y-auto">
                      {phoneTab === "validate" && (
                        <div className="space-y-1.5 w-full text-left my-auto">
                          <div className="flex items-center gap-1 border-b border-white/5 pb-1 mb-1 justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 filter drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]" />
                            <div>
                              <span className="text-[7px] font-black text-white uppercase block leading-none">Autenticidad SQL</span>
                              <span className="text-[5.5px] text-emerald-400 uppercase font-bold leading-none mt-0.5 block">Verificación OK</span>
                            </div>
                          </div>
                          
                          {/* Timeline steps */}
                          <div className="space-y-1.5 relative pl-2.5 border-l border-white/10 ml-1.5 text-[5.5px] leading-tight">
                            <div className="relative">
                              <span className="absolute -left-[13px] top-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-slate-950 flex items-center justify-center text-[4px] text-white">✓</span>
                              <span className="font-bold text-slate-300 uppercase block">1. Origen Lote</span>
                              <span className="text-slate-400 block">Registrado en AWS SQL</span>
                            </div>
                            
                            <div className="relative">
                              <span className="absolute -left-[13px] top-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-slate-950 flex items-center justify-center text-[4px] text-white">✓</span>
                              <span className="font-bold text-slate-300 uppercase block">2. Logística</span>
                              <span className="text-slate-400 block">Salida de Bodega validada</span>
                            </div>
                            
                            <div className="relative">
                              <span className="absolute -left-[13px] top-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-slate-950 flex items-center justify-center text-[4px] text-white">✓</span>
                              <span className="font-bold text-slate-300 uppercase block">3. TagTamper</span>
                              <span className="text-emerald-400 font-bold block">Sellado e Intacto</span>
                            </div>
                            
                            <div className="relative">
                              <span className="absolute -left-[13px] top-0.5 w-1.5 h-1.5 rounded-full bg-purple-500 border border-slate-950 flex items-center justify-center text-[4px] text-white">✓</span>
                              <span className="font-bold text-slate-300 uppercase block">4. Polygon Web3</span>
                              <span className="text-slate-400 block">Gemelo digital listo</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {phoneTab === "mint" && (
                        <div className="space-y-1.5 w-full text-center my-auto">
                          {isMinted ? (
                            <div className="space-y-1">
                              <Award className="w-5 h-5 mx-auto text-purple-400 filter drop-shadow-[0_0_5px_rgba(168,85,247,0.3)]" />
                              <p className="font-black text-white text-[7.5px] uppercase">Título Web3 Acuñado</p>
                              <p className="text-[5.5px] font-mono text-slate-400 break-all bg-slate-950 p-1 rounded">Tx: 0xbc79...2fa8</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Coins className="w-5 h-5 mx-auto text-purple-400" />
                              <p className="font-bold text-[7px] text-white">¿Acuñar Gemelo Digital?</p>
                              <button 
                                onClick={handleMintNft}
                                disabled={minting}
                                className="w-full bg-purple-600 hover:bg-purple-500 text-[6.5px] text-white font-black uppercase rounded py-1 transition flex items-center justify-center gap-1"
                              >
                                {minting ? (
                                  <>
                                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                    <span>Acuñando...</span>
                                  </>
                                ) : (
                                  <span>Crear NFT</span>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {phoneTab === "rewards" && (
                        <div className="space-y-1.5 w-full text-center my-auto">
                          <Gift className="w-5 h-5 mx-auto text-amber-400" />
                          <p className="font-black text-white text-[7.5px] uppercase">Premios del Club</p>
                          <div className="space-y-1 pt-1.5 border-t border-white/5">
                            <div className="flex justify-between items-center bg-slate-950 p-1 rounded">
                              <span className="text-slate-300 font-medium">Copa de Cata</span>
                              {claimedRewards["wine"] ? (
                                <span className="text-emerald-400 font-bold uppercase text-[5.5px]">Claimed</span>
                              ) : (
                                <button 
                                  onClick={() => handleClaimReward("wine")}
                                  className="bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded text-[5px] font-black uppercase"
                                >
                                  Claim
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {phoneTab === "market" && (
                        <div className="space-y-1.5 w-full text-center my-auto">
                          <ShoppingBag className="w-5 h-5 mx-auto text-cyan-400" />
                          <p className="font-black text-white text-[7.5px] uppercase">Marketplace VIP</p>
                          <div className="pt-1 border-t border-white/5 text-left space-y-0.5 text-[6px]">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Floor Price:</span>
                              <span className="text-white font-bold">0.18 ETH</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Bids Activos:</span>
                              <span className="text-cyan-400 font-bold">3 Ofertas</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sim Phone Tabs */}
                    <div className="grid grid-cols-4 gap-1 border-t border-white/10 pt-1.5 shrink-0">
                      {[
                        { id: "validate", label: "Val" },
                        { id: "mint", label: "Mint" },
                        { id: "rewards", label: "Drop" },
                        { id: "market", label: "Shop" }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setPhoneTab(item.id as any);
                            triggerNfcBeep();
                          }}
                          className={`text-[6px] font-black uppercase rounded py-1 transition ${
                            phoneTab === item.id 
                              ? "bg-cyan-500/20 text-cyan-300" 
                              : "text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Action Buttons */}
            <div className="w-full grid grid-cols-2 gap-3 z-10">
              {simStep === "idle" ? (
                <Button
                  onClick={startTapSimulation}
                  variant="primary"
                  className="col-span-2 gap-2.5 text-xs py-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-black tracking-widest uppercase border border-cyan-400/30 shadow-[0_0_30px_rgba(6,182,212,0.25)] rounded-2xl"
                >
                  <Smartphone className="w-4 h-4 text-white" />
                  Simular NFC Tap
                </Button>
              ) : (
                <Button
                  onClick={resetSimulation}
                  variant="secondary"
                  className="col-span-2 gap-2 text-xs py-3 border border-white/10 text-slate-300 rounded-2xl"
                >
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                  Reiniciar Simulador
                </Button>
              )}
            </div>

            {/* Sim Info Box */}
            <div className="w-full mt-4 p-4 rounded-2xl border border-white/5 bg-slate-900/30 text-[10px] text-slate-400 leading-relaxed space-y-1.5 z-10">
              {simStep === "idle" && (
                <p>💡 <strong>Cómo probar:</strong> Haz clic en <strong>Simular NFC Tap</strong>. Observa el arco de traslación del móvil y escucha el \"bip\" dinámico al conectar.</p>
              )}
              {simStep === "active" && (
                <p>🚀 <strong>Interactúa:</strong> Navega por las pestañas del celular simulado en el centro. Intenta acuñar el NFT en Polygon o reclamar copas en el club.</p>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Interactive ROI Calculator Section */}
      <RoiCalculator />

      {/* Slide 6 VIP metal card parallax feature overlay (Premium aesthetic showcase) */}
      <section className="rounded-3xl border border-white/10 bg-slate-950 p-8 lg:p-10 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full filter blur-[100px] pointer-events-none" />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-cyan-400 block">Prestigio de Marca & Estatus</span>
            <h2 className="text-2xl lg:text-3xl font-black text-white uppercase tracking-tight">Membresías Metálicas Premium</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Consumir un producto verificado por nexID otorga puntos y sube el rango del usuario en la cava digital. Los inversores adoran este incentivo de lealtad porque impulsa la recurrencia comercial B2C sin intermediarios.
            </p>
            <div className="flex gap-4 pt-2">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
                <span className="text-[8px] text-slate-500 block uppercase font-bold">Rango Gold</span>
                <span className="text-base text-amber-400 font-black">Cofradía Activa</span>
              </div>
              <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
                <span className="text-[8px] text-slate-500 block uppercase font-bold">Retención</span>
                <span className="text-base text-purple-400 font-black">+24% Recurrencia</span>
              </div>
            </div>
          </div>

          {/* Interactive VIP metal card mockup */}
          <div className="flex justify-center">
            <motion.div 
              whileHover={{ rotateY: 15, rotateX: -10 }}
              transition={{ type: "spring", stiffness: 150, damping: 15 }}
              className="w-[320px] h-[190px] rounded-2xl bg-gradient-to-br from-amber-300/35 via-amber-600/15 to-slate-900 border-2 border-amber-400/40 p-6 flex flex-col justify-between shadow-[0_20px_50px_rgba(251,191,36,0.15)] relative overflow-hidden group cursor-pointer"
            >
              {/* Card glossy shine */}
              <div className="absolute -inset-full bg-gradient-to-tr from-transparent via-white/[0.05] to-transparent group-hover:left-full duration-1000 transition-all pointer-events-none" />
              
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[7px] font-bold text-amber-300 uppercase tracking-widest block">NEXID PRESTIGE</span>
                  <span className="text-sm font-black text-white uppercase tracking-tight mt-1 block">VIP GOLD MEMBER</span>
                </div>
                <div className="w-8 h-8 rounded bg-gradient-to-tr from-amber-400 to-amber-200 border border-amber-300/30 flex items-center justify-center text-slate-950 font-black text-sm">
                  N
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[6px] text-slate-400 block uppercase">Propietario de Lote</span>
                  <span className="text-xs text-white font-mono leading-none">04:A5:8C:12:F3:60</span>
                </div>
                <span className="text-[10px] font-bold text-amber-400/90 tracking-wider">MENDOZA 2026</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

    </div>
  );
}
