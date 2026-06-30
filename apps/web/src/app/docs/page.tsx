import Link from "next/link";
import { BackLink } from "../../components/back-link";
import { ProductExitLink, productExitHref } from "../../components/product-exit-link";
import { PublicLinkChip } from "../../components/public-link-chip";
import { Card, SectionHeading } from "@product/ui";
import { getWebI18n } from "../../lib/locale";
import { legacyInstitutionalVideo } from "../../lib/institutional-video";
import { ArrowRight, BookOpen, CircleHelp, Layers3, Rocket, ShieldCheck, Sparkles } from "lucide-react";

type DocsCopy = {
  eyebrow: string;
  title: string;
  description: string;
  simpleFlowEyebrow: string;
  simpleFlowTitle: string;
  simpleFlowBody: string;
  simpleFlow: string[];
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
  trustOpsTitle: string;
  trustOpsBullets: string[];
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
    eyebrow: "Guia comercial + producto",
    title: "nexID explicado sin jerga: producto real, confianza y postventa en un solo toque",
    description: "No vendemos chips sueltos ni blockchain como moda. Creamos una capa de confianza para que cada producto pueda mostrar evidencia de autenticidad, origen y estado, y habilitar garantías, beneficios, certificados digitales o propiedad digital cuando la política lo permite.",
    simpleFlowEyebrow: "Arquitectura simple",
    simpleFlowTitle: "La arquitectura en una frase",
    simpleFlowBody: "Un producto físico recibe una identidad digital; cada toque ejecuta reglas de confianza, cuenta su historia y abre el siguiente paso comercial seguro si corresponde.",
    simpleFlow: [
      "Producto + lote + fotos reales",
      "NFC o QR seguro",
      "Tap con resultado claro",
      "Pasaporte, garantía, beneficios y certificado",
    ],
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
    apiIntro: "Rutas para salud, validación criptográfica, CRM comercial, eventos operativos y orquestación multi-tenant.",
    apiRoutes: [
      { method: "GET", path: "/health", detail: "Estado del backend para uptime checks." },
      { method: "GET", path: "Passport validation", detail: "Validación SDM/SUN para tags seguros; endpoint exacto redacted en documentación pública." },
      { method: "POST", path: "/assistant/chat", detail: "BotIA comercial: captura leads, tickets y pedidos." },
      { method: "GET/POST", path: "Private CRM endpoint", detail: "CRM-lite para super-admin y pipeline comercial; ruta interna no publicada." },
      { method: "POST", path: "Sandbox pack loader", detail: "Carga paquetes verticales en ambiente sandbox controlado." },
      { method: "POST", path: "Sandbox validation runner", detail: "Ejecuta una validación NFC simulada para QA comercial, sin tratarla como evidencia productiva." },
    ],
    packsTitle: "Packs priorizados para adopción",
    packs: [
      "1) Wine Secure (wedge premium de mayor claridad comercial).",
      "2) Events Basic + Events Secure (volumen + moat en el mismo vertical).",
      "3) Docs & Presence Secure (credenciales, certificados y evidencia física).",
      "Expansión inmediata: Cosmetics Secure. Expansión regulatoria: exportadores DPP-ready.",
    ],
    rolloutTitle: "Estándar operativo para pilotos y rollouts serios",
    rolloutBullets: [
      "Crear batch por cliente/campaña con batch_id, SKU, cantidad esperada y perfil de seguridad definidos.",
      "Entregar al proveedor un spec cerrado: chip, URL template, custodia de claves, formato CSV manifest, banco visual (image_url/label_image_url/model_url/gallery_urls) y criterio de activación.",
      "Importar manifest solo si el batch_id del archivo coincide exactamente con el batch creado en plataforma.",
      "Operar estados planned / imported / active para detectar diferencias antes de escalar a 10k/50k unidades.",
    ],
    revenueTitle: "Modelo de ingresos (lo que entiende un inversor)",
    revenueBullets: [
      "Setup/Pilot fee: discovery, diseño de caso, onboarding y activación.",
      "Hardware margin: tags/inlays/cards/seals como capa, no como core.",
      "SaaS/usage: verificaciones, certificados, claims, alertas, analítica y automatizaciones.",
      "Channel/white-label: rev-share y operación multi-tenant para distribuidores.",
    ],
    roadmapTitle: "Roadmap técnico (sin sobreprometer)",
    roadmapBullets: [
      "Hoy: NTAG215 + NTAG 424 DNA/TagTamper.",
      "Siguiente fase: middle tier con StatusDetect para casos de estado/sensing battery-free.",
      "Siempre: NFC + QR fallback + data model DPP-ready.",
    ],
    trustOpsTitle: "Capa de confianza enterprise",
    trustOpsBullets: [
      "Polygon se usa para propiedad digital, NFT/certificado, claims y transferencias; no para escribir cada tap.",
      "IOTA es una capa probatoria opcional para hashes, Merkle roots, DPP y evidencia logística.",
      "Supplier Encoding Pack entrega claves de encoding solo por sub-batch y canal cifrado; fábrica nunca recibe KMS ni database URLs.",
      "Tenant Vault muestra evidencia, manifest, QA y hashes; no muestra secretos internos.",
    ],
    actionsTitle: "Siguientes pasos",
    quickJumpTitle: "Explorar rápido",
    faqTitle: "FAQ corta para explicar bien el producto",
    faqItems: [
      { q: "¿Qué problema resuelve para una marca premium?", a: "Permite mostrar evidencia de confianza por unidad, saber dónde se valida, reducir fraude, recuperar datos propios del consumidor y abrir una relación postventa después de la compra." },
      { q: "¿Qué ve el consumidor final?", a: "Una pantalla simple: resultado de confianza, origen, lote, estado del sello, garantía, beneficios y, si corresponde, certificado digital o propiedad digital." },
      { q: "Como se empieza sin hacer un proyecto enorme?", a: "Con un piloto sobre una línea, lote o edición: banco de fotos, reglas de claim, tags o QR, portal mobile, dashboard y métricas de uso." },
      { q: "¿nexID vende chips NFC?", a: "No. nexID vende infraestructura para emitir, validar y operar identidades físicas verificables usando carriers como NFC y QR." },
      { q: "¿Sirve solo para antifraude?", a: "No. También habilita propiedad digital, acceso, garantías, vouchers, trazabilidad y analytics." },
      { q: "¿Tokenización y autenticación son lo mismo?", a: "No. La autenticación prueba el objeto; la tokenización digitaliza derechos sobre ese objeto." },
      { q: "¿Se puede usar con QR?", a: "Sí. Un backend único puede operar NFC y QR como fallback según cada contexto." },
      { q: "¿Sirve solo para vino?", a: "No. También aplica a eventos, documentos, credenciales, cosmética, lujo y sector público." },
    ],
    strategyTitle: "Guías estratégicas nuevas",
    strategyBody: "Sumamos dos páginas para explicar la diferencia entre antifraude, passport y derechos programables, y para adaptar el pitch según cada comprador.",
    stackPage: "Ver pila Verify → Passport → Rights",
    audiencesPage: "Ver pitch por audiencia (inversor, reseller, cliente, gobierno)",
    glossaryPage: "Abrir glosario operativo de marca",
    demoPage: "Ver entorno guiado",
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
      { label: "Ver entorno guiado", href: "/demo" },
      { label: "Ver pitch por audiencia", href: "/audiences" },
    ],
    openAssistant: "Abrir BotIA",
    talkAgent: "Hablar con agente (WhatsApp)",
    bookDemo: "Agendar demo",
    openLab: "Abrir laboratorio",
  },
  "pt-BR": {
    eyebrow: "Docs comercial + técnica",
    title: "nexID = infraestrutura de identidade física verificável",
    description: "Não vendemos chips isolados: vendemos emissão, verificação e analytics de eventos físicos.",
    simpleFlowEyebrow: "Arquitetura simples",
    simpleFlowTitle: "A arquitetura em uma frase",
    simpleFlowBody: "Um produto físico recebe uma identidade digital; cada toque valida se é real, conta sua história e abre o próximo passo comercial seguro.",
    simpleFlow: [
      "Produto + lote + fotos reais",
      "NFC ou QR seguro",
      "Toque com resultado claro",
      "Passaporte, garantia, benefícios e certificado",
    ],
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
    apiIntro: "Rotas para saúde, validação criptográfica, CRM comercial, eventos operacionais e orquestração multi-tenant.",
    apiRoutes: [
      { method: "GET", path: "/health", detail: "Saúde do backend para uptime." },
      { method: "GET", path: "Passport validation", detail: "Validação SDM/SUN para tags seguras; endpoint exato redacted na documentação pública." },
      { method: "POST", path: "/assistant/chat", detail: "BotIA comercial para leads/tickets/pedidos." },
      { method: "GET/POST", path: "Private CRM endpoint", detail: "CRM-lite para super-admin; rota interna não publicada." },
      { method: "POST", path: "Sandbox pack loader", detail: "Carrega pacotes verticais em ambiente sandbox controlado." },
      { method: "POST", path: "Sandbox validation runner", detail: "Executa validação NFC simulada para QA comercial, sem tratá-la como evidência produtiva." },
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
      "Enviar ao fornecedor um spec fechado: chip, URL template, custódia de chaves, formato CSV manifest, banco visual (image_url/label_image_url/model_url/gallery_urls) e critério de ativação.",
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
    trustOpsTitle: "Camada de confiança enterprise",
    trustOpsBullets: [
      "Polygon é usado para titularidade digital, NFT/certificado, claims e transferências; não para registrar cada toque.",
      "IOTA é uma camada probatória opcional para hashes, Merkle roots, DPP e evidência logística.",
      "Supplier Encoding Pack entrega chaves de encoding apenas por sub-batch e canal cifrado; fábrica nunca recebe KMS nem database URLs.",
      "Tenant Vault mostra evidência, manifest, QA e hashes; não mostra segredos internos.",
    ],
    actionsTitle: "Próximos passos",
    quickJumpTitle: "Explorar rápido",
    faqTitle: "FAQ curta para explicar o produto",
    faqItems: [
      { q: "Que problema resolve para uma marca premium?", a: "Permite demonstrar que uma unidade e real, saber onde foi validada, reduzir fraude, recuperar dados proprios do consumidor e abrir uma relacao pos-venda depois da compra." },
      { q: "O que o consumidor final vê?", a: "Uma tela simples: produto autêntico, origem, lote, estado do lacre, garantia, benefícios e, quando fizer sentido, certificado digital ou titularidade digital." },
      { q: "Como começar sem um projeto enorme?", a: "Com um piloto em uma linha, lote ou edição: banco de fotos, regras de claim, tags ou QR, portal mobile, dashboard e métricas de uso." },
      { q: "A nexID vende chips NFC?", a: "Não. A nexID vende infraestrutura para emitir, validar e operar identidades físicas verificáveis com NFC e QR." },
      { q: "Serve só para antifraude?", a: "Não. Também habilita titularidade digital, acesso, garantia, vouchers, rastreabilidade e analytics." },
      { q: "Tokenização e autenticação são iguais?", a: "Não. Autenticação valida o objeto; tokenização digitaliza direitos sobre ele." },
      { q: "Pode usar com QR?", a: "Sim. Um backend único opera NFC e QR como fallback." },
      { q: "Serve só para vinho?", a: "Não. Também aplica a eventos, documentos, credenciais, cosméticos, luxo e governo." },
    ],
    strategyTitle: "Novos guias estratégicos",
    strategyBody: "Adicionamos duas páginas para separar antifraude, passport e direitos programáveis e adaptar a narrativa por comprador.",
    stackPage: "Ver pilha Verify → Passport → Rights",
    audiencesPage: "Ver pitch por audiência (investidor, revendedor, cliente, governo)",
    glossaryPage: "Abrir glossário operacional de marca",
    demoPage: "Ver ambiente guiado",
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
      { label: "Ver ambiente guiado", href: "/demo" },
      { label: "Ver pitch por audiência", href: "/audiences" },
    ],
    openAssistant: "Abrir BotIA",
    talkAgent: "Falar com agente (WhatsApp)",
    bookDemo: "Agendar demo",
    openLab: "Abrir laboratório",
  },
  en: {
    eyebrow: "Commercial + product guide",
    title: "nexID without jargon: real products, trust and after-sales in one tap",
    description: "We do not sell loose chips or blockchain as a trend. We create a layer for each product to prove authenticity, show origin, activate warranty, benefits, data and a digital certificate.",
    simpleFlowEyebrow: "Simple architecture",
    simpleFlowTitle: "Architecture in one sentence",
    simpleFlowBody: "A physical product receives a digital identity; each tap checks if it is real, tells its story and opens the next safe commercial step.",
    simpleFlow: [
      "Product + batch + real photos",
      "Secure NFC or QR",
      "Tap with a clear result",
      "Passport, warranty, benefits and certificate",
    ],
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
    apiIntro: "Routes for health, cryptographic validation, CRM capture, operational events and multi-tenant orchestration.",
    apiRoutes: [
      { method: "GET", path: "/health", detail: "Backend health and uptime checks." },
      { method: "GET", path: "Passport validation", detail: "SDM/SUN secure validation; exact endpoint redacted in public docs." },
      { method: "POST", path: "/assistant/chat", detail: "Sales BotIA for leads/tickets/orders." },
      { method: "GET/POST", path: "Private CRM endpoint", detail: "CRM-lite pipeline for super-admin; internal route not published." },
      { method: "POST", path: "Sandbox pack loader", detail: "Load vertical packs in a controlled sandbox environment." },
      { method: "POST", path: "Sandbox validation runner", detail: "Run a simulated NFC validation for commercial QA without treating it as production evidence." },
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
      "Give suppliers a closed spec: chip, URL template, key custody, CSV manifest format, visual bank fields (image_url/label_image_url/model_url/gallery_urls) and activation criteria.",
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
    trustOpsTitle: "Enterprise trust layer",
    trustOpsBullets: [
      "Polygon is for digital ownership, NFT/certificates, claims and transfers; not every tap.",
      "IOTA is an optional proof layer for hashes, Merkle roots, DPP and logistics evidence.",
      "Supplier Encoding Pack sends encoding keys only per sub-batch through an encrypted channel; factories never receive KMS or database URLs.",
      "Tenant Vault shows evidence, manifests, QA and hashes; it does not expose internal secrets.",
    ],
    actionsTitle: "Next steps",
    quickJumpTitle: "Quick explore",
    faqTitle: "Short FAQ to make the value clear",
    faqItems: [
      { q: "What problem does this solve for a premium brand?", a: "It proves a unit is real, shows where it is validated, reduces fraud, recovers first-party customer data and opens an after-sales relationship after purchase." },
      { q: "What does the end customer see?", a: "A simple screen: authentic product, origin, batch, seal status, warranty, benefits and, when relevant, digital certificate or ownership." },
      { q: "How can a company start without a huge project?", a: "With a pilot on one line, batch or edition: product photos, claim rules, tags or QR, mobile portal, dashboard and usage metrics." },
      { q: "Does nexID sell NFC chips?", a: "No. nexID delivers infrastructure to issue, verify and operate physical digital identities using NFC and QR carriers." },
      { q: "Is this only anti-fraud?", a: "No. It also enables digital ownership, access, warranty, vouchers, traceability and analytics." },
      { q: "Are tokenization and authentication the same?", a: "No. Authentication proves the object; tokenization digitizes rights on top of that object." },
      { q: "Can it work with QR?", a: "Yes. A single backend can run NFC plus QR fallback." },
      { q: "Is this only for wine?", a: "No. It also fits events, documents, credentials, cosmetics, luxury and public sector workflows." },
    ],
    strategyTitle: "New strategic guides",
    strategyBody: "We added two pages to clearly separate anti-fraud, passport and programmable rights, and to tailor the pitch by buyer profile.",
    stackPage: "View Verify → Passport → Rights stack",
    audiencesPage: "View audience pitch (investor, reseller, client, government)",
    glossaryPage: "Open operational brand glossary",
    demoPage: "View guided environment",
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
      { label: "View guided environment", href: "/demo" },
      { label: "View the audience pitch page", href: "/audiences" },
    ],
    openAssistant: "Open BotIA",
    talkAgent: "Talk to agent (WhatsApp)",
    bookDemo: "Book demo",
    openLab: "Open lab",
  },
};

export default async function DocsPage() {
  const { locale } = await getWebI18n();
  const copy = docsCopy[locale];

  return (
    <main className="knowledge-page-surface docs-page container-shell space-y-8 py-16">
      <BackLink />
      <SectionHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <Card className="public-clarity-card p-6">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{copy.simpleFlowEyebrow}</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white md:text-3xl">{copy.simpleFlowTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{copy.simpleFlowBody}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {copy.simpleFlow.map((item, index) => (
              <div key={item} className="public-clarity-tile rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold leading-6 text-slate-100">
                <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/15 text-xs text-cyan-100">{index + 1}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

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
      <div id="api" className="grid gap-6 scroll-mt-28 lg:grid-cols-2">
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

        <Card className="p-6 border border-cyan-500/20 bg-cyan-950/10 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(6,182,212,0.10)]">
          <div>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-100">
              Integración de Clientes
            </span>
            <h3 className="mt-4 text-xl font-bold text-white">nexID SDK & APIs</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Ofrecemos bibliotecas listas para integrar en tu e-commerce (Shopify, WooCommerce, Next.js), aplicaciones móviles (React Native, iOS, Android) y cajas registradoras/POS.
            </p>
            <div className="mt-5 grid gap-3 text-xs text-slate-200">
              <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
                <strong className="text-cyan-200 block">Lectura Criptográfica</strong>
                Validación de firmas dinámicas SUN (Secure Unique NFC) y detección de copias sin exponer llaves privadas.
              </div>
              <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
                <strong className="text-cyan-200 block">Orquestación de Reclamos</strong>
                Registro seguro de propiedad digital en el pasaporte del producto cuando el pago, la política de reclamo y el riesgo lo permiten (token nxpos).
              </div>
              <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
                <strong className="text-cyan-200 block">Webhooks en Tiempo Real</strong>
                Notificación instantánea de toques, cambios de estado del sello y geolocalización hacia tus sistemas.
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400">Versión estable v1.4.2</span>
            <Link href="/sdk" className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300">
              Ir a la sección SDK completa
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </div>
      <div id="rollout" className="grid gap-6 scroll-mt-28 lg:grid-cols-2 xl:grid-cols-5">
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
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.trustOpsTitle}</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">{copy.trustOpsBullets.map((item) => <li key={item}>• {item}</li>)}</ul>
        </Card>
      </div>

      <div id="faq" className="scroll-mt-28">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.faqTitle}</h3>
          {locale === "en" ? (
            <div className="docs-faq-video mt-4">
              <div>
                <p>Video explainer</p>
                <strong>Original institutional cut</strong>
                <span>A useful English FAQ companion for buyers who want the story before entering the guided environment.</span>
              </div>
              <video controls preload="metadata" playsInline controlsList="nodownload" aria-label="nexID original institutional FAQ video">
                <source src={legacyInstitutionalVideo} type="video/mp4" />
              </video>
            </div>
          ) : null}
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
