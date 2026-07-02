export type PlatformVerticalId =
  | "agro"
  | "events"
  | "pharma"
  | "cosmetics"
  | "wine"
  | "bottle"
  | "luxury"
  | "sneaker"
  | "logistics"
  | "electronics"
  | "textile";

export type PlatformDemoVertical =
  | "seeds"
  | "bracelet"
  | "pharma"
  | "perfume"
  | "wine"
  | "bottle"
  | "luxury"
  | "sneaker"
  | "logistics"
  | "electronics"
  | "textile";

export type PlatformVerticalTone =
  | "emerald"
  | "amber"
  | "sky"
  | "rose"
  | "cyan"
  | "violet"
  | "lime"
  | "indigo"
  | "slate";

export type PlatformIconKey =
  | "sprout"
  | "ticket"
  | "pill"
  | "gem"
  | "shield"
  | "truck"
  | "package"
  | "sparkles"
  | "cpu"
  | "shirt"
  | "bottle"
  | "sneaker";

export type PlatformVertical = {
  id: PlatformVerticalId;
  demoVertical: PlatformDemoVertical;
  title: string;
  titleEn: string;
  titlePt: string;
  shortTitle: string;
  body: string;
  bodyEn: string;
  bodyPt: string;
  image: string;
  imageLight: string;
  tags: string[];
  metric: string;
  icon: PlatformIconKey;
  tone: PlatformVerticalTone;
};

export const platformVerticals: PlatformVertical[] = [
  {
    id: "agro",
    demoVertical: "seeds",
    title: "Agro & Alimentos",
    titleEn: "Agro & Food",
    titlePt: "Agro & Alimentos",
    shortTitle: "Agro",
    body: "Semillas, fitosanitarios, biológicos y alimentos con autenticidad física, canal seguro, uso responsable post-tap y datos de campo para CRM, ERP o Cropwise.",
    bodyEn: "Seeds, crop protection, biologicals and food with physical authenticity, channel control, responsible-use support and field data for CRM, ERP or Cropwise.",
    bodyPt: "Sementes, defensivos, biológicos e alimentos com autenticidade física, canal seguro, suporte de uso responsável e dados de campo para CRM, ERP ou Cropwise.",
    image: "/sdk/verticals/agro-nfc-qr-traceability.webp",
    imageLight: "/sdk/verticals/light/premium-agro-light.webp",
    tags: ["424 DNA", "Tamper", "Webhook"],
    metric: "Canal + soporte",
    icon: "sprout",
    tone: "emerald",
  },
  {
    id: "events",
    demoVertical: "bracelet",
    title: "Eventos & Tickets",
    titleEn: "Events & Access",
    titlePt: "Eventos & Acesso",
    shortTitle: "Eventos",
    body: "Pulseras, tickets, cashless, zonas VIP, consumos y capacidad en vivo con bloqueo de copia.",
    bodyEn: "Wristbands, tickets, cashless, VIP zones, consumption and live capacity with replay blocking.",
    bodyPt: "Pulseiras, ingressos, cashless, zonas VIP, consumos e capacidade ao vivo com bloqueio de copia.",
    image: "/sdk/verticals/events-nfc-qr-access.webp",
    imageLight: "/sdk/verticals/light/premium-events-light-enterprise.webp",
    tags: ["NFC", "QR", "POS"],
    metric: "Tap + acceso",
    icon: "ticket",
    tone: "amber",
  },
  {
    id: "pharma",
    demoVertical: "pharma",
    title: "Pharma & Salud",
    titleEn: "Pharma & Health",
    titlePt: "Pharma & Saude",
    shortTitle: "Salud",
    body: "Medicamentos, prospecto digital, recall por unidad, cadena de frio y auditoria de lote.",
    bodyEn: "Medicine authenticity, digital leaflet, unit recall, cold chain and batch audit trail.",
    bodyPt: "Autenticidade de medicamentos, bula digital, recall por unidade, cadeia fria e auditoria de lote.",
    image: "/sdk/pharma-authentication-pack.webp",
    imageLight: "/sdk/verticals/light/premium-pharma-agro-light-enterprise.webp",
    tags: ["QR", "NFC", "Recall"],
    metric: "Recall listo",
    icon: "pill",
    tone: "sky",
  },
  {
    id: "cosmetics",
    demoVertical: "perfume",
    title: "Belleza & Cosmetica",
    titleEn: "Beauty & Cosmetics",
    titlePt: "Beleza & Cosmetica",
    shortTitle: "Belleza",
    body: "Perfumes, skincare, recargas, sello NFC/QR y tamper contra refill o mercado gris.",
    bodyEn: "Perfume, skincare, refills, NFC/QR seals and tamper protection against refill fraud.",
    bodyPt: "Perfumes, skincare, recargas, selo NFC/QR e tamper contra refill e mercado cinza.",
    image: "/sdk/verticals/cosmetics-nfc-qr-tamper.webp",
    imageLight: "/sdk/verticals/light/premium-beauty-light.webp",
    tags: ["NFC", "QR", "Tamper"],
    metric: "Tamper + refill",
    icon: "sparkles",
    tone: "rose",
  },
  {
    id: "wine",
    demoVertical: "wine",
    title: "Vinos & Spirits",
    titleEn: "Wine & Spirits",
    titlePt: "Vinhos & Spirits",
    shortTitle: "Vinos",
    body: "Botellas premium con NTAG 424 DNA TT, tail de apertura, passport, ownership y exportacion.",
    bodyEn: "Premium bottles with NTAG 424 DNA TT, opening tail, passport, ownership and export control.",
    bodyPt: "Garrafas premium com NTAG 424 DNA TT, tail de abertura, passport, ownership e exportacao.",
    image: "/sdk/verticals/wine-spirits-424-tt.png",
    imageLight: "/sdk/verticals/light/premium-wine-light.webp",
    tags: ["424 DNA", "Tail", "SUN"],
    metric: "424 TT",
    icon: "shield",
    tone: "cyan",
  },
  {
    id: "luxury",
    demoVertical: "luxury",
    title: "Retail & Lujo",
    titleEn: "Luxury & Retail",
    titlePt: "Luxo & Retail",
    shortTitle: "Lujo",
    body: "Producto original, garantia, reventa, experiencias exclusivas y fidelizacion premium.",
    bodyEn: "Original products, warranty, resale, exclusive experiences and premium loyalty.",
    bodyPt: "Produto original, garantia, revenda, experiencias exclusivas e fidelizacao premium.",
    image: "/sdk/verticals/luxury-nfc-qr-tamper.webp",
    imageLight: "/sdk/verticals/light/premium-beauty-light.webp",
    tags: ["NFC", "QR", "Cert"],
    metric: "Ownership",
    icon: "gem",
    tone: "violet",
  },
  {
    id: "sneaker",
    demoVertical: "sneaker",
    title: "Zapatillas & Calzado",
    titleEn: "Sneakers & Footwear",
    titlePt: "Tenis & Calcados",
    shortTitle: "Calzado",
    body: "Autenticacion de drop verificado, control de reventa, certificado de propiedad digital y beneficios exclusivos de club.",
    bodyEn: "Verified drop authenticity, resale control, digital ownership certificate and exclusive club benefits.",
    bodyPt: "Autenticacao de drop verificado, controle de revenda, certificado de propriedade digital e beneficios de clube.",
    image: "/sdk/verticals/sneaker-nfc-qr-tamper.png",
    imageLight: "/sdk/verticals/light/premium-sneaker-light-enterprise.webp",
    tags: ["424 DNA", "Drop", "Cert"],
    metric: "Drop verificado",
    icon: "sneaker",
    tone: "indigo",
  },
  {
    id: "bottle",
    demoVertical: "bottle",
    title: "Envases inteligentes & Refill",
    titleEn: "Smart Packaging & Refill",
    titlePt: "Embalagens inteligentes & Refill",
    shortTitle: "Envases",
    body: "Envases retornables, refill, aguas, bebidas funcionales y packaging circular con GS1/QR, NFC opcional, retorno e incentivos.",
    bodyEn: "Reusable bottles, refill, water, functional drinks and circular packaging with GS1/QR, optional NFC, returns and incentives.",
    bodyPt: "Embalagens retornaveis, refill, aguas, bebidas funcionais e packaging circular com GS1/QR, NFC opcional, retorno e incentivos.",
    image: "/sdk/verticals/beverages-bottle-nfc-qr.png",
    imageLight: "/sdk/verticals/light/premium-bottle-light-enterprise.webp",
    tags: ["GS1", "QR", "NFC"],
    metric: "Refill + retorno",
    icon: "bottle",
    tone: "sky",
  },
  {
    id: "logistics",
    demoVertical: "logistics",
    title: "Logistica & Cadena Fria",
    titleEn: "Logistics & Cold Chain",
    titlePt: "Logistica & Cadeia Fria",
    shortTitle: "Logística",
    body: "Pallets, cajas, UHF/RFID, QR, NFC y sensores para rutas y temperatura auditables.",
    bodyEn: "Pallets, cartons, UHF/RFID, QR, NFC and sensors for auditable route and temperature control.",
    bodyPt: "Pallets, caixas, UHF/RFID, QR, NFC e sensores para rotas e temperatura auditaveis.",
    image: "/sdk/verticals/logistics-uhf-nfc-qr.webp",
    imageLight: "/sdk/verticals/light/premium-logistics-light-enterprise.webp",
    tags: ["UHF", "NFC", "Temp"],
    metric: "UHF + IoT",
    icon: "truck",
    tone: "lime",
  },
  {
    id: "electronics",
    demoVertical: "electronics",
    title: "Electronica & Garantia",
    titleEn: "Electronics & Warranty",
    titlePt: "Eletronica & Garantia",
    shortTitle: "Electrónica",
    body: "Serializacion, propiedad, garantia, soporte postventa y reclamos antifraude por unidad.",
    bodyEn: "Serialization, ownership, warranty, post-sale support and anti-fraud claims per unit.",
    bodyPt: "Serializacao, ownership, garantia, suporte pos-venda e reclamos antifraude por unidade.",
    image: "/sdk/verticals/electronics-warranty-nfc-qr.webp",
    imageLight: "/sdk/verticals/light/premium-electronics-light-enterprise.webp",
    tags: ["QR", "NFC", "DPP"],
    metric: "Warranty",
    icon: "cpu",
    tone: "indigo",
  },
  {
    id: "textile",
    demoVertical: "textile",
    title: "Textil & DPP",
    titleEn: "Textile & DPP",
    titlePt: "Textil & DPP",
    shortTitle: "Textil",
    body: "Pasaporte digital de producto, origen, composicion, cuidado conectado y reventa verificable.",
    bodyEn: "Digital product passport, origin, composition, connected care and verified resale.",
    bodyPt: "Passaporte digital de produto, origem, composicao, cuidado conectado e revenda verificavel.",
    image: "/sdk/verticals/textile-dpp-nfc-qr.webp",
    imageLight: "/sdk/verticals/light/premium-textile-light-enterprise.webp",
    tags: ["QR", "NFC", "DPP"],
    metric: "EU DPP",
    icon: "shirt",
    tone: "slate",
  },
];

export const platformTrustedBy = ["Bodegas", "Agro empresas", "Farmalab", "Retail Group", "Logic Cargo", "Eventos VIP"];

export const traceabilityGlobePoints = [
  { city: "Mendoza", country: "Argentina", lat: -32.8895, lng: -68.8458, scans: 4820, risk: 0, status: "origin", vertical: "wine" },
  { city: "Córdoba", country: "Argentina", lat: -31.4201, lng: -64.1888, scans: 1240, risk: 0, status: "tap", vertical: "agro" },
  { city: "São Paulo", country: "Brasil", lat: -23.5505, lng: -46.6333, scans: 2190, risk: 3, status: "risk", vertical: "events" },
  { city: "Miami", country: "Estados Unidos", lat: 25.7617, lng: -80.1918, scans: 3180, risk: 0, status: "export", vertical: "luxury" },
  { city: "Zúrich", country: "Suiza", lat: 47.3769, lng: 8.5417, scans: 980, risk: 0, status: "passport", vertical: "wine" },
  { city: "Madrid", country: "España", lat: 40.4168, lng: -3.7038, scans: 1680, risk: 0, status: "dpp", vertical: "textile" },
  { city: "Bogotá", country: "Colombia", lat: 4.711, lng: -74.0721, scans: 740, risk: 1, status: "cold-chain", vertical: "pharma" },
] as const;

export const traceabilityGlobeRoutes = [
  { fromLat: -32.8895, fromLng: -68.8458, toLat: 47.3769, toLng: 8.5417, tone: "info" as const, label: "Exportación premium" },
  { fromLat: -31.4201, fromLng: -64.1888, toLat: -23.5505, toLng: -46.6333, tone: "warn" as const, label: "Riesgo de canal" },
  { fromLat: -32.8895, fromLng: -68.8458, toLat: 25.7617, toLng: -80.1918, tone: "info" as const, label: "Ruta retail" },
  { fromLat: 4.711, fromLng: -74.0721, toLat: 40.4168, toLng: -3.7038, tone: "info" as const, label: "Pasaporte digital" },
] as const;
