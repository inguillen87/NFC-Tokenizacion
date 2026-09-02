import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandControlCenterPreview } from "./brand-control-center-preview";
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
        primary: "Try the journey",
      }
    : isBr
      ? {
          eyebrow: "Como funciona",
          title: "Uma jornada. Produtos diferentes.",
          body: "Escolha um setor e veja o celular se aproximar, ler a etiqueta e liberar a próxima ação. Sem precisar de app.",
          primary: "Testar a jornada",
        }
      : {
          eyebrow: "Cómo funciona",
          title: "Un mismo recorrido. Distintos productos.",
          body: "Elegí un rubro y mirá cómo el celular se acerca, lee la etiqueta y habilita la próxima acción. Sin app.",
          primary: "Probar el recorrido",
        };

  return (
    <section id="como-funciona" className="simple-trust-flow-section container-shell py-8 md:py-12">
      <div className="simple-trust-flow-shell">
        <SimpleTrustFlowIntroMotion eyebrow={copy.eyebrow} title={copy.title} body={copy.body} />
        <SimpleTrustIndustryJourney locale={locale} />

        <div className="simple-trust-flow-footer">
          <Link href="/demo-lab?profile=wine" className="simple-trust-flow-cta">
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
        eyebrow: "For your brand",
        title: "From one label to a connected operation.",
        body: "From one console, define what every product publishes, which service it offers and what information your team receives.",
        cta: "Book a demo for my product",
      }
    : isBr
      ? {
          eyebrow: "Para a sua marca",
          title: "De uma etiqueta a uma operação conectada.",
          body: "Em um único console, defina o que cada produto publica, qual serviço oferece e quais informações sua equipe recebe.",
          cta: "Agendar uma demo para meu produto",
        }
      : {
          eyebrow: "Del lado de tu marca",
          title: "De una etiqueta a una operación conectada.",
          body: "En una sola consola definís qué publica cada producto, qué servicio ofrece y qué información recibe tu equipo.",
          cta: "Agendar una demo para mi producto",
        };

  return (
    <section className="commercial-value-section container-shell" aria-labelledby="commercial-value-title">
      <div className="commercial-value-shell">
        <div className="commercial-value-intro">
          <div className="commercial-value-heading">
            <p>{copy.eyebrow}</p>
            <h2 id="commercial-value-title">{copy.title}</h2>
          </div>
          <div className="commercial-value-support">
            <span>{copy.body}</span>
            <Link href="/?contact=demo#contact-modal" className="commercial-value-cta">
              {copy.cta}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
        <BrandControlCenterPreview locale={locale} />
      </div>
    </section>
  );
}
