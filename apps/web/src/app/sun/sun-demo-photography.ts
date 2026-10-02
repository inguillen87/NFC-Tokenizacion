type PhotographyContext = {
  isDemoPreview: boolean;
  isDemoLabHandoff: boolean;
  visual: string;
  vertical: string;
};

// A photographic reference is an explicit, server-owned demo selection.
// It never supplies media or identity for an actual NFC, QR or snapshot result.
export function resolveSunDemoPhotography(context: PhotographyContext) {
  if (!context.isDemoPreview || context.isDemoLabHandoff || context.vertical !== "vino" || context.visual !== "rutini") return null;
  return {
    name: "Apartado Gran Malbec",
    brand: "Rutini Wines",
    region: "Valle de Uco, Mendoza",
    imageUrl: "/sun/references/rutini-apartado.webp",
    sourceUrl: "https://rutiniwines.com/apartado/",
    sourceLabel: "Fotografía: Rutini Wines",
    lot: "MUESTRA-VISUAL",
  } as const;
}
