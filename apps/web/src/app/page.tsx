import Image from "next/image";
import Link from "next/link";
import { pricingPlans, siteConfig, useCases } from "@product/config";
import { Badge, Button, Card, SectionHeading, StatCard } from "@product/ui";

export default function HomePage() {
  return (
    <main>
      <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
        <div className="container-shell flex h-20 items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo-mark.svg" alt="logo" width={36} height={36} />
            <div>
              <div className="text-lg font-bold text-white">{siteConfig.productName}</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">by {siteConfig.parentBrand}</div>
            </div>
          </div>
          <nav className="hidden gap-6 text-sm text-slate-300 md:flex">
            <Link href="/pricing">Pricing</Link>
            <Link href="/resellers">Resellers</Link>
            <Link href="/docs">Docs</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/pricing"><Button variant="ghost">Planes</Button></Link>
            <a href="https://dashboard.tudominio.com/login"><Button>Dashboard</Button></a>
          </div>
        </div>
      </header>

      <section className="container-shell py-20 md:py-28">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <Badge tone="cyan">NFC authentication + digital identity</Badge>
            <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-tight text-white md:text-7xl">
              Pasarela NFC, antifraude y producto digital en una sola plataforma.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
              Vendemos chips, operamos la API, activamos batches, validamos taps y abrimos un canal white-label para agencias y resellers. No es un negocio de plastico. Es un negocio de autenticacion, datos y control.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button>Solicitar demo</Button>
              <Link href="/pricing"><Button variant="secondary">Ver pricing</Button></Link>
              <Link href="/resellers"><Button variant="secondary">Programa reseller</Button></Link>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <StatCard label="API latency target" value="<150ms" delta="objetivo v1" />
              <StatCard label="Secure example" value="USD 200" delta="10k botellas x USD 0.02" tone="good" />
              <StatCard label="Monetizacion" value="HW + SaaS" delta="chips + validacion + datos" />
            </div>
          </div>

          <Card className="hero-glow overflow-hidden p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="text-sm font-semibold text-white">Live operator narrative</div>
                <div className="mt-1 text-xs text-slate-400">Lo que un inversor, reseller o bodega entiende en 60 segundos</div>
              </div>
              <Badge tone="green">Server live</Badge>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Card className="p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-cyan-300">Basic</div>
                <div className="mt-2 text-lg font-bold text-white">NTAG215</div>
                <p className="mt-2 text-sm text-slate-400">Eventos, loyalty, experiencias, tracking simple.</p>
              </Card>
              <Card className="p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-cyan-300">Secure</div>
                <div className="mt-2 text-lg font-bold text-white">NTAG 424 DNA TT</div>
                <p className="mt-2 text-sm text-slate-400">SUN validation, tamper awareness, anti-clone y manifest control.</p>
              </Card>
              <Card className="p-4 sm:col-span-2">
                <div className="text-xs uppercase tracking-[0.16em] text-cyan-300">White label</div>
                <div className="mt-2 text-lg font-bold text-white">Agencias y resellers</div>
                <p className="mt-2 text-sm text-slate-400">Les vendemos chips encodeados y plataforma. Ellos revenden a bodegas, cosmeticas y retailers. Nosotros seguimos controlando la validacion.</p>
              </Card>
            </div>
          </Card>
        </div>
      </section>

      <section className="container-shell py-16">
        <SectionHeading
          eyebrow="Producto"
          title="Los tres motores del negocio"
          description="La plataforma tiene que explicar desde el minuto cero que el valor real esta en el gateway, la capa de seguridad y la operacion del lote."
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <Card className="p-6">
            <div className="text-sm font-semibold text-white">Hardware rail</div>
            <p className="mt-3 text-sm leading-7 text-slate-400">Chips basicos, chips seguros, lotes encodeados, shipping, onboarding y control de stock.</p>
          </Card>
          <Card className="p-6">
            <div className="text-sm font-semibold text-white">Validation rail</div>
            <p className="mt-3 text-sm leading-7 text-slate-400">/sun, allowlist, batch keys, replay detection, tamper logic y eventos en tiempo real.</p>
          </Card>
          <Card className="p-6">
            <div className="text-sm font-semibold text-white">Digital identity rail</div>
            <p className="mt-3 text-sm leading-7 text-slate-400">Pasaporte digital, ownership, historial, warranty y futuro modulo de tokenizacion.</p>
          </Card>
        </div>
      </section>

      <section className="container-shell py-16">
        <SectionHeading
          eyebrow="Use cases"
          title="Verticales que entienden el ROI rapido"
          description="El producto no se vende como una blockchain con etiquetas. Se vende como control, autenticidad, trazabilidad y experiencia premium."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {useCases.map((item) => (
            <Card key={item.title} className="p-6">
              <div className="text-base font-semibold text-white">{item.title}</div>
              <p className="mt-3 text-sm leading-7 text-slate-400">{item.summary}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="container-shell py-16">
        <SectionHeading
          eyebrow="Pricing"
          title="Tres planes para un discurso comercial claro"
          description="La landing tiene que dejarle claro al cliente si quiere marketing, antifraude serio o un modelo reseller enterprise."
        />
        <div className="mt-10 grid gap-6 xl:grid-cols-3">
          {pricingPlans.map((plan) => (
            <Card key={plan.slug} className="p-6">
              <Badge tone={plan.slug === "enterprise" ? "amber" : "cyan"}>{plan.badge}</Badge>
              <div className="mt-4 text-2xl font-bold text-white">{plan.name}</div>
              <p className="mt-2 text-sm leading-7 text-slate-400">{plan.description}</p>
              <div className="mt-6 text-lg font-semibold text-cyan-300">{plan.monthlyLabel}</div>
              <div className="mt-1 text-sm text-slate-500">{plan.unitExample}</div>
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                {plan.features.map((feature) => <li key={feature}>- {feature}</li>)}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <section className="container-shell py-16">
        <SectionHeading
          eyebrow="Go to market"
          title="Reseller y white label desde v1"
          description="No queremos solamente vender directo. Queremos abrir el canal para agencias, convertidores de etiquetas y partners de packaging."
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="text-lg font-bold text-white">Cliente directo</div>
            <p className="mt-3 text-sm leading-7 text-slate-400">Bodega, cosmetica o laboratorio compra chips + SaaS + activacion. Nosotros operamos todo.</p>
          </Card>
          <Card className="p-6">
            <div className="text-lg font-bold text-white">Reseller</div>
            <p className="mt-3 text-sm leading-7 text-slate-400">Partner compra lotes encodeados, crea subclientes y vende bajo marca propia o co-branding.</p>
          </Card>
        </div>
      </section>

      <footer className="border-t border-white/10 py-12">
        <div className="container-shell flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-white">{siteConfig.productName}</div>
            <div className="mt-1 text-xs text-slate-500">Product separated from the Inmovar corporate site.</div>
          </div>
          <div className="flex gap-3">
            <Link href="/docs"><Button variant="secondary">Docs</Button></Link>
            <a href="https://dashboard.tudominio.com/login"><Button>Dashboard</Button></a>
          </div>
        </div>
      </footer>
    </main>
  );
}
