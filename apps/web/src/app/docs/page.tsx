import Link from "next/link";
import { BackLink } from "../../components/back-link";
import { productExitHref } from "../../components/product-exit-link";
import { PublicLinkChip } from "../../components/public-link-chip";
import { Card, SectionHeading } from "@product/ui";
import { getWebI18n } from "../../lib/locale";
import { ArrowRight, BookOpen, CircleHelp, Layers3, Rocket, ShieldCheck, Sparkles } from "lucide-react";

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
  activationTitle: string;
  activationSteps: Array<{ title: string; body: string }>;
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
  demoPage: string;
  jumpPillars: string;
  jumpChipProfiles: string;
  jumpApi: string;
  jumpRollout: string;
  jumpFaq: string;
  jumpStrategy: string;
  jumpActions: string;
  exploreTitle: string;
  exploreLinks: Array<{ label: string; href: string }>;
  openAssistant: string;
  talkAgent: string;
  bookDemo: string;
  openLab: string;
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
    activationTitle: "Playbook de activación tenant → batch → tags",
    activationSteps: [
      { title: "1. Alta del tenant", body: "Crear el tenant antes de fabricar o pilotear. Sin tenant no existe aislamiento comercial ni operativo para batches, analytics y webhooks." },
      { title: "2. Alta del batch", body: "Dar de alta el batch exacto que va a imprimir fábrica. El bid del link NDEF debe existir en la base; si no, /sun responde unknown batch." },
      { title: "3. Entrega al proveedor", body: "Compartir URL template, bid, profile, quantity y las keys del lote. El proveedor encodea usando ese spec cerrado, sin improvisar variantes." },
      { title: "4. Import manifest", body: "Cuando llegan UID/CSV, importar el manifest sobre ese mismo bid. La API rechaza archivos cuyo batch_id no coincida exactamente." },
      { title: "5. Activar tags", body: "Activar los UID importados para que un tap válido pase de NOT_REGISTERED / NOT_ACTIVE a VALID. Eso permite escalar igual para 10, 100 o millones." },
      { title: "6. UX al tocar", body: "El click/tap del link debe resolver autenticidad, estado y contexto comercial en la misma experiencia: válido, no registrado, no activo, replay o revocado." },
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
    demoPage: "Ver demo self-serve",
    jumpPillars: "Tesis",
    jumpChipProfiles: "Perfiles de chip",
    jumpApi: "API",
    jumpRollout: "Rollout",
    jumpFaq: "FAQ",
    jumpStrategy: "Strategy",
    jumpActions: "Actions",
    exploreTitle: "Conectar esta lectura con el resto del sitio",
    exploreLinks: [
      { label: "Ir al stack Verify → Passport → Rights", href: "/stack" },
      { label: "Abrir glosario operativo", href: "/glossary" },
      { label: "Ver demo y Demo Lab", href: "/demo" },
      { label: "Ver pitch por audiencia", href: "/audiences" },
    ],
    openAssistant: "Abrir BotIA",
    talkAgent: "Hablar con agente (WhatsApp)",
    bookDemo: "Agendar demo",
    openLab: "Abrir Demo Lab",
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
    activationTitle: "Playbook de ativação tenant → batch → tags",
    activationSteps: [
      { title: "1. Alta do tenant", body: "Criar o tenant antes da fabricação ou piloto. Sem tenant não existe isolamento comercial nem operacional para batches, analytics e webhooks." },
      { title: "2. Alta do batch", body: "Criar o batch exato que a fábrica vai gravar. O bid do link NDEF precisa existir no banco; caso contrário, /sun retorna unknown batch." },
      { title: "3. Handoff ao fornecedor", body: "Compartilhar URL template, bid, profile, quantity e as keys do lote. O fornecedor grava seguindo esse spec fechado, sem variantes improvisadas." },
      { title: "4. Import manifest", body: "Quando UID/CSV chegarem, importar o manifest sobre o mesmo bid. A API rejeita arquivos cujo batch_id não coincida exatamente." },
      { title: "5. Ativar tags", body: "Ativar os UID importados para que um tap válido saia de NOT_REGISTERED / NOT_ACTIVE para VALID. Isso escala igual para 10, 100 ou milhões." },
      { title: "6. UX no toque", body: "O click/tap do link deve resolver autenticidade, estado e contexto comercial na mesma experiência: válido, não registrado, não ativo, replay ou revogado." },
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
    demoPage: "Ver demo self-serve",
    jumpPillars: "Tese",
    jumpChipProfiles: "Perfis de chip",
    jumpApi: "API",
    jumpRollout: "Rollout",
    jumpFaq: "FAQ",
    jumpStrategy: "Strategy",
    jumpActions: "Actions",
    exploreTitle: "Conectar esta leitura com o restante do site",
    exploreLinks: [
      { label: "Ir para o stack Verify → Passport → Rights", href: "/stack" },
      { label: "Abrir glossário operacional", href: "/glossary" },
      { label: "Ver demo e Demo Lab", href: "/demo" },
      { label: "Ver pitch por audiência", href: "/audiences" },
    ],
    openAssistant: "Abrir BotIA",
    talkAgent: "Falar com agente (WhatsApp)",
    bookDemo: "Agendar demo",
    openLab: "Abrir Demo Lab",
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
    activationTitle: "Activation playbook: tenant → batch → tags",
    activationSteps: [
      { title: "1. Create the tenant", body: "Create the tenant before manufacturing or piloting. Without a tenant there is no commercial or operational isolation for batches, analytics and webhooks." },
      { title: "2. Create the batch", body: "Create the exact batch the factory will encode. The bid inside the NDEF link must exist in the database; otherwise /sun returns unknown batch." },
      { title: "3. Supplier handoff", body: "Share URL template, bid, profile, quantity and the batch keys. The supplier encodes against that closed spec with no ad-hoc variations." },
      { title: "4. Import manifest", body: "When UID/CSV files arrive, import the manifest into that same bid. The API rejects files whose batch_id does not match exactly." },
      { title: "5. Activate tags", body: "Activate imported UIDs so a valid tap moves from NOT_REGISTERED / NOT_ACTIVE into VALID. This keeps the same operating model for 10, 100 or millions of tags." },
      { title: "6. Tap UX", body: "The click/tap experience should resolve authenticity, operational state and commercial context together: valid, not registered, not active, replay or revoked." },
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
    demoPage: "View self-serve demo",
    jumpPillars: "Thesis",
    jumpChipProfiles: "Chip profiles",
    jumpApi: "API",
    jumpRollout: "Rollout",
    jumpFaq: "FAQ",
    jumpStrategy: "Strategy",
    jumpActions: "Actions",
    exploreTitle: "Connect this page with the rest of the site",
    exploreLinks: [
      { label: "Go to the Verify → Passport → Rights stack", href: "/stack" },
      { label: "Open the operational glossary", href: "/glossary" },
      { label: "See the demo and Demo Lab", href: "/demo" },
      { label: "View the audience pitch page", href: "/audiences" },
    ],
    openAssistant: "Open BotIA",
    talkAgent: "Talk to agent (WhatsApp)",
    bookDemo: "Book demo",
    openLab: "Open Demo Lab",
  },
};

export default async function DocsPage() {
  const { locale } = await getWebI18n();
  const copy = docsCopy[locale];

  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink />
      <SectionHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <div className="space-y-4">
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            {copy.quickJumpTitle}
          </p>
          <div className="flex flex-wrap gap-2">
            <PublicLinkChip href="#thesis" icon={<Layers3 className="h-3.5 w-3.5" />} variant="cyan">{copy.jumpPillars}</PublicLinkChip>
            <PublicLinkChip href="#chips" icon={<ShieldCheck className="h-3.5 w-3.5" />} variant="cyan">{copy.jumpChipProfiles}</PublicLinkChip>
            <PublicLinkChip href="#api" icon={<ShieldCheck className="h-3.5 w-3.5" />} variant="indigo">{copy.jumpApi}</PublicLinkChip>
            <PublicLinkChip href="#rollout" icon={<Rocket className="h-3.5 w-3.5" />} variant="emerald">{copy.jumpRollout}</PublicLinkChip>
            <PublicLinkChip href="#faq" icon={<CircleHelp className="h-3.5 w-3.5" />} variant="amber">{copy.jumpFaq}</PublicLinkChip>
            <PublicLinkChip href="#strategy" icon={<BookOpen className="h-3.5 w-3.5" />} variant="violet">{copy.jumpStrategy}</PublicLinkChip>
            <PublicLinkChip href="#actions">{copy.jumpActions}</PublicLinkChip>
          </div>
        </div>

        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{copy.exploreTitle}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {copy.exploreLinks.map((item) => (
              <PublicLinkChip key={item.href} href={item.href} size="md" trailingArrow>
                {item.label}
              </PublicLinkChip>
            ))}
          </div>
        </Card>
      </div>

      <div id="thesis" className="scroll-mt-28">
        <Card className="p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(14,165,233,0.08)]">
          <h3 className="text-lg font-semibold text-white">{copy.pillarsTitle}</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {copy.pillars.map((entry) => <li key={entry}>• {entry}</li>)}
          </ul>
        </Card>
      </div>

      <div id="chips" className="scroll-mt-28">
        <Card className="p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(14,165,233,0.08)]">
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
      </div>

      <div id="api" className="scroll-mt-28">
        <Card className="p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(99,102,241,0.10)]">
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
      </div>

      <div id="rollout" className="grid gap-6 scroll-mt-28 lg:grid-cols-2 xl:grid-cols-4">
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

      <div className="scroll-mt-28">
        <Card className="p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(16,185,129,0.10)]">
          <h3 className="text-lg font-semibold text-white">{copy.activationTitle}</h3>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {copy.activationSteps.map((step) => (
              <div key={step.title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-emerald-200">{step.title}</p>
                <p className="mt-2 text-sm text-slate-300">{step.body}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div id="faq" className="scroll-mt-28">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.faqTitle}</h3>
          <div className="mt-4 grid gap-3">
            {copy.faqItems.map((item) => (
              <details key={item.q} className="group rounded-xl border border-white/10 bg-white/5 p-3 transition-all duration-200 open:border-cyan-300/30 open:bg-cyan-500/5 hover:border-white/20">
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
      </div>

      <div id="strategy" className="scroll-mt-28">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.strategyTitle}</h3>
          <p className="mt-2 text-sm text-slate-300">{copy.strategyBody}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <PublicLinkChip href="/stack" variant="cyan" size="md" trailingArrow>{copy.stackPage}</PublicLinkChip>
            <PublicLinkChip href="/audiences" variant="indigo" size="md" trailingArrow>{copy.audiencesPage}</PublicLinkChip>
            <PublicLinkChip href="/glossary" variant="emerald" size="md" trailingArrow>{copy.glossaryPage}</PublicLinkChip>
            <PublicLinkChip href="/demo" variant="amber" size="md" trailingArrow>{copy.demoPage}</PublicLinkChip>
          </div>
        </Card>
      </div>


      <div id="actions" className="scroll-mt-28">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.actionsTitle}</h3>
          <div className="mt-4 flex flex-wrap gap-3">
            <PublicLinkChip href="/?assistant=open" variant="cyan" size="md" trailingArrow>{copy.openAssistant}</PublicLinkChip>
            <PublicLinkChip href={productExitHref.demoLab} size="md" trailingArrow>{copy.openLab}</PublicLinkChip>
            <a className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-100" href="https://wa.me/5492613168608" target="_blank" rel="noreferrer">{copy.talkAgent}</a>
            <Link className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 transition-transform duration-200 hover:-translate-y-0.5" href="/?contact=demo#contact-modal">{copy.bookDemo}<ArrowRight className="h-4 w-4" /></Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
