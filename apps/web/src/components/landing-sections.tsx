import { Card, SectionHeading, Badge } from "@product/ui";
import { schedulingUrls } from "@product/config";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CloudOff, Cpu, Fingerprint, KeyRound, Network, PackageCheck, QrCode, RadioTower, RotateCcw, ShieldCheck, Smartphone } from "lucide-react";
import { HeroScene } from "./hero-scene";
import { InstitutionalVideoPanel } from "./institutional-video-panel";
import { PremiumTraceabilityGlobe } from "./premium-traceability-globe";
import { platformVerticals, traceabilityGlobePoints, traceabilityGlobeRoutes } from "../lib/platform-verticals";

type Content = any;

export function HeroSection({ content, stats, locale, initialTheme = "dark" }: { content: Content; stats: any; locale: string; radar?: any; initialTheme?: "light" | "dark" }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const hero = content?.hero || {};
  const heroSubtitle = hero?.subtitle || hero?.body || "";
  const primaryCta = hero?.cta?.primary || hero?.primary || "Empezar";
  const secondaryCta = hero?.cta?.secondary || hero?.secondary || "Contacto";
  const mobileDocsCta = "Docs / API";

  const trustBadge = isEn ? "Enterprise Trusted" : isBr ? "Confiabilidade Corporativa" : "Confianza para empresas";
  const demoEyebrow = isEn ? "Interactive product experience" : isBr ? "Experiencia interativa do produto" : "Experiencia guiada de producto";
  const demoBody = isEn
    ? "Bottle, wristband, seal and package: real tap, origin map, authenticity, club, points and marketplace in one guided scene."
    : isBr
    ? "Garrafa, pulseira, lacre e embalagem: toque real, mapa de origem, autenticidade, clube, pontos e marketplace em uma cena guiada."
    : "Botella, pulsera, sello y envase: toque real, autenticidad, mapa de origen, club, puntos y tienda en una escena guiada.";
  const heroFlow = isEn
    ? ["Physical product", "Fresh tap", "Safe claim", "Portal + benefits"]
    : isBr
    ? ["Produto fisico", "Toque fresco", "Claim seguro", "Portal + beneficios"]
    : ["Producto físico", "Tap fresco", "Reclamo seguro", "Portal + beneficios"];
  const heroAssurance = isEn
    ? "No app download for the buyer. No crypto knowledge required. The tap explains authenticity, origin and next step."
    : isBr
    ? "Sem app para o comprador. Sem exigir cripto. O toque explica autenticidade, origem e proximo passo."
    : "Sin app para el comprador. Sin explicar cripto. El tap muestra evidencia, origen y próximo paso.";
  const demoCta = isEn ? "Open Product Lab" : isBr ? "Abrir Laboratorio" : "Abrir laboratorio";
  const meetingCta = isEn ? "Schedule meeting" : isBr ? "Agendar reunião" : "Agendar reunión";
  const heroStats = [
    {
      value: stats?.latencyDelta || "P95 < 150ms",
      label: stats?.latency || (isEn ? "API target latency" : isBr ? "Latencia alvo API" : "Latencia objetivo API"),
    },
    {
      value: "hash-only",
      label: isEn ? "Public proof without sensitive data" : isBr ? "Prova pública sem dados sensíveis" : "Prueba pública sin datos sensibles",
    },
    {
      value: "NFC + QR",
      label: isEn ? "No app required for the buyer" : isBr ? "Sem app para o comprador" : "Sin app para el comprador",
    },
    {
      value: "IOTA / Polygon",
      label: isEn ? "Optional auditable anchor" : isBr ? "Anchor auditavel opcional" : "Anclaje auditable opcional",
    },
  ];
  return (
    <section className="landing-hero-section relative overflow-hidden border-b border-white/5 bg-slate-950 pb-8 pt-8 lg:pb-10 lg:pt-10">
      <div className="hero-signal-field absolute inset-0 z-0 pointer-events-none" aria-hidden="true" />

      <div className="container-shell relative z-10">
        <div className="hero-main-copy mx-auto max-w-6xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md transition-colors hover:bg-white/10">
             <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
             <span className="text-xs font-medium text-slate-300 uppercase tracking-widest">{trustBadge}</span>
          </div>

          <h1 className="mx-auto mt-5 max-w-[22rem] pb-2 text-[2rem] font-extrabold leading-[1.12] tracking-normal text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 sm:max-w-5xl sm:text-[2.85rem] sm:leading-[1.08] lg:text-[3rem] lg:leading-[1.06]">
            {hero.title}
          </h1>
          <p className="hero-subtitle mx-auto mt-5 max-w-xl text-sm leading-6 text-slate-400">
            {heroSubtitle}
          </p>
          <div className="landing-mobile-hero-actions mt-5 grid gap-2 sm:hidden">
            <Link href="/?contact=demo#contact-modal" className="landing-mobile-hero-actions__primary">
              <span>{primaryCta}</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/proof/verify" className="landing-mobile-hero-actions__secondary">
                Proof
              </Link>
              <Link href="/pricing" className="landing-mobile-hero-actions__secondary">
                {isEn ? "Pricing" : isBr ? "Precos" : "Planes"}
              </Link>
            </div>
            <Link href="/docs" className="landing-mobile-hero-actions__muted">
              {mobileDocsCta}
            </Link>
          </div>
        </div>

        <div className="hero-demo-shell mx-auto mt-16 md:mt-24 max-w-7xl text-left relative z-20">

          <HeroScene locale={locale as any} />
          <InstitutionalVideoPanel locale={locale} variant="landing" className="mt-5" initialTheme={initialTheme} />
        </div>

        <div className="mx-auto mt-10 max-w-6xl text-center">
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/?contact=demo#contact-modal" className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-6 py-3.5 text-sm font-bold text-slate-950 transition-transform hover:scale-105 hover:bg-cyan-400">
              {primaryCta}
            </Link>
            <a href={schedulingUrls.meeting} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-6 py-3.5 text-sm font-semibold text-emerald-100 transition-all hover:bg-emerald-500/20">
              {meetingCta}
            </a>
            <Link href="/login?next=/me" className="landing-consumer-portal-cta inline-flex items-center justify-center rounded-xl border border-purple-500/35 bg-purple-500/10 px-6 py-3.5 text-sm font-bold text-purple-300 transition-all hover:scale-105 hover:bg-purple-500/20">
              {isEn ? "Consumer Portal (Passport)" : isBr ? "Portal do Consumidor" : "Portal Consumidor (Passport/NFT)"}
            </Link>
            <Link href="/docs" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-slate-900/50 backdrop-blur-md px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-white/10">
              {secondaryCta}
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4 border-t border-white/10 pt-8 md:grid-cols-4">
             {heroStats.map((item) => (
               <div key={item.label} className="text-center">
                  <p className="text-3xl font-bold text-white">{item.value}</p>
                  <p className="mt-1 text-xs text-slate-500 uppercase tracking-widest">{item.label}</p>
               </div>
             ))}
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
      eyebrow: "Understand it in 10 seconds",
      title: "Tap the product. Know if it is real. Claim benefits only when the purchase is trusted.",
      body: "nexID does not force people to understand NFC, cryptography or blockchain. First it shows the product, origin, seal status and the next safe step.",
      primary: "Open Product Lab",
      secondary: "See mobile passport",
      claimTitle: "When can ownership or NFT open?",
      claimBody: "Only after a fresh physical tap, verified email or phone, purchase proof or retailer token, and a risk score that does not look copied.",
      steps: [
        { label: "Physical product", body: "The brand loads batch, photos, labels, rules and allowed claim policy." },
        { label: "Fresh tap", body: "The person taps NFC/QR and sees authenticity, origin, map and seal state." },
        { label: "Safe claim", body: "Email or phone plus fresh tap, purchase proof and risk score unlock ownership." },
        { label: "Living portal", body: "Warranty, club, points, store, optional NFT and resale require product proof again." },
      ],
      audiences: [
        ["Consumer", "I know what I bought, where it came from and what I can do next."],
        ["Brand", "I receive demand, geography, risk, leads, warranty and repurchase data."],
        ["Retailer", "I validate purchase, reduce copy/replay and unlock benefits at checkout."],
      ],
      rubros: "One engine for wine, events, cosmetics, agro, health, documents, governments and enterprise assets.",
    }
    : isBr
    ? {
      eyebrow: "Entender em 10 segundos",
      title: "Toque o produto. Saiba se e real. Reivindique beneficios somente quando a compra for confiavel.",
      body: "nexID nao obriga ninguem a entender NFC, criptografia ou blockchain. Primeiro mostra produto, origem, estado do lacre e proximo passo seguro.",
      primary: "Abrir Laboratorio",
      secondary: "Ver passport mobile",
      claimTitle: "Quando a titularidade digital ou NFT pode ser habilitada?",
      claimBody: "Somente depois de toque fisico fresco, email ou celular validado, comprovante ou token da loja, e score de risco sem sinais de copia.",
      steps: [
        { label: "Produto fisico", body: "A marca carrega lote, fotos, etiquetas, regras e politica de claim." },
        { label: "Toque fresco", body: "A pessoa toca NFC/QR e ve autenticidade, origem, mapa e estado do lacre." },
        { label: "Claim seguro", body: "Email ou celular mais toque fresco, comprovante e score de risco liberam titularidade digital." },
        { label: "Portal vivo", body: "Garantia, clube, pontos, loja, NFT opcional e revenda pedem prova fisica de novo." },
      ],
      audiences: [
        ["Consumidor", "Eu sei o que comprei, de onde veio e o que posso fazer agora."],
        ["Marca", "Recebo demanda, geografia, risco, leads, garantia e recompra."],
        ["Loja", "Valido compra, reduzo copia/replay e libero beneficios no checkout."],
      ],
      rubros: "Um motor para vinho, eventos, cosmetica, agro, saude, documentos, governos e ativos empresariais.",
    }
    : {
      eyebrow: "Entendelo en 10 segundos",
      title: "Toca el producto. Ve el resultado de confianza. Reclama beneficios solo cuando la compra es confiable.",
      body: "nexID no obliga a nadie a entender NFC, criptografía o blockchain. Primero muestra producto, origen, estado del sello y el próximo paso seguro.",
      primary: "Abrir laboratorio",
      secondary: "Ver pasaporte mobile",
      claimTitle: "¿Cuándo se habilita la propiedad digital o NFT?",
      claimBody: "Solo después de tap físico fresco, email o celular validado, prueba de compra o token de tienda, y score de riesgo sin señales de copia.",
      steps: [
        { label: "Producto físico", body: "La marca carga lote, fotos, etiquetas, reglas y política de reclamo." },
        { label: "Tap fresco", body: "La persona toca NFC/QR y ve autenticidad, origen, mapa y estado del sello." },
        { label: "Reclamo seguro", body: "Email o celular más tap fresco, prueba de compra y score de riesgo habilitan propiedad digital." },
        { label: "Portal vivo", body: "Garantía, club, puntos, tienda, NFT opcional y reventa piden prueba física otra vez." },
      ],
      audiences: [
        ["Consumidor", "Sé qué compré, de dónde vino y qué puedo hacer ahora."],
        ["Marca", "Recibo demanda, geografía, riesgo, leads, garantía y recompra."],
        ["Tienda", "Valido compra, reduzco copia/replay y libero beneficios en caja."],
      ],
      rubros: "Un motor para vinos, eventos, cosmética, agro, salud, documentos, gobiernos y activos empresariales.",
    };

  return (
    <section className="container-shell py-10 md:py-14">
      <div className="simple-trust-flow-shell relative overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-5 shadow-[0_30px_90px_rgba(8,47,73,0.22)] md:p-7">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_84%_18%,rgba(16,185,129,0.12),transparent_30%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">{copy.eyebrow}</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight tracking-tight text-white md:text-4xl">{copy.title}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">{copy.body}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/demo-lab?vertical=wine" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/25">
                {copy.primary}
              </Link>
              <Link href="/sun" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-100 transition hover:bg-emerald-500/20">
                {copy.secondary}
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-4">
              {copy.steps.map((step, index) => (
                <article key={step.label} className="simple-trust-flow-step rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/10 text-xs font-black text-cyan-100">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-sm font-black text-white">{step.label}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{step.body}</p>
                </article>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {copy.audiences.map(([label, body]) => (
                <article key={label} className="rounded-2xl border border-emerald-300/15 bg-emerald-500/10 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">{label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-100">{body}</p>
                </article>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
              <p className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4 text-sm font-bold leading-6 text-violet-100">{copy.rubros}</p>
              <article className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">{copy.claimTitle}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-100">{copy.claimBody}</p>
              </article>
            </div>
          </div>
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
        { title: "QR / GS1", body: "Batch tracking, product data and GS1 Digital Link compliance at low cost.", meta: "Identity", icon: QrCode },
        { title: "NFC 424 DNA", body: "Unique one-time cryptographic signature per tap: impossible to clone or replay.", meta: "Authenticity", icon: Fingerprint },
        { title: "Offline Verifier", body: "Your phone or reader works in warehouses and remote areas. Syncs to server when back online.", meta: "Field", icon: Cpu },
        { title: "TagTamper", body: "Physical opening evidence: the tag changes state if the package was opened or broken.", meta: "Tamper", icon: ShieldCheck },
        { title: "Polygon", body: "The buyer claims the product as theirs: creates a digital twin, activates a transferable warranty and can resell with a verified certificate.", meta: "Ownership", icon: BadgeCheck },
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
        { title: "NFC 424 DNA", body: "Frescor criptografico, anti-copia e verificacao server-side.", meta: "Autenticidade", icon: Fingerprint },
        { title: "Offline Verifier", body: "App ou leitor controlado para zonas rurais e industriais com chaves por device e sync posterior.", meta: "Campo", icon: Cpu },
        { title: "TagTamper", body: "Evidencia fisica de abertura para garrafas, lacres, pharma e embalagens premium.", meta: "Tamper", icon: ShieldCheck },
        { title: "Polygon", body: "O comprador reivindica o produto como seu: cria um gêmeo digital, ativa garantia transferível e pode revender com certificado verificado.", meta: "Propriedade", icon: BadgeCheck },
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
        { title: "NFC 424 DNA", body: "Firma criptográfica única por cada toque: imposible de clonar o copiar.", meta: "Autenticidad", icon: Fingerprint },
        { title: "Verificador Offline", body: "El celular o lector valida en campo o galpón sin internet. Al conectarse, sincroniza con el servidor.", meta: "Campo", icon: Cpu },
        { title: "Sello Tamper", body: "Evidencia física de apertura: el sello cambia de estado si el envase fue abierto.", meta: "Tamper", icon: ShieldCheck },
        { title: "Polygon", body: "El comprador reclama el producto como suyo: crea un gemelo digital, activa garantía transferible y puede revender con certificado verificado.", meta: "Propiedad", icon: BadgeCheck },
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
                    ? "/demo-lab?scenario=qr-gs1"
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
      title: "Field verification for farms, wine cellars, plants, mines and warehouses without signal.",
      body: "nexID allows authorized phones and scanners to work in areas without internet. The app securely saves the scan and issues a provisional pass. Upon regaining signal, the system syncs the data and issues the official authenticity verdict.",
      docs: "Read offline architecture",
      demo: "Open offline DemoLab",
      phoneLabel: "Samsung field verifier",
      phoneStatus: "OFFLINE_LOCAL_PASS",
      phoneSub: "Provisional until backend sync",
      phoneWarning: "Full authenticity, warranty and ownership verdict are issued when the device reconnects to the server.",
      stages: [
        { label: "Enroll", body: "Security operator registers the device fingerprint and operator.", icon: Smartphone },
        { label: "Bundle", body: "Backend issues allowed BIDs, policy and key fingerprints only.", icon: KeyRound },
        { label: "Scan", body: "The app or reader queues hashed evidence in no-signal zones.", icon: CloudOff },
        { label: "Sync", body: "nexID performs final replay, policy, warranty and proof checks.", icon: RotateCcw },
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
      title: "Verificacao de campo para fazendas, cavas, plantas, minas e armazens sem sinal.",
      body: "nexID permite que celulares e leitores autorizados funcionem em areas sem internet. O app guarda a leitura com seguranca e emite um passe provisorio. Ao recuperar o sinal, o sistema sincroniza os dados e emite o veredicto oficial.",
      docs: "Ler arquitetura offline",
      demo: "Abrir DemoLab offline",
      phoneLabel: "Scanner de campo",
      phoneStatus: "VERIFICADO SEM SINAL",
      phoneSub: "Passe provisório até sincronizar",
      phoneWarning: "Replay, politica, garantia, ownership e proof checks finais acontecem apos sync.",
      stages: [
        { label: "Enroll", body: "O administrador vincula o celular do operador com seguranca.", icon: Smartphone },
        { label: "Bundle", body: "O sistema envia permissoes e dados dos produtos para o celular.", icon: KeyRound },
        { label: "Scan", body: "O app valida os produtos no campo mesmo sem internet.", icon: CloudOff },
        { label: "Sync", body: "Ao conectar na internet, o celular atualiza o sistema central.", icon: RotateCcw },
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
      title: "Verificación de campo para agro, cavas, plantas, minas y depósitos sin señal.",
      body: "nexID permite que celulares y escáneres autorizados funcionen en zonas sin internet. La app guarda la lectura de forma segura y da un pase provisional en el momento. Al recuperar señal, el sistema sincroniza los datos y emite el veredicto oficial.",
      docs: "Leer arquitectura offline",
      demo: "Abrir DemoLab offline",
      phoneLabel: "Escáner de campo",
      phoneStatus: "VERIFICADO SIN RED",
      phoneSub: "Pase provisional hasta sincronizar",
      phoneWarning: "El veredicto final de autenticidad, garantía y propiedad se emite al reconectar con el servidor.",
      stages: [
        { label: "Vincular", body: "El administrador vincula de forma segura el celular del operador.", icon: Smartphone },
        { label: "Permisos", body: "Se envian los permisos y datos de los productos al celular.", icon: KeyRound },
        { label: "Campo", body: "La app valida los productos en el campo aunque no haya internet.", icon: CloudOff },
        { label: "Sincronizar", body: "Al conectarse a internet, el celular actualiza el sistema central.", icon: RotateCcw },
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
      body: "Start with QR when cost matters, add NFC or NTAG 424 DNA TT when the product needs cryptographic proof, and connect POS, logistics, loyalty and CRM without forcing the buyer into a confusing registration flow.",
      cta: "Open SDK & APIs",
      secondary: "Open Product Lab",
    }
    : isBr
    ? {
      kicker: "Uma plataforma, muitos setores",
      title: "nexID vai alem de uma vitrine de vinho. E infraestrutura para qualquer ativo fisico que precise de confianca.",
      body: "Comece com QR quando custo importa, adicione NFC ou NTAG 424 DNA TT quando o produto precisa de prova criptografica, e conecte POS, logistica, loyalty e CRM sem empurrar o comprador para um cadastro confuso.",
      cta: "Abrir SDK & APIs",
      secondary: "Abrir Laboratorio",
    }
    : {
      kicker: "Una plataforma, muchos rubros",
      title: "nexID va mas alla de una vitrina de vinos. Es infraestructura para cualquier activo fisico que necesite confianza.",
      body: "Empeza con QR cuando el costo importa, suma NFC o NTAG 424 DNA TT cuando el producto necesita prueba criptografica, y conecta POS, logistica, loyalty y CRM sin empujar al comprador a un registro confuso.",
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
      body: "A premium product should not disappear after it leaves the factory or store. With nexID, every unit can prove it is real, show its story and keep the relationship alive with the buyer.",
      primary: "Book a 20 minute demo",
      secondary: "Open customer journey",
      cards: [
        { title: "For the brand", body: "Protect products, channels and reputation while collecting first-party data from real validations." },
        { title: "For the customer", body: "Tap, understand what was bought, claim warranty, receive benefits and keep a digital certificate." },
        { title: "For stores and distributors", body: "Validate purchase, reduce suspicious claims and activate campaigns by batch, city or channel." },
      ],
      story: [
        "Product is created with batch, origin and visual assets.",
        "Customer taps NFC or QR and sees a clear answer: authentic, observed or blocked.",
        "After purchase, contact validation and risk score unlock policy-based ownership, warranty and benefits.",
        "If the case needs it, the certificate can be registered on Polygon and connected to wallet or marketplace under tenant policy.",
      ],
      note: "The user does not need to understand blockchain. The screen must simply say what happened, why it matters and what to do next.",
    }
    : isBr
    ? {
      eyebrow: "Em palavras simples",
      title: "nexID nao e uma empresa de chips. Transforma cada produto em um canal direto de confianca e pos-venda.",
      body: "Um produto premium nao deveria desaparecer depois da fabrica ou da loja. Com nexID, cada unidade prova que e real, conta sua historia e mantem a relacao com o comprador.",
      primary: "Agendar demo de 20 min",
      secondary: "Ver jornada do cliente",
      cards: [
        { title: "Para a marca", body: "Protege produto, canal e reputacao enquanto gera dados proprios de validacoes reais." },
        { title: "Para o cliente", body: "Toca, entende o que comprou, ativa garantia, recebe beneficios e guarda certificado digital." },
        { title: "Para lojas e distribuidores", body: "Valida compra, reduz reclamos suspeitos e ativa campanhas por lote, cidade ou canal." },
      ],
      story: [
        "Produto nasce com lote, origem e banco visual.",
        "Cliente toca NFC ou QR e ve uma resposta clara: autentico, observado ou bloqueado.",
        "Depois da compra, contato validado e score de risco liberam titularidade digital, garantia e beneficios.",
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
        { title: "Para la marca", body: "Protege producto, canal y reputación mientras genera datos propios desde validaciones reales." },
        { title: "Para el cliente", body: "Toca, entiende qué compró, activa garantía, recibe beneficios y guarda su certificado digital." },
        { title: "Para tiendas y distribuidores", body: "Valida compra, reduce reclamos sospechosos y activa campanas por lote, ciudad o canal." },
      ],
      story: [
        "El producto nace con lote, origen y banco visual.",
        "El cliente toca NFC o QR y ve una respuesta clara: válido, observado o bloqueado.",
        "Después de la compra, contacto validado y score de riesgo habilitan propiedad digital, garantía y beneficios.",
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
      body: "Every validation can prove authenticity, show origin, protect the channel, open warranty, trigger benefits and send useful data back to the brand.",
      cta: "Plan a pilot",
      secondary: "See architecture",
      items: [
        ["Authenticity", "The buyer sees a clear answer: authentic, observed or blocked. No technical explanation needed."],
        ["Traceability", "Origin, batch, store, distributor, tap location and product state become part of one readable story."],
        ["After-sales", "Warranty, club, points, vouchers, support, marketplace and resale can open from the same passport."],
        ["Data for teams", "Marketing, operations, risk and sales get first-party signals by batch, city, channel and campaign."],
      ],
    }
    : isBr
    ? {
      eyebrow: "Por que empresas escolhem nexID",
      title: "O produto não termina na venda. Ele vira um canal vivo de confiança, dados e pós-venda.",
      body: "Cada validação pode mostrar evidência de autenticidade, origem, estado, risco e próximos passos comerciais para a marca.",
      cta: "Planejar piloto",
      secondary: "Ver arquitetura",
      items: [
        ["Autenticidade", "O comprador vê uma resposta clara: autêntico, observado ou bloqueado. Sem explicação técnica."],
        ["Rastreabilidade", "Origem, lote, loja, distribuidor, local do toque e estado do produto viram uma história legível."],
        ["Pós-venda", "Garantia, clube, pontos, vouchers, suporte, marketplace e revenda podem abrir no mesmo passaporte."],
        ["Dados para equipes", "Marketing, operações, risco e vendas recebem sinais por lote, cidade, canal e campanha."],
      ],
    }
    : {
      eyebrow: "Por que una empresa elige nexID",
      title: "El producto no termina en la venta. Se convierte en un canal vivo de confianza, datos y postventa.",
      body: "Cada validación puede mostrar evidencia de autenticidad, origen, estado, riesgo y próximos pasos comerciales para la marca.",
      cta: "Planear un piloto",
      secondary: "Ver arquitectura",
      items: [
        ["Autenticidad", "El comprador ve una respuesta clara: auténtico, observado o bloqueado. Sin explicación técnica."],
        ["Trazabilidad", "Origen, lote, tienda, distribuidor, lugar del tap y estado del producto se cuentan como una historia simple."],
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
  const liveLabel = isEn ? "Live Network" : isBr ? "Rede ao vivo" : "Red en vivo";
  const liveBody = isEn ? "Global node visualization." : isBr ? "Visualizacao de nodos globais." : "Visualizacion de nodos globales.";
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
              title="Red operativa global"
              subtitle="Origen, taps, riesgo y rutas comerciales en vivo."
              caption="El mismo motor visual alimenta SDK, laboratorio de producto, CRM e Investor."
              points={traceabilityGlobePoints}
              routes={traceabilityGlobeRoutes}
              compact
            />
            <div className="absolute bottom-4 right-4 bg-slate-950/80 backdrop-blur-md border border-white/10 rounded-lg p-3 text-xs text-slate-300 shadow-xl">
               <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-white">{liveLabel}</span>
               </div>
               {liveBody}
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
                        <div className="inline-flex px-2 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded mb-3 w-max">AUTÉNTICO</div>
                        <h3 className="text-xl font-bold text-white">Gran Reserva Malbec</h3>
                        <p className="text-xs text-slate-300 mt-1">Mendoza, Argentina</p>
                        <div className="mt-4 w-full h-10 bg-white text-slate-950 rounded-lg flex items-center justify-center text-sm font-bold shadow-lg">
                           Reclamar Propiedad
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
      secureTitle: "NTAG 424 DNA TagTamper (premium anti-fraud)",
      secureBullets: [
        "Use this profile when anti-clone and tamper resistance are business critical.",
        "Recommended for wine, cosmetics, docs/presence and high-risk supply chains.",
      ],
      footer: "Message to buyers: NTAG215 = UX + control + serialisation. NTAG 424 DNA TT = strong anti-fraud.",
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
      secureTitle: "NTAG 424 DNA TagTamper (anti-fraude premium)",
      secureBullets: [
        "Use este perfil quando anti-clone e tamper são críticos.",
        "Recomendado para vinho, cosméticos, docs/presence e cadeias de risco.",
      ],
      footer: "Mensagem comercial: NTAG215 = UX + controle + serialização. NTAG 424 DNA TT = anti-fraude forte.",
    }
    : {
      eyebrow: "Posicionamiento Eventos / NTAG215",
      title: "Por que NTAG215 supera al QR en muchos flujos de eventos",
      intro: "NTAG215 está pensado para experiencia por toque, serialización y control operativo en pulseras, entradas y credenciales. No es antifraude premium.",
      basicTitle: "NTAG215 Basico (eventos y activaciones)",
      basicBullets: [
        "Ingreso mas rapido que QR, email o foto en accesos con filas.",
        "Cada pieza fisica puede serializarse con UID y reglas del servidor.",
        "Mas dificil de compartir casualmente que un QR por captura.",
        "Ideal para pulseras, credenciales, tickets y activaciones de marca.",
      ],
      secureTitle: "NTAG 424 DNA TagTamper (anti-fraude premium)",
      secureBullets: [
        "Usa este perfil cuando anti-clonación y sello físico sean críticos.",
        "Recomendado para vino, cosmética, documentos, presencia y cadenas de alto riesgo.",
      ],
      footer: "Mensaje comercial: NTAG215 = experiencia + control + serializacion. NTAG 424 DNA TT = antifraude fuerte.",
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
              { name: "QR / GS1 Digital Link", tag: "Contenido", body: "La entrada mas economica: URL verificable, envase masivo, campanas, manuales y analitica basica. Ideal cuando no se necesita anti-clon fuerte." },
              { name: "NTAG213 / NTAG215", tag: "Toque simple", body: "Bajo costo NFC para entradas, credenciales, beneficios y productos de rotacion: UID serializado, reglas del servidor y experiencia sin camara." },
              { name: "NTAG 424 DNA", tag: "SUN/SDM", body: "Cada toque genera datos dinámicos verificables contra copias, clones y URLs reutilizadas. Recomendado para autenticidad fuerte sin sello físico." },
              { name: "424 DNA TT + token", tag: "Sello + política", body: "Para vino, lujo, salud y activos premium: detecta apertura física, cambia el pasaporte y prepara propiedad digital/tokenización según política de compra." },
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
      example: "NTAG215 o NTAG 424 DNA con UID/SUN dinamico para serializacion, anti copia y control del servidor.",
      fit: "Para eventos, credenciales, productos de valor medio y operaciones con validacion frecuente.",
    },
    {
      visual: "tt",
      title: "Premium tokenizado",
      example: "NTAG 424 DNA TT + pasaporte + certificado Polygon opcional para propiedad digital, historial y tienda.",
      fit: "Para vino, lujo, cosmética, salud y activos donde apertura, origen y postventa importan.",
    },
  ];
  const enrichedPlanEducation = isEn
    ? [
      { visual: "qr", title: "Basic launch", example: "Common QR or NFC UID for manuals, landing pages, warranty forms and first scan analytics.", fit: "Use it when speed matters more than anti-clone protection.", flow: ["Customer scans", "Content opens", "Lead or warranty is saved"] },
      { visual: "ntag", title: "Secure tap", example: "NTAG215 for events or NTAG 424 DNA for dynamic SUN, serialized UID and server-side rules.", fit: "Use it for tickets, credentials, mid-value products and frequent validation.", flow: ["Phone taps", "Backend checks UID/SUN", "Dashboard records location"] },
      { visual: "tt", title: "Premium tokenized", example: "NTAG 424 DNA TT + passport + optional Polygon certificate for ownership, lifecycle and marketplace.", fit: "Use it for wine, luxury, cosmetics, pharma and assets where opening, origin and resale matter.", flow: ["Seal breaks", "Passport state changes", "Ownership or voucher opens"] },
    ]
    : isBr
    ? [
      { visual: "qr", title: "Basic real", example: "QR comum ou NFC UID para manuais, landing pages, garantia e primeiras metricas de scan.", fit: "Use quando velocidade importa mais que protecao anti-clone.", flow: ["Cliente escaneia", "Conteudo abre", "Lead ou garantia salva"] },
      { visual: "ntag", title: "Secure tap", example: "NTAG215 para eventos ou NTAG 424 DNA com SUN dinamico, UID serializado e regras server-side.", fit: "Para ingressos, credenciais, produtos de valor medio e validacao frequente.", flow: ["Celular toca", "Backend valida UID/SUN", "Dashboard registra local"] },
      { visual: "tt", title: "Premium tokenizado", example: "NTAG 424 DNA TT + passaporte + certificado Polygon opcional para titularidade digital, ciclo de vida e marketplace.", fit: "Para vinho, luxo, cosmeticos, pharma e ativos onde abertura, origem e revenda importam.", flow: ["Lacre rompe", "Passaporte muda estado", "Titularidade ou voucher abre"] },
    ]
    : [
      { visual: "qr", title: "Basico real", example: "QR comun o NFC UID para manuales, paginas, registro de garantia y primeras metricas de escaneo.", fit: "Usalo cuando importa lanzar rapido y el riesgo de copia todavia no es critico.", flow: ["Cliente escanea", "Abre contenido", "Se guarda contacto o garantia"] },
      { visual: "ntag", title: "Toque seguro", example: "NTAG215 para eventos o NTAG 424 DNA con SUN dinamico, UID serializado y reglas del servidor.", fit: "Para entradas, credenciales, productos de valor medio y operaciones con validacion frecuente.", flow: ["El telefono toca", "Servidor valida UID/SUN", "Panel registra ubicacion"] },
      { visual: "tt", title: "Premium tokenizado", example: "NTAG 424 DNA TT + pasaporte + certificado Polygon opcional para propiedad digital, historial y tienda.", fit: "Para vino, lujo, cosmética, salud y activos donde apertura, origen y reventa importan.", flow: ["Se rompe el sello", "El pasaporte cambia estado", "Se revisa propiedad o voucher"] },
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
      body: "The premium layer turns each verified unit into a living passport: provenance, warranty, policy-based ownership and marketplace actions stay attached to the physical item.",
      demo: "Open premium flow",
      docs: "Read architecture",
      wallet: "Wallet / custody",
      proofTitle: "Premium passport example",
      proofStatus: "AUTH_OK / OPENED",
      proofRows: [
        ["Origin", "Uco Valley, Mendoza"],
        ["Seal", "NTAG 424 DNA TT opened"],
        ["Token", "Polygon claim ready"],
        ["Recipient", "Buyer wallet or tenant custody"],
      ],
      cards: [
        { title: "Ownership passport", body: "After authentication, the buyer can claim a digital ownership record tied to a derived asset reference, batch and product state." },
        { title: "Warranty lifecycle", body: "Warranty, service, return and support events become auditable lifecycle updates, not loose forms." },
        { title: "Provenance records", body: "Origin, production lot, reseller path and customer tap can be shown as a trust trail." },
        { title: "Marketplace unlocks", body: "Vouchers, club access, resale rules and premium tokenization become post-tap actions." },
      ],
      steps: ["Verify product", "Claim passport", "Attach warranty", "Unlock marketplace"],
    }
    : isBr
    ? {
      eyebrow: "Camada premium",
      title: "Titularidade digital para produtos que seguem gerando valor",
      body: "A camada premium transforma cada unidade verificada em um passaporte vivo: proveniencia, garantia, titularidade por politica e acoes de marketplace ficam ligadas ao item fisico.",
      demo: "Abrir fluxo premium",
      docs: "Ler arquitetura",
      wallet: "Wallet / custodia",
      proofTitle: "Exemplo de passport premium",
      proofStatus: "AUTH_OK / OPENED",
      proofRows: [
        ["Origem", "Valle de Uco, Mendoza"],
        ["Lacre", "NTAG 424 DNA TT aberto"],
        ["Token", "Claim Polygon pronto"],
        ["Destinatario", "Carteira do comprador ou custodia do tenant"],
      ],
      cards: [
        { title: "Passaporte de titularidade", body: "Depois da autenticacao, o comprador pode reclamar um registro digital ligado a referencia derivada do ativo, lote e estado." },
        { title: "Ciclo de garantia", body: "Garantia, suporte, devolucao e servico viram eventos auditaveis, nao formularios soltos." },
        { title: "Registros de proveniencia", body: "Origem, lote, canal revendedor e toque do cliente aparecem como trilha de confianca." },
        { title: "Aberturas de marketplace", body: "Vouchers, clube, regras de revenda e tokenizacao premium viram acoes pos-toque." },
      ],
      steps: ["Verificar produto", "Reclamar passaporte", "Anexar garantia", "Abrir marketplace"],
    }
    : {
      eyebrow: "Capa premium",
      title: "Propiedad digital para productos que siguen generando valor",
      body: "La capa premium convierte cada unidad verificada en un pasaporte vivo: procedencia, garantía, propiedad por política y acciones de tienda quedan asociadas al objeto físico.",
      demo: "Abrir flujo premium",
      docs: "Ver arquitectura",
      wallet: "Billetera / custodia",
      proofTitle: "Ejemplo de pasaporte premium",
      proofStatus: "AUTENTICO / ABIERTO",
      proofRows: [
        ["Origen", "Valle de Uco, Mendoza"],
        ["Sello", "NTAG 424 DNA TT abierto"],
        ["Token", "Claim Polygon listo"],
        ["Destinatario", "Billetera del comprador o custodia del tenant"],
      ],
      cards: [
        { title: "Pasaporte de propiedad", body: "Después de autenticar, el comprador puede reclamar un registro digital vinculado a una referencia derivada del activo, lote y estado." },
        { title: "Ciclo de garantía", body: "Garantía, soporte, devolución y servicio se vuelven eventos auditables, no formularios sueltos." },
        { title: "Registros de procedencia", body: "Origen, lote, canal distribuidor y toque del cliente se muestran como una ruta de confianza." },
        { title: "Tienda habilitada", body: "Vouchers, club, reglas de reventa y tokenización premium se activan después del toque cuando la política lo permite." },
      ],
      steps: ["Verificar producto", "Reclamar pasaporte", "Adjuntar garantía", "Abrir tienda"],
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
      risk: isEn ? "Not cryptographic anti-fraud." : isBr ? "Nao e antifraude criptografico." : "No es antifraude criptográfico.",
    },
    {
      name: "NTAG215 / 216",
      price: "USD 0.12 - 0.45",
      level: "Operacion",
      promise: isEn ? "Serialized UID, events, credentials and high-frequency validation." : isBr ? "UID serializado, eventos, credenciais e validacao frequente." : "UID serializado, eventos, credenciales y validacion frecuente.",
      best: isEn ? "Wristbands, tickets, access and mid-value products." : isBr ? "Pulseiras, tickets, acesso e produtos medios." : "Pulseras, tickets, accesos y productos medios.",
      risk: isEn ? "Server-side control, not premium clone proof." : isBr ? "Controle server-side, nao premium anti-clone." : "Control del servidor, no prueba anti-clon premium.",
    },
    {
      name: "NTAG424 DNA",
      price: "USD 0.55 - 0.90",
      level: "Secure",
      promise: isEn ? "SUN/SDM, dynamic URL and anti-replay evidence." : isBr ? "SUN/SDM, URL dinamica e evidencia anti-replay." : "SUN/SDM, URL dinamica y evidencia anti-replay.",
      best: isEn ? "Premium products, documents, warranty." : isBr ? "Produtos premium, documentos, garantia." : "Productos premium, documentos, garantía.",
      risk: isEn ? "Strong cryptographic authenticity." : isBr ? "Autenticidade criptografica forte." : "Autenticidad criptográfica fuerte.",
    },
    {
      name: "NTAG424 DNA TT",
      price: "USD 0.85 - 1.25",
      level: "Luxury",
      promise: isEn ? "Cryptographic tap plus physical opened/closed seal." : isBr ? "Toque criptografico mais selo fisico aberto/fechado." : "Toque criptográfico más sello físico abierto/cerrado.",
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
    ? "Security is only the first tap. The real value is the premium network after it."
    : isBr
    ? "A seguranca e apenas o primeiro toque. O valor real e a rede premium depois dele."
    : "La seguridad es solo el primer toque. El valor real es la red premium después.";
  const body = isEn
    ? "Every verified product can open a consumer passport, tenant club, marketplace offers, CRM tickets and cross-brand loyalty. That turns anti-fraud into retention and sales."
    : isBr
    ? "Cada produto verificado abre passport do consumidor, clube do tenant, ofertas de marketplace, tickets CRM e loyalty entre marcas."
    : "Cada producto verificado abre pasaporte del usuario, club de la marca, ofertas de tienda, casos CRM y beneficios entre marcas.";
  const nodes = [
    { k: "01", title: isEn ? "Trust tap" : isBr ? "Toque confiavel" : "Toque confiable", body: isEn ? "Authenticity, seal state, origin and risk." : isBr ? "Autenticidade, lacre, origem e risco." : "Autenticidad, sello, origen y riesgo." },
    { k: "02", title: isEn ? "Passport" : isBr ? "Passaporte" : "Pasaporte", body: isEn ? "Product history, warranty and owner context." : isBr ? "Historico, garantia e contexto de titularidade." : "Historial, garantía y contexto de propiedad." },
    { k: "03", title: isEn ? "Club & points" : isBr ? "Clube e pontos" : "Club y puntos", body: isEn ? "Rewards, vouchers and private drops by tenant." : isBr ? "Rewards, vouchers e drops privados por tenant." : "Puntos, vouchers y beneficios privados por marca." },
    { k: "04", title: isEn ? "Marketplace" : isBr ? "Marketplace" : "Tienda", body: isEn ? "Premium products, reorder, resale and partner offers." : isBr ? "Produtos premium, recompra, revenda e ofertas." : "Productos premium, recompra, reventa y ofertas." },
    { k: "05", title: "CRM", body: isEn ? "Leads, tickets, buyer intent and live notifications." : isBr ? "Leads, tickets, intencao e notificacoes." : "Contactos, casos, intencion de compra y avisos." },
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
                ["320", isEn ? "avg points" : isBr ? "pontos medios" : "pts promedio"],
                ["5", isEn ? "live actions" : isBr ? "acoes live" : "acciones activas"],
                ["1", isEn ? "network login" : isBr ? "login de rede" : "ingreso de red"],
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
    { title: "424 DNA Seguro", hardware: "USD 0.55 - 0.90", saas: "SUN + anti copia + panel", margin: "Antifraude real y auditoria" },
    { title: "DNA TT Premium", hardware: "USD 0.85 - 1.25", saas: "Sello + propiedad digital + token", margin: "Lujo, salud, vino, coleccionables" },
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
  const ctaLinks = isEn
    ? [
      { href: "/demo-lab?vertical=wine", label: "View live demo", body: "Bottle, seal, tap route, portal and marketplace in one guided scene." },
      { href: schedulingUrls.meeting, label: "Schedule meeting", body: "Open the calendar and reserve a slot for business, reseller or customer pilots.", external: true },
      { href: "/?contact=demo#contact-modal", label: "Book a demo", body: "Create the lead and save the case in the admin flow." },
      { href: "/?contact=sales#contact-modal", label: "Talk to sales", body: "Discuss tags, volumes, tenant setup and rollout." },
      { href: "/docs", label: "Read docs", body: "API, SUN, NTAG, dashboard and integration architecture." },
    ]
    : isBr
    ? [
      { href: "/demo-lab?vertical=wine", label: "Ver demo ao vivo", body: "Garrafa, lacre, rota, portal e marketplace em uma cena guiada." },
      { href: schedulingUrls.meeting, label: "Agendar reuniao", body: "Abre o calendario para reservar horario com marcas, resellers ou clientes.", external: true },
      { href: "/?contact=demo#contact-modal", label: "Agendar demo", body: "Cria o lead e salva o caso no fluxo admin." },
      { href: "/?contact=sales#contact-modal", label: "Falar com vendas", body: "Tags, volume, tenant e rollout comercial." },
      { href: "/docs", label: "Ler docs", body: "API, SUN, NTAG, dashboard e arquitetura de integracao." },
    ]
    : [
      { href: "/demo-lab?vertical=wine", label: "Ver demo en vivo", body: "Botella, sello, ruta del toque, portal y tienda en una escena guiada." },
      { href: schedulingUrls.meeting, label: "Agendar reunion", body: "Abre el calendario y reserva una reunion con empresarios, distribuidores o clientes.", external: true },
      { href: "/?contact=demo#contact-modal", label: "Agendar demo", body: "Crea el contacto y guarda el caso en el flujo del panel." },
      { href: "/?contact=sales#contact-modal", label: "Hablar con ventas", body: "Etiquetas, volumen, cuenta de marca y despliegue comercial." },
      { href: "/docs", label: "Ver documentación", body: "API, SUN, NTAG, panel y arquitectura de integración." },
    ];

  return (
    <section className="container-shell py-24">
      <div className="relative rounded-[2rem] border border-cyan-500/20 bg-slate-900/80 overflow-hidden shadow-[0_0_80px_rgba(6,182,212,0.15)]">
         <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10 pointer-events-none" />
         <div className="relative px-6 py-14 md:py-20 text-center z-10">
           <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-6">{content.cta.title}</h2>
           <p className="mx-auto max-w-2xl text-base leading-7 text-slate-400 mb-8">{content.cta.body}</p>
           <div className="flex flex-wrap justify-center gap-4">
             <Link href="/demo-lab?vertical=wine" className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-sm font-bold text-slate-950 transition hover:bg-slate-200 hover:scale-105 shadow-xl">
                {isEn ? "View live demo" : isBr ? "Ver demo ao vivo" : "Ver demo en vivo"}
             </Link>
             <a href={schedulingUrls.meeting} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-8 py-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20">
                {isEn ? "Schedule meeting" : isBr ? "Agendar reuniao" : "Agendar reunion"}
             </a>
             <Link href="/?contact=sales#contact-modal" className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-8 py-4 text-sm font-semibold text-white transition hover:bg-white/10">
                {content.cta?.secondary || (isEn ? "Talk to sales" : isBr ? "Falar com vendas" : "Hablar con ventas")}
             </Link>
             <Link href="/?contact=demo#contact-modal" className="inline-flex items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-8 py-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/10">
                {content.cta?.primary || "Empezar"}
             </Link>
           </div>
           <div className="mt-8 grid gap-3 text-left md:grid-cols-5">
             {ctaLinks.map((item) => (
               item.external ? (
                 <a key={item.href + item.label} href={item.href} target="_blank" rel="noreferrer" className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 transition hover:border-emerald-300/40 hover:bg-emerald-500/15">
                   <p className="text-sm font-black text-white">{item.label}</p>
                   <p className="mt-2 text-xs leading-5 text-slate-300">{item.body}</p>
                 </a>
               ) : (
                 <Link key={item.href + item.label} href={item.href} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 transition hover:border-cyan-300/35 hover:bg-cyan-500/10">
                   <p className="text-sm font-black text-white">{item.label}</p>
                   <p className="mt-2 text-xs leading-5 text-slate-400">{item.body}</p>
                 </Link>
               )
             ))}
           </div>
         </div>
      </div>
    </section>
  );
}
