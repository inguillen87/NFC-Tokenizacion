import { Card, SectionHeading, Badge } from "@product/ui";
import { schedulingUrls } from "@product/config";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CloudOff, Cpu, Fingerprint, KeyRound, Network, PackageCheck, QrCode, RadioTower, RotateCcw, ShieldCheck, Smartphone } from "lucide-react";
import { InstitutionalVideoPanel } from "./institutional-video-panel";
import { PremiumTraceabilityGlobe } from "./premium-traceability-globe";
import { SimpleTrustFlowMotion } from "./simple-trust-flow-motion";
import { SimpleTrustStepVisual, type SimpleTrustVisualKind } from "./simple-trust-step-visual";
import { HorizontalRailControls } from "./horizontal-rail-controls";
import { platformVerticals, traceabilityGlobePoints, traceabilityGlobeRoutes } from "../lib/platform-verticals";

type Content = any;

export function HeroSection({ content, locale, initialTheme = "light" }: { content: Content; locale: string; initialTheme?: "light" | "dark" }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const hero = content?.hero || {};
  const heroSubtitle = hero?.subtitle || hero?.body || "";
  const primaryCta = hero?.cta?.primary || hero?.primary || "Empezar";
  const secondaryCta = hero?.cta?.secondary || hero?.secondary || "Contacto";

  const trustBadge = isEn ? "Enterprise Trusted" : isBr ? "Confiabilidade Corporativa" : "Confianza para empresas";
  return (
    <section className="landing-hero-section relative overflow-hidden border-b border-white/5 bg-slate-950 pb-8 pt-8 lg:pb-10 lg:pt-10">
      <div className="hero-signal-field absolute inset-0 z-0 pointer-events-none" aria-hidden="true" />

      <div className="container-shell relative z-10">
        <div className="hero-main-copy mx-auto max-w-6xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md transition-colors hover:bg-white/10">
             <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
             <span className="text-xs font-medium text-slate-300 uppercase tracking-widest">{trustBadge}</span>
          </div>

          <h1 className="mx-auto mt-6 max-w-[24rem] pb-2 text-[2.35rem] font-extrabold leading-[1.08] tracking-[-0.035em] text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 sm:max-w-6xl sm:text-[3.35rem] sm:leading-[1.04] lg:text-[4rem]">
            {hero.title}
          </h1>
          <p className="hero-subtitle mx-auto mt-6 max-w-3xl text-base leading-7 text-slate-400 md:text-lg md:leading-8">
            {heroSubtitle}
          </p>
          <div className="landing-mobile-hero-actions mt-5 grid grid-cols-2 gap-2 sm:hidden">
            <Link href="/?contact=demo#contact-modal" className="landing-mobile-hero-actions__primary">
              <span>{primaryCta}</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
            <Link href="#como-funciona" className="landing-mobile-hero-actions__secondary">
              {secondaryCta}
            </Link>
          </div>
          <div className="mt-7 hidden items-center justify-center gap-3 sm:flex">
            <Link href="/?contact=demo#contact-modal" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-500 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400">
              {primaryCta}
            </Link>
            <Link href="#como-funciona" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              {secondaryCta}
            </Link>
          </div>
        </div>

        <div className="hero-demo-shell mx-auto mt-10 max-w-5xl text-left relative z-20 md:mt-12">
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
      title: "Three steps. No complications.",
      body: "Tap with your phone or scan the QR. nexID organizes what matters and shows what you can do next.",
      note: "nexID checks the digital label and shows a clear result. To validate the physical product as well, each brand can add specific controls.",
      primary: "Try the journey",
      railLabel: "Product journey steps",
      previous: "Previous step",
      next: "Next step",
      steps: [
        { label: "Discover the product", body: "Story, batch and brand information, gathered in one place." },
        { label: "Understand the reading", body: "A clear answer about the digital label and its configured checks." },
        { label: "Stay connected", body: "Warranty, benefits or support, depending on what is available." },
      ],
    }
    : isBr
    ? {
      eyebrow: "Como funciona",
      title: "Três etapas. Sem complicações.",
      body: "Aproxime o celular ou escaneie o QR. A nexID organiza o essencial e mostra o que fazer depois.",
      note: "A nexID verifica a etiqueta digital e mostra um resultado claro. Para validar também o produto físico, cada marca pode adicionar controles específicos.",
      primary: "Testar a jornada",
      railLabel: "Etapas da jornada do produto",
      previous: "Etapa anterior",
      next: "Próxima etapa",
      steps: [
        { label: "Conheça o produto", body: "História, lote e informações da marca, reunidos em um só lugar." },
        { label: "Entenda a leitura", body: "Uma resposta clara sobre a etiqueta digital e os controles configurados." },
        { label: "Siga com a marca", body: "Garantia, benefícios ou atendimento, conforme o que estiver disponível." },
      ],
    }
    : {
      eyebrow: "Cómo funciona",
      title: "Tres pasos. Sin complicaciones.",
      body: "Acercá el celular o escaneá el QR. nexID ordena lo importante y muestra qué hacer después.",
      note: "nexID verifica la etiqueta digital y muestra un resultado claro. Para validar también el producto físico, cada marca puede sumar controles específicos.",
      primary: "Probar el recorrido",
      railLabel: "Pasos del recorrido del producto",
      previous: "Paso anterior",
      next: "Paso siguiente",
      steps: [
        { label: "Conocé el producto", body: "Historia, lote e información de la marca, reunidos en un solo lugar." },
        { label: "Entendé la lectura", body: "Una respuesta clara sobre la etiqueta digital y los controles configurados." },
        { label: "Seguí con la marca", body: "Garantía, beneficios o atención, según lo que esté disponible." },
      ],
    };

  return (
    <section id="como-funciona" className="simple-trust-flow-section container-shell py-12 md:py-20">
      <div className="simple-trust-flow-shell">
        <div className="simple-trust-flow-intro">
          <p className="simple-trust-flow-eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <p className="simple-trust-flow-body">{copy.body}</p>
        </div>

        <SimpleTrustFlowMotion id="simple-trust-rail" ariaLabel={copy.railLabel}>
          {copy.steps.map((step, index) => (
            <li key={step.label}>
              <SimpleTrustStepVisual kind={visualKinds[index] ?? "discover"} locale={locale} />
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.label}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </SimpleTrustFlowMotion>

        <div className="simple-trust-flow-footer">
          <p>{copy.note}</p>
          <HorizontalRailControls
            railId="simple-trust-rail"
            itemCount={copy.steps.length}
            previousLabel={copy.previous}
            nextLabel={copy.next}
          />
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
        eyebrow: "After every sale",
        title: "More value, without more complexity.",
        body: "nexID gives each product a clear role before, during and after the sale.",
        railLabel: "Business value highlights",
        previous: "Previous benefit",
        next: "Next benefit",
        items: [
          { title: "A better product story", body: "Share the batch and the information your brand chooses to publish.", icon: PackageCheck },
          { title: "After-sales in one place", body: "Bring warranty, benefits and support into one simple experience.", icon: BadgeCheck },
          { title: "Measurable learning", body: "Review readings and actions to understand what works in each pilot.", icon: RadioTower },
        ],
      }
    : isBr
    ? {
        eyebrow: "Depois de cada venda",
        title: "Mais valor, sem mais complexidade.",
        body: "A nexID dá a cada produto um papel claro antes, durante e depois da venda.",
        railLabel: "Benefícios para o negócio",
        previous: "Benefício anterior",
        next: "Próximo benefício",
        items: [
          { title: "Uma história melhor contada", body: "Mostre o lote e as informações que sua marca decide publicar.", icon: PackageCheck },
          { title: "Pós-venda em um só lugar", body: "Reúna garantia, benefícios e atendimento em uma experiência simples.", icon: BadgeCheck },
          { title: "Aprendizado mensurável", body: "Acompanhe leituras e ações para entender o que funciona em cada piloto.", icon: RadioTower },
        ],
      }
    : {
        eyebrow: "Después de cada venta",
        title: "Más valor, sin sumar complejidad.",
        body: "nexID le da a cada producto un rol claro antes, durante y después de la venta.",
        railLabel: "Beneficios para el negocio",
        previous: "Beneficio anterior",
        next: "Beneficio siguiente",
        items: [
          { title: "Una historia mejor contada", body: "Mostrá el lote y la información que tu marca decide publicar.", icon: PackageCheck },
          { title: "Postventa en un solo lugar", body: "Reuní garantía, beneficios y atención en una experiencia simple.", icon: BadgeCheck },
          { title: "Aprendizaje medible", body: "Observá lecturas y acciones para entender qué funciona en cada piloto.", icon: RadioTower },
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
          <HorizontalRailControls
            railId="commercial-value-rail"
            itemCount={copy.items.length}
            previousLabel={copy.previous}
            nextLabel={copy.next}
          />
        </div>
      </div>
    </section>
  );
}

function TrustLayerMiniSimulation({ title, tone, locale }: { title: string; tone: string; locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = {
    scan: isEn ? "Scan" : isBr ? "Leitura" : "Lectura",
    verified: "SUN OK",
    replay: "Anti-replay",
    claim: isEn ? "Claim" : "Claim",
    warranty: isEn ? "Warranty" : isBr ? "Garantia" : "Garantia",
    resale: isEn ? "Resale cert" : isBr ? "Cert. revenda" : "Cert. reventa",
    plant: isEn ? "Plant" : isBr ? "Planta" : "Planta",
    transit: isEn ? "Transit" : isBr ? "Transito" : "Traslado",
    arrival: isEn ? "Arrival" : isBr ? "Chegada" : "Llegada",
    sync: isEn ? "Sync later" : isBr ? "Sync depois" : "Sync luego",
    seal: isEn ? "Seal state" : isBr ? "Estado lacre" : "Estado sello",
    resolver: isEn ? "Resolver" : "Resolver",
    sensor: isEn ? "Sensor ping" : isBr ? "Ping sensor" : "Ping sensor",
  };

  if (title.includes("NFC 424")) {
    return (
      <section className="trust-layer-sim trust-layer-sim--nfc" aria-hidden="true">
        <div className="trust-layer-sim__scan">
          <span />
          <i />
        </div>
        <div className="trust-layer-sim__stack">
          <strong>{copy.scan}</strong>
          <span>{copy.verified}</span>
          <span>{copy.replay}</span>
        </div>
      </section>
    );
  }

  if (title.includes("Polygon")) {
    return (
      <section className="trust-layer-sim trust-layer-sim--polygon" aria-hidden="true">
        {[copy.claim, copy.warranty, copy.resale].map((label, index) => (
          <span key={label} className={`trust-layer-sim__step trust-layer-sim__step--${index}`}>
            <small>{index + 1}</small>
            {label}
          </span>
        ))}
      </section>
    );
  }

  if (title.includes("IOTA")) {
    return (
      <section className="trust-layer-sim trust-layer-sim--iota" aria-hidden="true">
        <i />
        {[copy.plant, copy.transit, copy.arrival].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </section>
    );
  }

  if (title.includes("Offline") || title.includes("Verificador")) {
    return (
      <section className="trust-layer-sim trust-layer-sim--offline" aria-hidden="true">
        <div>
          <span />
          <span />
          <span />
        </div>
        <strong>{copy.sync}</strong>
      </section>
    );
  }

  if (title.includes("Tamper")) {
    return (
      <section className="trust-layer-sim trust-layer-sim--tamper" aria-hidden="true">
        <span />
        <strong>{copy.seal}</strong>
      </section>
    );
  }

  if (title.includes("UHF") || title.includes("IoT")) {
    return (
      <section className="trust-layer-sim trust-layer-sim--iot" aria-hidden="true">
        {[0, 1, 2, 3].map((item) => <span key={item} />)}
        <strong>{copy.sensor}</strong>
      </section>
    );
  }

  return (
    <section className={`trust-layer-sim trust-layer-sim--${tone}`} aria-hidden="true">
      <span />
      <strong>{copy.resolver}</strong>
      <span />
    </section>
  );
}

export function EnterpriseTrustLayersSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = isEn
    ? {
      eyebrow: "Trust layers for physical products",
      title: "One platform. The right proof layer for every risk, budget and rollout stage.",
      body: "nexID keeps the business workflow first: product identity, SUN validation, CRM, loyalty, DPP and analytics. Blockchain is optional and policy-driven, not a requirement for every tap.",
      note: "Polygon and IOTA are integrated technologies, not official partnerships unless a signed public agreement exists. We do not send every tap on-chain or store private customer data on-chain.",
      cta: "Read trust docs",
      paths: [
        { label: "SME rollout", body: "Start with QR/GS1, product passport, batch analytics and simple support workflows." },
        { label: "Enterprise rollout", body: "Add Supplier Ops, Tenant Vault, NFC 424, offline verifier, Polygon ownership, IOTA proof and UHF/IoT evidence only where risk justifies it." },
      ],
      cards: [
        { title: "QR / GS1", body: "Batch tracking, product data and a registry-backed GS1 Digital Link foundation at low cost; conformance certification remains a separate gate.", meta: "Identity", icon: QrCode },
        { title: "NFC 424 DNA", body: "Dynamic SUN/SDM message per tap, designed to resist message copying and replay when keys, counters and server validation are correctly configured; it is not physical-product proof.", meta: "Tag evidence", icon: Fingerprint },
        { title: "Offline Verifier", body: "Your phone or reader works in warehouses and remote areas. Syncs to server when back online.", meta: "Field", icon: Cpu },
        { title: "TagTamper", body: "Reports a TT-state change from the tag for review; it does not by itself prove the package, contents or physical opening.", meta: "Reported TT", icon: ShieldCheck },
        { title: "Polygon", body: "After separate evidence and tenant approval, a buyer can receive a digital ownership record. The transaction verifies the digital claim, not the physical item.", meta: "Digital ownership", icon: BadgeCheck },
        { title: "IOTA", body: "Anchors selected supply-chain evidence as hashes or Merkle roots when audit policy requires it. Private product and customer data stay off-chain.", meta: "Supply Chain", icon: Network },
        { title: "UHF / IoT", body: "Pallets, cartons and industrial sensors: operational traceability without complicating consumer UX.", meta: "Industrial", icon: RadioTower },
      ],
    }
    : isBr
    ? {
      eyebrow: "Camadas de confianca para produtos fisicos",
      title: "Uma plataforma. A camada certa para cada risco, custo e etapa de rollout.",
      body: "nexID prioriza a operacao de negocio: identidade do produto, validacao SUN, CRM, loyalty, DPP e analytics. Blockchain e opcional e governado por politica, nao obrigatorio em todo toque.",
      note: "Polygon e IOTA sao tecnologias integraveis, nao parcerias oficiais salvo acordo publico assinado. Nao enviamos todo toque on-chain nem gravamos dados privados de clientes on-chain.",
      cta: "Ler docs de confianca",
      paths: [
        { label: "Rollout PME", body: "Comeca com QR/GS1, passport do produto, analytics por lote e suporte simples." },
        { label: "Rollout enterprise", body: "Adiciona Supplier Ops, Tenant Vault, NFC 424, verificador offline, ownership Polygon, prova IOTA e UHF/IoT apenas quando o risco justifica." },
      ],
      cards: [
        { title: "QR / GS1", body: "Identidade visivel, dados do produto, resolver links e entrada low-cost para PMEs.", meta: "Identidade", icon: QrCode },
        { title: "NFC 424 DNA", body: "Mensagem SUN/SDM dinâmica por toque, projetada para resistir cópia da mensagem e replay quando chaves, contadores e validação server-side estão corretos; não é prova do produto físico.", meta: "Evidência da tag", icon: Fingerprint },
        { title: "Offline Verifier", body: "App ou leitor controlado para zonas rurais e industriais com chaves por device e sync posterior.", meta: "Campo", icon: Cpu },
        { title: "TagTamper", body: "Reporta uma mudança de estado TT para revisão; sozinho não comprova embalagem, conteúdo ou abertura física.", meta: "TT reportado", icon: ShieldCheck },
        { title: "Polygon", body: "Após evidência separada e aprovação do tenant, o comprador pode receber um registro digital de titularidade. A transação verifica o claim digital, não o item físico.", meta: "Titularidade digital", icon: BadgeCheck },
        { title: "IOTA", body: "Ancora evidencias selecionadas da cadeia como hashes ou Merkle roots quando a politica de auditoria exige. Dados privados ficam fora da blockchain.", meta: "Cadeia de Suprimentos", icon: Network },
        { title: "UHF / IoT", body: "Pallets, logistica, sensores e rastreabilidade industrial sem complicar o consumidor.", meta: "Industrial", icon: RadioTower },
      ],
    }
    : {
      eyebrow: "Capas de confianza para productos fisicos",
      title: "Una plataforma. La capa correcta para cada riesgo, presupuesto y etapa.",
      body: "nexID mantiene primero el flujo de negocio: identidad de producto, validacion SUN, CRM, loyalty, DPP y analitica. Blockchain es opcional y se activa por politica, no por cada tap.",
      note: "Polygon e IOTA son tecnologias integrables, no partnerships oficiales salvo acuerdo publico firmado. No mandamos cada tap on-chain ni guardamos datos privados de clientes en blockchain.",
      cta: "Leer docs de confianza",
      paths: [
        { label: "Rollout pyme", body: "Arranca con QR/GS1, pasaporte de producto, analitica por lote y soporte simple." },
        { label: "Rollout enterprise", body: "Suma Supplier Ops, Tenant Vault, NFC 424, verificador offline, ownership Polygon, prueba IOTA y UHF/IoT solo donde el riesgo lo justifica." },
      ],
      cards: [
        { title: "QR / GS1", body: "Identidad visible, datos de producto, resolver links y entrada low-cost para pymes.", meta: "Identidad", icon: QrCode },
        { title: "NFC 424 DNA", body: "Mensaje SUN/SDM dinámico por tap, diseñado para resistir copia del mensaje y replay cuando claves, contadores y validación server-side están bien configurados; no es prueba del producto físico.", meta: "Evidencia del tag", icon: Fingerprint },
        { title: "Verificador Offline", body: "El celular o lector evalúa localmente el mensaje y la política disponible. Al conectarse, el servidor confirma el resultado digital.", meta: "Campo", icon: Cpu },
        { title: "Sello Tamper", body: "Reporta un cambio de estado TT para revisión; por sí solo no prueba envase, contenido ni apertura física.", meta: "TT reportado", icon: ShieldCheck },
        { title: "Polygon", body: "Después de evidencia separada y aprobación del tenant, el comprador puede recibir un registro de propiedad digital. La transacción valida el claim digital, no el objeto físico.", meta: "Propiedad digital", icon: BadgeCheck },
        { title: "IOTA", body: "Ancla evidencia seleccionada de cadena como hashes o Merkle roots cuando la política de auditoría lo exige. Los datos privados quedan fuera de blockchain.", meta: "Cadena de Suministro", icon: Network },
        { title: "UHF / IoT", body: "Pallets, cajas y sensores industriales: trazabilidad operacional sin complicar al consumidor.", meta: "Industrial", icon: RadioTower },
      ],
    };

  return (
    <section className="container-shell py-16 md:py-24">
      <div className="enterprise-trust-layers__shell">
        <div className="enterprise-trust-layers__head">
          <div>
            <p>{copy.eyebrow}</p>
            <h2>{copy.title}</h2>
          </div>
          <div>
            <span>{copy.body}</span>
            <Link href="/docs#trust-layers">
              {copy.cta} <span aria-hidden="true">-&gt;</span>
            </Link>
          </div>
        </div>

        <div className="enterprise-trust-layers__grid">
          {copy.paths.map((item, i) => (
            <article key={item.label} className="enterprise-trust-layer-card enterprise-trust-layer-card--phase enterprise-trust-layer-card--identity md:col-span-2">
              <div>
                <span><PackageCheck className="h-4 w-4" /></span>
                <em>{locale === "en" ? `Phase ${i + 1}` : `Fase ${i + 1}`}</em>
              </div>
              <h3>{item.label}</h3>
              <p>{item.body}</p>
            </article>
          ))}

          {copy.cards.map((item) => {
            const Icon = item.icon;
            const isWide = item.title === "Polygon" || item.title === "NFC 424 DNA";
            const tone = item.title === "Polygon"
              ? "ownership"
              : item.title === "IOTA"
                ? "supply-chain"
                : item.title.includes("NFC")
                  ? "authenticity"
                  : "identity";
            const keepMobileSimulation = item.title.includes("NFC") || item.title === "Polygon" || item.title === "IOTA";
            const href = item.title === "IOTA"
              ? "/proof/verify"
              : item.title === "Polygon"
                ? "/demo-lab?scenario=polygon-ownership"
                : item.title.includes("Offline")
                  ? "/demo-lab?scenario=offline-verifier"
                  : item.title.includes("NFC")
                    ? "/demo-lab?scenario=nfc-424"
                    : item.title.includes("QR")
                      ? "/demo-lab?scenario=qr-gs1"
                      : "/docs#trust-layers";
            return (
              <Link
                key={item.title}
                href={href}
                aria-label={`${item.title}: ${locale === "en" ? "open related proof experience" : "abrir experiencia relacionada"}`}
                className={`enterprise-trust-layer-card enterprise-trust-layer-card--capability enterprise-trust-layer-card--${tone} ${keepMobileSimulation ? "enterprise-trust-layer-card--mobile-sim" : ""} ${isWide ? "md:col-span-2" : ""}`}
              >
                <div>
                  <span><Icon className="h-4 w-4" /></span>
                  <em>{item.meta}</em>
                </div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <TrustLayerMiniSimulation title={item.title} tone={tone} locale={locale} />
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.12em] text-cyan-200">
                  {locale === "en" ? "Try it" : "Probar"} <span aria-hidden="true">-&gt;</span>
                </span>
              </Link>
            );
          })}
        </div>

        <div className="enterprise-trust-layers__note">
          <BadgeCheck className="h-5 w-5" />
          <p>{copy.note}</p>
        </div>
      </div>
    </section>
  );
}

export function OfflineFieldOperationsSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = isEn
    ? {
      eyebrow: "Offline and low-connectivity operations",
      title: "Field message checks for farms, wine cellars, plants, mines and warehouses without signal.",
      body: "Authorized phones and scanners can evaluate the available tag message and local policy offline, then queue hashed evidence. Server sync issues the final digital message/policy result—not a verdict on physical authenticity, contents, origin, seal or custody.",
      docs: "Read offline architecture",
      demo: "Open offline DemoLab",
      phoneLabel: "Samsung field verifier",
      phoneStatus: "OFFLINE_LOCAL_PASS",
      phoneSub: "Provisional until backend sync",
      phoneWarning: "Server sync confirms replay and policy checks. Warranty and ownership remain separate approved workflows; no physical-product verdict is issued.",
      stages: [
        { label: "Enroll", body: "Security operator registers the device fingerprint and operator.", icon: Smartphone },
        { label: "Bundle", body: "Backend issues allowed BIDs, policy and key fingerprints only.", icon: KeyRound },
        { label: "Scan", body: "The app or reader queues hashed evidence in no-signal zones.", icon: CloudOff },
        { label: "Sync", body: "nexID confirms replay and policy checks; warranty and ownership use separate evidence.", icon: RotateCcw },
      ],
      atlas: [
        ["Field", "Seed lots, rural depots and crop inputs"],
        ["Cellar", "Wine caves, cavas and storage rooms"],
        ["Plant", "Factories, mines and remote QA stations"],
      ],
      warning: "No tenant master keys, KMS keys or raw batch keys are returned in offline bundles.",
    }
    : isBr
    ? {
      eyebrow: "Operacao offline e baixa conectividade",
      title: "Validação de mensagens em campo para fazendas, cavas, plantas, minas e armazéns sem sinal.",
      body: "Celulares e leitores autorizados avaliam a mensagem da tag e a política local disponível offline e enfileiram evidência com hash. O sync confirma o resultado digital, não autenticidade física, conteúdo, origem, lacre ou custódia.",
      docs: "Ler arquitetura offline",
      demo: "Abrir DemoLab offline",
      phoneLabel: "Scanner de campo",
      phoneStatus: "PASSE LOCAL PROVISÓRIO",
      phoneSub: "Passe provisório até sincronizar",
      phoneWarning: "O sync confirma replay e política. Garantia e ownership continuam fluxos separados com aprovação; não há veredito físico.",
      stages: [
        { label: "Enroll", body: "O administrador vincula o celular do operador com seguranca.", icon: Smartphone },
        { label: "Bundle", body: "O sistema envia permissoes e dados dos produtos para o celular.", icon: KeyRound },
        { label: "Scan", body: "O app avalia a mensagem da tag e a política local mesmo sem internet.", icon: CloudOff },
        { label: "Sync", body: "Ao conectar, o servidor confirma replay e política; outros direitos exigem evidência separada.", icon: RotateCcw },
      ],
      atlas: [
        ["Campo", "Lotes agro, depositos rurais e insumos"],
        ["Cava", "Adegas, cavas e salas de armazenamento"],
        ["Planta", "Fabricas, minas e QA remoto"],
      ],
      warning: "Bundles offline nao retornam master keys, KMS nem chaves cruas de batch.",
    }
    : {
      eyebrow: "Operación offline y baja conectividad",
      title: "Validación de mensajes en campo para agro, cavas, plantas, minas y depósitos sin señal.",
      body: "Celulares y escáneres autorizados evalúan el mensaje del tag y la política local disponible sin internet y encolan evidencia con hash. La sincronización confirma el resultado digital, no autenticidad física, contenido, origen, sello ni custodia.",
      docs: "Leer arquitectura offline",
      demo: "Abrir DemoLab offline",
      phoneLabel: "Escáner de campo",
      phoneStatus: "PASE LOCAL PROVISIONAL",
      phoneSub: "Pase provisional hasta sincronizar",
      phoneWarning: "La sincronización confirma replay y política. Garantía y propiedad siguen flujos separados con aprobación; no se emite un veredicto físico.",
      stages: [
        { label: "Vincular", body: "El administrador vincula de forma segura el celular del operador.", icon: Smartphone },
        { label: "Permisos", body: "Se envian los permisos y datos de los productos al celular.", icon: KeyRound },
        { label: "Campo", body: "La app evalúa el mensaje del tag y la política local aunque no haya internet.", icon: CloudOff },
        { label: "Sincronizar", body: "Al conectarse, el servidor confirma replay y política; otros derechos exigen evidencia separada.", icon: RotateCcw },
      ],
      atlas: [
        ["Campo", "Lotes agro, depositos rurales e insumos"],
        ["Cava", "Cavas de vino y salas de guarda"],
        ["Planta", "Fabricas, minas y QA remoto"],
      ],
      warning: "Los bundles offline no devuelven master keys, KMS ni llaves crudas de batch.",
    };

  return (
    <section id="offline-field-operations" className="container-shell scroll-mt-24 py-16 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_70%_50%,rgba(6,182,212,0.08),transparent_50%)]" />
      
      <div className="relative z-10 grid gap-12 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_450px] lg:items-center">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">{copy.eyebrow}</p>
          <h2 className="mt-4 text-3xl font-black leading-tight text-slate-900 dark:text-white md:text-5xl">{copy.title}</h2>
          <p className="mt-6 text-base leading-relaxed text-slate-600 dark:text-slate-300">{copy.body}</p>
          
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {copy.stages.map((stage) => {
              const Icon = stage.icon;
              return (
                <article key={stage.label} className="rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.02] p-5 shadow-sm dark:shadow-none transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">{stage.label}</h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{stage.body}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {copy.atlas.map(([label, body]) => (
              <div key={label} className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/docs#offline-verifier-architecture" className="inline-flex h-12 items-center justify-center rounded-xl bg-cyan-500 px-6 text-sm font-bold text-slate-950 transition-transform hover:scale-105 hover:bg-cyan-400">
              {copy.docs}
            </Link>
            <Link href="/demo-lab?scenario=offline-verifier" className="landing-offline-demo-cta inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 px-6 text-sm font-bold text-slate-900 dark:text-white transition-colors hover:bg-slate-50 dark:hover:bg-white/10">
              {copy.demo}
            </Link>
          </div>

          <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0" />
            <p className="text-xs font-semibold leading-relaxed text-amber-800 dark:text-amber-200/90">{copy.warning}</p>
          </div>
        </div>

        {/* Mobile Mockup Glassmorphic */}
        <div className="relative mx-auto w-full max-w-[320px] lg:max-w-full perspective-[1000px]">
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 blur-3xl opacity-50 rounded-full" />
          
          <div className="relative rounded-[2.5rem] border-[8px] border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-950 shadow-2xl overflow-hidden transform-gpu rotate-y-[-5deg] rotate-x-[2deg] hover:rotate-y-0 hover:rotate-x-0 transition-transform duration-700 ring-1 ring-slate-300 dark:ring-white/10">
            {/* Notch */}
            <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-20">
              <div className="w-24 h-full bg-slate-200 dark:bg-slate-800 rounded-b-xl" />
            </div>

            {/* Screen Content */}
            <div className="offline-phone-screen relative h-full w-full p-5 pt-12 pb-8 flex flex-col">
              {/* App Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                    <Smartphone className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-500/70">{copy.phoneLabel}</p>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">Scanner App</p>
                  </div>
                </div>
                <CloudOff className="h-5 w-5 text-slate-500" />
              </div>

              {/* Status Card (Glassmorphic) */}
              <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 backdrop-blur-md mb-6 shadow-[0_0_30px_rgba(16,185,129,0.15)] text-center">
                <div className="absolute -top-4 -right-4 p-4 opacity-10">
                  <Fingerprint className="h-28 w-28" />
                </div>
                <div className="relative z-10 flex flex-col items-center">
                  <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 border border-emerald-500/40">
                    <ShieldCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{copy.phoneStatus}</h3>
                  <p className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-300/80 bg-emerald-100 dark:bg-emerald-950/50 px-3 py-1 rounded-full">{copy.phoneSub}</p>
                </div>
              </div>

              {/* Data Rows */}
              <div className="space-y-3 mb-6">
                {[
                  { label: "BID", value: "SYN-AR-2026-001", icon: KeyRound },
                  { label: "UID Hash", value: "sha256:8f4c...", icon: Fingerprint },
                  { label: "Queue", value: "18 pending sync", icon: RotateCcw, highlight: true },
                  { label: "Bundle", value: "expires 24h", icon: PackageCheck }
                ].map((row, i) => (
                  <div key={i} className="offline-data-row flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] p-3 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <row.icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{row.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono ${row.highlight ? 'offline-sync-badge rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700 dark:border-transparent dark:bg-transparent dark:px-0 dark:py-0 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>{row.value}</span>
                      {row.highlight && <span className="offline-sync-badge flex h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
                    </div>
                  </div>
                ))}
              </div>

              {/* Warning Notice */}
              <div className="mt-auto rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
                <p className="text-[10px] font-bold leading-relaxed text-amber-700 dark:text-amber-400/90 text-center">
                  {copy.phoneWarning}
                </p>
              </div>

            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

export function PremiumVerticalShowcaseSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = isEn
    ? {
      kicker: "One platform, many industries",
      title: "nexID is more than a wine showcase. It is infrastructure for every physical asset that needs trust.",
      body: "Start with QR when cost matters, add NFC or NTAG 424 DNA TT for cryptographic tag-message and reported-TT evidence, and connect POS, logistics, loyalty and CRM without presenting that evidence as proof of the physical item.",
      cta: "Open SDK & APIs",
      secondary: "Open Product Lab",
    }
    : isBr
    ? {
      kicker: "Uma plataforma, muitos setores",
      title: "nexID vai alem de uma vitrine de vinho. E infraestrutura para qualquer ativo fisico que precise de confianca.",
      body: "Comece com QR quando o custo importa, adicione NFC ou NTAG 424 DNA TT para evidência criptográfica da mensagem e TT reportado, e conecte POS, logística, loyalty e CRM sem apresentar isso como prova do item físico.",
      cta: "Abrir SDK & APIs",
      secondary: "Abrir Laboratorio",
    }
    : {
      kicker: "Una plataforma, muchos rubros",
      title: "nexID va mas alla de una vitrina de vinos. Es infraestructura para cualquier activo fisico que necesite confianza.",
      body: "Empezá con QR cuando el costo importa, sumá NFC o NTAG 424 DNA TT para evidencia criptográfica del mensaje y TT reportado, y conectá POS, logística, loyalty y CRM sin presentarlo como prueba del objeto físico.",
      cta: "Abrir SDK & APIs",
      secondary: "Abrir laboratorio",
    };

  const verticals = platformVerticals.map((item) => ({
    title: isEn ? item.titleEn : isBr ? item.titlePt : item.title,
    image: item.image,
    tags: item.tags,
    body: isEn ? item.bodyEn : isBr ? item.bodyPt : item.body,
    demoVertical: item.demoVertical,
  }));

  return (
    <section className="landing-premium-verticals container-shell py-12 md:py-16">
      <div className="landing-premium-verticals__head">
        <div>
          <p>{copy.kicker}</p>
          <h2>{copy.title}</h2>
        </div>
        <div>
          <span>{copy.body}</span>
          <div>
            <Link href="/sdk">{copy.cta}</Link>
            <Link href="/demo-lab?vertical=wine">{copy.secondary}</Link>
          </div>
        </div>
      </div>
      <div className="landing-premium-verticals__grid">
        {verticals.map((item) => (
          <Link key={item.title} href={`/demo-lab?vertical=${item.demoVertical}`} className="landing-premium-vertical-card">
            <img src={item.image} alt={`${item.title} nexID`} loading="lazy" />
            <div className="landing-premium-vertical-card__body">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <div>
                {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function PlainLanguageValueSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = isEn
    ? {
      eyebrow: "In plain language",
      title: "nexID is not a chip company. It turns each product into a direct trust and after-sales channel.",
      body: "A premium product should not disappear after it leaves the factory or store. nexID validates tag messages, presents brand-declared history and keeps the buyer relationship alive without claiming that a tap proves the physical item.",
      primary: "Book a 20 minute demo",
      secondary: "Open customer journey",
      cards: [
        { title: "For the brand", body: "Protect channels and reputation while collecting first-party data from tag-message validations and approved claims." },
        { title: "For the customer", body: "Tap, review declared product data, request warranty, receive approved benefits and keep a digital record." },
        { title: "For stores and distributors", body: "Record purchase evidence, reduce suspicious claims and activate campaigns by batch, city or channel." },
      ],
      story: [
        "A digital record is created with declared batch, origin and visual assets.",
        "Customer taps NFC or QR and sees a clear message/policy result: valid, flagged or blocked.",
        "After purchase, separately reviewed evidence and explicit policy approval can unlock ownership, warranty and benefits.",
        "If the case needs it, the certificate can be registered on Polygon and connected to wallet or marketplace under tenant policy.",
      ],
      note: "The user does not need to understand blockchain. The screen must simply say what happened, why it matters and what to do next.",
    }
    : isBr
    ? {
      eyebrow: "Em palavras simples",
      title: "nexID nao e uma empresa de chips. Transforma cada produto em um canal direto de confianca e pos-venda.",
      body: "Um produto premium não deveria desaparecer depois da fábrica ou da loja. nexID valida mensagens da tag, mostra o histórico declarado pela marca e mantém a relação com o comprador sem afirmar que o toque prova o item físico.",
      primary: "Agendar demo de 20 min",
      secondary: "Ver jornada do cliente",
      cards: [
        { title: "Para a marca", body: "Protege canal e reputação enquanto gera dados próprios de mensagens validadas e claims aprovados." },
        { title: "Para o cliente", body: "Toca, consulta dados declarados, solicita garantia, recebe benefícios aprovados e guarda um registro digital." },
        { title: "Para lojas e distribuidores", body: "Registra evidência de compra, reduz claims suspeitos e ativa campanhas por lote, cidade ou canal." },
      ],
      story: [
        "O registro digital nasce com lote, origem e banco visual declarados.",
        "Cliente toca NFC ou QR e vê um resultado claro da mensagem/política: válido, sinalizado ou bloqueado.",
        "Depois da compra, evidência revisada separadamente e aprovação explícita podem liberar titularidade, garantia e benefícios.",
        "Se o caso pedir, o certificado pode ser registrado na Polygon e conectado a wallet ou marketplace sob politica do tenant.",
      ],
      note: "O usuario nao precisa entender blockchain. A tela deve explicar o que aconteceu, por que importa e qual e o proximo passo.",
    }
    : {
      eyebrow: "En palabras simples",
      title: "nexID no es una empresa de chips. Convierte cada producto en un canal directo de confianza y postventa.",
      body: "Un producto premium no debería desaparecer después de salir de fábrica o de la tienda. Con nexID, cada unidad puede mostrar evidencia de confianza, contar su historia y mantener viva la relación con el comprador.",
      primary: "Agendar demo de 20 min",
      secondary: "Ver experiencia del cliente",
      cards: [
        { title: "Para la marca", body: "Protege canal y reputación mientras genera datos propios desde mensajes validados y reclamos aprobados." },
        { title: "Para el cliente", body: "Toca, consulta datos declarados, solicita garantía, recibe beneficios aprobados y guarda un registro digital." },
        { title: "Para tiendas y distribuidores", body: "Registra evidencia de compra, reduce reclamos sospechosos y activa campañas por lote, ciudad o canal." },
      ],
      story: [
        "El registro digital nace con lote, origen y banco visual declarados.",
        "El cliente toca NFC o QR y ve un resultado claro del mensaje y la política: válido, observado o bloqueado.",
        "Después de la compra, evidencia revisada por separado y aprobación explícita pueden habilitar propiedad digital, garantía y beneficios.",
        "Si el caso lo necesita, el certificado puede registrarse en Polygon y conectarse a wallet o marketplace bajo política del tenant.",
      ],
      note: "El usuario no necesita entender blockchain. La pantalla tiene que explicar que paso, por que importa y cual es el proximo paso.",
    };

  return (
    <section className="container-shell py-10 md:py-14">
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-stretch">
        <div className="rounded-[2rem] border border-emerald-300/15 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/60 p-6 md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">{copy.eyebrow}</p>
          <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white md:text-5xl">{copy.title}</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">{copy.body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={schedulingUrls.meeting} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-4 py-2 text-sm font-black text-emerald-100 transition hover:bg-emerald-500/25">
              {copy.primary}
            </a>
            <Link href="/sun" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/20">
              {copy.secondary}
            </Link>
          </div>
          <p className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm font-semibold leading-6 text-cyan-50">{copy.note}</p>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            {copy.cards.map((card) => (
              <article key={card.title} className="rounded-2xl border border-white/10 bg-slate-950/65 p-5">
                <h3 className="text-base font-black text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{card.body}</p>
              </article>
            ))}
          </div>
          <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-5 md:p-6">
            <div className="grid gap-3 md:grid-cols-4">
              {copy.story.map((item, index) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/15 text-xs font-black text-cyan-100">{index + 1}</span>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-100">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CommercialPromiseSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = isEn
    ? {
      eyebrow: "Why companies choose nexID",
      title: "The product does not end at the sale. It becomes a live channel for trust, data and after-sales.",
      body: "Each validation can confirm a tag message and policy, show declared data, protect the channel and start governed after-sales actions. It does not prove the physical item, contents, origin, seal or custody.",
      cta: "Plan a pilot",
      secondary: "See architecture",
      items: [
        ["NFC evidence", "The buyer sees a clear message/policy result: valid, flagged or blocked, without a false physical verdict."],
        ["Declared traceability", "Declared origin, batch, store, distributor, reported tap location and TT state become one readable story."],
        ["After-sales", "Warranty, club, points, vouchers, support, marketplace and resale can open from the same passport."],
        ["Data for teams", "Marketing, operations, risk and sales get first-party signals by batch, city, channel and campaign."],
      ],
    }
    : isBr
    ? {
      eyebrow: "Por que empresas escolhem nexID",
      title: "O produto não termina na venda. Ele vira um canal vivo de confiança, dados e pós-venda.",
      body: "Cada validação confirma mensagem e política da tag, mostra dados declarados e inicia ações governadas. Não comprova item físico, conteúdo, origem, lacre ou custódia.",
      cta: "Planejar piloto",
      secondary: "Ver arquitetura",
      items: [
        ["Evidência NFC", "O comprador vê um resultado claro da mensagem/política: válido, sinalizado ou bloqueado, sem falso veredito físico."],
        ["Rastreabilidade declarada", "Origem, lote, loja, distribuidor, local informado do toque e TT reportado formam uma história legível."],
        ["Pós-venda", "Garantia, clube, pontos, vouchers, suporte, marketplace e revenda podem abrir no mesmo passaporte."],
        ["Dados para equipes", "Marketing, operações, risco e vendas recebem sinais por lote, cidade, canal e campanha."],
      ],
    }
    : {
      eyebrow: "Por que una empresa elige nexID",
      title: "El producto no termina en la venta. Se convierte en un canal vivo de confianza, datos y postventa.",
      body: "Cada validación confirma el mensaje y la política del tag, muestra datos declarados e inicia acciones gobernadas. No prueba objeto físico, contenido, origen, sello ni custodia.",
      cta: "Planear un piloto",
      secondary: "Ver arquitectura",
      items: [
        ["Evidencia NFC", "El comprador ve un resultado claro del mensaje y la política: válido, observado o bloqueado, sin falso veredicto físico."],
        ["Trazabilidad declarada", "Origen, lote, tienda, distribuidor, ubicación reportada del tap y TT reportado forman una historia simple."],
        ["Postventa", "Garantía, club, puntos, vouchers, soporte, marketplace y reventa pueden abrir desde el mismo pasaporte."],
        ["Datos para equipos", "Marketing, operaciones, riesgo y ventas reciben señales por lote, ciudad, canal y campaña."],
      ],
    };

  return (
    <section className="container-shell py-10 md:py-14">
      <div className="commercial-promise-card rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">{copy.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white md:text-5xl">{copy.title}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">{copy.body}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={schedulingUrls.meeting} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-4 py-2 text-sm font-black text-emerald-100 transition hover:bg-emerald-500/25">
                {copy.cta}
              </a>
              <Link href="/docs" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/20">
                {copy.secondary}
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {copy.items.map(([title, body]) => (
              <article key={title} className="commercial-promise-tile rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <h3 className="text-base font-black text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function AboutInmovarSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = isEn
    ? {
      eyebrow: "Who builds it",
      title: "NexID is an Inmovar product for brands that need trust after the sale.",
      body: "Inmovar builds technology for AI, automation, integrations, blockchain, tokenization and operational platforms. NexID applies that stack to premium products, export goods, limited editions, credentials and assets where authenticity matters.",
      founder: "Led by Marcelo Guillen, computer and telecommunications engineer, CEO and founder of Inmovar.",
      bullets: ["Pilot by product line, batch or edition.", "White-label experience for each brand.", "API, dashboard, portal, marketplace and optional wallet in the same operating layer."],
      cta: "Talk about a pilot",
    }
    : isBr
    ? {
      eyebrow: "Quem constroi",
      title: "NexID e um produto da Inmovar para marcas que precisam de confianca depois da venda.",
      body: "A Inmovar desenvolve tecnologia com IA, automacao, integracoes, blockchain, tokenizacao e plataformas operacionais. NexID aplica essa experiencia a produtos premium, exportacao, edicoes limitadas, credenciais e ativos onde autenticidade importa.",
      founder: "Liderado por Marcelo Guillen, engenheiro informatico e de telecomunicacoes, CEO e fundador da Inmovar.",
      bullets: ["Piloto por linha, lote ou edicao.", "Experiencia white-label para cada marca.", "API, dashboard, portal, marketplace e wallet opcional na mesma camada."],
      cta: "Falar sobre piloto",
    }
    : {
      eyebrow: "Quienes somos",
      title: "NexID es un producto de Inmovar para marcas que necesitan confianza después de la venta.",
      body: "Inmovar desarrolla tecnología con inteligencia artificial, automatización, integraciones, blockchain, tokenización y plataformas operativas. NexID lleva esa experiencia a productos premium, exportación, ediciones limitadas, credenciales y activos donde la autenticidad importa.",
      founder: "Liderado por Marcelo Guillen, ingeniero informatico y de telecomunicaciones, CEO y fundador de Inmovar.",
      bullets: ["Piloto por linea, lote o edicion.", "Experiencia white-label para cada marca.", "API, dashboard, portal, marketplace y wallet opcional en una misma capa operativa."],
      cta: "Hablar de un piloto",
    };

  return (
    <section className="container-shell py-10 md:py-14">
      <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">{copy.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white md:text-5xl">{copy.title}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">{copy.body}</p>
            <p className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm font-semibold leading-6 text-emerald-50">{copy.founder}</p>
          </div>
          <div className="grid gap-3">
            {copy.bullets.map((item, index) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{String(index + 1).padStart(2, "0")}</span>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-100">{item}</p>
              </div>
            ))}
            <Link href="/?contact=sales&intent=pilot#contact-modal" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/25">
              {copy.cta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function RadarSection({ radar, locale }: { radar: any; locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const demoLabel = isEn ? "Illustrative network" : isBr ? "Rede ilustrativa" : "Red ilustrativa";
  const demoBody = isEn ? "Simulated nodes; not live telemetry." : isBr ? "Nodos simulados; nao e telemetria ao vivo." : "Nodos simulados; no es telemetría en vivo.";
  return (
    <section className="container-shell py-16">
      <div className="grid items-center gap-12 lg:grid-cols-2">
         <div>
            <SectionHeading eyebrow={radar.eyebrow} title={radar.title} description={radar.description}  />
            <ul className="mt-8 space-y-4">
              {radar.features.map((feature: any) => (
                <li key={feature.title} className="flex gap-4">
                   <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      ✓
                   </div>
                   <div>
                      <h4 className="text-sm font-bold text-white">{feature.title}</h4>
                      <p className="text-sm text-slate-400 mt-1">{feature.body}</p>
                   </div>
                </li>
              ))}
            </ul>
         </div>
         <div className="relative overflow-hidden">
            <PremiumTraceabilityGlobe
              title="Vista global de trazabilidad"
              subtitle="Origen, taps, riesgo y rutas ilustrativas con fuente declarada."
              caption="El mismo motor visual alimenta SDK, laboratorio de producto, CRM e Investor."
              points={traceabilityGlobePoints}
              routes={traceabilityGlobeRoutes}
              compact
            />
            <div className="absolute bottom-4 right-4 bg-slate-950/80 backdrop-blur-md border border-white/10 rounded-lg p-3 text-xs text-slate-300 shadow-xl">
               <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="font-bold text-white">{demoLabel}</span>
               </div>
               {demoBody}
            </div>
         </div>
      </div>
    </section>
  );
}

export function InteractiveDemoSection({ locale }: { locale: string }) {
   const copy = locale === "en" ? {
      eyebrow: "Interactive Preview",
      title: "Experience the Consumer Journey",
      desc: "Scan a product and instantly access provenance, loyalty, and secondary market tools without app downloads."
   } : {
      eyebrow: "Vista interactiva",
      title: "Vivi la experiencia del consumidor",
      desc: "Escanea un producto y accede a su historia, beneficios y herramientas de reventa sin descargar apps."
   };

   return (
      <section className="container-shell py-20">
         <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-8 md:p-12 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-violet-600/10 to-transparent pointer-events-none" />

            <div className="grid md:grid-cols-2 gap-8 items-center relative z-10">
               <div>
                  <SectionHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.desc}  />
                  <div className="mt-8 flex flex-wrap gap-4">
                     <Link href="/sun" className="inline-flex items-center justify-center rounded-xl bg-white text-slate-950 px-6 py-3 font-bold transition hover:bg-slate-200 shadow-lg shadow-white/10">
                        Probar pasaporte celular
                     </Link>
                     <Link href="/demo-lab?vertical=wine" className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10 backdrop-blur-sm">
                        Abrir laboratorio
                     </Link>
                  </div>
               </div>

               <div className="flex justify-center md:justify-end">
                  <div className="w-[280px] h-[550px] border-[8px] border-slate-800 rounded-[3rem] bg-slate-950 overflow-hidden relative shadow-2xl ring-1 ring-white/10 transform rotate-[-5deg] transition-transform duration-500 hover:rotate-0">
                     <div className="absolute top-0 inset-x-0 h-6 bg-slate-900 z-20 flex justify-center">
                        <div className="w-20 h-4 bg-slate-950 rounded-b-xl" />
                     </div>
                     <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?q=80&w=600')] bg-cover bg-center opacity-30" />
                     <div className="absolute inset-0 flex flex-col justify-end p-6 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent">
                        <div className="inline-flex px-2 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded mb-3 w-max">DEMO · MENSAJE NFC VÁLIDO</div>
                        <h3 className="text-xl font-bold text-white">Gran Reserva Malbec</h3>
                        <p className="text-xs text-slate-300 mt-1">Mendoza, Argentina</p>
                        <div className="mt-4 w-full h-10 bg-white text-slate-950 rounded-lg flex items-center justify-center text-sm font-bold shadow-lg">
                           Solicitar ownership
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </section>
   );
}


export function EventsTagPositioningSection({ locale }: { locale: string }) {
  const copy = locale === "en"
    ? {
      eyebrow: "Events Positioning / NTAG215",
      title: "Why NTAG215 beats QR in event flows",
      intro: "NTAG215 is for tap UX, serialization, and operational control on wristbands, tickets, and credentials. It is not premium anti-fraud.",
      basicTitle: "NTAG215 Basic (events & activations)",
      basicBullets: [
        "Faster check-in than QR/email/photo in queued access.",
        "Each physical piece can be serialized with UID and server-side rules.",
        "Harder to share casually than a screenshot QR.",
        "Ideal for event wristbands, credentials, tickets and brand activations.",
      ],
      secureTitle: "NTAG 424 DNA TagTamper (premium tag-message evidence)",
      secureBullets: [
        "Use this profile when dynamic message validation, replay resistance and reported TT state are business critical.",
        "Recommended for wine, cosmetics, docs/presence and high-risk supply chains.",
      ],
      footer: "Message to buyers: NTAG215 = UX + control + serialisation. NTAG 424 DNA TT = stronger tag-message and reported-TT evidence, not proof of physical contents.",
    }
    : locale === "pt-BR"
    ? {
      eyebrow: "Posicionamento Eventos / NTAG215",
      title: "Por que NTAG215 supera QR em muitos fluxos de evento",
      intro: "NTAG215 é para UX por toque, serialização e controle operacional em pulseiras, tickets e credenciais. Não é anti-fraude premium.",
      basicTitle: "NTAG215 Basic (eventos e ativações)",
      basicBullets: [
        "Check-in mais rápido que QR/email/foto em acessos com fila.",
        "Cada peça física pode ser serializada com UID e regras no backend.",
        "Mais difícil de compartilhar casualmente do que um QR por screenshot.",
        "Ideal para pulseiras, credenciais, tickets e ativações de marca.",
      ],
      secureTitle: "NTAG 424 DNA TagTamper (evidência premium da tag)",
      secureBullets: [
        "Use este perfil quando mensagem dinâmica, resistência a replay e TT reportado são críticos.",
        "Recomendado para vinho, cosméticos, docs/presence e cadeias de risco.",
      ],
      footer: "Mensagem comercial: NTAG215 = UX + controle + serialização. NTAG 424 DNA TT = evidência mais forte da mensagem e TT reportado, não prova do conteúdo físico.",
    }
    : {
      eyebrow: "Posicionamiento Eventos / NTAG215",
      title: "Por que NTAG215 supera al QR en muchos flujos de eventos",
      intro: "NTAG215 está pensado para experiencia por toque, serialización y control operativo en pulseras, entradas y credenciales. No aporta mensajes SUN dinámicos ni prueba del objeto físico.",
      basicTitle: "NTAG215 Basico (eventos y activaciones)",
      basicBullets: [
        "Ingreso mas rapido que QR, email o foto en accesos con filas.",
        "Cada pieza fisica puede serializarse con UID y reglas del servidor.",
        "Mas dificil de compartir casualmente que un QR por captura.",
        "Ideal para pulseras, credenciales, tickets y activaciones de marca.",
      ],
      secureTitle: "NTAG 424 DNA TagTamper (evidencia premium del tag)",
      secureBullets: [
        "Usá este perfil cuando mensaje dinámico, resistencia a replay y TT reportado sean críticos.",
        "Recomendado para vino, cosmética, documentos, presencia y cadenas de alto riesgo.",
      ],
      footer: "Mensaje comercial: NTAG215 = experiencia + control + serialización. NTAG 424 DNA TT = evidencia más fuerte del mensaje y TT reportado, no prueba del contenido físico.",
    };

  return (
    <section className="container-shell py-16">
      <Card className="p-6 md:p-8 backdrop-blur-xl border border-white/5 bg-slate-900/60 shadow-2xl">
        <SectionHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.intro} />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-cyan-500/10 to-transparent p-6 hover:border-cyan-300/40 transition-colors">
            <p className="text-sm font-bold text-cyan-200">{copy.basicTitle}</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {copy.basicBullets.map((bullet) => (
                 <li key={bullet} className="flex items-start gap-2">
                    <span className="text-cyan-500 mt-0.5">•</span>
                    <span>{bullet}</span>
                 </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-violet-300/25 bg-gradient-to-br from-violet-500/10 to-transparent p-6 hover:border-violet-300/40 transition-colors">
            <p className="text-sm font-bold text-violet-200">{copy.secureTitle}</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {copy.secureBullets.map((bullet) => (
                 <li key={bullet} className="flex items-start gap-2">
                    <span className="text-violet-500 mt-0.5">•</span>
                    <span>{bullet}</span>
                 </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-6 text-sm text-slate-400 text-center">{copy.footer}</p>
        <div className="risk-stack-panel mt-8 rounded-2xl border border-white/10 bg-slate-950/65 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Configuracion por riesgo</p>
              <h3 className="mt-2 text-lg font-semibold text-white">De QR comun a NTAG 424 DNA TagTamper</h3>
            </div>
            <Link href="/stack" className="risk-stack-link rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">
              Ver capa tecnica
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {[
              { name: "QR / GS1 Digital Link", tag: "Contenido", body: "La entrada mas economica: resolver, envase masivo, campanas, manuales y analitica basica. Ideal cuando no se necesita evidencia criptografica dinamica del mensaje." },
              { name: "NTAG213 / NTAG215", tag: "Toque simple", body: "Bajo costo NFC para entradas, credenciales, beneficios y productos de rotacion: UID serializado, reglas del servidor y experiencia sin camara." },
              { name: "NTAG 424 DNA", tag: "SUN/SDM", body: "Cada toque genera un mensaje dinámico verificable para detectar copia del mensaje, replay y URLs reutilizadas. No certifica el objeto físico." },
              { name: "424 DNA TT + token", tag: "TT + política", body: "Para vino, lujo, salud y activos premium: reporta estado TT, actualiza el pasaporte y prepara propiedad digital sólo según evidencia y política aprobadas." },
            ].map((item, index) => (
              <article key={item.name} className="risk-stack-card relative rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="risk-stack-index grid h-7 w-7 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-500/10 text-xs font-black text-cyan-100">{index + 1}</span>
                  <span className="risk-stack-badge rounded-full border border-white/10 bg-slate-950 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">{item.tag}</span>
                </div>
                <h4 className="text-sm font-semibold text-white">{item.name}</h4>
                <p className="mt-2 text-xs leading-5 text-slate-400">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
}

export function PlansSection({ content, locale }: { content: Content; locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const learnMore = isEn ? "Example flow" : isBr ? "Fluxo exemplo" : "Flujo ejemplo";
  const planEducation = [
    {
      visual: "qr",
      title: "Basico real",
      example: "QR comun o NFC UID para contenido, campanas, manuales, registro de garantia y primeras metricas.",
      fit: "Cuando el riesgo de copia no es critico y lo importante es lanzar rapido.",
    },
    {
      visual: "ntag",
      title: "Toque seguro",
      example: "NTAG215 o NTAG 424 DNA con UID/SUN dinámico para serialización, detección de copia/replay del mensaje y control del servidor.",
      fit: "Para eventos, credenciales, productos de valor medio y operaciones con validacion frecuente.",
    },
    {
      visual: "tt",
      title: "Premium tokenizado",
      example: "NTAG 424 DNA TT + pasaporte + certificado Polygon opcional para propiedad digital, historial y tienda.",
      fit: "Para vino, lujo, cosmética, salud y activos donde TT reportado, datos de origen declarados y postventa importan.",
    },
  ];
  const enrichedPlanEducation = isEn
    ? [
      { visual: "qr", title: "Basic launch", example: "Common QR or NFC UID for manuals, landing pages, warranty forms and first scan analytics.", fit: "Use it when speed matters more than dynamic cryptographic message evidence.", flow: ["Customer scans", "Content opens", "Lead or warranty is saved"] },
      { visual: "ntag", title: "Secure tap", example: "NTAG215 for events or NTAG 424 DNA for dynamic SUN, serialized UID and server-side rules.", fit: "Use it for tickets, credentials, mid-value products and frequent validation.", flow: ["Phone taps", "Backend checks UID/SUN", "Dashboard records location"] },
      { visual: "tt", title: "Premium tokenized", example: "NTAG 424 DNA TT + passport + optional Polygon record for policy-approved ownership, lifecycle and marketplace.", fit: "Use it where reported TT, declared origin and resale workflows matter.", flow: ["Tag reports TT change", "Passport records the report", "Policy reviews ownership or voucher"] },
    ]
    : isBr
    ? [
      { visual: "qr", title: "Basic", example: "QR comum ou NFC UID para manuais, landing pages, garantia e primeiras metricas de scan.", fit: "Use quando velocidade importa mais que evidencia criptografica dinamica da mensagem.", flow: ["Cliente escaneia", "Conteudo abre", "Lead ou garantia salva"] },
      { visual: "ntag", title: "Secure tap", example: "NTAG215 para eventos ou NTAG 424 DNA com SUN dinamico, UID serializado e regras server-side.", fit: "Para ingressos, credenciais, produtos de valor medio e validacao frequente.", flow: ["Celular toca", "Backend valida UID/SUN", "Dashboard registra local"] },
      { visual: "tt", title: "Premium tokenizado", example: "NTAG 424 DNA TT + passaporte + registro Polygon opcional para titularidade aprovada por política, ciclo de vida e marketplace.", fit: "Para casos em que TT reportado, origem declarada e revenda importam.", flow: ["Tag reporta mudança TT", "Passaporte registra o reporte", "Política revisa titularidade ou voucher"] },
    ]
    : [
      { visual: "qr", title: "Basico real", example: "QR comun o NFC UID para manuales, paginas, registro de garantia y primeras metricas de escaneo.", fit: "Usalo cuando importa lanzar rapido y el riesgo de copia todavia no es critico.", flow: ["Cliente escanea", "Abre contenido", "Se guarda contacto o garantia"] },
      { visual: "ntag", title: "Toque seguro", example: "NTAG215 para eventos o NTAG 424 DNA con SUN dinamico, UID serializado y reglas del servidor.", fit: "Para entradas, credenciales, productos de valor medio y operaciones con validacion frecuente.", flow: ["El telefono toca", "Servidor valida UID/SUN", "Panel registra ubicacion"] },
      { visual: "tt", title: "Premium tokenizado", example: "NTAG 424 DNA TT + pasaporte + registro Polygon opcional para propiedad aprobada por política, historial y tienda.", fit: "Para casos donde TT reportado, origen declarado y reventa importan.", flow: ["El tag reporta cambio TT", "El pasaporte registra el reporte", "La política revisa propiedad o voucher"] },
    ];

  return (
    <section className="container-shell py-20">
      <SectionHeading eyebrow={content.plans.eyebrow} title={content.plans.title} description={content.plans.description} />
      <div className="mt-12 grid gap-6 xl:grid-cols-3">
        {content.plans.cards.map((plan: any, index: number) => {
           const isPremium = plan.name.includes("ENTERPRISE") || plan.name.includes("PRO");
           const education = enrichedPlanEducation[index] || enrichedPlanEducation[enrichedPlanEducation.length - 1];
           return (
             <Card key={plan.name} className={`plan-card relative p-8 overflow-hidden transition-transform duration-300 hover:-translate-y-2 ${isPremium ? 'plan-card--premium border-cyan-500/30 bg-slate-900/80 shadow-[0_0_40px_rgba(6,182,212,0.1)]' : 'border-white/5 bg-slate-900/40'}`}>
               {isPremium && <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 blur-[50px] rounded-full pointer-events-none" />}
               <div className="mb-6 inline-block"><Badge tone={isPremium ? "cyan" : "default"}>{plan.badge}</Badge></div>
               <h3 className="text-3xl font-bold text-white tracking-tight">{plan.name}</h3>
               <p className="mt-4 text-sm leading-6 text-slate-400">{plan.body}</p>
                <div className="plan-education-box mt-5 flex items-center gap-4 rounded-xl border border-white/10 bg-slate-950/55 p-3">
                  <span className={`plan-tag-visual plan-tag-visual--${education.visual}`} aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-cyan-100">{education.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{education.example}</p>
                  </div>
                </div>
                <p className="plan-fit-note mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs leading-5 text-emerald-50">{education.fit}</p>
                <div className="plan-flow-card mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">{learnMore}</p>
                  <div className="mt-2 grid gap-2">
                    {education.flow.map((step: string, stepIndex: number) => (
                      <div key={step} className="plan-flow-step flex items-center gap-2 text-xs text-slate-300">
                        <span className="plan-flow-index grid h-5 w-5 shrink-0 place-items-center rounded-full border border-cyan-300/25 bg-cyan-500/10 text-[10px] font-black text-cyan-100">{stepIndex + 1}</span>
                        <span>{step}</span>
                      </div>
                    ))}
                 </div>
               </div>
               <div className="my-6 h-px w-full bg-gradient-to-r from-white/10 to-transparent" />
               <ul className="space-y-3 text-sm text-slate-300">
                 {plan.bullets.map((bullet: string) => (
                    <li key={bullet} className="flex items-start gap-2">
                       <span className="text-cyan-500">✓</span>
                       <span>{bullet}</span>
                    </li>
                 ))}
               </ul>
             </Card>
           );
        })}
      </div>
    </section>
  );
}

export function AuthenticityStatesSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={content.authenticity.eyebrow} title={content.authenticity.title} description={content.authenticity.description} />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {content.authenticity.cards.map((item: any) => (
          <Card key={item.state} className="p-6 backdrop-blur-xl border border-white/5 bg-slate-900/50 hover:bg-slate-900/80 transition-colors">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 mb-2">{item.state}</p>
            <span className={`inline-flex px-3 py-1 rounded text-xs font-bold ${item.tone === "good" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : item.tone === "warn" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
              {item.tone === "good" ? content.authenticity.badges.good : item.tone === "warn" ? content.authenticity.badges.warn : content.authenticity.badges.risk}
            </span>
            <p className="mt-4 text-sm leading-6 text-slate-400">{item.detail}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function BulletSection({ eyebrow, title, description, bullets }: { eyebrow: string; title: string; description: string; bullets: string[] }) {
  return (
    <section className="container-shell py-16">
      <Card className="p-8 backdrop-blur-xl border border-white/5 bg-slate-900/60 shadow-xl">
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {bullets.map((bullet) => (
            <div key={bullet} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-slate-950/50 px-5 py-4 text-sm text-slate-300 transition-colors hover:border-white/10 hover:bg-white/5">
               <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
               {bullet}
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

export function PremiumIdentitySection({ content, locale }: { content: Content; locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = isEn
    ? {
      eyebrow: "Premium layer",
      title: "Digital ownership for products that keep value after the tap",
      body: "The premium layer associates a living passport with a declared asset reference after separate evidence and policy approval. Tag validation and the digital record do not prove physical authenticity, contents, origin, seal or custody.",
      demo: "Open premium flow",
      docs: "Read architecture",
      wallet: "Wallet / digital custody",
      proofTitle: "Premium passport example",
      proofStatus: "TAG_MSG_VALID / TT_OPEN_REPORTED",
      proofRows: [
        ["Declared origin", "Uco Valley, Mendoza"],
        ["Reported TT", "NTAG 424 DNA TT open"],
        ["Token", "Optional Polygon claim - policy and RPC confirmation required"],
        ["Digital recipient", "Buyer wallet or tenant digital custody"],
      ],
      cards: [
        { title: "Ownership passport", body: "After separate purchase evidence and tenant approval, the buyer can receive a digital ownership record tied to a declared asset reference and batch." },
        { title: "Warranty lifecycle", body: "Warranty, service, return and support events become auditable lifecycle updates, not loose forms." },
        { title: "Declared provenance records", body: "Declared origin, lot, channel and reported tap events form an auditable timeline, not proof of a physical route." },
        { title: "Marketplace unlocks", body: "Vouchers, club access, resale rules and premium tokenization become post-tap actions." },
      ],
      steps: ["Validate tag message", "Review claim evidence", "Approve passport", "Open governed actions"],
    }
    : isBr
    ? {
      eyebrow: "Camada premium",
      title: "Titularidade digital para produtos que seguem gerando valor",
      body: "A camada premium associa um passaporte a uma referência declarada do ativo após evidência separada e aprovação da política. A validação da tag e o registro digital não comprovam autenticidade física, conteúdo, origem, lacre ou custódia.",
      demo: "Abrir fluxo premium",
      docs: "Ler arquitetura",
      wallet: "Wallet / custódia digital",
      proofTitle: "Exemplo de passport premium",
      proofStatus: "TAG_MSG_VALID / TT_OPEN_REPORTED",
      proofRows: [
        ["Origem declarada", "Valle de Uco, Mendoza"],
        ["TT reportado", "NTAG 424 DNA TT aberto"],
        ["Token", "Polygon opcional - sujeito a politica e confirmacao RPC"],
        ["Destinatário digital", "Carteira do comprador ou custódia digital do tenant"],
      ],
      cards: [
        { title: "Passaporte de titularidade", body: "Após evidência de compra separada e aprovação do tenant, o comprador pode receber um registro digital ligado à referência declarada e ao lote." },
        { title: "Ciclo de garantia", body: "Garantia, suporte, devolucao e servico viram eventos auditaveis, nao formularios soltos." },
        { title: "Registros de proveniência declarada", body: "Origem, lote, canal e eventos reportados formam uma linha do tempo auditável, não prova de rota física." },
        { title: "Aberturas de marketplace", body: "Vouchers, clube, regras de revenda e tokenizacao premium viram acoes pos-toque." },
      ],
      steps: ["Validar mensagem da tag", "Revisar evidência do claim", "Aprovar passaporte", "Abrir ações governadas"],
    }
    : {
      eyebrow: "Capa premium",
      title: "Propiedad digital para productos que siguen generando valor",
      body: "La capa premium asocia un pasaporte a una referencia declarada del activo después de evidencia separada y aprobación de política. La validación del tag y el registro digital no prueban autenticidad física, contenido, origen, sello ni custodia.",
      demo: "Abrir flujo premium",
      docs: "Ver arquitectura",
      wallet: "Billetera / custodia digital",
      proofTitle: "Ejemplo de pasaporte premium",
      proofStatus: "MENSAJE_VALIDO / TT_ABIERTO_REPORTADO",
      proofRows: [
        ["Origen declarado", "Valle de Uco, Mendoza"],
        ["TT reportado", "NTAG 424 DNA TT abierto"],
        ["Token", "Polygon opcional - sujeto a politica y confirmacion RPC"],
        ["Destinatario digital", "Billetera del comprador o custodia digital del tenant"],
      ],
      cards: [
        { title: "Pasaporte de propiedad", body: "Después de evidencia de compra separada y aprobación del tenant, el comprador puede recibir un registro digital vinculado a la referencia declarada y al lote." },
        { title: "Ciclo de garantía", body: "Garantía, soporte, devolución y servicio se vuelven eventos auditables, no formularios sueltos." },
        { title: "Registros de procedencia", body: "Origen declarado, lote, canal y eventos reportados se muestran como una cronología auditable; no prueban por sí solos la ruta física." },
        { title: "Tienda habilitada", body: "Vouchers, club, reglas de reventa y tokenización premium se activan después del toque cuando la política lo permite." },
      ],
      steps: ["Validar mensaje del tag", "Revisar evidencia del reclamo", "Aprobar pasaporte", "Abrir acciones gobernadas"],
    };

  return (
    <section className="container-shell py-16">
      <div className="premium-identity-card rounded-3xl border border-cyan-300/20 p-5 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">{copy.eyebrow}</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-black leading-[1.12] tracking-tight text-white md:text-5xl">{copy.title}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">{copy.body}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/demo-lab?vertical=wine" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/10">{copy.demo}</Link>
              <Link href="/docs" className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-slate-100 transition hover:bg-white/10">{copy.docs}</Link>
              <Link href="/me/wallet" className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-4 py-3 text-sm font-bold text-violet-100 transition hover:bg-violet-300/10">{copy.wallet}</Link>
            </div>
          </div>

          <div className="premium-passport rounded-3xl border border-white/10 bg-slate-950/55 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-300">{copy.proofTitle}</p>
                <h3 className="mt-2 text-2xl font-black text-white">{copy.proofStatus}</h3>
              </div>
              <span className="premium-token-orbit" aria-hidden="true" />
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {copy.proofRows.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
                  <p className="mt-1 text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="premium-chain mt-5">
              {copy.steps.map((step, index) => (
                <div key={step} className="premium-chain-step">
                  <span>{index + 1}</span>
                  <p>{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {copy.cards.map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-slate-950/45 p-5">
              <p className="text-sm font-black text-cyan-100">{item.title}</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function UseCasesSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={content.useCases.eyebrow} title={content.useCases.title} description={content.useCases.description} />
      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {content.useCases.cards.map((item: any) => (
          <Card key={item.title} className="p-6 backdrop-blur-xl border border-white/5 bg-slate-900/50 shadow-lg hover:border-cyan-500/30 hover:-translate-y-1 transition-all duration-300 group">
            <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shadow-inner group-hover:bg-cyan-500/20 transition-colors text-cyan-400">✨</div><h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">{item.title}</h3></div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{item.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function ResellerSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={content.reseller.eyebrow} title={content.reseller.title} description={content.reseller.description} />
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {content.reseller.cards.map((item: any) => (
          <Card key={item.title} className="relative p-8 backdrop-blur-xl border border-white/5 bg-gradient-to-br from-slate-900/80 to-slate-950 shadow-xl overflow-hidden hover:border-white/10 transition-colors group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-[40px] rounded-full group-hover:bg-cyan-500/10 transition-colors" />
            <h3 className="text-xl font-bold text-white relative z-10">{item.title}</h3>
            <p className="mt-4 text-sm leading-7 text-slate-400 relative z-10">{item.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function RoiCredibilitySection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-20">
      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="p-8 backdrop-blur-md border-white/5 bg-slate-900/50">
          <SectionHeading eyebrow={content.roi.eyebrow} title={content.roi.title} description={content.roi.description}  />
          <div className="mt-10 grid gap-4">
            {content.roi.metrics.map((metric: any) => (
              <div key={metric.label} className="group rounded-2xl border border-white/5 bg-slate-950/50 p-6 transition-all hover:border-cyan-500/20 hover:bg-slate-900/80">
                <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">{metric.label}</p>
                <p className="mt-2 text-3xl font-extrabold text-white tracking-tight">{metric.value}</p>
                <p className="mt-2 text-sm text-slate-400">{metric.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-8 backdrop-blur-md border-white/5 bg-slate-900/50">
          <SectionHeading eyebrow={content.credibility.eyebrow} title={content.credibility.title} description={content.credibility.description}  />
          <ul className="mt-8 space-y-4 text-sm text-slate-300">
            {content.credibility.items.map((item: string) => (
               <li key={item} className="flex gap-3">
                  <span className="text-cyan-500 font-bold mt-0.5">✓</span>
                  <span>{item}</span>
               </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}

export function CarrierProfileMatrixSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const copy = isEn
    ? {
      eyebrow: "Carrier profiles",
      title: "One platform for QR, GS1, NFC, tamper, ownership proof and industrial traceability",
      body: "nexID lets a small brand start with a low-cost QR passport and grow into cryptographic NFC, TagTamper, Polygon ownership, IOTA proof and UHF/IoT logistics without rebuilding the operating model.",
      note: "Planning ranges for pilots. Final quotes depend on volume, printing, encoding, import, integrations, support and SLA.",
      action: "See technical docs",
    }
    : isBr
    ? {
      eyebrow: "Perfis de carrier",
      title: "Uma plataforma para QR, GS1, NFC, tamper, ownership proof e rastreabilidade industrial",
      body: "nexID permite comecar com QR passport de baixo custo e evoluir para NFC criptografico, TagTamper, ownership Polygon, prova IOTA e logistica UHF/IoT sem refazer a operacao.",
      note: "Faixas de planejamento para pilotos. A cotacao final depende de volume, impressao, encoding, importacao, integracoes, suporte e SLA.",
      action: "Ver docs tecnicos",
    }
    : {
      eyebrow: "Perfiles de soporte físico",
      title: "Una sola plataforma para QR, GS1, NFC, sello, ownership proof y trazabilidad industrial",
      body: "nexID permite arrancar con QR de bajo costo y subir a NFC criptográfico, TagTamper, ownership Polygon, prueba IOTA y logística UHF/IoT sin rehacer la operación.",
      note: "Rangos de planificación para pilotos. La cotización final depende de volumen, impresión, codificación, importación, integraciones, soporte y SLA.",
      action: "Ver documentación técnica",
    };

  const profiles = [
    {
      name: "QR comun",
      price: "USD 0.005 - 0.03",
      level: "Marketing",
      promise: isEn ? "Content, lead capture and analytics." : isBr ? "Conteudo, leads e analytics." : "Contenido, leads y analytics.",
      best: isEn ? "Menus, promos, small batches." : isBr ? "Menus, promos, pequenos lotes." : "Menus, promos, lotes chicos.",
      risk: isEn ? "Can be copied by screenshot." : isBr ? "Pode ser copiado por print." : "Se puede copiar con una captura.",
    },
    {
      name: "QR GS1 Digital Link",
      price: "USD 0.01 - 0.05",
      level: "Retail",
      promise: isEn ? "GTIN, lot, serial and export-friendly identity." : isBr ? "GTIN, lote, serie e identidade para retail/exportacao." : "GTIN, lote, serie e identidad retail/exportacion.",
      best: isEn ? "Food, pharma, agro, export." : isBr ? "Alimentos, pharma, agro, exportacao." : "Alimentos, pharma, agro, exportacion.",
      risk: isEn ? "Traceability declared by platform." : isBr ? "Rastreabilidade declarada pela plataforma." : "Trazabilidad declarada por plataforma.",
    },
    {
      name: "NTAG213",
      price: "USD 0.08 - 0.20",
      level: "Toque web",
      promise: isEn ? "Low-cost NFC for campaigns and basic warranty." : isBr ? "NFC economico para campanhas e garantia basica." : "NFC económico para campañas y garantía básica.",
      best: isEn ? "Tourism, local brands, simple activation." : isBr ? "Turismo, marcas locais, ativacao simples." : "Turismo, marcas locales, activacion simple.",
      risk: isEn ? "No dynamic SUN message evidence or physical-product proof." : isBr ? "Sem evidencia SUN dinamica nem prova do produto fisico." : "Sin evidencia SUN dinamica ni prueba del producto fisico.",
    },
    {
      name: "NTAG215 / 216",
      price: "USD 0.12 - 0.45",
      level: "Operacion",
      promise: isEn ? "Serialized UID, events, credentials and high-frequency validation." : isBr ? "UID serializado, eventos, credenciais e validacao frequente." : "UID serializado, eventos, credenciales y validacion frecuente.",
      best: isEn ? "Wristbands, tickets, access and mid-value products." : isBr ? "Pulseiras, tickets, acesso e produtos medios." : "Pulseras, tickets, accesos y productos medios.",
      risk: isEn ? "Server-side duplicate controls, without SUN message evidence or physical-product proof." : isBr ? "Controle de duplicados server-side, sem evidencia SUN da mensagem nem prova do produto fisico." : "Control de duplicados server-side, sin evidencia SUN del mensaje ni prueba del producto fisico.",
    },
    {
      name: "NTAG424 DNA",
      price: "USD 0.55 - 0.90",
      level: "Secure",
      promise: isEn ? "SUN/SDM, dynamic URL and anti-replay evidence." : isBr ? "SUN/SDM, URL dinamica e evidencia anti-replay." : "SUN/SDM, URL dinamica y evidencia anti-replay.",
      best: isEn ? "Premium products, documents, warranty." : isBr ? "Produtos premium, documentos, garantia." : "Productos premium, documentos, garantía.",
      risk: isEn ? "Strong tag-message evidence; not physical authenticity." : isBr ? "Evidência criptográfica forte da mensagem; não autenticidade física." : "Evidencia criptográfica fuerte del mensaje; no autenticidad física.",
    },
    {
      name: "NTAG424 DNA TT",
      price: "USD 0.85 - 1.25",
      level: "Luxury",
      promise: isEn ? "Cryptographic tag message plus reported open/closed TT state." : isBr ? "Mensagem criptográfica da tag mais estado TT aberto/fechado reportado." : "Mensaje criptográfico del tag más estado TT abierto/cerrado reportado.",
      best: isEn ? "Wine, luxury, pharma, collectibles." : isBr ? "Vinho, luxo, pharma, colecionaveis." : "Vino, lujo, pharma, coleccionables.",
      risk: isEn ? "Best fit for ownership and token gates." : isBr ? "Ideal para titularidade digital e acessos por token." : "Ideal para propiedad digital y accesos por token.",
    },
    {
      name: "Polygon ownership",
      price: isEn ? "Policy add-on" : isBr ? "Add-on por politica" : "Add-on por politica",
      level: "Ownership",
      promise: isEn ? "Certificates, claims, warranty transfer and premium ownership." : isBr ? "Certificados, claims, transferencia de garantia e ownership premium." : "Certificados, claims, transferencia de garantia y ownership premium.",
      best: isEn ? "Luxury, collectibles, warranty and resale." : isBr ? "Luxo, colecionaveis, garantia e revenda." : "Lujo, coleccionables, garantia y reventa.",
      risk: isEn ? "Only after fresh tap, validated buyer and tenant approval." : isBr ? "Somente com toque fresco, comprador validado e aprovacao do tenant." : "Solo con tap fresco, comprador validado y aprobacion del tenant.",
    },
    {
      name: "IOTA proof layer",
      price: isEn ? "Proof add-on" : isBr ? "Add-on de prova" : "Add-on de prueba",
      level: "Audit",
      promise: isEn ? "Audit evidence for logistics and product history." : isBr ? "Evidencia auditavel para logistica e ciclo de vida do produto." : "Evidencia auditable para logistica y ciclo de vida del producto.",
      best: isEn ? "Regulated exports, auditing and transparent supply chain." : isBr ? "Exportacoes regulamentadas, auditoria e cadeia de suprimentos." : "Exportaciones reguladas, auditorias y cadena de suministro transparente.",
      risk: isEn ? "Optional blockchain layer for public proof. No private data exposed." : isBr ? "Camada blockchain opcional para provas publicas. Sem expor dados privados." : "Capa blockchain opcional para confianza publica. No expone datos privados.",
    },
    {
      name: "UHF / IoT",
      price: isEn ? "Custom" : isBr ? "Custom" : "Custom",
      level: "Industrial",
      promise: isEn ? "Pallets, cartons, sensor events and operational traceability." : isBr ? "Pallets, caixas, eventos de sensores e rastreabilidade operacional." : "Pallets, cajas, eventos de sensores y trazabilidad operacional.",
      best: isEn ? "Logistics, cold chain, warehouses and field operations." : isBr ? "Logistica, cadeia fria, armazens e campo." : "Logistica, cadena fria, depositos y campo.",
      risk: isEn ? "Industrial evidence, not the consumer tap experience." : isBr ? "Evidencia industrial, nao a experiencia de toque do consumidor." : "Evidencia industrial, no la experiencia de tap del consumidor.",
    },
  ];

  return (
    <section id="carrier-profiles" className="container-shell py-16">
      <div className="landing-value-panel rounded-[2rem] border border-cyan-300/15 bg-slate-900/55 p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">{copy.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">{copy.title}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">{copy.body}</p>
          </div>
          <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            {copy.note}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((item) => (
            <article key={item.name} className="carrier-profile-card rounded-2xl border border-white/10 bg-slate-950/55 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-white">{item.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-300">{item.level}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-slate-200">{item.price}</span>
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-cyan-100">{item.promise}</p>
              <div className="mt-4 grid gap-2 text-xs leading-5 text-slate-300">
                <span><strong className="text-slate-100">{isEn ? "Best for:" : isBr ? "Melhor para:" : "Ideal para:"}</strong> {item.best}</span>
                <span><strong className="text-slate-100">{isEn ? "Policy:" : isBr ? "Politica:" : "Politica:"}</strong> {item.risk}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/docs#carrier-profiles" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-100">{copy.action}</Link>
          <Link href="/?contact=quote&intent=carrier_matrix#contact-modal" className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-100">
            {isEn ? "Quote a rollout" : isBr ? "Cotar rollout" : "Cotizar rollout"}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function MarketplaceNetworkSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const title = isEn
    ? "A tag read is only the start. Business value depends on governed next actions."
    : isBr
    ? "A leitura da etiqueta é apenas o começo. O valor depende das próximas ações governadas."
    : "La lectura de la etiqueta es solo el comienzo. El valor depende de las siguientes acciones gobernadas.";
  const body = isEn
    ? "This simulated network shows possible passport, club, marketplace, CRM and loyalty flows. A SUN/UID result covers the tag message and a reported seal state when available; it does not prove the physical product, contents, declared origin, custody or ownership."
    : isBr
    ? "Esta rede simulada mostra fluxos possíveis de passaporte, clube, marketplace, CRM e fidelidade. Um resultado SUN/UID cobre a mensagem da etiqueta e, quando disponível, o estado informado do lacre; não comprova produto físico, conteúdo, origem declarada, custódia ou propriedade."
    : "Esta red simulada muestra posibles flujos de pasaporte, club, tienda, CRM y beneficios. Un resultado SUN/UID cubre el mensaje de la etiqueta y, cuando existe, el estado reportado del sello; no prueba producto físico, contenido, origen declarado, custodia ni propiedad.";
  const nodes = [
    { k: "01", title: isEn ? "Simulated tag read" : isBr ? "Leitura simulada" : "Lectura simulada", body: isEn ? "SUN/UID message and reported seal state; no physical-product verdict." : isBr ? "Mensagem SUN/UID e estado informado do lacre; sem veredito sobre o produto físico." : "Mensaje SUN/UID y estado reportado del sello; sin veredicto sobre el producto físico." },
    { k: "02", title: isEn ? "Passport" : isBr ? "Passaporte" : "Pasaporte", body: isEn ? "Declared product record; warranty and ownership require their own evidence." : isBr ? "Registro declarado; garantia e propriedade exigem evidência própria." : "Registro declarado; garantía y propiedad requieren evidencia propia." },
    { k: "03", title: isEn ? "Club & points" : isBr ? "Clube e pontos" : "Club y puntos", body: isEn ? "Example rewards and vouchers, subject to tenant rules." : isBr ? "Recompensas e vouchers de exemplo, sujeitos às regras do tenant." : "Puntos y vouchers de ejemplo, sujetos a reglas del tenant." },
    { k: "04", title: isEn ? "Marketplace" : isBr ? "Marketplace" : "Tienda", body: isEn ? "Demo reorder, resale and partner offers; transactions need policy and claim checks." : isBr ? "Recompra, revenda e ofertas demo; transações exigem política e validação do claim." : "Recompra, reventa y ofertas demo; las transacciones requieren política y validación del claim." },
    { k: "05", title: "CRM", body: isEn ? "Simulated leads, tickets and buyer intent; no live customer feed." : isBr ? "Leads, tickets e intenção simulados; sem feed de clientes ao vivo." : "Contactos, casos e intención simulados; sin feed de clientes en vivo." },
  ];

  return (
    <section className="container-shell py-16">
      <div className="market-network-shell rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">{isEn ? "Loyalty network" : isBr ? "Rede loyalty" : "Red de beneficios"}</p>
        <div className="mt-3 grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-white md:text-5xl">{title}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">{body}</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                ["320", isEn ? "demo points" : isBr ? "pontos demo" : "puntos demo"],
                ["5", isEn ? "example actions" : isBr ? "ações de exemplo" : "acciones de ejemplo"],
                ["1", isEn ? "demo login" : isBr ? "login demo" : "ingreso demo"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-cyan-300/15 bg-cyan-500/10 p-4">
                  <p className="text-2xl font-black text-white">{value}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-cyan-200">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            {nodes.map((node) => (
              <article key={node.k} className="market-network-node rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <span>{node.k}</span>
                <div>
                  <p className="font-black text-white">{node.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{node.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function WhiteLabelOperatingSystemSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const steps = [
    isEn ? "Create tenant and brand rules" : isBr ? "Criar tenant e regras de marca" : "Crear cuenta de marca y reglas",
    isEn ? "Choose carrier profile by risk" : isBr ? "Escolher carrier por risco" : "Elegir soporte físico por riesgo",
    isEn ? "Import manifest CSV/TXT" : isBr ? "Importar manifest CSV/TXT" : "Importar manifiesto CSV/TXT",
    isEn ? "Activate audited batch" : isBr ? "Ativar lote auditado" : "Activar lote auditado",
    isEn ? "Operate leads, tickets and analytics" : isBr ? "Operar leads, tickets e analytics" : "Operar contactos, casos y analitica",
    isEn ? "Export reports and reseller revenue" : isBr ? "Exportar relatorios e receita reseller" : "Exportar reportes e ingresos de distribuidor",
  ];

  return (
    <section className="container-shell py-16">
      <div className="landing-value-panel rounded-[2rem] border border-violet-300/15 bg-gradient-to-br from-slate-900/80 via-slate-950/80 to-cyan-950/50 p-6 md:p-8">
        <div className="max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-200">{isEn ? "White-label OS" : isBr ? "Sistema white-label" : "Sistema para distribuidores"}</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
            {isEn ? "A reseller can sell nexID without becoming a cryptography engineer." : isBr ? "Um reseller pode vender nexID sem virar engenheiro de criptografia." : "Un distribuidor puede vender nexID sin volverse ingeniero de criptografía."}
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
            {isEn
              ? "The platform should guide printers, agencies, distributors and field teams with simple buttons, batch manifests, approval states, alerts and dashboards."
              : isBr
              ? "A plataforma guia graficas, agencias, distribuidores e times de campo com botoes simples, manifests, aprovacoes, alertas e dashboards."
              : "La plataforma guia imprentas, agencias, distribuidores y equipos de campo con botones simples, manifiestos, aprobaciones, alertas y paneles."}
          </p>
        </div>
        <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step} className="white-label-step rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{step}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/resellers" className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-4 py-2 text-sm font-bold text-violet-100">
            {isEn ? "Open reseller model" : isBr ? "Abrir modelo reseller" : "Abrir modelo de distribuidores"}
          </Link>
          <Link href="/?contact=sales&intent=white_label#contact-modal" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-100">
            {isEn ? "Prepare white-label demo" : isBr ? "Preparar demo white-label" : "Preparar demo para distribuidor"}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function UnitEconomicsSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const cards = [
    { title: "Inicio QR / GS1", hardware: "USD 0.01 - 0.05", saas: "SaaS + página + analítica", margin: "Baja barrera, alto volumen" },
    { title: "NFC Básico", hardware: "USD 0.08 - 0.45", saas: "Toque web + garantía + contactos", margin: "Eventos, turismo, comercio local" },
    { title: "424 DNA Seguro", hardware: "USD 0.55 - 0.90", saas: "SUN + detección de replay + panel", margin: "Evidencia del mensaje y auditoría" },
    { title: "DNA TT Premium", hardware: "USD 0.85 - 1.25", saas: "TT reportado + propiedad digital por política", margin: "Lujo, salud, vino, coleccionables" },
  ];
  const title = isEn ? "A pricing story that works for small brands and enterprise rollouts" : isBr ? "Uma historia comercial para marcas pequenas e rollouts enterprise" : "Una historia comercial para marcas chicas y despliegues grandes";
  const body = isEn
    ? "The expensive chip is not the only product. The ladder starts with low-cost QR/GS1 and grows into NFC, tamper, dashboards, marketplace, loyalty and optional Polygon tokenization."
    : isBr
    ? "O chip caro nao e o unico produto. A escada comeca em QR/GS1 e evolui para NFC, tamper, dashboards, marketplace, loyalty e tokenizacao Polygon opcional."
    : "El chip caro no es el único producto. La escalera arranca con QR/GS1 y sube a NFC, sello, paneles, tienda, beneficios y tokenización Polygon opcional.";

  return (
    <section className="container-shell py-16">
      <div className="rounded-[2rem] border border-emerald-300/15 bg-slate-900/55 p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">{isEn ? "Unit economics" : isBr ? "Unit economics" : "Economia por unidad"}</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">{title}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">{body}</p>
            <p className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-100">
              {isEn ? "Argentina planning assumption: premium TT landed around USD 1 per encoded unit, then add SaaS, setup, support and reseller margin." : isBr ? "Premissa Argentina: TT premium desembarcado perto de USD 1 por unidade codificada, somando SaaS, setup, suporte e margem reseller." : "Supuesto Argentina: TT premium puesto alrededor de USD 1 por unidad codificada, sumando SaaS, configuracion, soporte y margen de distribuidor."}
            </p>
          </div>
          <div className="grid gap-3">
            {cards.map((item) => (
              <article key={item.title} className="unit-economics-card rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-black text-white">{item.title}</p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-200">{item.hardware}</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  <span>{item.saas}</span>
                  <strong className="text-emerald-200">{item.margin}</strong>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CtaSection({ content, locale }: { content: Content; locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";

  return (
    <section className="container-shell py-24">
      <div className="relative rounded-[2rem] border border-cyan-500/20 bg-slate-900/80 overflow-hidden shadow-[0_0_80px_rgba(6,182,212,0.15)]">
         <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10 pointer-events-none" />
         <div className="relative px-6 py-14 md:py-20 text-center z-10">
           <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-6">{content.cta.title}</h2>
           <p className="mx-auto max-w-2xl text-base leading-7 text-slate-400 mb-8">{content.cta.body}</p>
           <div className="flex flex-wrap justify-center gap-4">
             <Link href="/demo-lab?vertical=wine" className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-sm font-bold text-slate-950 transition hover:bg-slate-200 hover:scale-105 shadow-xl">
                {isEn ? "View guided demo" : isBr ? "Ver demo guiada" : "Ver demo guiada"}
             </Link>
             <a href={schedulingUrls.meeting} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-8 py-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20">
                {isEn ? "Schedule meeting" : isBr ? "Agendar reuniao" : "Agendar reunion"}
             </a>
            </div>
          </div>
      </div>
    </section>
  );
}
