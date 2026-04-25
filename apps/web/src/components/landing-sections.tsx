import { Card, SectionHeading, Badge, Button, WorldMapRealtime } from "@product/ui";
import Link from "next/link";

type Content = any;

export function HeroSection({ content, stats, locale }: { content: Content; stats: any; locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";

  const trustBadge = isEn ? "Enterprise Trusted" : isBr ? "Confiabilidade Corporativa" : "Confianza Enterprise";

  return (
    <section className="relative overflow-hidden border-b border-white/5 bg-slate-950 pb-20 pt-28 lg:pb-32 lg:pt-40">
      {/* Stripe-level Animated Background Glow */}
      <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] w-[800px] h-[500px] bg-cyan-500/20 blur-[120px] rounded-[100%] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute top-[30%] left-[20%] w-[600px] h-[600px] bg-violet-600/10 blur-[100px] rounded-[100%] animate-pulse" style={{ animationDuration: '8s' }} />
      </div>

      <div className="container-shell relative z-10">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md transition-colors hover:bg-white/10">
             <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
             <span className="text-xs font-medium text-slate-300 uppercase tracking-widest">{trustBadge}</span>
          </div>

          <h1 className="mt-8 text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 sm:text-6xl lg:text-7xl">
            {content.hero.title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400 sm:text-xl">
            {content.hero.subtitle}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/?contact=demo#contact-modal" className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-6 py-3.5 text-sm font-bold text-slate-950 transition-transform hover:scale-105 hover:bg-cyan-400">
              {content.hero.cta.primary}
            </Link>
            <Link href="/docs" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-slate-900/50 backdrop-blur-md px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-white/10">
              {content.hero.cta.secondary}
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-4 border-t border-white/10 pt-10 md:grid-cols-4">
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
      </Card>
    </section>
  );
}

export function PlansSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-20">
      <SectionHeading eyebrow={content.plans.eyebrow} title={content.plans.title} description={content.plans.description} />
      <div className="mt-12 grid gap-6 xl:grid-cols-3">
        {content.plans.cards.map((plan: any) => {
           const isPremium = plan.name.includes("ENTERPRISE") || plan.name.includes("PRO");
           return (
             <Card key={plan.name} className={`relative p-8 overflow-hidden transition-transform duration-300 hover:-translate-y-2 ${isPremium ? 'border-cyan-500/30 bg-slate-900/80 shadow-[0_0_40px_rgba(6,182,212,0.1)]' : 'border-white/5 bg-slate-900/40'}`}>
               {isPremium && <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 blur-[50px] rounded-full pointer-events-none" />}
               <div className="mb-6 inline-block"><Badge tone={isPremium ? "cyan" : "default"}>{plan.badge}</Badge></div>
               <h3 className="text-3xl font-bold text-white tracking-tight">{plan.name}</h3>
               <p className="mt-2 text-sm font-medium text-cyan-300">{plan.price}</p>
               <p className="mt-4 text-sm leading-6 text-slate-400">{plan.body}</p>
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

export function UseCasesSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={content.useCases.eyebrow} title={content.useCases.title} description={content.useCases.description} />
      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {content.useCases.cards.map((item: any) => (
          <Card key={item.title} className="p-6 backdrop-blur-xl border border-white/5 bg-slate-900/50 shadow-lg hover:border-cyan-500/30 hover:-translate-y-1 transition-all duration-300 group">
            <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">{item.title}</h3>
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

export function CtaSection({ content }: { content: Content }) {
  return (
    <section className="container-shell py-24">
      <div className="relative rounded-[2rem] border border-cyan-500/20 bg-slate-900/80 overflow-hidden shadow-[0_0_80px_rgba(6,182,212,0.15)]">
         <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10 pointer-events-none" />
         <div className="relative px-6 py-16 md:py-24 text-center z-10">
           <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-6">{content.cta.title}</h2>
           <p className="mx-auto max-w-2xl text-lg text-slate-400 mb-10">{content.cta.body}</p>
           <div className="flex flex-wrap justify-center gap-4">
             <Link href="/?contact=demo#contact-modal" className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-sm font-bold text-slate-950 transition hover:bg-slate-200 hover:scale-105 shadow-xl">
                {content.cta.primary}
             </Link>
             <Link href="/?contact=sales#contact-modal" className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-8 py-4 text-sm font-semibold text-white transition hover:bg-white/10">
                {content.cta.secondary}
             </Link>
           </div>
         </div>
      </div>
    </section>
  );
}
