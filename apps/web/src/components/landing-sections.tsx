import { Card, SectionHeading, Badge, Button, WorldMapRealtime } from "@product/ui";
import Link from "next/link";
import { HeroScene } from "./hero-scene";

type Content = any;

export function HeroSection({ content, stats, locale }: { content: Content; stats: any; locale: string; radar?: any }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const hero = content?.hero || {};
  const heroSubtitle = hero?.subtitle || hero?.body || "";
  const primaryCta = hero?.cta?.primary || hero?.primary || "Empezar";
  const secondaryCta = hero?.cta?.secondary || hero?.secondary || "Contacto";

  const trustBadge = isEn ? "Enterprise Trusted" : isBr ? "Confiabilidade Corporativa" : "Confianza Enterprise";
  const demoEyebrow = isEn ? "Interactive product experience" : isBr ? "Experiencia interativa do produto" : "Experiencia interactiva de producto";
  const demoBody = isEn
    ? "Bottle, wristband, seal and package: tap, authenticity and consumer action in one guided scene."
    : isBr
    ? "Garrafa, pulseira, lacre e embalagem: toque, autenticidade e acao do consumidor em uma cena guiada."
    : "Botella, pulsera, sello y packaging: tap, autenticidad y accion del consumidor en una escena guiada.";
  const demoCta = isEn ? "Open Demo Lab" : isBr ? "Abrir Demo Lab" : "Abrir Demo Lab";

  return (
    <section className="landing-hero-section relative overflow-hidden border-b border-white/5 bg-slate-950 pb-16 pt-16 lg:pb-24 lg:pt-24">
      <div className="hero-signal-field absolute inset-0 z-0 pointer-events-none" aria-hidden="true" />

      <div className="container-shell relative z-10">
        <div className="mx-auto max-w-6xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md transition-colors hover:bg-white/10">
             <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
             <span className="text-xs font-medium text-slate-300 uppercase tracking-widest">{trustBadge}</span>
          </div>

          <h1 className="mt-8 pb-2 text-4xl font-extrabold leading-[1.14] tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 sm:text-5xl sm:leading-[1.12] lg:text-[3.45rem] lg:leading-[1.1]">
            {hero.title}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-400">
            {heroSubtitle}
          </p>

          <div className="mx-auto mt-10 max-w-5xl text-left">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{demoEyebrow}</p>
                <p className="mt-1 max-w-2xl text-sm text-slate-300">{demoBody}</p>
              </div>
              <Link href="/demo-lab" className="rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20">
                {demoCta}
              </Link>
            </div>
            <HeroScene locale={locale as any} />
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/?contact=demo#contact-modal" className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-6 py-3.5 text-sm font-bold text-slate-950 transition-transform hover:scale-105 hover:bg-cyan-400">
              {primaryCta}
            </Link>
            <Link href="/docs" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-slate-900/50 backdrop-blur-md px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-white/10">
              {secondaryCta}
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4 border-t border-white/10 pt-8 md:grid-cols-4">
             <div className="text-center">
                <p className="text-3xl font-bold text-white">{stats.scanSpeed}</p>
                <p className="mt-1 text-xs text-slate-500 uppercase tracking-widest">{stats.scanSpeedLabel}</p>
             </div>
             <div className="text-center">
                <p className="text-3xl font-bold text-white">{stats.uptime}</p>
                <p className="mt-1 text-xs text-slate-500 uppercase tracking-widest">{stats.uptimeLabel}</p>
             </div>
             <div className="text-center">
                <p className="text-3xl font-bold text-white">{stats.crypto}</p>
                <p className="mt-1 text-xs text-slate-500 uppercase tracking-widest">{stats.cryptoLabel}</p>
             </div>
             <div className="text-center">
                <p className="text-3xl font-bold text-white">{stats.global}</p>
                <p className="mt-1 text-xs text-slate-500 uppercase tracking-widest">{stats.globalLabel}</p>
             </div>
          </div>

        </div>
      </div>
    </section>
  );
}

export function RadarSection({ radar, locale }: { radar: any; locale: string }) {
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
         <div className="relative rounded-2xl border border-white/10 bg-slate-900/40 p-4 shadow-2xl backdrop-blur-xl h-[400px] overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent transition-opacity group-hover:opacity-50" />
            <WorldMapRealtime title="" subtitle="" points={[{ lat: -34.6, lng: -58.3, city: "Buenos Aires", scans: 140, risk: 0 }]} initialExpanded={false} />
            <div className="absolute bottom-4 right-4 bg-slate-950/80 backdrop-blur-md border border-white/10 rounded-lg p-3 text-xs text-slate-300 shadow-xl">
               <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-white">Live Network</span>
               </div>
               Global node visualization.
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
      eyebrow: "Preview Interactivo",
      title: "Viví la Experiencia del Consumidor",
      desc: "Escaneá un producto y accedé a su historia, programa de lealtad y herramientas de reventa sin descargar apps."
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
                        Probar Passport Móvil
                     </Link>
                     <Link href="/demo-lab" className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10 backdrop-blur-sm">
                        Abrir Demo Lab
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
      title: "Por qué NTAG215 supera al QR en muchos flujos de eventos",
      intro: "NTAG215 está pensado para UX por tap, serialización y control operativo en pulseras, tickets y credenciales. No es anti-fraude premium.",
      basicTitle: "NTAG215 Basic (eventos y activaciones)",
      basicBullets: [
        "Check-in más rápido que QR/email/foto en accesos con filas.",
        "Cada pieza física puede serializarse con UID y reglas server-side.",
        "Más difícil de compartir casualmente que un QR por screenshot.",
        "Ideal para pulseras, credenciales, tickets y activaciones de marca.",
      ],
      secureTitle: "NTAG 424 DNA TagTamper (anti-fraude premium)",
      secureBullets: [
        "Usá este perfil cuando anti-clonación y tamper sean críticos.",
        "Recomendado para vino, cosmética, docs/presence y cadenas de alto riesgo.",
      ],
      footer: "Mensaje comercial: NTAG215 = UX + control + serialización. NTAG 424 DNA TT = anti-fraude fuerte.",
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
              Ver stack tecnico
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {[
              { name: "QR comun", tag: "Marketing", body: "Barato y rapido. Sirve para contenido, campanas y trazabilidad simple, pero se copia con una captura." },
              { name: "NTAG215", tag: "Tap UX", body: "Ideal para pulseras, credenciales y activaciones donde importa velocidad, serializacion y control server-side." },
              { name: "NTAG 424 DNA", tag: "Anti-clone", body: "Agrega SUN/SDM dinamico para que cada tap sea unico y verificable contra replay o copia." },
              { name: "424 DNA TT", tag: "Tamper", body: "Para botellas, tapas, sellos y packaging premium: detecta apertura fisica y cambia el estado del passport." },
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
      title: "Basic real",
      example: "QR comun o NFC UID para contenido, campañas, manuales, registro de garantia y primeras metricas.",
      fit: "Cuando el riesgo de copia no es critico y lo importante es lanzar rapido.",
    },
    {
      visual: "ntag",
      title: "Secure tap",
      example: "NTAG215 o NTAG 424 DNA con UID/SUN dinamico para serializacion, anti-replay y control server-side.",
      fit: "Para eventos, credenciales, productos de valor medio y operaciones con validacion frecuente.",
    },
    {
      visual: "tt",
      title: "Premium tokenizado",
      example: "NTAG 424 DNA TT + passport + token sandbox/Polygon para propiedad, historial y marketplace.",
      fit: "Para vino, lujo, cosmetica, pharma y activos donde apertura, origen y postventa importan.",
    },
  ];
  const enrichedPlanEducation = isEn
    ? [
      { visual: "qr", title: "Basic launch", example: "Common QR or NFC UID for manuals, landing pages, warranty forms and first scan analytics.", fit: "Use it when speed matters more than anti-clone protection.", flow: ["Customer scans", "Content opens", "Lead or warranty is saved"] },
      { visual: "ntag", title: "Secure tap", example: "NTAG215 for events or NTAG 424 DNA for dynamic SUN, serialized UID and server-side rules.", fit: "Use it for tickets, credentials, mid-value products and frequent validation.", flow: ["Phone taps", "Backend checks UID/SUN", "Dashboard records location"] },
      { visual: "tt", title: "Premium tokenized", example: "NTAG 424 DNA TT + passport + sandbox/Polygon token for ownership, lifecycle and marketplace.", fit: "Use it for wine, luxury, cosmetics, pharma and assets where opening, origin and resale matter.", flow: ["Seal breaks", "Passport state changes", "Ownership or voucher opens"] },
    ]
    : isBr
    ? [
      { visual: "qr", title: "Basic real", example: "QR comum ou NFC UID para manuais, landing pages, garantia e primeiras metricas de scan.", fit: "Use quando velocidade importa mais que protecao anti-clone.", flow: ["Cliente escaneia", "Conteudo abre", "Lead ou garantia salva"] },
      { visual: "ntag", title: "Secure tap", example: "NTAG215 para eventos ou NTAG 424 DNA com SUN dinamico, UID serializado e regras server-side.", fit: "Para ingressos, credenciais, produtos de valor medio e validacao frequente.", flow: ["Celular toca", "Backend valida UID/SUN", "Dashboard registra local"] },
      { visual: "tt", title: "Premium tokenizado", example: "NTAG 424 DNA TT + passport + token sandbox/Polygon para ownership, lifecycle e marketplace.", fit: "Para vinho, luxo, cosmeticos, pharma e ativos onde abertura, origem e revenda importam.", flow: ["Lacre rompe", "Passport muda estado", "Ownership ou voucher abre"] },
    ]
    : [
      { visual: "qr", title: "Basic real", example: "QR comun o NFC UID para manuales, landing pages, registro de garantia y primeras metricas de escaneo.", fit: "Usalo cuando importa lanzar rapido y el riesgo de copia todavia no es critico.", flow: ["Cliente escanea", "Abre contenido", "Se guarda lead o garantia"] },
      { visual: "ntag", title: "Secure tap", example: "NTAG215 para eventos o NTAG 424 DNA con SUN dinamico, UID serializado y reglas server-side.", fit: "Para tickets, credenciales, productos de valor medio y operaciones con validacion frecuente.", flow: ["El telefono tapea", "Backend valida UID/SUN", "Dashboard registra ubicacion"] },
      { visual: "tt", title: "Premium tokenizado", example: "NTAG 424 DNA TT + passport + token sandbox/Polygon para ownership, historial y marketplace.", fit: "Para vino, lujo, cosmetica, pharma y activos donde apertura, origen y reventa importan.", flow: ["Se rompe el sello", "El passport cambia estado", "Se abre ownership o voucher"] },
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
      body: "The premium layer turns each verified unit into a living passport: provenance, warranty, token-ready ownership and marketplace actions stay attached to the physical item.",
      demo: "Open premium demo",
      docs: "Read architecture",
      wallet: "Wallet sandbox",
      proofTitle: "Premium passport example",
      proofStatus: "AUTH_OK / OPENED",
      proofRows: [
        ["Origin", "Uco Valley, Mendoza"],
        ["Seal", "NTAG 424 DNA TT opened"],
        ["Token", "Polygon sandbox ready"],
        ["Owner", "Anonymous buyer wallet"],
      ],
      cards: [
        { title: "Ownership passport", body: "After authentication, the buyer can claim a digital ownership record tied to UID, batch and product state." },
        { title: "Warranty lifecycle", body: "Warranty, service, return and support events become auditable lifecycle updates, not loose forms." },
        { title: "Provenance records", body: "Origin, production lot, reseller path and customer tap can be shown as a trust trail." },
        { title: "Marketplace unlocks", body: "Vouchers, club access, resale rules and premium tokenization become post-tap actions." },
      ],
      steps: ["Verify product", "Claim passport", "Attach warranty", "Unlock marketplace"],
    }
    : isBr
    ? {
      eyebrow: "Camada premium",
      title: "Ownership digital para produtos que seguem gerando valor",
      body: "A camada premium transforma cada unidade verificada em um passport vivo: proveniencia, garantia, ownership token-ready e acoes de marketplace ficam ligadas ao item fisico.",
      demo: "Abrir demo premium",
      docs: "Ler arquitetura",
      wallet: "Wallet sandbox",
      proofTitle: "Exemplo de passport premium",
      proofStatus: "AUTH_OK / OPENED",
      proofRows: [
        ["Origem", "Valle de Uco, Mendoza"],
        ["Lacre", "NTAG 424 DNA TT aberto"],
        ["Token", "Polygon sandbox pronto"],
        ["Owner", "Wallet anonima"],
      ],
      cards: [
        { title: "Ownership passport", body: "Depois da autenticacao, o comprador pode reclamar um registro digital ligado a UID, lote e estado." },
        { title: "Warranty lifecycle", body: "Garantia, suporte, devolucao e servico viram eventos auditaveis, nao formularios soltos." },
        { title: "Registros de proveniencia", body: "Origem, lote, canal revendedor e toque do cliente aparecem como trilha de confianca." },
        { title: "Marketplace unlocks", body: "Vouchers, clube, regras de revenda e tokenizacao premium viram acoes pos-toque." },
      ],
      steps: ["Verificar produto", "Reclamar passport", "Anexar garantia", "Abrir marketplace"],
    }
    : {
      eyebrow: "Capa premium",
      title: "Ownership digital para productos que siguen generando valor",
      body: "La capa premium convierte cada unidad verificada en un passport vivo: procedencia, garantia, ownership token-ready y acciones de marketplace quedan asociadas al objeto fisico.",
      demo: "Abrir demo premium",
      docs: "Ver arquitectura",
      wallet: "Wallet sandbox",
      proofTitle: "Ejemplo de passport premium",
      proofStatus: "AUTH_OK / OPENED",
      proofRows: [
        ["Origen", "Valle de Uco, Mendoza"],
        ["Sello", "NTAG 424 DNA TT abierto"],
        ["Token", "Polygon sandbox listo"],
        ["Owner", "Wallet anonima"],
      ],
      cards: [
        { title: "Ownership passport", body: "Despues de autenticar, el comprador puede reclamar un registro digital vinculado a UID, lote y estado." },
        { title: "Warranty lifecycle", body: "Garantia, soporte, devolucion y service se vuelven eventos auditables, no formularios sueltos." },
        { title: "Registros de procedencia", body: "Origen, lote, canal reseller y tap del cliente se muestran como una ruta de confianza." },
        { title: "Marketplace unlocks", body: "Vouchers, club, reglas de reventa y tokenizacion premium se activan post-tap." },
      ],
      steps: ["Verificar producto", "Reclamar passport", "Adjuntar garantia", "Abrir marketplace"],
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
              <Link href="/demo-lab" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/10">{copy.demo}</Link>
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

export function CtaSection({ content, locale }: { content: Content; locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const ctaLinks = isEn
    ? [
      { href: "/demo-lab", label: "View live demo", body: "Bottle, seal, tap route, portal and marketplace in one guided scene." },
      { href: "/?contact=demo#contact-modal", label: "Book a demo", body: "Create the lead and save the case in the admin flow." },
      { href: "/?contact=sales#contact-modal", label: "Talk to sales", body: "Discuss tags, volumes, tenant setup and rollout." },
      { href: "/docs", label: "Read docs", body: "API, SUN, NTAG, dashboard and integration architecture." },
    ]
    : isBr
    ? [
      { href: "/demo-lab", label: "Ver demo ao vivo", body: "Garrafa, lacre, rota, portal e marketplace em uma cena guiada." },
      { href: "/?contact=demo#contact-modal", label: "Agendar demo", body: "Cria o lead e salva o caso no fluxo admin." },
      { href: "/?contact=sales#contact-modal", label: "Falar com vendas", body: "Tags, volume, tenant e rollout comercial." },
      { href: "/docs", label: "Ler docs", body: "API, SUN, NTAG, dashboard e arquitetura de integracao." },
    ]
    : [
      { href: "/demo-lab", label: "Ver demo en vivo", body: "Botella, sello, ruta del tap, portal y marketplace en una escena guiada." },
      { href: "/?contact=demo#contact-modal", label: "Agendar demo", body: "Crea el lead y guarda el caso en el flujo admin." },
      { href: "/?contact=sales#contact-modal", label: "Hablar con ventas", body: "Tags, volumen, tenant y rollout comercial." },
      { href: "/docs", label: "Ver docs", body: "API, SUN, NTAG, dashboard y arquitectura de integracion." },
    ];

  return (
    <section className="container-shell py-24">
      <div className="relative rounded-[2rem] border border-cyan-500/20 bg-slate-900/80 overflow-hidden shadow-[0_0_80px_rgba(6,182,212,0.15)]">
         <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10 pointer-events-none" />
         <div className="relative px-6 py-14 md:py-20 text-center z-10">
           <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-6">{content.cta.title}</h2>
           <p className="mx-auto max-w-2xl text-base leading-7 text-slate-400 mb-8">{content.cta.body}</p>
           <div className="flex flex-wrap justify-center gap-4">
             <Link href="/demo-lab" className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-sm font-bold text-slate-950 transition hover:bg-slate-200 hover:scale-105 shadow-xl">
                {isEn ? "View live demo" : isBr ? "Ver demo ao vivo" : "Ver demo en vivo"}
             </Link>
             <Link href="/?contact=sales#contact-modal" className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-8 py-4 text-sm font-semibold text-white transition hover:bg-white/10">
                {content.cta?.secondary || (isEn ? "Talk to sales" : isBr ? "Falar com vendas" : "Hablar con ventas")}
             </Link>
             <Link href="/?contact=demo#contact-modal" className="inline-flex items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-8 py-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/10">
                {content.cta?.primary || "Empezar"}
             </Link>
           </div>
           <div className="mt-8 grid gap-3 text-left md:grid-cols-4">
             {ctaLinks.map((item) => (
               <Link key={item.href + item.label} href={item.href} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 transition hover:border-cyan-300/35 hover:bg-cyan-500/10">
                 <p className="text-sm font-black text-white">{item.label}</p>
                 <p className="mt-2 text-xs leading-5 text-slate-400">{item.body}</p>
               </Link>
             ))}
           </div>
         </div>
      </div>
    </section>
  );
}
