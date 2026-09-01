import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, PackageCheck, RadioTower } from "lucide-react";
import { HorizontalRailControls } from "./horizontal-rail-controls";
import { HeroImmersiveSignal } from "./hero-immersive-signal";
import { InstitutionalVideoPanel } from "./institutional-video-panel";
import { SimpleTrustFlowIntroMotion } from "./simple-trust-flow-motion";
import { SimpleTrustIndustryJourney } from "./simple-trust-industry-journey";

type Content = {
  hero: {
    badge: string;
    title: string;
    body: string;
    primary: string;
    secondary: string;
  };
};

export function HeroSection({ content, locale, initialTheme = "light" }: { content: Content; locale: string; initialTheme?: "light" | "dark" }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const hero = content.hero;
  const proofPoints = isEn
    ? ["No app required", "NFC + QR", "Reads + actions"]
    : isBr
      ? ["Sem baixar um app", "NFC + QR", "Leituras + ações"]
      : ["Sin descargar una app", "NFC + QR", "Lecturas + acciones"];
  const videoLabel = isEn
    ? "See the complete customer journey"
    : isBr
      ? "Veja a jornada completa do cliente"
      : "Mirá el recorrido completo del cliente";

  return (
    <section className="landing-hero-section relative overflow-hidden border-b border-white/5 bg-slate-950 pb-6 pt-8 lg:pb-8 lg:pt-12">
      <div className="hero-immersive-media pointer-events-none absolute inset-x-0 top-0 z-0" aria-hidden="true">
        <Image
          src="/landing/nexid-nfc-immersive.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="hero-immersive-image"
        />
        <div className="hero-immersive-veil" />
        <HeroImmersiveSignal locale={locale} />
      </div>
      <div className="hero-signal-field pointer-events-none absolute inset-0 z-0" aria-hidden="true" />

      <div className="container-shell relative z-10">
        <div className="hero-story-grid grid min-w-0 items-center">
          <div className="hero-main-copy min-w-0 max-w-[47rem] text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium uppercase tracking-widest text-slate-300">{hero.badge}</span>
            </div>

            <h1 className="mt-6 max-w-4xl pb-2 text-[2.65rem] font-extrabold leading-[1.03] tracking-[-0.045em] text-transparent sm:text-[3.5rem] lg:text-[4.25rem]">
              {hero.title}
            </h1>
            <p className="hero-subtitle mt-5 max-w-2xl text-base leading-7 text-slate-400 md:text-lg md:leading-8">
              {hero.body}
            </p>

            <div className="hero-post-video-actions mt-7" role="group" aria-label={isEn ? "Main actions" : isBr ? "Ações principais" : "Acciones principales"}>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="#como-funciona" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-cyan-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_30px_rgba(6,182,212,.2)] transition hover:-translate-y-0.5 hover:bg-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 motion-reduce:hover:translate-y-0">
                  {hero.primary}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/?contact=demo#contact-modal" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 motion-reduce:hover:translate-y-0">
                  {hero.secondary}
                </Link>
              </div>
            </div>

            <ul className="mt-6 flex flex-wrap gap-2" aria-label={isEn ? "Experience highlights" : isBr ? "Destaques da experiência" : "Claves de la experiencia"}>
              {proofPoints.map((point) => (
                <li key={point} className="inline-flex min-h-8 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 text-xs font-semibold text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

        </div>

        <div className="hero-demo-shell relative z-20 mx-auto mt-10 max-w-5xl text-left md:mt-14">
          <p className="mb-4 text-center text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200">{videoLabel}</p>
          <InstitutionalVideoPanel locale={locale} variant="landing" initialTheme={initialTheme} />
        </div>
      </div>
    </section>
  );
}

export function SimpleTrustFlowSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = isEn
    ? {
        eyebrow: "How it works",
        title: "One journey. Different products.",
        body: "Choose an industry and see the phone approach, read the tag and unlock the next action. No app required.",
        note: "The answer comes from the digital tag. If a brand also needs to assess the physical product, it can add separate checks for that purpose.",
        primary: "Try the journey",
      }
    : isBr
      ? {
          eyebrow: "Como funciona",
          title: "Uma jornada. Produtos diferentes.",
          body: "Escolha um setor e veja o celular se aproximar, ler a etiqueta e liberar a próxima ação. Sem precisar de app.",
          note: "A resposta vem da etiqueta digital. Caso a marca também precise avaliar o produto físico, pode adicionar controles específicos em separado.",
          primary: "Testar a jornada",
        }
      : {
          eyebrow: "Cómo funciona",
          title: "Un mismo recorrido. Distintos productos.",
          body: "Elegí un rubro y mirá cómo el celular se acerca, lee la etiqueta y habilita la próxima acción. Sin app.",
          note: "La respuesta viene de la etiqueta digital. Si una marca también necesita evaluar el producto físico, puede sumar controles específicos por separado.",
          primary: "Probar el recorrido",
        };

  return (
    <section id="como-funciona" className="simple-trust-flow-section container-shell py-8 md:py-12">
      <div className="simple-trust-flow-shell">
        <SimpleTrustFlowIntroMotion eyebrow={copy.eyebrow} title={copy.title} body={copy.body} />
        <SimpleTrustIndustryJourney locale={locale} />

        <div className="simple-trust-flow-footer">
          <p>{copy.note}</p>
          <Link href="/demo-lab?scenario=qr-gs1" className="simple-trust-flow-cta">
            {copy.primary}
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function CommercialValueSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = isEn
    ? {
        eyebrow: "The change for your brand",
        title: "From sold product to owned channel.",
        body: "After the sale, the same product can inform, assist and generate useful signals for your business.",
        transformFrom: "Product delivered",
        transformTo: "Active relationship",
        transformLabel: "The product moves from an endpoint to a direct brand channel",
        railLabel: "Business value highlights",
        previous: "Previous benefit",
        next: "Next benefit",
        items: [
          { title: "A direct channel", body: "Inform or activate customers from the product, without asking them to install an app.", icon: PackageCheck },
          { title: "Organized after-sales", body: "Bring warranty, benefits and enquiries into one configurable journey.", icon: BadgeCheck },
          { title: "Signals for decisions", body: "See reads and chosen actions to improve content, service and future campaigns.", icon: RadioTower },
        ],
      }
    : isBr
      ? {
          eyebrow: "A mudança para sua marca",
          title: "De produto vendido a canal próprio.",
          body: "Depois da venda, o mesmo produto pode informar, atender e gerar sinais úteis para o seu negócio.",
          transformFrom: "Produto entregue",
          transformTo: "Relação ativa",
          transformLabel: "O produto passa de um ponto final a um canal direto da marca",
          railLabel: "Benefícios para o negócio",
          previous: "Benefício anterior",
          next: "Próximo benefício",
          items: [
            { title: "Um canal direto", body: "Volte a informar ou ativar pelo produto, sem pedir que o cliente instale um app.", icon: PackageCheck },
            { title: "Pós-venda organizada", body: "Reúna garantia, benefícios e consultas em uma jornada configurável.", icon: BadgeCheck },
            { title: "Sinais para decidir", body: "Observe leituras e ações escolhidas para melhorar conteúdo, serviço e próximas campanhas.", icon: RadioTower },
          ],
        }
      : {
          eyebrow: "El cambio para tu marca",
          title: "De producto vendido a canal propio.",
          body: "Después de la venta, el mismo producto puede informar, atender y generar señales útiles para tu negocio.",
          transformFrom: "Producto entregado",
          transformTo: "Relación activa",
          transformLabel: "El producto pasa de ser un punto final a un canal directo de la marca",
          railLabel: "Beneficios para el negocio",
          previous: "Beneficio anterior",
          next: "Beneficio siguiente",
          items: [
            { title: "Un canal directo", body: "Volvé a informar o activar desde el producto, sin pedirle al cliente que instale una app.", icon: PackageCheck },
            { title: "Postventa ordenada", body: "Reuní garantía, beneficios y consultas en un recorrido configurable.", icon: BadgeCheck },
            { title: "Señales para decidir", body: "Observá lecturas y acciones elegidas para mejorar contenido, servicio y próximas campañas.", icon: RadioTower },
          ],
        };

  return (
    <section className="commercial-value-section container-shell" aria-labelledby="commercial-value-title">
      <div className="commercial-value-shell">
        <div className="commercial-value-intro">
          <p>{copy.eyebrow}</p>
          <h2 id="commercial-value-title">{copy.title}</h2>
          <span>{copy.body}</span>
          <div className="commercial-value-transform" aria-label={copy.transformLabel}>
            <span>{copy.transformFrom}</span>
            <ArrowRight aria-hidden="true" />
            <strong>{copy.transformTo}</strong>
          </div>
        </div>
        <div className="commercial-value-rail-shell">
          <ul id="commercial-value-rail" className="commercial-value-grid" aria-label={copy.railLabel} tabIndex={0}>
            {copy.items.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
                  <span className="commercial-value-index" aria-hidden="true">0{index + 1}</span>
                  <span className="commercial-value-icon"><Icon aria-hidden="true" /></span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              );
            })}
          </ul>
          <HorizontalRailControls railId="commercial-value-rail" itemCount={copy.items.length} previousLabel={copy.previous} nextLabel={copy.next} />
        </div>
      </div>
    </section>
  );
}
