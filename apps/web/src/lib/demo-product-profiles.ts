export type DemoProductProfileKey = "wine" | "perfume" | "agro" | "agrochem" | "fragrance";
export type DemoExperienceAction = "warranty" | "benefit" | "support";

export type DemoProductProfile = {
  key: DemoProductProfileKey;
  label: string;
  name: string;
  brand: string;
  region: string;
  lot: string;
  vertical: string;
  category: string;
  origin: {
    city: string;
    country: string;
    lat: number;
    lng: number;
  };
  sampleTap: {
    city: string;
    country: string;
    lat: number;
    lng: number;
  };
  images: readonly [string, string, string, string];
};

/**
 * Public, illustrative fixtures shared by Demo Lab and SUN preview.
 * The allowlisted profile key is the only URL-controlled selector; product,
 * brand, lot and location fields are resolved from this catalog server-side.
 */
export const DEMO_PRODUCT_PROFILES: Readonly<Record<DemoProductProfileKey, DemoProductProfile>> = {
  wine: {
    key: "wine",
    label: "Botella premium",
    name: "Reserva Andina",
    brand: "Bodega Balmec",
    region: "Valle de Uco, Mendoza",
    lot: "RA-2407",
    vertical: "vino",
    category: "Vino premium",
    origin: { city: "Tunuyán", country: "AR", lat: -33.2095, lng: -69.1211 },
    sampleTap: { city: "Buenos Aires", country: "AR", lat: -34.6037, lng: -58.3816 },
    images: [
      "/landing/connected-journey/wine-journey-01.webp",
      "/landing/connected-journey/wine-journey-02.webp",
      "/landing/connected-journey/wine-journey-03.webp",
      "/landing/connected-journey/wine-journey-03.webp",
    ],
  },
  perfume: {
    key: "perfume",
    label: "Packaging premium",
    name: "Estuche Aurora",
    brand: "Aurora Packaging",
    region: "Buenos Aires, Argentina",
    lot: "EA-2047",
    vertical: "perfume",
    category: "Packaging conectado",
    origin: { city: "Buenos Aires", country: "AR", lat: -34.6037, lng: -58.3816 },
    sampleTap: { city: "Santiago", country: "CL", lat: -33.4489, lng: -70.6693 },
    images: [
      "/landing/connected-journey/packaging-journey-01.webp",
      "/landing/connected-journey/packaging-journey-02.webp",
      "/landing/connected-journey/packaging-journey-03.webp",
      "/landing/connected-journey/packaging-journey-03.webp",
    ],
  },
  agro: {
    key: "agro",
    label: "Agro",
    name: "Semilla Norte",
    brand: "CampoNexo",
    region: "Pergamino, Buenos Aires",
    lot: "SN-318",
    vertical: "agro",
    category: "Semillas",
    origin: { city: "Pergamino", country: "AR", lat: -33.8908, lng: -60.5736 },
    sampleTap: { city: "Rosario", country: "AR", lat: -32.9442, lng: -60.6505 },
    images: [
      "/landing/connected-journey/agro-journey-01.webp",
      "/landing/connected-journey/agro-journey-02.webp",
      "/landing/connected-journey/agro-journey-03.webp",
      "/landing/connected-journey/agro-journey-03.webp",
    ],
  },
  agrochem: {
    key: "agrochem",
    label: "Agroquímicos",
    name: "Protección de cultivos · muestra",
    brand: "CampoNexo",
    region: "Pergamino, Buenos Aires",
    lot: "CN-DEMO-01",
    vertical: "agro",
    category: "Agroquímicos · ejemplo ilustrativo",
    origin: { city: "Pergamino", country: "AR", lat: -33.8908, lng: -60.5736 },
    sampleTap: { city: "Rosario", country: "AR", lat: -32.9442, lng: -60.6505 },
    // Illustrative container artwork already used by Demo Lab. This fixture
    // does not describe a registered chemical, dosage or application advice.
    images: [
      "/landing/connected-journey/agro-journey-01.webp",
      "/landing/connected-journey/agro-journey-02.webp",
      "/landing/connected-journey/agro-journey-03.webp",
      "/landing/connected-journey/agro-journey-03.webp",
    ],
  },
  fragrance: {
    key: "fragrance",
    label: "Perfumería",
    name: "Bruma · Eau de Parfum",
    brand: "Casa Bruma",
    region: "Buenos Aires, Argentina",
    lot: "BR-DEMO-01",
    vertical: "perfume",
    category: "Fragancia · ejemplo ilustrativo",
    origin: { city: "Buenos Aires", country: "AR", lat: -34.6037, lng: -58.3816 },
    sampleTap: { city: "Mendoza", country: "AR", lat: -32.8895, lng: -68.8458 },
    // Licensed reference photography, not a photograph of this fictional brand.
    images: [
      "/demo/cosmetics-secure/real-luxury-perfume-pexels.jpg",
      "/demo/cosmetics-secure/real-perfume-bottle-pexels.jpg",
      "/demo/cosmetics-secure/real-cosmetic-bottles-pexels.jpg",
      "/demo/cosmetics-secure/real-luxury-perfume-pexels.jpg",
    ],
  },
};

export function isDemoProductProfileKey(value: string): value is DemoProductProfileKey {
  return value === "wine" || value === "perfume" || value === "agro" || value === "agrochem" || value === "fragrance";
}

export function resolveDemoProductProfile(value: string | null | undefined): DemoProductProfile {
  return isDemoProductProfileKey(String(value || "").trim().toLowerCase())
    ? DEMO_PRODUCT_PROFILES[String(value).trim().toLowerCase() as DemoProductProfileKey]
    : DEMO_PRODUCT_PROFILES.wine;
}

export function resolveDemoExperienceAction(value: string | null | undefined): DemoExperienceAction {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "benefit" || normalized === "support" ? normalized : "warranty";
}
