import Link from "next/link";
import { BackLink } from "../../components/back-link";
import { Card, SectionHeading } from "@product/ui";
import { getWebI18n } from "../../lib/locale";

type DocsCopy = {
  eyebrow: string;
  title: string;
  description: string;
  pillarsTitle: string;
  pillars: string[];
  chipTitle: string;
  chipRows: Array<{ chip: string; bestFor: string; avoid: string }>;
  apiTitle: string;
  apiIntro: string;
  apiRoutes: Array<{ method: string; path: string; detail: string }>;
  packsTitle: string;
  packs: string[];
  rolloutTitle: string;
  rolloutBullets: string[];
  revenueTitle: string;
  revenueBullets: string[];
  roadmapTitle: string;
  roadmapBullets: string[];
  actionsTitle: string;
  quickJumpTitle: string;
  faqTitle: string;
  faqItems: Array<{ q: string; a: string }>;
  strategyTitle: string;
  strategyBody: string;
  stackPage: string;
  audiencesPage: string;
  glossaryPage: string;
  openAssistant: string;
  talkAgent: string;
  bookDemo: string;
};

const docsCopy: Record<"es-AR" | "pt-BR" | "en", DocsCopy> = {
  "es-AR": {
    eyebrow: "Docs comercial + técnica",
    title: "nexID = infraestructura de identidad física verificable",
    description: "No vendemos chips sueltos: vendemos emisión, verificación y analítica de eventos físicos para productos, accesos y documentos.",
    pillarsTitle: "Tesis de producto",
    pillars: [
      "Línea BASIC (NTAG215): volumen, UX por toque, activaciones y control operativo.",
      "Línea SECURE (NTAG 424 DNA / TagTamper): autenticidad fuerte, anti-clone, tamper y evidencia verificable.",
      "nexID OS: issuance + verification API + dashboard + webhooks + canal reseller/white-label.",
      "Arquitectura marker-agnostic: NFC + QR fallback desde el diseño para escalar adopción.",
    ],
    chipTitle: "Qué vender con cada chip (sin humo)",
    chipRows: [
      { chip: "NTAG215", bestFor: "Eventos, activaciones, warranties, loyalty, lead capture, tap-to-web.", avoid: "No prometer antifraude premium ni voucher monetario sensible." },
      { chip: "NTAG 424 DNA", bestFor: "Autenticidad fuerte, SUN/SDM, documentos, vouchers seguros, control de canal.", avoid: "No venderlo como sensor de temperatura/cold-chain por sí solo." },
      { chip: "NTAG 424 DNA TagTamper", bestFor: "Integridad física de cierre/sello: wine, cosmética premium, pharma packaging.", avoid: "No usarlo donde no importa estado físico del empaque." },
    ],
    apiTitle: "API enterprise para operación real",
    apiIntro: "Rutas para salud, validación criptográfica, CRM comercial, Demo Lab y orquestación multi-tenant.",
    apiRoutes: [
      { method: "GET", path: "/health", detail: "Estado del backend para uptime checks." },
      { method: "GET", path: "/sun", detail: "Validación SDM/SUN para tags seguros." },
      { method: "POST", path: "/assistant/chat", detail: "BotIA comercial: captura leads, tickets y pedidos." },
      { method: "GET/POST", path: "/admin/leads", detail: "CRM-lite para super-admin y pipeline comercial." },
      { method: "POST", path: "/internal/demo/use-pack", detail: "Carga packs por vertical para demos y ventas." },
      { method: "POST", path: "/internal/demo/simulate-tap", detail: "Simula tap NFC y estado autenticado/tamper." },
    ],
    packsTitle: "Packs priorizados para vender ya",
    packs: [
      "1) Wine Secure (wedge premium de mayor claridad comercial).",
      "2) Events Basic + Events Secure (volumen + moat en el mismo vertical).",
      "3) Docs & Presence Secure (credenciales, certificados y evidencia física).",
      "Expansión inmediata: Cosmetics Secure. Expansión regulatoria: exportadores DPP-ready.",
    ],
    rolloutTitle: "Estándar operativo para pilotos y rollouts serios",
    rolloutBullets: [
      "Crear batch por cliente/campaña con batch_id, SKU, cantidad esperada y perfil de seguridad definidos.",
      "Entregar al proveedor un spec cerrado: chip, URL template, key ownership, formato CSV manifest y criterio de activación.",
      "Importar manifest solo si el batch_id del archivo coincide exactamente con el batch creado en plataforma.",
      "Operar estados planned / imported / active para detectar diferencias antes de escalar a 10k/50k unidades.",
    ],
    revenueTitle: "Modelo de ingresos (lo que entiende un inversor)",
    revenueBullets: [
      "Setup/Pilot fee: discovery, diseño de caso, onboarding y activación.",
      "Hardware margin: tags/inlays/cards/seals como capa, no como core.",
      "SaaS/usage: verificaciones, ownership, alertas, analítica y automatizaciones.",
      "Channel/white-label: rev-share y operación partner multi-tenant.",
    ],
    roadmapTitle: "Roadmap técnico (sin sobreprometer)",
    roadmapBullets: [
      "Hoy: NTAG215 + NTAG 424 DNA/TagTamper.",
      "Siguiente fase: middle tier con StatusDetect para casos de estado/sensing battery-free.",
      "Siempre: NFC + QR fallback + data model DPP-ready.",
    ],
    actionsTitle: "Siguientes pasos",
    quickJumpTitle: "Explorar rápido",
    faqTitle: "FAQ corta para explicar bien el producto",
    faqItems: [
      { q: "¿nexID vende chips NFC?", a: "No. nexID vende infraestructura para emitir, validar y operar identidades físicas verificables usando carriers como NFC y QR." },
      { q: "¿Sirve solo para antifraude?", a: "No. También habilita ownership, acceso, garantías, vouchers, trazabilidad y analytics." },
      { q: "¿Tokenización y autenticación son lo mismo?", a: "No. La autenticación prueba el objeto; la tokenización digitaliza derechos sobre ese objeto." },
      { q: "¿Se puede usar con QR?", a: "Sí. Un backend único puede operar NFC y QR como fallback según cada contexto." },
      { q: "¿Sirve solo para vino?", a: "No. También aplica a eventos, documentos, credenciales, cosmética, lujo y sector público." },
    ],
    strategyTitle: "Guías estratégicas nuevas",
    strategyBody: "Sumamos dos páginas para explicar la diferencia entre antifraude, passport y derechos programables, y para adaptar el pitch según cada comprador.",
    stackPage: "Ver pila Verify → Passport → Rights",
    audiencesPage: "Ver pitch por audiencia (inversor, reseller, cliente, gobierno)",
    glossaryPage: "Abrir glosario operativo de marca",
    openAssistant: "Abrir BotIA",
    talkAgent: "Hablar con agente (WhatsApp)",
    bookDemo: "Agendar demo",
  },
  "pt-BR": {
    eyebrow: "Docs comercial + técnica",
    title: "nexID = infraestrutura de identidade física verificável",
    description: "Não vendemos chips isolados: vendemos emissão, verificação e analytics de eventos físicos.",
    pillarsTitle: "Tese de produto",
    pillars: [
      "Linha BASIC (NTAG215): volume, UX por toque e operação.",
      "Linha SECURE (NTAG 424 DNA / TagTamper): autenticidade forte e evidência verificável.",
      "nexID OS: issuance + verification API + dashboard + webhooks + canal revenda.",
      "Arquitetura marker-agnostic: NFC + fallback QR para escala.",
    ],
    chipTitle: "O que vender com cada chip",
    chipRows: [
      { chip: "NTAG215", bestFor: "Eventos, ativações, warranty, loyalty e tap-to-web.", avoid: "Não prometer antifraude premium." },
      { chip: "NTAG 424 DNA", bestFor: "Autenticidade forte, SUN/SDM, documentos e vouchers sensíveis.", avoid: "Não vender como sensor de temperatura sozinho." },
      { chip: "NTAG 424 DNA TagTamper", bestFor: "Selo/fecho com integridade física: vinho, cosméticos premium e pharma.", avoid: "Não usar quando estado físico da embalagem não importa." },
    ],
    apiTitle: "API enterprise para operação",
    apiIntro: "Rotas para saúde, validação criptográfica, CRM comercial e Demo Lab multi-tenant.",
    apiRoutes: [
      { method: "GET", path: "/health", detail: "Saúde do backend para uptime." },
      { method: "GET", path: "/sun", detail: "Validação SDM/SUN para tags seguras." },
      { method: "POST", path: "/assistant/chat", detail: "BotIA comercial para leads/tickets/pedidos." },
      { method: "GET/POST", path: "/admin/leads", detail: "CRM-lite para super-admin." },
      { method: "POST", path: "/internal/demo/use-pack", detail: "Carrega packs verticais para demo comercial." },
      { method: "POST", path: "/internal/demo/simulate-tap", detail: "Simula tap NFC e estados autenticados." },
    ],
    packsTitle: "Packs priorizados",
    packs: [
      "1) Wine Secure.",
      "2) Events Basic + Events Secure.",
      "3) Docs & Presence Secure.",
      "Expansão imediata: Cosmetics Secure. Expansão regulatória: exportadores DPP-ready.",
    ],
    rolloutTitle: "Padrão operacional para pilotos e rollouts sérios",
    rolloutBullets: [
      "Criar batch por cliente/campanha com batch_id, SKU, volume esperado e perfil de segurança definidos.",
      "Enviar ao fornecedor um spec fechado: chip, URL template, ownership das keys, formato CSV manifest e critério de ativação.",
      "Importar manifest apenas se o batch_id do arquivo coincidir exatamente com o batch criado na plataforma.",
      "Operar estados planned / imported / active para detectar diferenças antes de escalar para 10k/50k unidades.",
    ],
    revenueTitle: "Modelo de receita",
    revenueBullets: [
      "Setup/Pilot fee.",
      "Margem de hardware.",
      "SaaS/usage recorrente.",
      "Canal white-label com rev-share.",
    ],
    roadmapTitle: "Roadmap técnico",
    roadmapBullets: [
      "Hoje: NTAG215 + NTAG 424 DNA/TagTamper.",
      "Próxima fase: middle tier com StatusDetect.",
      "Sempre: NFC + fallback QR + modelo DPP-ready.",
    ],
    actionsTitle: "Próximos passos",
    quickJumpTitle: "Explorar rápido",
    faqTitle: "FAQ curta para explicar o produto",
    faqItems: [
      { q: "A nexID vende chips NFC?", a: "Não. A nexID vende infraestrutura para emitir, validar e operar identidades físicas verificáveis com NFC e QR." },
      { q: "Serve só para antifraude?", a: "Não. Também habilita ownership, acesso, garantia, vouchers, rastreabilidade e analytics." },
      { q: "Tokenização e autenticação são iguais?", a: "Não. Autenticação valida o objeto; tokenização digitaliza direitos sobre ele." },
      { q: "Pode usar com QR?", a: "Sim. Um backend único opera NFC e QR como fallback." },
      { q: "Serve só para vinho?", a: "Não. Também aplica a eventos, documentos, credenciais, cosméticos, luxo e governo." },
    ],
    strategyTitle: "Novos guias estratégicos",
    strategyBody: "Adicionamos duas páginas para separar antifraude, passport e direitos programáveis e adaptar a narrativa por comprador.",
    stackPage: "Ver pilha Verify → Passport → Rights",
    audiencesPage: "Ver pitch por audiência (investidor, revendedor, cliente, governo)",
    glossaryPage: "Abrir glossário operacional de marca",
    openAssistant: "Abrir BotIA",
    talkAgent: "Falar com agente (WhatsApp)",
    bookDemo: "Agendar demo",
  },
  en: {
    eyebrow: "Commercial + technical docs",
    title: "nexID = verifiable physical identity infrastructure",
    description: "We do not sell raw NFC chips; we sell issuance, verification and analytics for physical events.",
    pillarsTitle: "Product thesis",
    pillars: [
      "BASIC line (NTAG215): volume UX and operational control.",
      "SECURE line (NTAG 424 DNA / TagTamper): strong authenticity and tamper-aware trust.",
      "nexID OS: issuance + verification API + dashboard + webhooks + reseller channel.",
      "Marker-agnostic architecture: NFC + QR fallback from day one.",
    ],
    chipTitle: "What to sell with each chip",
    chipRows: [
      { chip: "NTAG215", bestFor: "Events, activations, loyalty, warranties, tap-to-web.", avoid: "Do not position as premium anti-fraud." },
      { chip: "NTAG 424 DNA", bestFor: "Strong authenticity, SUN/SDM, secure vouchers and docs.", avoid: "Do not claim native cold-chain sensing." },
      { chip: "NTAG 424 DNA TagTamper", bestFor: "Packaging integrity use cases where open/closed matters.", avoid: "Do not force into rigid credentials where tamper loop adds little value." },
    ],
    apiTitle: "Enterprise API",
    apiIntro: "Routes for health, cryptographic validation, CRM capture, and demo orchestration.",
    apiRoutes: [
      { method: "GET", path: "/health", detail: "Backend health and uptime checks." },
      { method: "GET", path: "/sun", detail: "SDM/SUN secure validation endpoint." },
      { method: "POST", path: "/assistant/chat", detail: "Sales BotIA for leads/tickets/orders." },
      { method: "GET/POST", path: "/admin/leads", detail: "CRM-lite pipeline for super-admin." },
      { method: "POST", path: "/internal/demo/use-pack", detail: "Load vertical demo packs." },
      { method: "POST", path: "/internal/demo/simulate-tap", detail: "Simulate NFC taps and trust state." },
    ],
    packsTitle: "Prioritized sellable packs",
    packs: [
      "1) Wine Secure.",
      "2) Events Basic + Events Secure.",
      "3) Docs & Presence Secure.",
      "Immediate expansion: Cosmetics Secure. Regulatory expansion: DPP-ready exporters.",
    ],
    rolloutTitle: "Operational standard for serious pilots and rollouts",
    rolloutBullets: [
      "Create one batch per customer/campaign with batch_id, SKU, expected volume and security profile defined up front.",
      "Give suppliers a closed spec: chip, URL template, key ownership, CSV manifest format and activation criteria.",
      "Import manifests only when the file batch_id exactly matches the batch created in platform.",
      "Track planned / imported / active states to catch supplier mismatches before scaling to 10k/50k units.",
    ],
    revenueTitle: "Revenue model",
    revenueBullets: [
      "Setup/Pilot fee.",
      "Hardware margin.",
      "Recurring SaaS/usage.",
      "White-label channel rev-share.",
    ],
    roadmapTitle: "Technical roadmap",
    roadmapBullets: [
      "Now: NTAG215 + NTAG 424 DNA/TagTamper.",
      "Next: middle tier with StatusDetect capabilities.",
      "Always: NFC + QR fallback + DPP-ready data model.",
    ],
    actionsTitle: "Next steps",
    quickJumpTitle: "Quick explore",
    faqTitle: "Short FAQ to make the value clear",
    faqItems: [
      { q: "Does nexID sell NFC chips?", a: "No. nexID delivers infrastructure to issue, verify and operate physical digital identities using NFC and QR carriers." },
      { q: "Is this only anti-fraud?", a: "No. It also enables ownership, access, warranty, vouchers, traceability and analytics." },
      { q: "Are tokenization and authentication the same?", a: "No. Authentication proves the object; tokenization digitizes rights on top of that object." },
      { q: "Can it work with QR?", a: "Yes. A single backend can run NFC plus QR fallback." },
      { q: "Is this only for wine?", a: "No. It also fits events, documents, credentials, cosmetics, luxury and public sector workflows." },
    ],
    strategyTitle: "New strategic guides",
    strategyBody: "We added two pages to clearly separate anti-fraud, passport and programmable rights, and to tailor the pitch by buyer profile.",
    stackPage: "View Verify → Passport → Rights stack",
    audiencesPage: "View audience pitch (investor, reseller, client, government)",
    glossaryPage: "Open operational brand glossary",
    openAssistant: "Open BotIA",
    talkAgent: "Talk to agent (WhatsApp)",
    bookDemo: "Book demo",
  },
};

export default async function DocsPage() {
  const { locale } = await getWebI18n();
  const copy = docsCopy[locale];

  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink />
      <SectionHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <div className="flex flex-wrap gap-2">
        <a href="#thesis" className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100">{copy.pillarsTitle}</a>
        <a href="#api" className="rounded-full border border-indigo-300/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-100">{copy.apiTitle}</a>
        <a href="#rollout" className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100">{copy.rolloutTitle}</a>
        <a href="#faq" className="rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100">{copy.faqTitle}</a>
        <a href="#strategy" className="rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-100">{copy.strategyTitle}</a>
      </div>

      <Card id="thesis" className="p-6 transition-transform duration-200 hover:-translate-y-1">
        <h3 className="text-lg font-semibold text-white">{copy.pillarsTitle}</h3>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {copy.pillars.map((entry) => <li key={entry}>• {entry}</li>)}
        </ul>
      </Card>

      <Card className="p-6 transition-transform duration-200 hover:-translate-y-1">
        <h3 className="text-lg font-semibold text-white">{copy.chipTitle}</h3>
        <div className="mt-4 grid gap-3">
          {copy.chipRows.map((row) => (
            <div key={row.chip} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-sm font-semibold text-cyan-200">{row.chip}</p>
              <p className="mt-1 text-sm text-slate-300">✓ {row.bestFor}</p>
              <p className="mt-1 text-sm text-rose-300">⚠ {row.avoid}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card id="api" className="p-6 transition-transform duration-200 hover:-translate-y-1">
        <h3 className="text-lg font-semibold text-white">{copy.apiTitle}</h3>
        <p className="mt-2 text-sm text-slate-300">{copy.apiIntro}</p>
        <div className="mt-4 space-y-3">
          {copy.apiRoutes.map((route) => (
            <div key={`${route.method}-${route.path}`} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <p className="font-semibold text-cyan-200">{route.method} <span className="text-white">{route.path}</span></p>
              <p className="mt-1 text-slate-300">{route.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <div id="rollout" className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.packsTitle}</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">{copy.packs.map((item) => <li key={item}>• {item}</li>)}</ul>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.rolloutTitle}</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">{copy.rolloutBullets.map((item) => <li key={item}>• {item}</li>)}</ul>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.revenueTitle}</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">{copy.revenueBullets.map((item) => <li key={item}>• {item}</li>)}</ul>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.roadmapTitle}</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">{copy.roadmapBullets.map((item) => <li key={item}>• {item}</li>)}</ul>
        </Card>
      </div>


      <Card id="faq" className="p-6 scroll-mt-28">
        <h3 className="text-lg font-semibold text-white">{copy.faqTitle}</h3>
        <div className="mt-4 grid gap-3">
          {copy.faqItems.map((item) => (
            <details key={item.q} className="group rounded-xl border border-white/10 bg-white/5 p-3 transition-colors open:border-cyan-300/30 open:bg-cyan-500/5">
              <summary className="cursor-pointer list-none text-sm font-semibold text-white">
                <span className="inline-flex items-center gap-2">
                  <span className="text-cyan-300 transition-transform group-open:rotate-45">＋</span>{item.q}
                </span>
              </summary>
              <p className="mt-3 text-sm text-slate-300">{item.a}</p>
            </details>
          ))}
        </div>
      </Card>

      <Card id="strategy" className="p-6 scroll-mt-28">
        <h3 className="text-lg font-semibold text-white">{copy.strategyTitle}</h3>
        <p className="mt-2 text-sm text-slate-300">{copy.strategyBody}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link className="rounded-lg border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-sm text-cyan-100" href="/stack">{copy.stackPage}</Link>
          <Link className="rounded-lg border border-indigo-300/35 bg-indigo-500/15 px-4 py-2 text-sm text-indigo-100" href="/audiences">{copy.audiencesPage}</Link>
          <Link className="rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100" href="/glossary">{copy.glossaryPage}</Link>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white">{copy.actionsTitle}</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link className="rounded-lg border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-sm text-cyan-100" href="/?assistant=open">{copy.openAssistant}</Link>
          <a className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-100" href="https://wa.me/5492613168608" target="_blank" rel="noreferrer">{copy.talkAgent}</a>
          <Link className="rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100" href="/?contact=demo#contact-modal">{copy.bookDemo}</Link>
        </div>
      </Card>
    </main>
  );
}
