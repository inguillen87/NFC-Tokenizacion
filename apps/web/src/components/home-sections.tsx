import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DppRoleExplorer } from "./dpp-role-explorer";
import { HeroImmersiveSignal } from "./hero-immersive-signal";
import { SimpleTrustFlowIntroMotion } from "./simple-trust-flow-motion";
import { SimpleTrustIndustryJourney } from "./simple-trust-industry-journey";
import nexIdDppHero from "../../public/landing/nexid-dpp-hero-v3.webp";

type Content = {
  hero: {
    badge: string;
    title: string;
    body: string;
    primary: string;
    secondary: string;
  };
};

export function HeroSection({ content, locale }: { content: Content; locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const hero = content.hero;
  const proofPoints = isEn
    ? ["Model, batch or item identity", "Available information and history", "NFC + QR, no app"]
    : isBr
      ? ["Identidade por modelo, lote ou unidade", "Informação e história disponíveis", "NFC + QR, sem app"]
      : ["Identidad por modelo, lote o unidad", "Información e historia disponibles", "NFC + QR, sin app"];

  return (
    <section className="landing-hero-section relative overflow-hidden border-b pb-6 pt-8 lg:pb-8 lg:pt-12">
      <div className="hero-immersive-media pointer-events-none absolute inset-x-0 top-0 z-0" aria-hidden="true">
        <Image
          src={nexIdDppHero}
          alt=""
          fill
          priority
          placeholder="blur"
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
            <div className="hero-eyebrow-chip inline-flex items-center gap-2 rounded-full border px-4 py-1.5 backdrop-blur-md">
              <span className="hero-eyebrow-dot flex h-2 w-2 rounded-full" aria-hidden="true" />
              <span className="hero-eyebrow-copy text-xs font-medium uppercase tracking-widest">{hero.badge}</span>
            </div>

            <h1 className="brand-editorial-gradient mt-6 max-w-4xl pb-2 text-[2.65rem] font-extrabold leading-[1.03] tracking-[-0.045em] sm:text-[3.5rem] lg:text-[4.25rem]">
              {hero.title}
            </h1>
            <p className="hero-subtitle mt-5 max-w-2xl text-base leading-7 md:text-lg md:leading-8">
              {hero.body}
            </p>

            <div className="hero-post-video-actions mt-7" role="group" aria-label={isEn ? "Main actions" : isBr ? "Ações principais" : "Acciones principales"}>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="#como-funciona" className="inline-flex min-h-12 hero-primary-action items-center justify-center rounded-xl px-6 py-3 text-sm font-bold transition hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
                  {hero.primary}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/?contact=demo#contact-modal" className="inline-flex min-h-12 hero-secondary-action items-center justify-center rounded-xl border px-6 py-3 text-sm font-semibold transition hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
                  {hero.secondary}
                </Link>
              </div>
            </div>

            <ul className="mt-6 flex flex-wrap gap-2" aria-label={isEn ? "Experience highlights" : isBr ? "Destaques da experiência" : "Claves de la experiencia"}>
              {proofPoints.map((point) => (
                <li key={point} className="hero-proof-chip inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold">
                  <span className="hero-proof-dot h-1.5 w-1.5 rounded-full" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

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
        title: "From the product to its passport, in three moments.",
        body: "Choose an industry and follow one product from its identity to its current information and the services available through NFC or QR.",
        primary: "Try the interactive passport",
      }
    : isBr
      ? {
          eyebrow: "Como funciona",
          title: "Do produto ao seu passaporte, em três momentos.",
          body: "Escolha um setor e acompanhe um único produto desde sua identidade até as informações atuais e os serviços disponíveis por NFC ou QR.",
          primary: "Testar o passaporte interativo",
        }
      : {
          eyebrow: "Cómo funciona",
          title: "Del producto a su pasaporte, en tres momentos.",
          body: "Elegí un rubro y seguí un único producto desde su identidad hasta la información vigente y los servicios disponibles por NFC o QR.",
          primary: "Probar el pasaporte interactivo",
        };

  return (
    <section id="como-funciona" className="simple-trust-flow-section container-shell py-8 md:py-12">
      <div className="simple-trust-flow-shell">
        <SimpleTrustFlowIntroMotion eyebrow={copy.eyebrow} title={copy.title} body={copy.body} />
        <SimpleTrustIndustryJourney locale={locale} ctaLabel={copy.primary} />
      </div>
    </section>
  );
}

export function CommercialValueSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const label = isEn
    ? "Digital product passport information by role"
    : isBr
      ? "Informações do passaporte digital do produto por papel"
      : "Información del pasaporte digital de producto según el rol";

  return (
    <section className="commercial-value-section container-shell" aria-label={label}>
      <div className="commercial-value-shell">
        <DppRoleExplorer locale={locale} />
      </div>
    </section>
  );
}
