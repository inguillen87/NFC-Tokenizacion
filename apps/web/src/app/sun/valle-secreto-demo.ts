/** Public producer information for an explicitly selected meeting demo.
 * These facts never supply identity, permissions or evidence to a real passport.
 */
export const VALLE_SECRETO_DEMO = {
  key: "valle-secreto",
  brand: "Valle Secreto",
  name: "Profundo 2019",
  vintage: "2019",
  region: "Cachapoal Andes, Chile",
  barrelMonths: 24,
  serving: "16–18 °C",
  barrel: "Barricas Magnum nuevas de roble francés",
  blend: "34% Cabernet Sauvignon · 23% Cabernet Franc · 23% Carmenere · 15% Petit Verdot · 5% Malbec",
  pairing: "Cordero, carnes de caza y pato",
  address: "Ruta H-711, Los Maquis, Pelequén, Malloa, Chile",
  imageUrl: "/sun/valle-secreto/profundo.webp",
  logoDark: "/sun/valle-secreto/logo-dark.webp",
  logoLight: "/sun/valle-secreto/logo-light.png",
  photoSource: "https://vallesecreto.cl/wp-content/uploads/2026/05/PROFUNDO-scaled.webp",
  technicalSheet: "https://vallesecreto.cl/wp-content/uploads/2025/10/10-2025-Ficha-Tecnica-PROFUNDO-2019.pdf",
  experiences: "https://vallesecreto.cl/experiencias/",
  estate: "https://vallesecreto.cl/campo-y-bodega/",
  practices: "https://vallesecreto.cl/wp-content/uploads/2025/10/Practicas-Sustentables-Formato-VVS-Aprobada_VS.pdf",
  certificate: "https://www.sustainable.cl/wp-content/uploads/2026/07/2025_CSV_VINA-Y-CABA-VALLE-SECRETO_ES.pdf",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=Vi%C3%B1a%20Valle%20Secreto%2C%20Ruta%20H-711%2C%20Los%20Maquis%2C%20Pelequ%C3%A9n%2C%20Malloa%2C%20Chile",
} as const;

export type DemoWineProfile = typeof VALLE_SECRETO_DEMO;

export function selectedValleSecretoDemo(isDemoPreview: boolean, profile: unknown): DemoWineProfile | null {
  return isDemoPreview && profile === VALLE_SECRETO_DEMO.key ? VALLE_SECRETO_DEMO : null;
}

export function valleSecretoDemoScenario(value: unknown): "closed" | "opened" {
  return value === "opened" ? "opened" : "closed";
}

export function valleSecretoDemoResult(isDemoPreview: boolean, profile: unknown, scenario: unknown) {
  const wine = selectedValleSecretoDemo(isDemoPreview, profile);
  if (!wine) return null;
  const opened = valleSecretoDemoScenario(scenario) === "opened";
  return {
    ok: true,
    status: {
      code: "AUTH_OK", label: opened ? "Sello abierto · demo" : "Sello cerrado · demo", tone: "good" as const,
      summary: "Escenario ilustrativo para la presentación. No corresponde a una lectura NFC ni a una botella verificada.",
      reason: "demo_preview", productState: opened ? "VALID_OPENED" : "VALID_CLOSED", tamperSupported: true, tamperStatus: opened ? "OPENED" : "CLOSED",
    },
    identity: { bid: "MUESTRA-VS-2019", uid: null, readCounter: 0, scanCount: 0, eventId: "demo-sun-preview", tenantSlug: "demo-valle-secreto" },
    product: {
      name: wine.name, winery: wine.brand, region: wine.region, varietal: "Ensamblaje de cinco cepas", vintage: wine.vintage,
      barrelMonths: wine.barrelMonths, category: "Vino ícono", vertical: "vino", imageUrl: wine.imageUrl, maridaje: wine.pairing, serving: wine.serving, oakType: wine.barrel,
    },
    provenance: { origin: wine.region, timelineSummary: [] },
    iot: {
      wineryLocation: wine.region, wineryCoordinates: null, sensorEvidenceKind: "simulated",
      sensorSnapshot: { cellarTemperature: "15.2 °C", humidity: "62%", lightExposure: "Exposición baja (simulada)", transitShock: "Sin golpes críticos en la simulación", source: "valle_secreto_demo_simulation", deviceId: null, observedAt: null },
    },
    tag_tamper: { available: true, status: opened ? "opened" : "closed", raw: null },
    cta: { claimOwnership: false, registerWarranty: false, provenance: false, tokenize: false },
    allowedActions: [], blockedActions: ["claim", "warranty", "tokenize", "purchase", "rewards"], troubleshooting: [],
  };
}
