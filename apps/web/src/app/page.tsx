import Link from "next/link";
import { BrandLockup, Button } from "@product/ui";
import { productUrls } from "@product/config";

export default function HomePage() {
  return (
    <main>
      <header className="site-header sticky top-0 z-50 border-b backdrop-blur-xl">
        <div className="container-shell flex h-24 items-center justify-between gap-6 lg:h-28">
          <BrandLockup size={64} variant="ripple" theme="dark" className="hero-brand site-main-brand" />
          <nav className="hidden gap-6 text-sm md:flex site-nav">
            <Link href="/">Producto</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/resellers">Canal</Link>
            <Link href="/architecture">Arquitectura</Link>
          </nav>
          <a href={`${process.env.NEXT_PUBLIC_APP_URL || productUrls.app}/login`}>
            <Button variant="secondary">Dashboard</Button>
          </a>
        </div>
      </header>

      <section className="container-shell py-16 md:py-24">
        <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Identidad física verificable</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-white md:text-6xl">
          Autenticá productos, verificá accesos y activá experiencias con una sola plataforma.
        </h1>
        <p className="mt-5 max-w-3xl text-lg text-slate-300">
          nexID conecta tags NFC, validación backend y reglas de negocio para convertir cada toque en autenticación, estado, ownership, redención o ingreso.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/?contact=demo#contact-modal" className="rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-100">Solicitar demo</Link>
          <a href="#casos" className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100">Ver casos</a>
          <Link href="/resellers" className="rounded-xl border border-violet-300/35 bg-violet-500/15 px-4 py-3 text-sm font-semibold text-violet-100">Quiero ser reseller</Link>
        </div>
        <p className="mt-5 text-sm text-slate-300">Basic para volumen. Secure para confianza. API-first para escalar.</p>
      </section>

      <section className="container-shell py-8">
        <h2 className="text-2xl font-bold text-white">Dos niveles de confianza. Un solo sistema operativo.</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-semibold text-cyan-200">Basic</h3>
            <p className="mt-2 text-sm text-slate-300">NTAG215 para tap-to-web, serialización, acceso general, loyalty, warranty y analytics.</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-300"><li>• Rápido de desplegar</li><li>• Ideal para eventos y activaciones</li><li>• No usar para antifraude premium</li></ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-semibold text-violet-200">Secure</h3>
            <p className="mt-2 text-sm text-slate-300">NTAG 424 DNA / TagTamper para autenticidad fuerte, duplicate alerts, tamper state y flujos sensibles.</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-300"><li>• Ideal para vino, cosmética, vouchers y documentos</li><li>• Validación por tap</li><li>• Más señal, menos fraude</li></ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-semibold text-emerald-200">nexID OS</h3>
            <p className="mt-2 text-sm text-slate-300">Emisión, validación, ownership, dashboards, API, webhooks y workspace reseller.</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-300"><li>• Backend único</li><li>• Reglas por vertical</li><li>• Operación white-label</li></ul>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-400">La separación técnica entre estas capas está respaldada por las capacidades nativas de NTAG215 y NTAG 424 DNA/TagTamper.</p>
      </section>

      <section id="casos" className="container-shell py-12">
        <h2 className="text-2xl font-bold text-white">Casos con mejor wedge comercial hoy</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Link href="/wine-secure" className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-200">Wine Secure · Autenticidad, apertura y ownership para botellas premium y canal selectivo.</Link>
          <Link href="/events" className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-200">Events · Acceso, activaciones y proof-of-presence con Basic y Secure.</Link>
          <Link href="/docs-presence" className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-200">Docs & Presence · Documentos verificables, contratistas, visitas y bitácoras.</Link>
          <Link href="/cosmetics-secure" className="rounded-2xl border border-white/10 bg-white/5 p-5 text-slate-200">Cosmetics Secure · Autenticidad, estado de apertura y canal directo postventa.</Link>
        </div>
      </section>

      <section className="container-shell py-10">
        <h2 className="text-2xl font-bold text-white">Del objeto al backend en cuatro pasos</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-slate-200">1) Emitís y codificás el lote.</div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-slate-200">2) El usuario toca el tag o escanea el fallback QR.</div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-slate-200">3) nexID valida autenticidad, estado y reglas de negocio.</div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-slate-200">4) Tu sistema recibe el evento y dispara contenido, bloqueo, redención o trazabilidad.</div>
        </div>
        <p className="mt-4 text-sm text-slate-400">Modelo carrier-agnostic: QR fallback + NFC premium interaction, GS1 Digital Link-ready.</p>
      </section>

      <section className="container-shell py-10">
        <h2 className="text-2xl font-bold text-white">Vendé soluciones NFC sin construir infraestructura desde cero.</h2>
        <p className="mt-2 text-slate-300">nexID permite a agencias, converters, imprentas e integradores operar sobre una capa central con branding, control y soporte.</p>
        <ul className="mt-4 grid gap-2 md:grid-cols-2 text-sm text-slate-200">
          <li className="rounded-xl border border-white/10 bg-white/5 p-3">• Workspace aislado por partner</li>
          <li className="rounded-xl border border-white/10 bg-white/5 p-3">• Gestión de lotes y clientes</li>
          <li className="rounded-xl border border-white/10 bg-white/5 p-3">• Pricing por canal</li>
          <li className="rounded-xl border border-white/10 bg-white/5 p-3">• API y webhooks en tiers altos</li>
        </ul>
      </section>

      <section className="container-shell py-16">
        <div className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-6">
          <h2 className="text-2xl font-bold text-white">Listo para piloto.</h2>
          <p className="mt-2 text-slate-200">Definimos el caso, elegimos el formato físico y activamos el flujo de validación con tu equipo.</p>
          <Link href="/?contact=demo#contact-modal" className="mt-4 inline-flex rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-100">Agendar demo</Link>
        </div>
      </section>
    </main>
  );
}
