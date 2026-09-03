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
    ? ["Model, batch or item identity", "NFC + QR in the browser", "Information by role"]
    : isBr
      ? ["Identidade por modelo, lote ou unidade", "NFC + QR no navegador", "Informação conforme o papel"]
      : ["Identidad por modelo, lote o unidad", "NFC + QR en el navegador", "Información según el rol"];

  return (
    <section className="landing-hero-section relative overflow-hidden border-b border-white/5 bg-slate-950 pb-6 pt-8 lg:pb-8 lg:pt-12">
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
        title: "One tap. A useful passport for every product.",
        body: "Choose an industry and see how an NFC tag or QR code connects the physical product to its identity, current information and available services.",
        primary: "Try the interactive passport",
      }
    : isBr
      ? {
          eyebrow: "Como funciona",
          title: "Um toque. Um passaporte útil para cada produto.",
          body: "Escolha um setor e veja como NFC ou QR conecta o produto físico à sua identidade, informações atuais e serviços disponíveis.",
          primary: "Testar o passaporte interativo",
        }
      : {
          eyebrow: "Cómo funciona",
          title: "Un toque. Un pasaporte útil para cada producto.",
          body: "Elegí un rubro y mirá cómo NFC o QR conecta el producto físico con su identidad, información vigente y servicios disponibles.",
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
