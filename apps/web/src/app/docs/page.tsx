import Link from "next/link";
import type { Metadata } from "next";
import { BackLink } from "../../components/back-link";
import { DocsIntegrationConsole } from "./docs-integration-console";
import { JsonLd } from "../../components/json-ld";
import { productExitHref } from "../../components/product-exit-link";
import { PublicLinkChip } from "../../components/public-link-chip";
import { Card } from "@product/ui";
import { getWebI18n } from "../../lib/locale";
import { legacyInstitutionalVideo } from "../../lib/institutional-video";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Hexagon,
  Layers3,
  Network,
  Rocket,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Docs | nexID enterprise trust architecture",
  description: "Technical and commercial documentation for nexID product identity, NFC/QR verification, DPP-ready event models, trust layers, rollout and API integration.",
  openGraph: {
    title: "Docs | nexID",
    description: "Explore nexID architecture, trust layers, rollout, API routes, DPP model and enterprise FAQ.",
    images: [{ url: "/opengraph-image?surface=docs&campaign=enterprise", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Docs | nexID",
    images: ["/twitter-image?surface=docs&campaign=enterprise"],
  },
};

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
  jumpTrustLayers: string;
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

const trustLayerDocLinks: Record<string, { href: string; label: string; display: string }> = {
  "blockchain-architecture.md": { href: "/docs#trust-layers", label: "Architecture", display: "Trust architecture" },
  "offline-nfc-validation.md": { href: "/demo-lab?scenario=offline-verifier", label: "Offline demo", display: "Offline validation" },
  "offline-verifier-architecture.md": { href: "/demo-lab?scenario=offline-verifier", label: "Verifier flow", display: "Offline verifier" },
  "polygon-ownership-layer.md": { href: "/demo-lab?scenario=polygon-ownership", label: "Polygon demo", display: "Ownership Polygon" },
  "iota-proof-audit-layer.md": { href: "/proof/verify", label: "Proof verifier", display: "Proof IOTA" },
  "enterprise-trust-faq.md": { href: "/docs#trust-layers", label: "FAQ", display: "Enterprise FAQ" },
  "dpp-event-model.md": { href: "/demo-lab?scenario=dual-proof", label: "DPP demo", display: "DPP event model" },
};

const docsCopy: Record<"es-AR" | "pt-BR" | "en", DocsCopy> = {
  "es-AR": {
    eyebrow: "Guia comercial + producto",
    title:
      "nexID explicado sin jerga: producto real, confianza y postventa en un solo toque",
    description:
      "No vendemos chips sueltos ni blockchain como moda. Creamos una capa de confianza para que cada producto pueda mostrar evidencia de autenticidad, origen y estado, y habilitar garantías, beneficios, certificados digitales o propiedad digital cuando la política lo permite.",
    simpleFlowEyebrow: "Arquitectura simple",
    simpleFlowTitle: "La arquitectura en una frase",
    simpleFlowBody:
      "Un producto físico recibe una identidad digital; cada toque ejecuta reglas de confianza, cuenta su historia y abre el siguiente paso comercial seguro si corresponde.",
    simpleFlow: [
      "Producto + lote + fotos reales",
      "NFC o QR seguro",
      "Tap con resultado claro",
      "Pasaporte, garantía, beneficios y certificado",
    ],
    pillarsTitle: "Tesis de producto",
    pillars: [
      "Línea BASIC (NTAG215): volumen, UX por toque, activaciones y control operativo.",
      "Línea SECURE (NTAG 424 DNA): autenticidad fuerte, anti-clone y evidencia verificable. TagTamper agrega estado físico de apertura cuando el circuito está integrado.",
      "nexID OS: issuance + verification API + dashboard + webhooks + canal reseller/white-label.",
      "Arquitectura marker-agnostic: NFC + QR fallback desde el diseño para escalar adopción.",
    ],
    chipTitle: "Qué vender con cada chip (sin humo)",
    chipRows: [
      {
        chip: "NTAG215",
        bestFor:
          "Eventos, activaciones, warranties, loyalty, lead capture, tap-to-web.",
        avoid: "No prometer antifraude premium ni voucher monetario sensible.",
      },
      {
        chip: "NTAG 424 DNA",
        bestFor:
          "Autenticidad fuerte, SUN/SDM, documentos, vouchers seguros, control de canal.",
        avoid: "No venderlo como sensor de temperatura/cold-chain por sí solo.",
      },
      {
        chip: "NTAG 424 DNA TagTamper",
        bestFor:
          "Integridad física de cierre/sello: wine, cosmética premium, pharma packaging.",
        avoid: "No usarlo donde no importa estado físico del empaque.",
      },
    ],
    apiTitle: "API enterprise para operación real",
    apiIntro:
      "Rutas para salud, validación criptográfica, CRM comercial, eventos operativos y orquestación multi-tenant.",
    apiRoutes: [
      {
        method: "GET",
        path: "/health",
        detail: "Estado del backend para uptime checks.",
      },
      {
        method: "GET",
        path: "Passport validation",
        detail:
          "Validación SDM/SUN para tags seguros; endpoint exacto redacted en documentación pública.",
      },
      {
        method: "POST",
        path: "/assistant/chat",
        detail: "BotIA comercial: captura leads, tickets y pedidos.",
      },
      {
        method: "GET/POST",
        path: "Private CRM endpoint",
        detail:
          "CRM-lite para super-admin y pipeline comercial; ruta interna no publicada.",
      },
      {
        method: "POST",
        path: "Sandbox pack loader",
        detail: "Carga paquetes verticales en ambiente sandbox controlado.",
      },
      {
        method: "POST",
        path: "Sandbox validation runner",
        detail:
          "Ejecuta una validación NFC simulada para QA comercial, sin tratarla como evidencia productiva.",
      },
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
      "Hoy: NTAG215 + NTAG 424 DNA; TagTamper cuando el estado físico del sello importa.",
      "Siguiente fase: middle tier con StatusDetect para casos de estado/sensing battery-free.",
      "Siempre: NFC + QR fallback + data model DPP-ready.",
    ],
    trustOpsTitle: "Cómo funciona cada capa de confianza",
    trustOpsBullets: [
      "Polygon permite que el comprador reclame el producto como suyo: crea un gemelo digital, activa garantía transferible y habilita la reventa con certificado NFT verificado. No registra cada toque del consumidor.",
      "IOTA puede anclar evidencia seleccionada de cadena de suministro como hashes o Merkle roots cuando la política de auditoría lo exige. No enviamos datos privados ni cada lectura individual on-chain.",
      "El paquete de operaciones de proveedor entrega los permisos necesarios para encodear chips por sub-lote y canal cifrado. El proveedor nunca recibe acceso al sistema central.",
      "El verificador offline permite que un celular o lector funcione sin internet en campo, galpón o cava. Al recuperar señal, sincroniza con el servidor y emite el veredicto oficial.",
    ],
    actionsTitle: "Siguientes pasos",
    quickJumpTitle: "Explorar rápido",
    faqTitle: "FAQ corta para explicar bien el producto",
    faqItems: [
      {
        q: "¿Qué problema resuelve para una marca premium?",
        a: "Permite mostrar evidencia de confianza por unidad, saber dónde se valida, reducir fraude, recuperar datos propios del consumidor y abrir una relación postventa después de la compra.",
      },
      {
        q: "¿Qué ve el consumidor final?",
        a: "Una pantalla simple: resultado de confianza, origen, lote, estado del sello, garantía, beneficios y, si corresponde, certificado digital o propiedad digital.",
      },
      {
        q: "Como se empieza sin hacer un proyecto enorme?",
        a: "Con un piloto sobre una línea, lote o edición: banco de fotos, reglas de claim, tags o QR, portal mobile, dashboard y métricas de uso.",
      },
      {
        q: "¿nexID vende chips NFC?",
        a: "No. nexID vende infraestructura para emitir, validar y operar identidades físicas verificables usando carriers como NFC y QR.",
      },
      {
        q: "¿Sirve solo para antifraude?",
        a: "No. También habilita propiedad digital, acceso, garantías, vouchers, trazabilidad y analytics.",
      },
      {
        q: "¿Tokenización y autenticación son lo mismo?",
        a: "No. La autenticación prueba el objeto; la tokenización digitaliza derechos sobre ese objeto.",
      },
      {
        q: "¿Se puede usar con QR?",
        a: "Sí. Un backend único puede operar NFC y QR como fallback según cada contexto.",
      },
      {
        q: "¿Sirve solo para vino?",
        a: "No. También aplica a eventos, documentos, credenciales, cosmética, lujo y sector público.",
      },
    ],
    strategyTitle: "Guías estratégicas nuevas",
    strategyBody:
      "Sumamos dos páginas para explicar la diferencia entre antifraude, passport y derechos programables, y para adaptar el pitch según cada comprador.",
    stackPage: "Ver pila Verify → Passport → Rights",
    audiencesPage:
      "Ver pitch por audiencia (inversor, reseller, cliente, gobierno)",
    glossaryPage: "Abrir glosario operativo de marca",
    demoPage: "Ver entorno guiado",
    jumpPillars: "Tesis",
    jumpChipProfiles: "Perfiles de chip",
    jumpApi: "API",
    jumpRollout: "Rollout",
    jumpTrustLayers: "Trust layers",
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
    description:
      "Não vendemos chips isolados: vendemos emissão, verificação e analytics de eventos físicos.",
    simpleFlowEyebrow: "Arquitetura simples",
    simpleFlowTitle: "A arquitetura em uma frase",
    simpleFlowBody:
      "Um produto físico recebe uma identidade digital; cada toque valida se é real, conta sua história e abre o próximo passo comercial seguro.",
    simpleFlow: [
      "Produto + lote + fotos reais",
      "NFC ou QR seguro",
      "Toque com resultado claro",
      "Passaporte, garantia, benefícios e certificado",
    ],
    pillarsTitle: "Tese de produto",
    pillars: [
      "Linha BASIC (NTAG215): volume, UX por toque e operação.",
      "Linha SECURE (NTAG 424 DNA): autenticidade forte e evidência verificável. TagTamper adiciona estado físico de abertura quando o circuito está integrado.",
      "nexID OS: issuance + verification API + dashboard + webhooks + canal revenda.",
      "Arquitetura marker-agnostic: NFC + fallback QR para escala.",
    ],
    chipTitle: "O que vender com cada chip",
    chipRows: [
      {
        chip: "NTAG215",
        bestFor: "Eventos, ativações, warranty, loyalty e tap-to-web.",
        avoid: "Não prometer antifraude premium.",
      },
      {
        chip: "NTAG 424 DNA",
        bestFor:
          "Autenticidade forte, SUN/SDM, documentos e vouchers sensíveis.",
        avoid: "Não vender como sensor de temperatura sozinho.",
      },
      {
        chip: "NTAG 424 DNA TagTamper",
        bestFor:
          "Selo/fecho com integridade física: vinho, cosméticos premium e pharma.",
        avoid: "Não usar quando estado físico da embalagem não importa.",
      },
    ],
    apiTitle: "API enterprise para operação",
    apiIntro:
      "Rotas para saúde, validação criptográfica, CRM comercial, eventos operacionais e orquestração multi-tenant.",
    apiRoutes: [
      {
        method: "GET",
        path: "/health",
        detail: "Saúde do backend para uptime.",
      },
      {
        method: "GET",
        path: "Passport validation",
        detail:
          "Validação SDM/SUN para tags seguras; endpoint exato redacted na documentação pública.",
      },
      {
        method: "POST",
        path: "/assistant/chat",
        detail: "BotIA comercial para leads/tickets/pedidos.",
      },
      {
        method: "GET/POST",
        path: "Private CRM endpoint",
        detail: "CRM-lite para super-admin; rota interna não publicada.",
      },
      {
        method: "POST",
        path: "Sandbox pack loader",
        detail: "Carrega pacotes verticais em ambiente sandbox controlado.",
      },
      {
        method: "POST",
        path: "Sandbox validation runner",
        detail:
          "Executa validação NFC simulada para QA comercial, sem tratá-la como evidência produtiva.",
      },
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
      "Hoje: NTAG215 + NTAG 424 DNA; TagTamper quando o estado físico do lacre importa.",
      "Próxima fase: middle tier com StatusDetect.",
      "Sempre: NFC + fallback QR + modelo DPP-ready.",
    ],
    trustOpsTitle: "Camada de confiança enterprise",
    trustOpsBullets: [
      "Polygon permite que o comprador reivindique o produto como seu: cria um gêmeo digital, ativa garantia transferível e habilita a revenda com certificado NFT verificado. Não registra cada toque do consumidor.",
      "IOTA pode ancorar evidencias selecionadas da cadeia como hashes ou Merkle roots quando a politica de auditoria exige. Nao enviamos dados privados nem cada leitura individual on-chain.",
      "Supplier Encoding Pack entrega chaves de encoding apenas por sub-batch e canal cifrado; fábrica nunca recebe KMS nem database URLs.",
      "Tenant Vault mostra evidência, manifest, QA e hashes; não mostra segredos internos.",
    ],
    actionsTitle: "Próximos passos",
    quickJumpTitle: "Explorar rápido",
    faqTitle: "FAQ curta para explicar o produto",
    faqItems: [
      {
        q: "Que problema resolve para uma marca premium?",
        a: "Permite demonstrar que uma unidade e real, saber onde foi validada, reduzir fraude, recuperar dados proprios do consumidor e abrir uma relacao pos-venda depois da compra.",
      },
      {
        q: "O que o consumidor final vê?",
        a: "Uma tela simples: produto autêntico, origem, lote, estado do lacre, garantia, benefícios e, quando fizer sentido, certificado digital ou titularidade digital.",
      },
      {
        q: "Como começar sem um projeto enorme?",
        a: "Com um piloto em uma linha, lote ou edição: banco de fotos, regras de claim, tags ou QR, portal mobile, dashboard e métricas de uso.",
      },
      {
        q: "A nexID vende chips NFC?",
        a: "Não. A nexID vende infraestrutura para emitir, validar e operar identidades físicas verificáveis com NFC e QR.",
      },
      {
        q: "Serve só para antifraude?",
        a: "Não. Também habilita titularidade digital, acesso, garantia, vouchers, rastreabilidade e analytics.",
      },
      {
        q: "Tokenização e autenticação são iguais?",
        a: "Não. Autenticação valida o objeto; tokenização digitaliza direitos sobre ele.",
      },
      {
        q: "Pode usar com QR?",
        a: "Sim. Um backend único opera NFC e QR como fallback.",
      },
      {
        q: "Serve só para vinho?",
        a: "Não. Também aplica a eventos, documentos, credenciais, cosméticos, luxo e governo.",
      },
    ],
    strategyTitle: "Novos guias estratégicos",
    strategyBody:
      "Adicionamos duas páginas para separar antifraude, passport e direitos programáveis e adaptar a narrativa por comprador.",
    stackPage: "Ver pilha Verify → Passport → Rights",
    audiencesPage:
      "Ver pitch por audiência (investidor, revendedor, cliente, governo)",
    glossaryPage: "Abrir glossário operacional de marca",
    demoPage: "Ver ambiente guiado",
    jumpPillars: "Tese",
    jumpChipProfiles: "Perfis de chip",
    jumpApi: "API",
    jumpRollout: "Rollout",
    jumpTrustLayers: "Trust layers",
    jumpFaq: "FAQ",
    jumpStrategy: "Strategy",
    jumpActions: "Actions",
    exploreTitle: "Conectar esta leitura com o restante do site",
    exploreLinks: [
      { label: "Ir para o stack Verify → Passport → Rights", href: "/stack" },
      { label: "Abrir glossário operacional", href: "/glossary" },
      { label: "Ver Demo Lab guiado", href: "/demo-lab" },
      { label: "Ver pitch por audiência", href: "/audiences" },
    ],
    openAssistant: "Abrir BotIA",
    talkAgent: "Falar com agente (WhatsApp)",
    bookDemo: "Agendar demo",
    openLab: "Abrir laboratório",
  },
  en: {
    eyebrow: "Commercial + product guide",
    title:
      "nexID without jargon: real products, trust and after-sales in one tap",
    description:
      "We do not sell loose chips or blockchain as a trend. We create a layer for each product to prove authenticity, show origin, activate warranty, benefits, data and a digital certificate.",
    simpleFlowEyebrow: "Simple architecture",
    simpleFlowTitle: "Architecture in one sentence",
    simpleFlowBody:
      "A physical product receives a digital identity; each tap checks if it is real, tells its story and opens the next safe commercial step.",
    simpleFlow: [
      "Product + batch + real photos",
      "Secure NFC or QR",
      "Tap with a clear result",
      "Passport, warranty, benefits and certificate",
    ],
    pillarsTitle: "Product thesis",
    pillars: [
      "BASIC line (NTAG215): volume UX and operational control.",
      "SECURE line (NTAG 424 DNA): strong authenticity and verifiable freshness. TagTamper adds physical open-state evidence when the loop is integrated.",
      "nexID OS: issuance + verification API + dashboard + webhooks + reseller channel.",
      "Marker-agnostic architecture: NFC + QR fallback from day one.",
    ],
    chipTitle: "What to sell with each chip",
    chipRows: [
      {
        chip: "NTAG215",
        bestFor: "Events, activations, loyalty, warranties, tap-to-web.",
        avoid: "Do not position as premium anti-fraud.",
      },
      {
        chip: "NTAG 424 DNA",
        bestFor: "Strong authenticity, SUN/SDM, secure vouchers and docs.",
        avoid: "Do not claim native cold-chain sensing.",
      },
      {
        chip: "NTAG 424 DNA TagTamper",
        bestFor: "Packaging integrity use cases where open/closed matters.",
        avoid:
          "Do not force into rigid credentials where tamper loop adds little value.",
      },
    ],
    apiTitle: "Enterprise API",
    apiIntro:
      "Routes for health, cryptographic validation, CRM capture, operational events and multi-tenant orchestration.",
    apiRoutes: [
      {
        method: "GET",
        path: "/health",
        detail: "Backend health and uptime checks.",
      },
      {
        method: "GET",
        path: "Passport validation",
        detail:
          "SDM/SUN secure validation; exact endpoint redacted in public docs.",
      },
      {
        method: "POST",
        path: "/assistant/chat",
        detail: "Sales BotIA for leads/tickets/orders.",
      },
      {
        method: "GET/POST",
        path: "Private CRM endpoint",
        detail:
          "CRM-lite pipeline for super-admin; internal route not published.",
      },
      {
        method: "POST",
        path: "Sandbox pack loader",
        detail: "Load vertical packs in a controlled sandbox environment.",
      },
      {
        method: "POST",
        path: "Sandbox validation runner",
        detail:
          "Run a simulated NFC validation for commercial QA without treating it as production evidence.",
      },
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
      "Now: NTAG215 + NTAG 424 DNA; TagTamper where seal state matters.",
      "Next: middle tier with StatusDetect capabilities.",
      "Always: NFC + QR fallback + DPP-ready data model.",
    ],
    trustOpsTitle: "Enterprise trust layer",
    trustOpsBullets: [
      "Polygon lets the buyer claim the product as theirs: creates a digital twin, activates a transferable warranty and enables resale with a verified NFT certificate. Not used to record every consumer tap.",
      "IOTA can anchor selected supply-chain evidence as hashes or Merkle roots when audit policy requires it. We do not put private data or every individual tap on-chain.",
      "Supplier Encoding Pack sends encoding keys only per sub-batch through an encrypted channel; factories never receive KMS or database URLs.",
      "Tenant Vault shows evidence, manifests, QA and hashes; it does not expose internal secrets.",
    ],
    actionsTitle: "Next steps",
    quickJumpTitle: "Quick explore",
    faqTitle: "Short FAQ to make the value clear",
    faqItems: [
      {
        q: "What problem does this solve for a premium brand?",
        a: "It proves a unit is real, shows where it is validated, reduces fraud, recovers first-party customer data and opens an after-sales relationship after purchase.",
      },
      {
        q: "What does the end customer see?",
        a: "A simple screen: authentic product, origin, batch, seal status, warranty, benefits and, when relevant, digital certificate or ownership.",
      },
      {
        q: "How can a company start without a huge project?",
        a: "With a pilot on one line, batch or edition: product photos, claim rules, tags or QR, mobile portal, dashboard and usage metrics.",
      },
      {
        q: "Does nexID sell NFC chips?",
        a: "No. nexID delivers infrastructure to issue, verify and operate physical digital identities using NFC and QR carriers.",
      },
      {
        q: "Is this only anti-fraud?",
        a: "No. It also enables digital ownership, access, warranty, vouchers, traceability and analytics.",
      },
      {
        q: "Are tokenization and authentication the same?",
        a: "No. Authentication proves the object; tokenization digitizes rights on top of that object.",
      },
      {
        q: "Can it work with QR?",
        a: "Yes. A single backend can run NFC plus QR fallback.",
      },
      {
        q: "Is this only for wine?",
        a: "No. It also fits events, documents, credentials, cosmetics, luxury and public sector workflows.",
      },
    ],
    strategyTitle: "New strategic guides",
    strategyBody:
      "We added two pages to clearly separate anti-fraud, passport and programmable rights, and to tailor the pitch by buyer profile.",
    stackPage: "View Verify → Passport → Rights stack",
    audiencesPage:
      "View audience pitch (investor, reseller, client, government)",
    glossaryPage: "Open operational brand glossary",
    demoPage: "View guided environment",
    jumpPillars: "Thesis",
    jumpChipProfiles: "Chip profiles",
    jumpApi: "API",
    jumpRollout: "Rollout",
    jumpTrustLayers: "Trust layers",
    jumpFaq: "FAQ",
    jumpStrategy: "Strategy",
    jumpActions: "Actions",
    exploreTitle: "Connect this page with the rest of the site",
    exploreLinks: [
      { label: "Go to the Verify → Passport → Rights stack", href: "/stack" },
      { label: "Open the operational glossary", href: "/glossary" },
      { label: "Open guided Demo Lab", href: "/demo-lab" },
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
  const mobileTrustRail =
    locale === "en"
      ? [
          { label: "Proof", detail: "Verify a public hash", href: "/proof/verify", Icon: ShieldCheck },
          { label: "IOTA", detail: "Audit hash-only evidence", href: "/demo-lab?scenario=iota-proof", Icon: Network },
          { label: "Polygon", detail: "Ownership and resale flow", href: "/demo-lab?scenario=polygon-ownership", Icon: Hexagon },
          { label: "Demo Lab", detail: "Run the guided pilot", href: "/demo-lab", Icon: Rocket },
        ]
      : locale === "pt-BR"
        ? [
            { label: "Proof", detail: "Verificar hash publico", href: "/proof/verify", Icon: ShieldCheck },
            { label: "IOTA", detail: "Evidencia auditavel hash-only", href: "/demo-lab?scenario=iota-proof", Icon: Network },
            { label: "Polygon", detail: "Ownership e revenda", href: "/demo-lab?scenario=polygon-ownership", Icon: Hexagon },
            { label: "Demo Lab", detail: "Rodar piloto guiado", href: "/demo-lab", Icon: Rocket },
          ]
        : [
            { label: "Proof", detail: "Verificar hash publico", href: "/proof/verify", Icon: ShieldCheck },
            { label: "IOTA", detail: "Evidencia auditada hash-only", href: "/demo-lab?scenario=iota-proof", Icon: Network },
            { label: "Polygon", detail: "Propiedad y reventa", href: "/demo-lab?scenario=polygon-ownership", Icon: Hexagon },
            { label: "Demo Lab", detail: "Probar piloto guiado", href: "/demo-lab", Icon: Rocket },
          ];
  const trustLayerFaq =
    locale === "en"
      ? {
          title: "Enterprise trust FAQ",
          docsTitle: "Internal technical notes for due diligence",
          docsNote:
            "Available to qualified buyers and partners; public claims stay conservative until releases and agreements are signed.",
          docs: [
            "blockchain-architecture.md",
            "offline-nfc-validation.md",
            "offline-verifier-architecture.md",
            "polygon-ownership-layer.md",
            "iota-proof-audit-layer.md",
            "enterprise-trust-faq.md",
            "dpp-event-model.md",
          ],
          items: [
            [
              "Official partnerships?",
              "No. Polygon and IOTA are technologies the architecture can integrate with; do not claim an official partnership unless there is a signed public agreement.",
            ],
            [
              "Does every tap go on-chain?",
              "No. Taps are validated server-side. Chains are used only for approved ownership, certificates, claims, transfers or batched proof anchors.",
            ],
            [
              "Is IOTA zero-fee here?",
              "No. We position IOTA as an optional proof/audit layer for hashes, Merkle roots, DPP and logistics evidence, without zero-fee claims.",
            ],
            [
              "Do customers need a wallet?",
              "No. Consumer UX stays mobile-first. Custodial or wallet flows are optional and policy-driven.",
            ],
            [
              "Does NTAG 424 DNA work offline?",
              "The chip can be read and can generate a fresh SUN/SDM response without internet. A normal browser still needs connectivity for the final backend trust verdict; industrial offline validation needs a controlled app or reader with secure keys.",
            ],
            [
              "Can we build an offline verifier app or reader?",
              "Yes, but it must be a controlled verifier with device-scoped, batch-scoped and expiring keys. Do not embed tenant master keys in a consumer app; backend sync still finalizes replay, policy, ownership and warranty.",
            ],
            [
              "Is private data stored on-chain?",
              "No. Private data and raw UIDs stay off-chain; proofs use hashes, salts, policy checks and tenant-scoped records.",
            ],
          ],
        }
      : locale === "pt-BR"
        ? {
            title: "FAQ enterprise de confianca",
            docsTitle: "Notas tecnicas internas para due diligence",
            docsNote:
              "Disponiveis para compradores e parceiros qualificados; claims publicos seguem conservadores ate releases e acordos assinados.",
            docs: [
              "blockchain-architecture.md",
              "offline-nfc-validation.md",
              "offline-verifier-architecture.md",
              "polygon-ownership-layer.md",
              "iota-proof-audit-layer.md",
              "enterprise-trust-faq.md",
              "dpp-event-model.md",
            ],
            items: [
              [
                "Parcerias oficiais?",
                "Nao. Polygon e IOTA sao tecnologias integraveis; nao declarar parceria oficial sem acordo publico assinado.",
              ],
              [
                "Todo toque vai on-chain?",
                "Nao. Taps sao validados server-side. Chains entram apenas para ownership, certificados, claims, transferencias ou ancoras de prova aprovadas.",
              ],
              [
                "IOTA e zero-fee aqui?",
                "Nao. IOTA e camada opcional de prova/auditoria para hashes, Merkle roots, DPP e logistica, sem claims de zero-fee.",
              ],
              [
                "Cliente precisa de wallet?",
                "Nao. A UX segue mobile-first. Wallet ou custodia sao opcionais e governadas por politica.",
              ],
              [
                "NTAG 424 DNA funciona offline?",
                "O chip pode ser lido e gerar uma resposta SUN/SDM fresca sem internet. Um browser comum ainda precisa de conexao para o veredito final do backend; validacao industrial offline exige app ou leitor controlado com chaves seguras.",
              ],
              [
                "Podemos criar app ou leitor offline?",
                "Sim, mas precisa ser um verificador controlado com chaves por device, batch e vencimento. Nao colocar master keys do tenant em app consumidor; o backend ainda finaliza replay, politica, ownership e garantia.",
              ],
              [
                "Dados privados ficam on-chain?",
                "Nao. Dados privados e UIDs crus ficam off-chain; provas usam hashes, salts, regras e registros por tenant.",
              ],
            ],
          }
        : {
            title: "FAQ enterprise de confianza",
            docsTitle: "Notas tecnicas internas para due diligence",
            docsNote:
              "Disponibles para compradores y partners calificados; los claims publicos se mantienen conservadores hasta release y acuerdos firmados.",
            docs: [
              "blockchain-architecture.md",
              "offline-nfc-validation.md",
              "offline-verifier-architecture.md",
              "polygon-ownership-layer.md",
              "iota-proof-audit-layer.md",
              "enterprise-trust-faq.md",
              "dpp-event-model.md",
            ],
            items: [
              [
                "Alianzas oficiales?",
                "No. Polygon e IOTA son tecnologias integrables; no se debe declarar partnership oficial sin acuerdo publico firmado.",
              ],
              [
                "Cada tap va on-chain?",
                "No. Los taps se validan server-side. Las cadenas entran solo para ownership, certificados, claims, transferencias o anclas de prueba aprobadas.",
              ],
              [
                "IOTA es zero-fee aca?",
                "No. IOTA se posiciona como capa opcional de prueba/auditoria para hashes, Merkle roots, DPP y logistica, sin claims de zero-fee.",
              ],
              [
                "El cliente necesita wallet?",
                "No. La UX sigue mobile-first. Wallet o custodia son opcionales y dependen de la politica del tenant.",
              ],
              [
                "NTAG 424 DNA funciona offline?",
                "El chip se puede leer y puede generar una respuesta SUN/SDM fresca sin internet. Un navegador comun igual necesita conexion para el veredicto final del backend; la validacion industrial offline exige app o lector controlado con claves seguras.",
              ],
              [
                "Podemos crear app o lector offline?",
                "Si, pero tiene que ser un verificador controlado con claves por dispositivo, batch y vencimiento. No se meten master keys del tenant en una app consumer; el backend igual finaliza replay, politica, ownership y garantia.",
              ],
              [
                "Datos privados quedan on-chain?",
                "No. Datos privados y UIDs crudos quedan off-chain; las pruebas usan hashes, salts, reglas y registros por tenant.",
              ],
            ],
          };
  const docsSchema = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: copy.faqItems.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "nexID",
          item: "https://nexid.lat/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Docs",
          item: "https://nexid.lat/docs",
        },
      ],
    },
  ];

  return (
    <main className="knowledge-page-surface docs-page container-shell max-w-[100vw] space-y-8 overflow-x-hidden px-3 py-16 sm:px-4 md:px-8">
      {docsSchema.map((schema) => (
        <JsonLd key={schema["@type"]} data={schema} />
      ))}
      <BackLink />
      <header className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">
          {copy.eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
          {copy.title}
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-400">
          {copy.description}
        </p>
      </header>

      <nav className="docs-mobile-trust-rail md:hidden" aria-label={locale === "en" ? "Trust layer quick actions" : "Accesos rapidos de confianza"}>
        {mobileTrustRail.map((item) => {
          const Icon = item.Icon;
          return (
            <Link key={item.href} href={item.href} className="docs-mobile-trust-rail__item">
              <span className="docs-mobile-trust-rail__icon">
                <Icon className="h-4 w-4" />
              </span>
              <span className="docs-mobile-trust-rail__copy">
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
              <ArrowRight className="docs-mobile-trust-rail__arrow h-4 w-4" />
            </Link>
          );
        })}
      </nav>

      <Card className="public-clarity-card w-full min-w-0 max-w-full overflow-hidden p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
              {copy.simpleFlowEyebrow}
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white md:text-3xl">
              {copy.simpleFlowTitle}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {copy.simpleFlowBody}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {copy.simpleFlow.map((item, index) => (
              <div
                key={item}
                className="public-clarity-tile rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold leading-6 text-slate-100"
              >
                <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/15 text-xs text-cyan-100">
                  {index + 1}
                </span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <DocsIntegrationConsole locale={locale} />

      <div className="space-y-4">
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            {copy.quickJumpTitle}
          </p>
          <div className="flex flex-wrap gap-2">
            <PublicLinkChip
              href="#thesis"
              icon={<Layers3 className="h-3.5 w-3.5" />}
              variant="cyan"
            >
              {copy.jumpPillars}
            </PublicLinkChip>
            <PublicLinkChip
              href="#carrier-profiles"
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              variant="cyan"
            >
              {copy.jumpChipProfiles}
            </PublicLinkChip>
            <PublicLinkChip
              href="#api"
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              variant="indigo"
            >
              {copy.jumpApi}
            </PublicLinkChip>
            <PublicLinkChip
              href="#rollout"
              icon={<Rocket className="h-3.5 w-3.5" />}
              variant="emerald"
            >
              {copy.jumpRollout}
            </PublicLinkChip>
            <PublicLinkChip
              href="#trust-layers"
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              variant="cyan"
            >
              {copy.jumpTrustLayers}
            </PublicLinkChip>
            <PublicLinkChip
              href="#faq"
              icon={<CircleHelp className="h-3.5 w-3.5" />}
              variant="amber"
            >
              {copy.jumpFaq}
            </PublicLinkChip>
            <PublicLinkChip
              href="#strategy"
              icon={<BookOpen className="h-3.5 w-3.5" />}
              variant="violet"
            >
              {copy.jumpStrategy}
            </PublicLinkChip>
            <PublicLinkChip href="#actions">{copy.jumpActions}</PublicLinkChip>
          </div>
        </div>

        <Card className="w-full min-w-0 max-w-full overflow-hidden p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            {copy.exploreTitle}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {copy.exploreLinks.map((item) => (
              <PublicLinkChip
                key={item.href}
                href={item.href}
                size="md"
                trailingArrow
              >
                {item.label}
              </PublicLinkChip>
            ))}
          </div>
        </Card>
      </div>

      <div id="thesis" className="scroll-mt-28">
        <Card className="w-full min-w-0 max-w-full overflow-hidden p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(14,165,233,0.08)] sm:p-6">
          <h3 className="text-lg font-semibold text-white">
            {copy.pillarsTitle}
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {copy.pillars.map((entry) => (
              <li key={entry}>• {entry}</li>
            ))}
          </ul>
        </Card>
      </div>

      <div id="carrier-profiles" className="scroll-mt-28">
        <span id="chips" className="sr-only" />
        <Card className="w-full min-w-0 max-w-full overflow-hidden p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(14,165,233,0.08)] sm:p-6">
          <h3 className="text-lg font-semibold text-white">{copy.chipTitle}</h3>
          <div className="mt-4 grid gap-3">
            {copy.chipRows.map((row) => (
              <div
                key={row.chip}
                className="rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <p className="text-sm font-semibold text-cyan-200">
                  {row.chip}
                </p>
                <p className="mt-1 text-sm text-slate-300">✓ {row.bestFor}</p>
                <p className="mt-1 text-sm text-rose-300">⚠ {row.avoid}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div id="api" className="grid gap-6 scroll-mt-28 lg:grid-cols-2">
        <Card className="w-full min-w-0 max-w-full overflow-hidden p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(99,102,241,0.10)] sm:p-6">
          <h3 className="text-lg font-semibold text-white">{copy.apiTitle}</h3>
          <p className="mt-2 text-sm text-slate-300">{copy.apiIntro}</p>
          <div className="mt-4 space-y-3">
            {copy.apiRoutes.map((route) => (
              <div
                key={`${route.method}-${route.path}`}
                className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm"
              >
                <p className="font-semibold text-cyan-200">
                  {route.method}{" "}
                  <span className="text-white">{route.path}</span>
                </p>
                <p className="mt-1 text-slate-300">{route.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex w-full min-w-0 max-w-full flex-col justify-between overflow-hidden border border-cyan-500/20 bg-cyan-950/10 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(6,182,212,0.10)] sm:p-6">
          <div>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-100">
              Integración de Clientes
            </span>
            <h3 className="mt-4 text-xl font-bold text-white">
              nexID SDK & APIs
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Ofrecemos un SDK base, contratos API y webhooks para integraciones
              propias. Adaptadores para Shopify, WooCommerce, mobile o POS se
              definen por proyecto hasta que estén publicados como paquetes
              versionados.
            </p>
            <div className="mt-5 grid gap-3 text-xs text-slate-200">
              <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
                <strong className="text-cyan-200 block">
                  Lectura Criptográfica
                </strong>
                Validación de CMAC/SUN dinámico y detección de replay/copias sin
                exponer material criptográfico.
              </div>
              <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
                <strong className="text-cyan-200 block">
                  Orquestación de Reclamos
                </strong>
                Registro seguro de propiedad digital en el pasaporte del
                producto cuando el pago, la política de reclamo y el riesgo lo
                permiten (token nxpos).
              </div>
              <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
                <strong className="text-cyan-200 block">
                  Webhooks en Tiempo Real
                </strong>
                Entrega de eventos de toques, cambios de estado del sello y
                señales de ubicación consentidas hacia tus sistemas.
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400">
              SDK base + contratos API
            </span>
            <Link
              href="/sdk"
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              Ir a la sección SDK completa
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </div>
      <div
        id="rollout"
        className="grid min-w-0 max-w-full gap-4 scroll-mt-28 lg:grid-cols-2 xl:grid-cols-4"
      >
        <Card className="w-full min-w-0 max-w-full overflow-hidden p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-white">
            {copy.packsTitle}
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {copy.packs.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </Card>
        <Card className="w-full min-w-0 max-w-full overflow-hidden p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-white">
            {copy.rolloutTitle}
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {copy.rolloutBullets.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </Card>
        <Card className="w-full min-w-0 max-w-full overflow-hidden p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-white">
            {copy.revenueTitle}
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {copy.revenueBullets.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </Card>
        <Card className="w-full min-w-0 max-w-full overflow-hidden p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-white">
            {copy.roadmapTitle}
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {copy.roadmapBullets.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </Card>
      </div>

      <div id="trust-layers" className="scroll-mt-28">
        <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-3xl border border-cyan-500/20 bg-slate-950/50 p-4 shadow-[0_0_40px_rgba(6,182,212,0.1)] backdrop-blur-md sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />

          <div className="relative z-10 mb-10">
            <span id="offline-verifier-architecture" className="sr-only" />
            <h3 className="text-2xl font-black text-white">
              {copy.trustOpsTitle}
            </h3>
            <div className="docs-trust-layer-actions mt-5 flex flex-wrap gap-2">
              <Link
                href="/proof/verify"
                className="docs-trust-layer-action docs-trust-layer-action--proof inline-flex min-h-10 items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15"
              >
                {locale === "en" ? "Open Proof Verify" : locale === "pt-BR" ? "Abrir Proof Verify" : "Abrir Proof Verify"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/demo-lab?scenario=iota-proof"
                className="docs-trust-layer-action docs-trust-layer-action--iota inline-flex min-h-10 items-center gap-2 rounded-full border border-indigo-300/30 bg-indigo-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-indigo-100 transition hover:border-indigo-200/70 hover:bg-indigo-400/15"
              >
                {locale === "en" ? "Run IOTA proof demo" : locale === "pt-BR" ? "Demo prova IOTA" : "Demo prueba IOTA"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/demo-lab?scenario=polygon-ownership"
                className="docs-trust-layer-action docs-trust-layer-action--polygon inline-flex min-h-10 items-center gap-2 rounded-full border border-purple-300/30 bg-purple-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-purple-100 transition hover:border-purple-200/70 hover:bg-purple-400/15"
              >
                {locale === "en" ? "Run Polygon ownership" : locale === "pt-BR" ? "Demo ownership Polygon" : "Demo ownership Polygon"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="relative z-10 grid gap-6 md:grid-cols-3">
            <div className="relative rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md transition-all hover:border-cyan-500/30 hover:bg-slate-900/80">
              <div className="mb-4 inline-flex rounded-xl bg-slate-800 p-3 text-cyan-400">
                <WifiOff className="h-6 w-6" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {copy.trustOpsBullets[3]}
              </p>
              <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-relaxed text-slate-300">
                {copy.trustOpsBullets[2]}
              </p>
              <div className="absolute top-1/2 -right-4 z-0 hidden w-8 border-t-2 border-dashed border-cyan-500/30 md:block" />
            </div>

            <div className="relative rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md transition-all hover:border-indigo-500/30 hover:bg-slate-900/80">
              <div className="mb-4 inline-flex rounded-xl bg-indigo-500/20 p-3 text-indigo-400">
                <Network className="h-6 w-6" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {copy.trustOpsBullets[1]}
              </p>
              <div className="absolute top-1/2 -right-4 z-0 hidden w-8 border-t-2 border-dashed border-indigo-500/30 md:block" />
            </div>

            <div className="relative rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md transition-all hover:border-purple-500/30 hover:bg-slate-900/80">
              <div className="mb-4 inline-flex rounded-xl bg-purple-500/20 p-3 text-purple-400">
                <Hexagon className="h-6 w-6" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {copy.trustOpsBullets[0]}
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-12 rounded-2xl border border-cyan-300/15 bg-cyan-950/20 p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-400">
              {trustLayerFaq.title}
            </p>
            <div className="mt-6 grid gap-3">
              {trustLayerFaq.items.map(([question, answer]) => (
                <details
                  key={question}
                  className="group rounded-xl border border-white/5 bg-slate-950/50 p-4 transition-all duration-200 hover:border-white/10 open:border-cyan-500/30 open:bg-slate-900/80"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-white">
                    <span>{question}</span>
                    <ChevronDown className="h-4 w-4 text-cyan-500 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
          </div>

          <div className="relative z-10 mt-6 rounded-2xl border border-white/5 bg-slate-950/40 p-6 backdrop-blur-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">
              {trustLayerFaq.docsTitle}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {trustLayerFaq.docsNote}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {trustLayerFaq.docs.map((item) => {
                const target = trustLayerDocLinks[item] || { href: "/docs#trust-layers", label: "Docs", display: "Trust docs" };
                return (
                  <Link
                    key={item}
                    href={target.href}
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-200"
                    title={`${item} -> ${target.label}`}
                  >
                    <span>{target.display}</span>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-cyan-200">
                      {target.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div id="faq" className="scroll-mt-28">
        <Card className="w-full min-w-0 max-w-full overflow-hidden p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-white">{copy.faqTitle}</h3>
          {locale === "en" ? (
            <div className="docs-faq-video mt-4">
              <div>
                <p>Video explainer</p>
                <strong>Original institutional cut</strong>
                <span>
                  A useful English FAQ companion for buyers who want the story
                  before entering the guided environment.
                </span>
              </div>
              <video
                controls
                preload="metadata"
                playsInline
                controlsList="nodownload"
                aria-label="nexID original institutional FAQ video"
              >
                <source src={legacyInstitutionalVideo} type="video/mp4" />
              </video>
            </div>
          ) : null}
          <div className="mt-4 grid gap-3">
            {copy.faqItems.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-white/10 bg-white/5 p-3 transition-all duration-200 open:border-cyan-300/30 open:bg-cyan-500/5 hover:border-white/20"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-white">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-cyan-300 transition-transform group-open:rotate-45">
                      ＋
                    </span>
                    {item.q}
                  </span>
                </summary>
                <p className="mt-3 text-sm text-slate-300">{item.a}</p>
              </details>
            ))}
          </div>
        </Card>
      </div>

      <div id="strategy" className="scroll-mt-28">
        <Card className="w-full min-w-0 max-w-full overflow-hidden p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-white">
            {copy.strategyTitle}
          </h3>
          <p className="mt-2 text-sm text-slate-300">{copy.strategyBody}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <PublicLinkChip
              href="/stack"
              variant="cyan"
              size="md"
              trailingArrow
            >
              {copy.stackPage}
            </PublicLinkChip>
            <PublicLinkChip
              href="/audiences"
              variant="indigo"
              size="md"
              trailingArrow
            >
              {copy.audiencesPage}
            </PublicLinkChip>
            <PublicLinkChip
              href="/glossary"
              variant="emerald"
              size="md"
              trailingArrow
            >
              {copy.glossaryPage}
            </PublicLinkChip>
            <PublicLinkChip
              href="/demo"
              variant="amber"
              size="md"
              trailingArrow
            >
              {copy.demoPage}
            </PublicLinkChip>
          </div>
        </Card>
      </div>

      <div id="actions" className="scroll-mt-28">
        <Card className="w-full min-w-0 max-w-full overflow-hidden p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-white">
            {copy.actionsTitle}
          </h3>
          <div className="mt-4 flex flex-wrap gap-3">
            <PublicLinkChip
              href="/?assistant=open"
              variant="cyan"
              size="md"
              trailingArrow
            >
              {copy.openAssistant}
            </PublicLinkChip>
            <PublicLinkChip
              href={productExitHref.demoLab}
              size="md"
              trailingArrow
            >
              {copy.openLab}
            </PublicLinkChip>
            <a
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-100"
              href="https://wa.me/5492613168608"
              target="_blank"
              rel="noreferrer"
            >
              {copy.talkAgent}
            </a>
            <Link
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 transition-transform duration-200 hover:-translate-y-0.5"
              href="/?contact=demo#contact-modal"
            >
              {copy.bookDemo}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
