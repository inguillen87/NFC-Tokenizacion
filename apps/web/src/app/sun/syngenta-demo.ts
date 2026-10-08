import { resolveSunDemoScenario, sunDemoScenarioSignals, type SunDemoScenario } from "./sun-demo-scenario";
import type { SunLocale } from "./sun-locale";

/** Public catalog references for this explicit SUN demonstration only.
 * They never supply tenant identity, NFC evidence or an application recommendation.
 */
export const SYNGENTA_DEMO = {
  key: "syngenta",
  brand: "Syngenta",
  name: "AMISTAR XTRA",
  category: "Fungicida",
  formulation: "Suspensión concentrada",
  container: "Bidón de 5 L",
  tagProposal: "NTAG 424 DNA TagTamper",
  tagSource: "https://www.nxp.com/docs/en/application-note/AN12196.pdf",
  registrationNumber: "34011",
  productPage: "https://www.syngenta.com.ar/product/crop-protection/fungicida/amistar-xtra",
  label: "https://www.syngenta.com.ar/sites/g/files/kgtney396/files/media/document/2016/08/16/amistar20xtra_etiqueta_4541.pdf",
  safetySheet: "https://www.syngenta.com.ar/sites/g/files/kgtney396/files/media/document/2024/02/28/AMISTAR%20XTRA_hoja_de_seguridad.pdf",
  imageUrl: "/sun/syngenta/amistar-xtra-5l.webp",
  logo: "/sun/syngenta/logo.svg",
  photoSource: "https://www.mercadolibre.com.ar/syngenta-amistar-xtra-fungicida-5-litro/up/MLAU2913854648",
  lot: "DEMO-SYN-001",
} as const;

export type SyngentaDemoProfile = typeof SYNGENTA_DEMO;

export function selectedSyngentaDemo(isDemoPreview: boolean, profile: unknown): SyngentaDemoProfile | null {
  return isDemoPreview && profile === SYNGENTA_DEMO.key ? SYNGENTA_DEMO : null;
}

export function syngentaDemoResult(isDemoPreview: boolean, profile: unknown, scenario: unknown) {
  const product = selectedSyngentaDemo(isDemoPreview, profile);
  if (!product) return null;
  const state = resolveSunDemoScenario(scenario, "closed");
  const signals = sunDemoScenarioSignals(state);
  return {
    ok: signals.ok,
    status: {
      code: signals.code, label: signals.label, tone: signals.tone,
      summary: signals.summary, reason: "demo_preview",
      productState: signals.productState, tamperSupported: signals.tagAvailable, tamperStatus: signals.tamperStatus,
    },
    identity: { bid: product.lot, uid: null, readCounter: 0, scanCount: 0, eventId: "demo-sun-preview", tenantSlug: "demo-syngenta" },
    product: {
      name: product.name, winery: product.brand, category: product.category, vertical: "agro", imageUrl: product.imageUrl,
      region: null, varietal: null, vintage: null, barrelMonths: null, storage: null,
    },
    provenance: { origin: null, timelineSummary: [] },
    iot: { wineryLocation: null, wineryCoordinates: null, sensorEvidenceKind: "none" },
    tag_tamper: { available: signals.tagAvailable, status: signals.tagStatus, raw: null },
    cta: { claimOwnership: false, registerWarranty: false, provenance: false, tokenize: false },
    allowedActions: [], blockedActions: ["claim", "warranty", "tokenize", "purchase", "rewards"], troubleshooting: [],
  };
}

export function syngentaDemoCopy(locale: SunLocale, scenario: SunDemoScenario) {
  const copy = {
    "es-AR": {
      trust: "Ficha y documentos públicos de Syngenta Argentina. El lote y el sello son de muestra; no verifican un envase real ni su contenido.",
      productStatusTitle: "AMISTAR XTRA · experiencia de muestra",
      productStatusBody: "Consultá la información publicada del producto y probá los estados del envase. Esta demo no indica dosis ni recomienda aplicaciones.",
      passportEventBody: "Esta presentación combina documentación pública con un estado de sello simulado. No ocurrió una lectura física.",
      passportNowTitle: "Conocer AMISTAR XTRA",
      passportNowBody: "La etiqueta y la hoja de seguridad están disponibles. La demo no activa compras, beneficios ni contacto comercial.",
      photoCredit: "Foto de referencia comercial · Agroinsumos Mercofrut",
      originLabel: "Origen de la demostración",
      originAction: "Ver lote y trazabilidad",
      conditionTitle: "Estado de muestra del envase",
      conditionBody: "No hay sensores ni mediciones de este envase. El estado sólo ilustra cómo se presentaría una lectura; no prueba autenticidad ni seguridad del contenido.",
      state: scenario === "invalid" ? "Lectura no válida · demo" : scenario === "opened" ? "Sello abierto · demo" : "Sello cerrado · demo",
      decision: scenario === "invalid" ? "Lectura no válida de muestra. La identidad y el sello no se confirmaron; las acciones protegidas están bloqueadas. No se evaluó un envase real." : "Estado de sello simulado. No ocurrió una lectura NFC ni se evaluó el contenido de un envase real.",
      stageTitle: scenario === "invalid" ? "Lectura no válida en esta simulación" : scenario === "opened" ? "Sello abierto en esta simulación" : "Sello cerrado en esta simulación",
      stageBody: "La ficha pública permanece disponible en los tres escenarios. Una apertura no demuestra falsificación; esta demo no valida el contenido del producto.",
    },
    en: {
      trust: "Public product information and documents from Syngenta Argentina. The batch and seal are samples; they verify no real container or its contents.",
      productStatusTitle: "AMISTAR XTRA · sample experience",
      productStatusBody: "Read the published product information and explore the container states. This demo gives no dosage or application recommendations.",
      passportEventBody: "This presentation combines public documentation with a simulated seal state. No physical reading occurred.",
      passportNowTitle: "Discover AMISTAR XTRA",
      passportNowBody: "The product label and safety sheet are available. The demo activates no purchases, benefits or commercial contact.",
      photoCredit: "Commercial reference photo · Agroinsumos Mercofrut",
      originLabel: "Demonstration origin",
      originAction: "View lot and traceability",
      conditionTitle: "Sample container state",
      conditionBody: "There are no sensors or measurements for this container. The state only illustrates how a reading would appear; it proves neither authenticity nor content safety.",
      state: scenario === "invalid" ? "Invalid reading · demo" : scenario === "opened" ? "Open seal · demo" : "Closed seal · demo",
      decision: scenario === "invalid" ? "Invalid sample reading. Identity and seal were not confirmed; protected actions are blocked. No real container was evaluated." : "Simulated seal state. No NFC reading occurred and no real container's contents were evaluated.",
      stageTitle: scenario === "invalid" ? "Invalid reading in this simulation" : scenario === "opened" ? "Open seal in this simulation" : "Closed seal in this simulation",
      stageBody: "Public product information remains available in all three scenarios. An opening does not prove counterfeiting; this demo does not validate the product's contents.",
    },
    "pt-BR": {
      trust: "Informações e documentos públicos da Syngenta Argentina. O lote e o lacre são de exemplo; não verificam uma embalagem real nem seu conteúdo.",
      productStatusTitle: "AMISTAR XTRA · experiência de exemplo",
      productStatusBody: "Consulte as informações publicadas do produto e explore os estados da embalagem. Esta demo não indica doses nem recomenda aplicações.",
      passportEventBody: "Esta apresentação combina documentação pública com um estado de lacre simulado. Não ocorreu uma leitura física.",
      passportNowTitle: "Conhecer AMISTAR XTRA",
      passportNowBody: "O rótulo e a ficha de segurança estão disponíveis. A demo não ativa compras, benefícios nem contato comercial.",
      photoCredit: "Foto de referência comercial · Agroinsumos Mercofrut",
      originLabel: "Origem da demonstração",
      originAction: "Ver lote e rastreabilidade",
      conditionTitle: "Estado de exemplo da embalagem",
      conditionBody: "Não há sensores nem medições desta embalagem. O estado apenas ilustra como uma leitura seria exibida; não prova autenticidade nem segurança do conteúdo.",
      state: scenario === "invalid" ? "Leitura inválida · demo" : scenario === "opened" ? "Lacre aberto · demo" : "Lacre fechado · demo",
      decision: scenario === "invalid" ? "Leitura inválida de exemplo. A identidade e o lacre não foram confirmados; as ações protegidas estão bloqueadas. Nenhuma embalagem real foi avaliada." : "Estado de lacre simulado. Não ocorreu uma leitura NFC nem foi avaliado o conteúdo de uma embalagem real.",
      stageTitle: scenario === "invalid" ? "Leitura inválida nesta simulação" : scenario === "opened" ? "Lacre aberto nesta simulação" : "Lacre fechado nesta simulação",
      stageBody: "As informações públicas permanecem disponíveis nos três cenários. Uma abertura não prova falsificação; esta demo não valida o conteúdo do produto.",
    },
  }[locale];
  return copy;
}
