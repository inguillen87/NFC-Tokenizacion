import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Cpu, Box, Lock, Zap, Fingerprint, Layers3, Activity, ShieldAlert, CheckCircle2, Leaf, Pill, Package, Star, Truck, QrCode, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "nexID | Identidad de Producto con NFC y QR",
  description: "Autenticidad criptográfica, trazabilidad completa y experiencia de cliente conectada para Agro, Pharma, Vinos, Logística y más. Pyme o Enterprise.",
};

export default function LandingB2BPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50 overflow-hidden font-sans selection:bg-cyan-500/30">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-6 lg:px-8 max-w-7xl mx-auto z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-cyan-600/15 rounded-full blur-[140px] -z-10 opacity-80 animate-pulse" />
        <div className="text-center max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-cyan-300 text-sm font-semibold backdrop-blur-md">
            <Lock className="w-4 h-4" />
            <span>nexID · Plataforma de identidad para productos físicos</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-neutral-200 to-neutral-500 leading-tight">
            Tus productos,{" "}
            <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              verificados en un toque.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Con un simple escaneo NFC o QR, tu cliente verifica autenticidad, conoce el origen exacto y accede a una experiencia exclusiva. Vos controlás el canal, la logística y los datos.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/demo-lab"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-8 py-4 text-base shadow-[0_0_40px_-5px_rgba(34,211,238,0.5)] transition-all hover:scale-105"
            >
              Probar Demo Interactivo <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/docs#trust-layers"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold px-8 py-4 text-base transition-all"
            >
              Ver Capas de Confianza
            </Link>
          </div>
        </div>
      </section>

      {/* ── VERTICALES ───────────────────────────────────────────── */}
      <section className="py-24 relative z-10 border-t border-white/5 bg-black/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-16 text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400 mb-3">Una plataforma, todas las industrias</p>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Diseñado para tu sector</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">Desde semillas en el campo hasta medicamentos en cadena fría. nexID adapta las capas de identidad al riesgo y presupuesto de cada vertical.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">

            {/* Agro */}
            <div className="group relative p-8 rounded-3xl bg-neutral-900/50 border border-white/5 backdrop-blur-xl hover:bg-neutral-800/50 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-[60px] group-hover:bg-emerald-500/20 transition-all" />
              <Leaf className="w-10 h-10 text-emerald-400 mb-6" />
              <h3 className="text-2xl font-bold mb-3 text-white">Agro &amp; Alimentos</h3>
              <p className="text-neutral-400 leading-relaxed mb-6">
                Semillas, fitosanitarios y alimentos con trazabilidad de lote, canal seguro y autenticidad en el campo. Compatible con GS1, CRM y Cropwise.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Verificación offline en galpón y campo</li>
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> QR/GS1 + NFC 424 DNA</li>
              </ul>
              <Link href="/demo-lab?vertical=seeds" className="mt-6 inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
                Ver demo Agro <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Pharma */}
            <div className="group relative p-8 rounded-3xl bg-neutral-900/50 border border-white/5 backdrop-blur-xl hover:bg-neutral-800/50 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-sky-500/10 rounded-full blur-[60px] group-hover:bg-sky-500/20 transition-all" />
              <Pill className="w-10 h-10 text-sky-400 mb-6" />
              <h3 className="text-2xl font-bold mb-3 text-white">Pharma &amp; Cadena Fría</h3>
              <p className="text-neutral-400 leading-relaxed mb-6">
                Medicamentos con prospecto digital, recall por unidad y auditoría de lote en tiempo real. Detectá manipulaciones y asegurar cumplimiento normativo.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" /> Historial inalterable para logística</li>
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" /> Sello físico TagTamper anti-apertura</li>
              </ul>
              <Link href="/demo-lab?vertical=pharma" className="mt-6 inline-flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors">
                Ver demo Pharma <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Lujo */}
            <div className="group relative p-8 rounded-3xl bg-neutral-900/50 border border-white/5 backdrop-blur-xl hover:bg-neutral-800/50 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-[60px] group-hover:bg-amber-500/20 transition-all" />
              <Star className="w-10 h-10 text-amber-400 mb-6" />
              <h3 className="text-2xl font-bold mb-3 text-white">Lujo &amp; Vinos</h3>
              <p className="text-neutral-400 leading-relaxed mb-6">
                Gemelos digitales y experiencias exclusivas para productos premium. El cliente verifica autenticidad, activa garantía y recibe beneficios de marca en un solo tap.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> NFC con criptografía dinámica (SUN)</li>
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> Pasaporte digital &amp; fidelización</li>
              </ul>
              <Link href="/demo-lab?vertical=wine" className="mt-6 inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors">
                Ver demo Vinos <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Logística */}
            <div className="group relative p-8 rounded-3xl bg-neutral-900/50 border border-white/5 backdrop-blur-xl hover:bg-neutral-800/50 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-lime-500/10 rounded-full blur-[60px] group-hover:bg-lime-500/20 transition-all" />
              <Truck className="w-10 h-10 text-lime-400 mb-6" />
              <h3 className="text-2xl font-bold mb-3 text-white">Logística &amp; Cadena de Frío</h3>
              <p className="text-neutral-400 leading-relaxed mb-6">
                Pallets, bultos y temperatura auditables. UHF/RFID, NFC y QR para rutas, depósitos y cadena fría. Control de entrega con evidencia inalterable.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" /> UHF + IoT para operaciones industriales</li>
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" /> Verificación offline con sync posterior</li>
              </ul>
              <Link href="/demo-lab?scenario=offline-verifier" className="mt-6 inline-flex items-center gap-1 text-xs font-bold text-lime-400 hover:text-lime-300 transition-colors">
                Ver demo Logística <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Eventos */}
            <div className="group relative p-8 rounded-3xl bg-neutral-900/50 border border-white/5 backdrop-blur-xl hover:bg-neutral-800/50 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-violet-500/10 rounded-full blur-[60px] group-hover:bg-violet-500/20 transition-all" />
              <Sparkles className="w-10 h-10 text-violet-400 mb-6" />
              <h3 className="text-2xl font-bold mb-3 text-white">Eventos &amp; Tickets</h3>
              <p className="text-neutral-400 leading-relaxed mb-6">
                Pulseras NFC, tickets y cashless con bloqueo de copia. Zonas VIP, consumo en vivo y capacidad controlada al instante.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" /> Bloqueo de copia y replay en tiempo real</li>
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" /> Integración POS y cashless</li>
              </ul>
              <Link href="/demo-lab?vertical=bracelet" className="mt-6 inline-flex items-center gap-1 text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors">
                Ver demo Eventos <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Electrónica */}
            <div className="group relative p-8 rounded-3xl bg-neutral-900/50 border border-white/5 backdrop-blur-xl hover:bg-neutral-800/50 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-[60px] group-hover:bg-blue-500/20 transition-all" />
              <Cpu className="w-10 h-10 text-blue-400 mb-6" />
              <h3 className="text-2xl font-bold mb-3 text-white">Electrónica &amp; Garantía</h3>
              <p className="text-neutral-400 leading-relaxed mb-6">
                Serialización por unidad, propiedad digital, garantía activable y reclamos antifraude. Control del canal gris y soporte postventa diferenciado.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" /> Verificación offline en campo</li>
                <li className="flex items-center gap-3 text-sm text-neutral-300"><CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" /> Propiedad tokenizada (Polygon)</li>
              </ul>
              <Link href="/demo-lab?scenario=polygon-ownership" className="mt-6 inline-flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">
                Ver demo Electrónica <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── ESPECTRO DE CONFIANZA ─────────────────────────────────── */}
      <section className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-16 text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400 mb-3">Capas de confianza</p>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">La capa correcta para cada riesgo</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">Más allá del código de barras. Entendé la diferencia entre rastrear un producto, autenticarlo y saber si fue abierto o manipulado.</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Nivel 1: QR/GS1 */}
            <div className="p-8 rounded-3xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 relative group">
              <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-neutral-800 text-neutral-400 group-hover:scale-110 transition-transform">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Trazabilidad (QR / GS1)</h3>
              <div className="text-sm text-neutral-400 font-medium mb-4">Nivel 1 · Visibilidad</div>
              <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
                Códigos impresos para rastreo de lote, cumplimiento GS1 Digital Link y entrada económica para pymes. Sin protección contra copias ni falsificaciones.
              </p>
              <div className="space-y-2 pt-6 border-t border-neutral-800">
                <div className="flex items-center gap-2 text-xs text-neutral-500"><CheckCircle2 className="w-3 h-3 text-neutral-400" /> Rastreo económico por lote</div>
                <div className="flex items-center gap-2 text-xs text-neutral-500"><ShieldAlert className="w-3 h-3 text-red-400" /> Se puede copiar e imprimir</div>
                <div className="flex items-center gap-2 text-xs text-neutral-500"><ShieldAlert className="w-3 h-3 text-red-400" /> Sin evidencia física de autenticidad</div>
              </div>
            </div>

            {/* Nivel 2: NFC 424 */}
            <div className="p-8 rounded-3xl bg-gradient-to-b from-neutral-800 to-neutral-900 border border-cyan-500/30 relative group shadow-[0_0_30px_-10px_rgba(34,211,238,0.2)]">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
              <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 group-hover:scale-110 transition-transform">
                <Fingerprint className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Autenticidad (NFC 424)</h3>
              <div className="text-sm text-cyan-400 font-medium mb-4">Nivel 2 · Prueba Criptográfica</div>
              <p className="text-neutral-300 text-sm mb-6 leading-relaxed">
                Cada toque genera una firma criptográfica única y de un solo uso. Elimina la copia de links, la clonación de etiquetas y los ataques de replay al instante.
              </p>
              <div className="space-y-2 pt-6 border-t border-neutral-700">
                <div className="flex items-center gap-2 text-xs text-neutral-300"><CheckCircle2 className="w-3 h-3 text-cyan-400" /> Imposible de clonar</div>
                <div className="flex items-center gap-2 text-xs text-neutral-300"><CheckCircle2 className="w-3 h-3 text-cyan-400" /> Sin app: funciona con el celular del cliente</div>
                <div className="flex items-center gap-2 text-xs text-neutral-300"><CheckCircle2 className="w-3 h-3 text-cyan-400" /> Listo para propiedad digital tokenizada</div>
              </div>
            </div>

            {/* Nivel 3: TagTamper */}
            <div className="p-8 rounded-3xl bg-gradient-to-b from-cyan-900/40 to-neutral-900 border border-cyan-400/50 relative group shadow-[0_0_50px_-15px_rgba(34,211,238,0.3)]">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
              <div className="absolute -top-3 right-6 bg-cyan-500 text-slate-950 text-[10px] font-black uppercase tracking-wider py-1 px-3 rounded-full">
                Máxima seguridad
              </div>
              <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500 text-white group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Evidencia de Apertura</h3>
              <div className="text-sm text-cyan-300 font-medium mb-4">Nivel 3 · Etiquetas con Estado Físico</div>
              <p className="text-neutral-200 text-sm mb-6 leading-relaxed">
                El sello NTAG 424 DNA TT detecta físicamente si el envase fue abierto. El mensaje criptográfico cambia de estado, probando tanto el origen como la integridad del producto.
              </p>
              <div className="space-y-2 pt-6 border-t border-cyan-800">
                <div className="flex items-center gap-2 text-xs text-neutral-200"><CheckCircle2 className="w-3 h-3 text-cyan-300" /> Detección física de apertura o rotura</div>
                <div className="flex items-center gap-2 text-xs text-neutral-200"><CheckCircle2 className="w-3 h-3 text-cyan-300" /> Cambio de estado criptográfico verificable</div>
                <div className="flex items-center gap-2 text-xs text-neutral-200"><CheckCircle2 className="w-3 h-3 text-cyan-300" /> Activa garantía y NFT al abrir</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ROLLOUT PYME vs ENTERPRISE ───────────────────────────── */}
      <section className="py-24 relative z-10 border-t border-white/5 bg-black/40">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-16 text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400 mb-3">Planes de implementación</p>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Arrancá rápido. Escalá con confianza.</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">Dos caminos claros según el tamaño de tu operación. Podés empezar pequeño y sumar capas a medida que crecés.</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-6">

            {/* Pyme */}
            <div className="relative p-8 rounded-3xl bg-neutral-900 border border-white/10 overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/8 rounded-full blur-[80px]" />
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Rollout Pyme</h3>
                  <p className="text-xs text-neutral-500 font-medium">Ideal para comenzar</p>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "QR/GS1 con pasaporte de producto",
                  "Analítica por lote y origen",
                  "Portal de cliente básico",
                  "Soporte de integración incluido",
                  "Escala desde 500 unidades",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-neutral-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/demo-lab" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-bold px-6 py-3 text-sm hover:bg-emerald-500/30 transition-colors">
                Probar demo Pyme <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Enterprise */}
            <div className="relative p-8 rounded-3xl bg-neutral-900 border border-cyan-500/25 overflow-hidden shadow-[0_0_40px_-15px_rgba(34,211,238,0.25)]">
              <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-[80px]" />
              <div className="absolute top-4 right-4 bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-[10px] font-black uppercase tracking-wider py-1 px-3 rounded-full">
                Enterprise
              </div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Rollout Enterprise</h3>
                  <p className="text-xs text-neutral-500 font-medium">Para operaciones a gran escala</p>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Todo lo de Pyme, más:",
                  "NFC 424 DNA con criptografía dinámica (SUN)",
                  "Verificación offline para campo e industria",
                  "Propiedad tokenizada en Polygon",
                  "Auditoría logística inalterable (IOTA)",
                  "UHF/IoT donde el riesgo lo justifica",
                  "Tenant Vault y Supplier Ops",
                ].map((item, i) => (
                  <li key={item} className={`flex items-start gap-3 text-sm ${i === 0 ? "text-neutral-500 font-bold" : "text-neutral-300"}`}>
                    {i > 0 && <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />}
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/demo-lab?scenario=polygon-ownership" className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 font-bold px-6 py-3 text-sm hover:bg-cyan-500/30 transition-colors">
                Probar demo Enterprise <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────── */}
      <section className="py-24 relative z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-transparent to-violet-900/15 backdrop-blur-3xl -z-10" />
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[120px]" />
        </div>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-6">¿Listo para proteger tu marca?</h2>
          <p className="text-xl text-neutral-300 mb-10">Probá Polygon Ownership, IOTA Proof y Verificación Offline en nuestro Demo Lab interactivo.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/demo-lab"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-slate-950 hover:bg-neutral-200 font-black px-8 py-4 text-base transition-all hover:scale-105"
            >
              Entrar al Demo Lab <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/?contact=demo#contact-modal"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 text-white font-semibold px-8 py-4 text-base hover:bg-white/10 transition-colors"
            >
              Agendar una demo
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
