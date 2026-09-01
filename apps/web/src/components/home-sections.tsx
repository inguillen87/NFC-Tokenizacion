import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, PackageCheck, RadioTower } from "lucide-react";
import { HorizontalRailControls } from "./horizontal-rail-controls";
import { InstitutionalVideoPanel } from "./institutional-video-panel";
import { SimpleTrustFlowIntroMotion, SimpleTrustFlowMotion } from "./simple-trust-flow-motion";
import { SimpleTrustStepVisual, type SimpleTrustVisualKind } from "./simple-trust-step-visual";

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
    <section className="landing-hero-section relative overflow-hidden border-b border-white/5 bg-slate-950 pb-8 pt-8 lg:pb-12 lg:pt-12">
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
        <span className="hero-immersive-ring hero-immersive-ring--one" />
        <span className="hero-immersive-ring hero-immersive-ring--two" />
        <span className="hero-immersive-ring hero-immersive-ring--three" />
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
  const visualKinds: SimpleTrustVisualKind[] = ["discover", "signal", "aftercare"];
  const copy = isEn
    ? {
        eyebrow: "How it works",
        title: "Tap or scan. Three simple steps.",
        body: "Bottle, parcel or pouch: customers tap or scan, get a clear answer and choose what comes next. Everything happens in the browser, with no app to download.",
        note: "The answer comes from the digital tag. If a brand also needs to assess the physical product, it can add separate checks for that purpose.",
        primary: "Try the journey",
        railLabel: "Product journey steps",
        previous: "Previous step",
        next: "Next step",
        steps: [
          { label: "Tap or scan", body: "NFC or QR opens the product story and the information chosen by the brand." },
          { label: "Get a clear answer", body: "nexID reads the digital tag and shows the result on the phone." },
          { label: "Choose what comes next", body: "The brand decides whether the journey offers warranty, benefits or support." },
        ],
      }
    : isBr
      ? {
          eyebrow: "Como funciona",
          title: "Aproxime ou escaneie. Três passos simples.",
          body: "Garrafa, pacote ou bolsa: o cliente aproxima ou escaneia, recebe uma resposta clara e escolhe o próximo passo. Tudo acontece no navegador, sem baixar um app.",
          note: "A resposta vem da etiqueta digital. Caso a marca também precise avaliar o produto físico, pode adicionar controles específicos em separado.",
          primary: "Testar a jornada",
          railLabel: "Etapas da jornada do produto",
          previous: "Etapa anterior",
          next: "Próxima etapa",
          steps: [
            { label: "Aproxime ou escaneie", body: "NFC ou QR abre a história do produto e as informações escolhidas pela marca." },
            { label: "Receba uma resposta clara", body: "A nexID lê a etiqueta digital e mostra o resultado no celular." },
            { label: "Escolha o próximo passo", body: "A marca define se a jornada oferece garantia, benefícios ou atendimento." },
          ],
        }
      : {
          eyebrow: "Cómo funciona",
          title: "Acercá o escaneá. Tres pasos simples.",
          body: "Botella, paquete o bolsa: el cliente acerca o escanea, recibe una respuesta clara y elige cómo seguir. Todo sucede en el navegador, sin descargar una app.",
          note: "La respuesta viene de la etiqueta digital. Si una marca también necesita evaluar el producto físico, puede sumar controles específicos por separado.",
          primary: "Probar el recorrido",
          railLabel: "Pasos del recorrido del producto",
          previous: "Paso anterior",
          next: "Paso siguiente",
          steps: [
            { label: "Acercá o escaneá", body: "NFC o QR abre la historia del producto y la información elegida por la marca." },
            { label: "Recibí una respuesta clara", body: "nexID lee la etiqueta digital y muestra el resultado en el celular." },
            { label: "Elegí cómo seguir", body: "La marca define si el recorrido ofrece garantía, beneficios o atención." },
          ],
        };

  return (
    <section id="como-funciona" className="simple-trust-flow-section container-shell py-12 md:py-20">
      <div className="simple-trust-flow-shell">
        <SimpleTrustFlowIntroMotion eyebrow={copy.eyebrow} title={copy.title} body={copy.body} />

        <SimpleTrustFlowMotion id="simple-trust-rail" ariaLabel={copy.railLabel}>
          {copy.steps.map((step, index) => (
            <li key={step.label}>
              <SimpleTrustStepVisual kind={visualKinds[index] ?? "discover"} locale={locale} />
              <span className="simple-trust-flow-step-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="simple-trust-flow-step-title">{step.label}</h3>
              <p className="simple-trust-flow-step-copy">{step.body}</p>
            </li>
          ))}
        </SimpleTrustFlowMotion>

        <div className="simple-trust-flow-footer">
          <p>{copy.note}</p>
          <HorizontalRailControls railId="simple-trust-rail" itemCount={copy.steps.length} previousLabel={copy.previous} nextLabel={copy.next} />
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
        eyebrow: "What changes after the sale",
        title: "A relationship that keeps creating value.",
        body: "The product stops being an endpoint and becomes a useful, measurable point of contact.",
        railLabel: "Business value highlights",
        previous: "Previous benefit",
        next: "Next benefit",
        items: [
          { title: "The right story, at the right moment", body: "Show the batch and the information your brand chooses to publish.", icon: PackageCheck },
          { title: "After-sales without friction", body: "Bring warranty, benefits and support into one simple experience.", icon: BadgeCheck },
          { title: "Learning for the next sale", body: "Review readings and actions to improve each experience.", icon: RadioTower },
        ],
      }
    : isBr
      ? {
          eyebrow: "O que muda depois da venda",
          title: "Uma relação que continua gerando valor.",
          body: "O produto deixa de ser um ponto final e vira um ponto de contato útil e mensurável.",
          railLabel: "Benefícios para o negócio",
          previous: "Benefício anterior",
          next: "Próximo benefício",
          items: [
            { title: "A história certa, na hora certa", body: "Mostre o lote e as informações que sua marca decide publicar.", icon: PackageCheck },
            { title: "Pós-venda sem atrito", body: "Reúna garantia, benefícios e atendimento em uma experiência simples.", icon: BadgeCheck },
            { title: "Aprendizado para a próxima venda", body: "Acompanhe leituras e ações para melhorar cada experiência.", icon: RadioTower },
          ],
        }
      : {
          eyebrow: "Lo que cambia después de la venta",
          title: "Una relación que sigue generando valor.",
          body: "El producto deja de ser un punto final y se convierte en un punto de contacto útil y medible.",
          railLabel: "Beneficios para el negocio",
          previous: "Beneficio anterior",
          next: "Beneficio siguiente",
          items: [
            { title: "La historia correcta, en el momento justo", body: "Mostrá el lote y la información que tu marca decide publicar.", icon: PackageCheck },
            { title: "Postventa sin fricción", body: "Reuní garantía, beneficios y atención en una experiencia simple.", icon: BadgeCheck },
            { title: "Aprendizaje para la próxima venta", body: "Observá lecturas y acciones para mejorar cada experiencia.", icon: RadioTower },
          ],
        };

  return (
    <section className="commercial-value-section container-shell" aria-labelledby="commercial-value-title">
      <div className="commercial-value-shell">
        <div className="commercial-value-intro">
          <p>{copy.eyebrow}</p>
          <h2 id="commercial-value-title">{copy.title}</h2>
          <span>{copy.body}</span>
        </div>
        <div className="commercial-value-rail-shell">
          <ul id="commercial-value-rail" className="commercial-value-grid" aria-label={copy.railLabel} tabIndex={0}>
            {copy.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
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
