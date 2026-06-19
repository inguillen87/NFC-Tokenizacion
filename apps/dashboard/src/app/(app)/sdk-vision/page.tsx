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
              Un **SDK (Software Development Kit)** es un kit de desarrollo de software que permite a cualquier programador conectar un sistema físico (como un chip NFC seguro o un código QR de botella) a una aplicación digital (e-commerce, Shopify, apps móviles) con muy pocas líneas de código.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Mientras competidores globales como **Authena**, **Qliktag** y **Selinko** obligan a depender de proveedores cerrados, consultoria lenta, contratos dificiles de cambiar y aplicaciones rigidas, **nexID provee una infraestructura abierta**. Al dar un SDK publico (`@nexid/sdk`), permitimos que cualquier desarrollador integre autenticacion de originalidad y programas de fidelidad con libertad, velocidad y bajo costo de entrada.
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
              ¿Requiere nuestros chips? **Sí, para la máxima ciberseguridad anti-clonación.**
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              El SDK invoca a nuestro descifrador en la nube para desencriptar el payload SUN (Secure Unique NFC) generado por los chips premium **NTAG 424 DNA** o **NTAG 224 DNA** que grabamos con nuestras llaves criptográficas Diversificadas.
            </p>
            <div className="mt-4 rounded-lg bg-black/45 p-3 text-[11px] text-cyan-300 border border-cyan-500/10">
              📌 **Estrategia Comercial:** Este servicio del SDK se incluye **sin costo adicional** para los clientes que ya nos pagan por el SaaS y la compra física de nuestros chips NFC. Sirve para blindar el "lock-in" y darles valor agregado.
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
              ¿Funciona con sus propios QR o NFC básicos? **¡Sí, absolutamente!**
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Si la marca ya tiene códigos de barras GS1 impresos, códigos QR de marketing, o compró tags NFC standard (NTAG 213/215) a otros proveedores chinas, el SDK canaliza el evento de lectura a nuestro API de telemetría sin validar firmas criptográficas.
            </p>
            <div className="mt-4 rounded-lg bg-black/45 p-3 text-[11px] text-amber-300 border border-amber-500/10">
              📌 **Estrategia Comercial:** Cobramos la suscripción **SaaS de $99 USD/mes** + cuotas por excedente de llamadas de API. Permitimos que el cliente acceda a mapas, telemetría geográfica, IA Sommelier y Web3 usando su hardware actual.
            </div>
          </Card>
        </div>
      </div>

      {/* 5. Panel de Monitoreo Live del SDK (Consumo de API de la Marca) */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Consumo y Telemetría del SDK (Mes Actual)</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Requests */}
          <Card className="border border-white/5 bg-slate-950/40 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Llamadas a la API</span>
              <Activity className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-4">
              <b className="text-2xl font-black text-white">24,815</b>
              <span className="text-xs text-slate-500"> / 50,000 requests</span>
            </div>
            {/* Progress Bar */}
            <div className="mt-3 h-1.5 w-full rounded-full bg-white/5">
              <div className="h-full rounded-full bg-cyan-400" style={{ width: "49.6%" }} />
            </div>
            <span className="mt-2 block text-[10px] text-slate-500">49.6% consumido de tu plan actual.</span>
          </Card>

          {/* Latency */}
          <Card className="border border-white/5 bg-slate-950/40 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Latencia Promedio</span>
              <Cpu className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="mt-4">
              <b className="text-2xl font-black text-white">34 ms</b>
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/20 ml-2">Óptimo</span>
            </div>
            <span className="mt-5 block text-[10px] text-slate-500">Tiempo de respuesta del descifrador SUN.</span>
          </Card>

          {/* Monetización en Exceso */}
          <Card className="border border-white/5 bg-slate-950/40 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Consumo Acumulado</span>
              <DollarSign className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-4">
              <b className="text-2xl font-black text-white">$124.08</b>
              <span className="text-xs text-slate-500"> USD</span>
            </div>
            <span className="mt-5 block text-[10px] text-slate-500">Facturación estimada por excesos + claims Web3.</span>
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
                <span className="text-xs font-bold text-cyan-400">Gratis</span>
              </div>
              <h4 className="mt-3 text-lg font-black text-white">Free Sandbox</h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">Para agencias de software y pruebas iniciales en local.</p>
              <ul className="mt-4 space-y-2 text-[11px] text-slate-300">
                <li className="flex items-center gap-2">✔️ 1,000 validaciones / mes</li>
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
                <span className="text-xs font-bold text-white">$99 USD / mes</span>
              </div>
              <h4 className="mt-3 text-lg font-black text-white">Growth Core</h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-200">Para bodegas y marcas vendiendo en Shopify/WooCommerce.</p>
              <ul className="mt-4 space-y-2 text-[11px] text-slate-200">
                <li className="flex items-center gap-2">✔️ 25,000 validaciones / mes</li>
                <li className="flex items-center gap-2">✔️ 5 Webhooks concurrentes</li>
                <li className="flex items-center gap-2">✔️ Exceso: $0.005 USD por tap</li>
                <li className="flex items-center gap-2">✔️ Conector Shopify App</li>
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
                <span className="text-xs font-bold text-amber-400">$499 USD / mes</span>
              </div>
              <h4 className="mt-3 text-lg font-black text-white">White-Label API</h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">Para redes de distribución masivas y marcas globales de lujo.</p>
              <ul className="mt-4 space-y-2 text-[11px] text-slate-300">
                <li className="flex items-center gap-2">✔️ API Keys y Webhooks ilimitados</li>
                <li className="flex items-center gap-2">✔️ Descarga de claves SUN privadas</li>
                <li className="flex items-center gap-2">✔️ Pipeline NFT en Polygon prioritario</li>
                <li className="flex items-center gap-2">✔️ Soporte SLA 99.99%</li>
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
              <strong>Comisión Transaccional Web3:</strong> Adicionalmente cobramos <strong>$0.10 USD</strong> por cada reclamo de titularidad digital que ejecute un mint de NFT en Polygon. Esto abstrae los costos de gas para la bodega y provee un margen recurrente y líquido por cada botella tokenizada en el mundo.
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
          <h3 className="mt-4 text-base font-bold text-white">1. Líderes de LATAM</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Nacemos en el corazón del mercado vitivinícola y agrícola sudamericano. Al incorporar soporte para los chips de bajo costo **NTAG 223/224 DNA** (cuyo valor es menor a $0.15 USD), eliminamos la barrera económica y permitimos la adopción masiva en bodegas de Argentina, Chile, Uruguay y Brasil.
          </p>
        </Card>

        {/* EUROPA */}
        <Card className="relative overflow-hidden border border-white/5 bg-slate-950/60 p-6 backdrop-blur-md">
          <div className="absolute right-0 top-0 -mr-8 -mt-8 h-24 w-24 rounded-full bg-indigo-500/5 blur-2xl" />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
            <Shield className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-base font-bold text-white">2. Conquistando Europa</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Competimos directamente con las firmas europeas de lujo en Suiza, Francia e Italia. nexID ofrece validación criptográfica de grado bancario **EAL4+ (NTAG 424 DNA)** y trazabilidad Web3 con acuñación de NFTs de propiedad en Polygon. El lujo europeo encuentra máxima ciberseguridad con total flexibilidad digital.
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
            Adoptamos el estándar global **GS1 Digital Link**. Una sola etiqueta NFC o código de barras QR sirve para el escaneo logístico de distribución en China, inventario en estantes mediante UHF RFID (RAIN RFID) de largo alcance, y la interacción interactiva B2C del consumidor final.
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
  apiKey: process.env.NEXID_API_KEY,      // Llave privada de tu CRM
  tenantSlug: 'bodegagranblend',
  environment: 'production'
});

// 2. Validar autenticidad física en tu servidor (Shopify/Next.js/React Native)
const verification = await nexid.verifyTap({
  bid: "MALBEC-2022-LOT1",
  picc_data: "04A7F3...",  // Parámetros capturados en el tap NFC
  enc: "E1A2C3...",
  cmac: "C5A9..."
});

if (verification.verdict === 'VALID') {
  console.log("¡Botella 100% original!");
  
  // 3. Reclamar propiedad y registrar lead en el CRM
  const claim = await nexid.claimOwnership({
    contact: "cliente@gmail.com",
    name: "Carlos Gómez",
    bid: "MALBEC-2022-LOT1",
    uidHex: verification.uidDecrypted,
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
            Cada vez que un cliente utiliza el SDK para realizar un `verifyTap`, nexID registra la geolocalización por IP, el dispositivo y la velocidad de escaneo. Esto alimenta directamente los gráficos de analíticas del panel, identificando instantáneamente desvíos de mercado gris y sospechas de copiado de tags (Replay attacks).
          </p>
        </Card>
        
        <Card className="border border-white/5 bg-slate-900/40 p-5">
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 text-amber-400" />
            <h4 className="text-sm font-bold text-white">Webhooks y Automatización Activa</h4>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            El SDK soporta suscripción a Webhooks. Tu servidor recibirá avisos automáticos ante eventos como `tap.invalid` (sospecha de falsificación física), `seal.broken` (sensor de corcho abierto reportado por chip TagTamper) y `ownership.claimed`, permitiendo disparar correos de soporte o puntos en tu club de fidelización.
          </p>
        </Card>
      </div>
    </main>
  );
}
