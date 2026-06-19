import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Code2,
  Gem,
  Globe2,
  KeyRound,
  PackageCheck,
  Pill,
  PlayCircle,
  Radio,
  ShieldCheck,
  Sprout,
  Store,
  TicketCheck,
  Truck,
  Webhook,
  Zap,
  Sparkles,
  Cpu,
  Shirt,
} from "lucide-react";
import { BrandLockup, Button, Card } from "@product/ui";
import { PremiumTraceabilityGlobe } from "../../components/premium-traceability-globe";
import { platformTrustedBy, platformVerticals, traceabilityGlobePoints, traceabilityGlobeRoutes, type PlatformIconKey } from "../../lib/platform-verticals";

export const metadata: Metadata = {
  title: "SDK y APIs - nexID",
  description: "SDK, APIs, webhooks y flujo POS para integrar autenticidad, QR, NFC, GS1 Digital Link y marketplace sin atar a las marcas a proveedores cerrados.",
};
const code = `import { NexIdClient } from "@nexid/sdk";

// 1. Inicializar cliente con tu API Key
const nexid = new NexIdClient({ apiKey: "nx_live_...", tenantSlug: "mi-marca" });

// 2. Leer credenciales del tag físico (QR o chip NFC seguro)
const tag = await nexid.readPhysicalTag({ uidHex, sunSignature });

// 3. Validar autenticidad y verificar estado del sello físico
const verification = await nexid.verifyAuthenticity(tag);
console.log(verification.genuine ? "Producto original" : "Alerta de copia");
// 4. Registrar propiedad (ownership) del consumidor al comprar
if (verification.genuine) {
  await nexid.claimOwnership({
    contact: buyer.email,
    bid: tag.bid,
    posToken: pos.token // Emitido al facturar en caja o e-commerce
  });
}`;
const pillars = [
  {
    icon: Code2,
    title: "SDK abierto para equipos tecnicos",
    body: "Un cliente puede integrarnos en su e-commerce, app, ERP o POS sin esperar consultoria externa ni contratos cerrados para cada cambio.",
  },
  {
    icon: ShieldCheck,
    title: "Claim seguro, no scan oportunista",
    body: "Leer una etiqueta en gondola no te hace dueno. El ownership automatico exige tag fisico seguro, token POS y, si la marca quiere, PIN.",
  },
  {
    icon: Webhook,
    title: "Eventos firmados hacia su stack",
    body: "Verificaciones, compras, claims, leads y alertas salen por webhooks firmados hacia CRM, data warehouse, Shopify, WooCommerce o soporte.",
  },
  {
    icon: Radio,
    title: "QR, NFC, GS1 y UHF en una arquitectura",
    body: "QR baja la barrera de entrada; NFC criptografico protege premium; GS1 Digital Link y RAIN/UHF preparan logistica y passport global.",
  },
];

const flow = [
  "1. La marca empieza con QR, NFC existente o lote nuevo de tags nexID.",
  "2. El SDK lee producto, passport, marketplace, beneficios y asistente IA.",
  "3. Si hay compra, el POS emite un token nxpos de un solo uso.",
  "4. El claim usa token POS + PIN opcional + tag fisico seguro.",
  "5. El CRM recibe analytics, mapa, leads y webhooks en tiempo real.",
];

const strategy = [
  { label: "LATAM", text: "Entrada barata con QR/SDK y chips NTAG DNA de menor costo cuando el caso lo justifica." },
  { label: "Europa", text: "Vinos, lujo y productos premium con NTAG 424 DNA, tamper, passport y trazabilidad fuerte." },
  { label: "Global", text: "Interoperabilidad con GS1 Digital Link, integraciones API y tags hibridos NFC/UHF para escala logistica." },
];

const trustSignals = [
  { label: "Anti-falsificacion", detail: "Criptografia y telemetria de riesgo.", Icon: ShieldCheck },
  { label: "Implementacion rapida", detail: "SDK para web, mobile, POS y ERP.", Icon: Zap },
  { label: "Estandares globales", detail: "QR, NFC, UHF y GS1 Digital Link.", Icon: Globe2 },
  { label: "Privacidad por diseno", detail: "Datos minimos y control del usuario.", Icon: KeyRound },
];

const iconByKey: Record<PlatformIconKey, typeof Sprout> = {
  sprout: Sprout,
  ticket: TicketCheck,
  pill: Pill,
  gem: Gem,
  shield: ShieldCheck,
  truck: Truck,
  package: PackageCheck,
  sparkles: Sparkles,
  cpu: Cpu,
  shirt: Shirt,
};

function SdkTopNav() {
  return (
    <header className="sdk-top-nav">
      <div className="sdk-top-nav-inner">
        <Link href="/" aria-label="nexID home" className="sdk-brand-link">
          <BrandLockup size={48} variant="ripple" theme="dark" />
          <span>SDK & APIs</span>
        </Link>
        <nav className="sdk-desktop-nav" aria-label="SDK navigation">
          <Link href="/docs">Docs</Link>
          <Link href="/pricing">Precios</Link>
          <Link href="/stack">Stack</Link>
          <Link href="/audiences">Casos de uso</Link>
          <Link href="/resellers">Partners</Link>
        </nav>
        <div className="sdk-nav-actions">
          <span className="sdk-api-status"><i /> API Status</span>
          <Link href="https://app.nexid.lat/login">
            <Button variant="secondary">Iniciar sesion</Button>
          </Link>
          <Link href="/?contact=sales#contact-modal">
            <Button>Solicitar acceso</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function SdkGlobalHeroScene() {
  return (
    <PremiumTraceabilityGlobe
      title="Infraestructura viva para productos reales"
      subtitle="Taps, rutas, origen, riesgo y canales QR/NFC/UHF conectados al CRM y al SDK."
      caption="Una capa visual y operativa para mostrarle a cualquier empresa que nexID no es solo vino: es identidad fisica verificable."
      points={traceabilityGlobePoints}
      routes={traceabilityGlobeRoutes}
      ctaHref="/demo-lab?vertical=wine"
      ctaLabel="Abrir Demo Lab"
      className="sdk-global-hero-globe"
    />
  );
}

function SdkIndustryShowcase() {
  return (
    <section className="sdk-industry-showcase">
      {platformVerticals.map((item) => {
        const Icon = iconByKey[item.icon];
        return (
          <article key={item.title} className={`sdk-industry-card sdk-industry-card--${item.tone}`}>
            <div className="sdk-industry-image-wrap">
              <img src={item.image} alt={`${item.title} conectado a nexID`} className="sdk-industry-image" />
              <span>{item.metric}</span>
            </div>
            <div className="sdk-industry-content">
              <Icon className="h-6 w-6" />
              <h2>{item.title}</h2>
              <p>{item.body}</p>
              <div className="sdk-industry-tags">
                {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <Link href={`/demo-lab?vertical=${item.demoVertical}`}>
                Ver solucion <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export default function SdkPage() {
  return (
    <main className="knowledge-page-surface public-page-shell sdk-page-shell">
      <SdkTopNav />

      <div className="container-shell space-y-10 pb-16">
        <section className="sdk-premium-hero">
          <div className="sdk-premium-copy">
            <p className="sdk-hero-eyebrow">Identidad - Autenticidad - Confianza</p>
            <h1>
              Infraestructura de identidad{" "}
              <br />
              para todo lo que creas,{" "}
              <br />
              <span>mueves y vendes.</span>
            </h1>
            <p>
              nexID SDK y APIs convierten cualquier producto, empaque, evento o activo fisico en una identidad digital verificable. Integracion en horas, preparada para millones de interacciones, sin depender de integraciones caras y dificiles de cambiar.
            </p>
            <div className="sdk-hero-actions">
              <Link href="/docs">
                <Button><Code2 className="mr-2 h-4 w-4" />Explorar documentacion</Button>
              </Link>
              <Link href="/demo-lab?vertical=wine">
                <Button variant="secondary"><PlayCircle className="mr-2 h-4 w-4" />Ver demo interactiva</Button>
              </Link>
            </div>
            <div className="sdk-trust-rail">
              {trustSignals.map((item) => {
                const Icon = item.Icon;
                return (
                  <div key={item.label}>
                    <Icon className="h-5 w-5" />
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <SdkGlobalHeroScene />
        </section>

        <SdkIndustryShowcase />

        <div className="sdk-trusted-rail">
          <span>Confian en nexID</span>
          {platformTrustedBy.map((item) => <strong key={item}>{item}</strong>)}
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pillars.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="p-5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-500/10 text-cyan-200">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-white">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{item.body}</p>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Por que lo construimos</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">Para integrar sin quedar atrapado en contratos caros</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Muchos competidores venden plataformas potentes, pero la adopcion suele depender de procesos cerrados, integraciones a medida y pricing poco flexible. nexID debe ganar por velocidad de implementacion, costo de entrada, seguridad por politica y experiencia clara para consumidor, marca e inversor.
            </p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">QR no promete anti-copia criptografica: sirve para passport, leads, marketplace y analytics de bajo costo.</div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">NFC seguro y SUN prueban autenticidad fuerte cuando la marca necesita defensa real contra clones.</div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">POS + PIN separan lectura, compra y propiedad para no regalar ownership al curioso de gondola.</div>
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-white/10 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Blueprint en 5 lineas</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Asi deberia sentirse integrar nexID</h2>
            </div>
            <pre className="overflow-x-auto bg-slate-950 p-5 text-xs leading-6 text-cyan-50"><code>{code}</code></pre>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Flujo end-to-end</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">Del primer tap a un CRM que sirve para vender</h2>
            <div className="mt-5 grid gap-3">
              {flow.map((item) => (
                <div key={item} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">{item}</div>
              ))}
            </div>
          </Card>
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Expansion</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">Una plataforma para LATAM, Europa y escala global</h2>
            <div className="mt-5 space-y-3">
              {strategy.map((item) => (
                <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-white"><Boxes className="h-4 w-4 text-cyan-300" />{item.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.text}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card className="p-6">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200"><KeyRound className="h-4 w-4" />Implementacion comercial</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-white">La empresa no compra solo tags: compra una capa operativa</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">Con SDK y APIs, nexID puede vender membresia, uso, integraciones, soporte, analytics y marketplace incluso cuando el cliente ya tiene QR, etiquetas o codigos de barra.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-50"><Store className="mb-3 h-5 w-5" />POS/caja valida compra antes de ownership.</div>
              <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm text-cyan-50"><Code2 className="mb-3 h-5 w-5" />SDK reduce friccion para programadores.</div>
              <div className="rounded-lg border border-violet-300/20 bg-violet-500/10 p-4 text-sm text-violet-50"><Webhook className="mb-3 h-5 w-5" />Webhooks alimentan procesos existentes.</div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
