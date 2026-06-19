import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Boxes, Code2, KeyRound, Radio, ShieldCheck, Store, Webhook } from "lucide-react";
import { BackLink } from "../../components/back-link";
import { Button, Card, SectionHeading } from "@product/ui";

export const metadata: Metadata = {
  title: "SDK y APIs · nexID",
  description: "SDK, APIs, webhooks y flujo POS para integrar autenticidad, QR, NFC, GS1 Digital Link y marketplace sin encerrar a las marcas en silos caros.",
};

const code = `import { NexIdClient } from "@nexid/sdk";

const nexid = new NexIdClient({ apiKey, tenantSlug: "demobodega" });
const product = await nexid.getProduct("DEMO-2026-02");
const pos = await nexid.activatePosPurchase({ bid: product.batch.bid, uidHex, externalOrderId });
await nexid.claimOwnership({ contact: buyer.email, bid: product.batch.bid, uidHex, posToken: pos.posToken });`;

const pillars = [
  {
    icon: Code2,
    title: "SDK abierto para equipos tecnicos",
    body: "Un cliente puede integrarnos en su e-commerce, app, ERP o POS sin esperar consultoria eterna ni contratos cerrados para cada cambio.",
  },
  {
    icon: ShieldCheck,
    title: "Claim seguro, no scan oportunista",
    body: "Leer una etiqueta en gondola no te hace dueño. El ownership automatico exige tag fisico seguro, token POS y, si la marca quiere, PIN.",
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
  "2. El SDK lee producto, passport, marketplace, beneficios y sommelier IA.",
  "3. Si hay compra, el POS emite un token nxpos de un solo uso.",
  "4. El claim usa token POS + PIN opcional + tag fisico seguro.",
  "5. El CRM recibe analytics, mapa, leads y webhooks en tiempo real.",
];

const strategy = [
  { label: "LATAM", text: "Entrada barata con QR/SDK y chips NTAG DNA de menor costo cuando el caso lo justifica." },
  { label: "Europa", text: "Vinos, lujo y productos premium con NTAG 424 DNA, tamper, passport y trazabilidad fuerte." },
  { label: "Global", text: "Interoperabilidad con GS1 Digital Link, integraciones API y tags hibridos NFC/UHF para escala logistica." },
];

export default function SdkPage() {
  return (
    <main className="knowledge-page-surface public-page-shell container-shell space-y-10 py-16">
      <BackLink />

      <section className="grid gap-8 lg:grid-cols-[1fr_0.92fr] lg:items-center">
        <div>
          <SectionHeading
            eyebrow="SDK + APIs + POS"
            title="El salto profesional para que nexID se integre en cualquier empresa"
            description="El SDK convierte la plataforma en infraestructura: autenticidad, QR, NFC, GS1, POS, webhooks, marketplace, leads y analytics sin forzar a cada cliente a comprar hardware desde el primer dia."
          />
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/docs">
              <Button>Ver documentacion <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
            <Link href="/?contact=sales#contact-modal">
              <Button variant="secondary">Hablar de integracion</Button>
            </Link>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-950 shadow-[0_18px_80px_rgba(8,145,178,0.18)]">
          <img
            src="/demo/wine-secure/real-malbec-bottle-pexels.jpg"
            alt="Botella premium integrada con identidad digital nexID"
            className="h-[360px] w-full object-cover opacity-80"
          />
          <div className="absolute inset-x-4 bottom-4 rounded-lg border border-cyan-300/25 bg-slate-950/88 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-200">De etiqueta fisica a revenue digital</p>
            <p className="mt-2 text-sm text-slate-200">Un tap puede informar, vender, fidelizar, verificar compra y alimentar el CRM sin confundir lectura con propiedad.</p>
          </div>
        </div>
      </section>

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
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white">Para romper el silo cerrado sin bajar el nivel enterprise</h2>
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
    </main>
  );
}
