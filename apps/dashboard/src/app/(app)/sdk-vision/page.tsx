import { Card, SectionHeading } from "@product/ui";
import { Code, Terminal, Globe, Shield, Sparkles, Cpu, Layers, BarChart3, Coins, Activity, CreditCard, DollarSign, HelpCircle, HardDrive, Compass, KeyRound, ArrowRight } from "lucide-react";
import { getDashboardI18n } from "../../../lib/locale";
import { dashboardContent } from "../../../lib/dashboard-content";
import { InteractiveSdkGuide } from "./interactive-guide";

export default async function SdkVisionPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8 pb-12">
      {/* 1. Cabecera de Módulo */}
      <SectionHeading 
        eyebrow="Developer Hub" 
        title={copy.pages.sdkVision.title} 
        description={copy.pages.sdkVision.description} 
      />

      {/* 2. ¿Qué es un SDK y por qué lo construimos? */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
            <Cpu className="h-8 w-8 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">¿Qué hace el nexID SDK y por qué democratiza el mercado?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Un SDK (Software Development Kit) es un kit de desarrollo de software que permite conectar un sistema físico, como un chip NFC seguro o un código QR, a una aplicación digital, e-commerce, Shopify o app móvil con una integración controlada.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Frente a plataformas cerradas, nexID prioriza una infraestructura integrable: SDK publico, APIs, webhooks y políticas por tenant para que el equipo técnico conecte identidad física, telemetría y fidelización sin exponer llaves crudas.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Guía de Integración Rápida para QR Existentes (Paso a Paso Novatos e Interactivo) */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Guía de Integración para QRs Existentes (Paso a Paso)</h3>
        <InteractiveSdkGuide />
      </div>

      {/* 4. Estrategia de Compatibilidad de Hardware (¿Cómo funciona con QRs y Chips Propios?) */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Estrategia de Compatibilidad de Hardware</h3>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Opción 1: Chips Criptográficos */}
          <Card className="relative overflow-hidden border border-cyan-500/30 bg-cyan-500/5 p-6 backdrop-blur-md">
            <div className="absolute right-0 top-0 -mr-12 -mt-12 h-32 w-32 rounded-full bg-cyan-500/5 blur-2xl" />
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
                <Shield className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-white">1. Chips Criptográficos (nexID Keys)</h4>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-300 font-semibold">
              Requiere chips seguros cuando la marca necesita autenticación criptográfica fuerte y defensa server-side contra replay/copia.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              El SDK invoca a nuestro servicio de verificacion en la nube para validar el payload SUN generado por chips premium NTAG 424 DNA o perfiles equivalentes configurados por tenant, sin exponer llaves crudas en frontend.
            </p>
            <div className="mt-4 rounded-lg bg-black/45 p-3 text-[11px] text-cyan-300 border border-cyan-500/10">
              Estrategia comercial: el alcance se define por plan y contrato. El valor está en vender SaaS, soporte, analítica e integración sin entregar claves maestras al frontend.
            </div>
          </Card>

          {/* Opción 2: Bring Your Own Hardware (QR / NFC Básicos) */}
          <Card className="relative overflow-hidden border border-amber-500/30 bg-amber-500/5 p-6 backdrop-blur-md">
            <div className="absolute right-0 top-0 -mr-12 -mt-12 h-32 w-32 rounded-full bg-amber-500/5 blur-2xl" />
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/25">
                <HardDrive className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-white">2. Bring Your Own QR / NFC (Hardware del Cliente)</h4>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-300 font-semibold">
              Funciona con sus propios QR o NFC básicos como carriers visibles, sin afirmar autenticación criptográfica anticopia.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Si la marca ya tiene códigos de barras GS1 impresos, códigos QR de marketing, o compró tags NFC standard (NTAG 213/215) a proveedores externos, el SDK canaliza el evento de lectura a nuestro API de telemetría sin afirmar autenticación criptográfica anticopia.
            </p>
            <div className="mt-4 rounded-lg bg-black/45 p-3 text-[11px] text-amber-300 border border-amber-500/10">
              Estrategia comercial: el SaaS, cuotas de API e integraciones se cotizan por plan. El cliente puede empezar con hardware actual y subir a chips seguros donde el riesgo lo justifique.
            </div>
          </Card>
        </div>
      </div>

      {/* 5. Panel de Monitoreo Live del SDK (Consumo de API de la Marca) */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Simulación de consumo y telemetría del SDK</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Requests */}
          <Card className="border border-white/5 bg-slate-950/40 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Llamadas a la API</span>
              <Activity className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-4">
              <b className="text-2xl font-black text-white">24.8k</b>
              <span className="text-xs text-slate-500"> requests demo</span>
            </div>
            {/* Progress Bar */}
            <div className="mt-3 h-1.5 w-full rounded-full bg-white/5">
              <div className="h-full rounded-full bg-cyan-400" style={{ width: "49.6%" }} />
            </div>
            <span className="mt-2 block text-[10px] text-slate-500">Ejemplo de consumo para sandbox comercial.</span>
          </Card>

          {/* Latency */}
          <Card className="border border-white/5 bg-slate-950/40 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Latencia Promedio</span>
              <Cpu className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="mt-4">
              <b className="text-2xl font-black text-white">Demo</b>
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/20 ml-2">Variable</span>
            </div>
            <span className="mt-5 block text-[10px] text-slate-500">La latencia real depende de región, carrier y backend contratado.</span>
          </Card>

          {/* Monetización en Exceso */}
          <Card className="border border-white/5 bg-slate-950/40 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Consumo Acumulado</span>
              <DollarSign className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-4">
              <b className="text-2xl font-black text-white">Estimado</b>
              <span className="text-xs text-slate-500"> por plan</span>
            </div>
            <span className="mt-5 block text-[10px] text-slate-500">Facturación definida por contrato, uso y políticas activas.</span>
          </Card>
        </div>
      </div>

      {/* 6. Modelo de Monetización B2B del SDK */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Modelo de Negocio e Ingresos por SDK</h3>
        <div className="grid gap-6 md:grid-cols-3">
          {/* Developer Free */}
          <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Developer</span>
                <span className="text-xs font-bold text-cyan-400">Sandbox</span>
              </div>
              <h4 className="mt-3 text-lg font-black text-white">Free Sandbox</h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">Para agencias de software y pruebas iniciales en local.</p>
              <ul className="mt-4 space-y-2 text-[11px] text-slate-300">
                <li className="flex items-center gap-2">✔️ Límites definidos por sandbox</li>
                <li className="flex items-center gap-2">✔️ 1 API Key activa</li>
                <li className="flex items-center gap-2">✔️ Redirecciones QR básicas</li>
              </ul>
            </div>
            <div className="mt-6 border-t border-white/5 pt-4 text-center">
              <span className="text-[10px] text-slate-500">Ideal para maquetar integraciones</span>
            </div>
          </div>

          {/* Growth / E-Commerce */}
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-6 flex flex-col justify-between shadow-lg relative">
            <div className="absolute top-0 right-0 -mt-2.5 mr-4 rounded-full bg-cyan-500 px-2.5 py-0.5 text-[9px] font-bold text-slate-950 uppercase">Popular</div>
            <div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">E-Commerce</span>
                <span className="text-xs font-bold text-white">Cotización</span>
              </div>
              <h4 className="mt-3 text-lg font-black text-white">Growth Core</h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-200">Para bodegas y marcas vendiendo en Shopify/WooCommerce.</p>
              <ul className="mt-4 space-y-2 text-[11px] text-slate-200">
                <li className="flex items-center gap-2">✔️ Volumen mensual por contrato</li>
                <li className="flex items-center gap-2">✔️ Webhooks firmados configurables</li>
                <li className="flex items-center gap-2">✔️ Excedentes por política comercial</li>
                <li className="flex items-center gap-2">✔️ Conectores cuando estén contratados</li>
              </ul>
            </div>
            <div className="mt-6 border-t border-cyan-500/20 pt-4 text-center">
              <span className="text-[10px] text-cyan-300">Monetización automatizada por uso</span>
            </div>
          </div>

          {/* Enterprise */}
          <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Enterprise</span>
                <span className="text-xs font-bold text-amber-400">Enterprise</span>
              </div>
              <h4 className="mt-3 text-lg font-black text-white">White-Label API</h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">Para redes de distribución masivas y marcas globales de lujo.</p>
              <ul className="mt-4 space-y-2 text-[11px] text-slate-300">
                <li className="flex items-center gap-2">✔️ API Keys y webhooks según contrato</li>
                <li className="flex items-center gap-2">✔️ Pack cifrado auditado para fábrica</li>
                <li className="flex items-center gap-2">✔️ Ownership/certificado Polygon cuando aplica</li>
                <li className="flex items-center gap-2">✔️ Soporte enterprise y SLA cuando está firmado</li>
              </ul>
            </div>
            <div className="mt-6 border-t border-white/5 pt-4 text-center">
              <span className="text-[10px] text-slate-500">Manejo masivo de transacciones</span>
            </div>
          </div>
        </div>

        {/* Web3 y claims */}
        <Card className="border border-white/5 bg-slate-900/20 p-4 text-xs text-slate-300 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2.5">
            <Coins className="h-5 w-5 text-amber-400 shrink-0" />
            <span>
              <strong>Web3 opcional:</strong> los costos por mint, gas, custodia o certificados Polygon se activan solo si la política del tenant y el contrato lo justifican. No todo tap va on-chain.
            </span>
          </div>
        </Card>
      </div>

      {/* 7. Pilares de Expansión Global */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* LATAM */}
        <Card className="relative overflow-hidden border border-white/5 bg-slate-950/60 p-6 backdrop-blur-md">
          <div className="absolute right-0 top-0 -mr-8 -mt-8 h-24 w-24 rounded-full bg-amber-500/5 blur-2xl" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/25">
            <Globe className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-base font-bold text-white">1. Entrada LATAM</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Nacemos en el corazón del mercado vitivinícola y agrícola sudamericano. Al incorporar soporte para QR/GS1 y tags NTAG21x básicos como carriers de bajo costo, bajamos la barrera económica para trazabilidad, marketing y telemetría; la autenticación criptográfica fuerte queda reservada para NTAG 424 DNA o carriers equivalentes.
          </p>
        </Card>

        {/* EUROPA */}
        <Card className="relative overflow-hidden border border-white/5 bg-slate-950/60 p-6 backdrop-blur-md">
          <div className="absolute right-0 top-0 -mr-8 -mt-8 h-24 w-24 rounded-full bg-indigo-500/5 blur-2xl" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
            <Shield className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-base font-bold text-white">2. Europa premium</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Para lujo y productos regulados, nexID ofrece validación criptográfica con NTAG 424 DNA, evidencias auditables y ownership Polygon opcional cuando agrega valor. La plataforma mantiene el control operativo en el SaaS.
          </p>
        </Card>

        {/* EL MUNDO */}
        <Card className="relative overflow-hidden border border-white/5 bg-slate-950/60 p-6 backdrop-blur-md">
          <div className="absolute right-0 top-0 -mr-8 -mt-8 h-24 w-24 rounded-full bg-cyan-500/5 blur-2xl" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-base font-bold text-white">3. Escala Global e Interoperable</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            GS1 Digital Link, QR, NFC y UHF/RFID pueden convivir por carrier y caso de uso: consumidor final, inventario, cajas, pallets o auditoría industrial sin prometer que un solo carrier resuelve todos los flujos.
          </p>
        </Card>
      </div>

      {/* 8. Previsualización de Código del SDK */}
      <Card className="border border-white/10 bg-slate-950 p-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Blueprint de Integración (@nexid/sdk)</h3>
          </div>
          <span className="rounded-full bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-400/20">
            npm i @nexid/sdk
          </span>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg bg-black/50 p-4 font-mono text-xs text-slate-300 leading-normal">
          <pre>
{`// 1. Instanciar el cliente nexID con las API Keys del Tenant
import { NexIdClient } from '@nexid/sdk';

const nexid = new NexIdClient({
  apiKey: process.env.NEXID_API_KEY,      // Solo backend; nunca exponer en frontend
  tenantSlug: 'bodegagranblend',
  environment: 'production'
});

// 2. Verificar el tap en tu servidor (Shopify/Next.js/React Native)
const verification = await nexid.verifyTap({
  bid: "MALBEC-2022-LOT1",
  picc_data: "04A7F3...",  // Parámetros capturados en el tap NFC
  enc: "E1A2C3...",
  cmac: "C5A9..."
});

if (verification.verdict === 'VALID') {
  console.log("Tap validado por nexID con evidencia disponible.");

  const pos = await nexid.activatePosPurchase({
    bid: "MALBEC-2022-LOT1",
    externalOrderId: "ORDER-1001"
  });
  
  // 3. Reclamar propiedad con POS token y registrar lead en CRM
  const claim = await nexid.claimOwnership({
    contact: "cliente@gmail.com",
    name: "Carlos Gómez",
    bid: "MALBEC-2022-LOT1",
    posToken: pos.posToken,
    meta: {
      occasion: "Regalo",
      gender: "Hombre"
    }
  });
}`}
          </pre>
        </div>
      </Card>

      {/* 9. Arquitectura del Flujo de Datos y Eventos */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border border-white/5 bg-slate-900/40 p-5">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-400" />
            <h4 className="text-sm font-bold text-white">Monitoreo de Eventos en Tiempo Real</h4>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Cada vez que un cliente utiliza el SDK para realizar un `verifyTap`, nexID registra el evento y las señales disponibles bajo política del tenant. Geolocalización, dispositivo y riesgo se usan solo cuando están disponibles, permitidos y son necesarios para auditoría.
          </p>
        </Card>
        
        <Card className="border border-white/5 bg-slate-900/40 p-5">
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 text-amber-400" />
            <h4 className="text-sm font-bold text-white">Webhooks y Automatización Activa</h4>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            El SDK se integra con webhooks firmados cuando están configurados. Tu servidor puede recibir eventos de verificación, riesgo, apertura física o ownership y disparar soporte, CRM o beneficios sin exponer llaves maestras.
          </p>
        </Card>
      </div>
    </main>
  );
}
