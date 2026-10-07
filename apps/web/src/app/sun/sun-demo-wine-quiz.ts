import type { AppLocale } from "@product/config";
import type { ClientTriviaQuestion } from "./sun-trivia-model";

export type DemoWineFacts = Readonly<{
  region: string;
  vintage: string;
  barrelMonths: number;
}>;

type DemoWineTriviaInput = {
  productName: string;
  wineryName: string;
  locale: AppLocale;
  /** Facts from the selected demo's published wine sheet, never a live tenant quiz. */
  facts?: DemoWineFacts;
};

const COPY = {
  "es-AR": {
    storage: "¿Dónde conviene guardar una botella de vino?",
    storageOptions: ["En un lugar fresco, sin sol directo", "Junto a una ventana al sol", "Al lado del horno"],
    storageHelp: "Un lugar fresco y sin sol directo ayuda a conservar el vino. Revisá también las indicaciones de la bodega.",
    origin: "¿Dónde encontrás de dónde viene un vino?",
    originOptions: ["En la forma de la botella", "En el origen indicado por la bodega", "En su precio"],
    originHelp: "La región indicada en la ficha o en la etiqueta te permite conocer el origen informado por la bodega.",
    pairing: "¿Qué te ayuda a elegir con qué comida acompañarlo?",
    pairingOptions: ["Sólo el diseño de la etiqueta", "Sólo el tamaño de la botella", "Su estilo y los platos recomendados"],
    pairingHelp: "Los aromas, el estilo y las recomendaciones de la bodega son un buen punto de partida para elegir un acompañamiento.",
    region: (wine: string) => `¿De qué valle viene ${wine}?`,
    regionHelp: (wine: string, winery: string, region: string) => `La ficha de ${wine}, de ${winery}, indica ${region} como origen.`,
    vintage: (wine: string) => `¿Qué cosecha aparece en la ficha de ${wine}?`,
    vintageHelp: (vintage: string) => `La ficha informa la cosecha ${vintage}. La cosecha corresponde al año en que se recogieron las uvas.`,
    barrel: "¿Cuántos meses de barrica informa su ficha?",
    monthOption: (months: number) => `${months} meses`,
    barrelHelp: (months: number) => `La ficha informa ${months} meses de barrica durante la elaboración del vino.`,
  },
  en: {
    storage: "Where should you store a bottle of wine?",
    storageOptions: ["Somewhere cool, away from direct sunlight", "By a sunny window", "Next to the oven"],
    storageHelp: "A cool place away from direct sunlight helps preserve wine. Also check the winery's instructions.",
    origin: "Where can you find out where a wine comes from?",
    originOptions: ["In the shape of the bottle", "In the origin stated by the winery", "In its price"],
    originHelp: "The region listed on the wine sheet or label tells you the origin stated by the winery.",
    pairing: "What helps you choose a food pairing?",
    pairingOptions: ["Only the label design", "Only the bottle size", "Its style and recommended dishes"],
    pairingHelp: "The aromas, style and winery's recommendations are a good starting point for choosing a food pairing.",
    region: (wine: string) => `Which valley does ${wine} come from?`,
    regionHelp: (wine: string, winery: string, region: string) => `The wine sheet for ${wine}, by ${winery}, lists ${region} as its origin.`,
    vintage: (wine: string) => `Which vintage is listed for ${wine}?`,
    vintageHelp: (vintage: string) => `The wine sheet lists the ${vintage} vintage. A vintage is the year the grapes were harvested.`,
    barrel: "How many months of barrel ageing does its wine sheet list?",
    monthOption: (months: number) => `${months} months`,
    barrelHelp: (months: number) => `The wine sheet lists ${months} months of barrel ageing during winemaking.`,
  },
  "pt-BR": {
    storage: "Onde convém guardar uma garrafa de vinho?",
    storageOptions: ["Em um lugar fresco, sem sol direto", "Perto de uma janela com sol", "Ao lado do forno"],
    storageHelp: "Um lugar fresco e sem sol direto ajuda a conservar o vinho. Confira também as orientações da vinícola.",
    origin: "Onde você descobre de onde vem um vinho?",
    originOptions: ["No formato da garrafa", "Na origem informada pela vinícola", "No preço"],
    originHelp: "A região indicada na ficha ou no rótulo permite conhecer a origem informada pela vinícola.",
    pairing: "O que ajuda a escolher com que comida acompanhá-lo?",
    pairingOptions: ["Só o desenho do rótulo", "Só o tamanho da garrafa", "Seu estilo e os pratos recomendados"],
    pairingHelp: "Os aromas, o estilo e as recomendações da vinícola são um bom ponto de partida para escolher uma harmonização.",
    region: (wine: string) => `De qual vale vem ${wine}?`,
    regionHelp: (wine: string, winery: string, region: string) => `A ficha de ${wine}, da ${winery}, informa ${region} como origem.`,
    vintage: (wine: string) => `Qual safra aparece na ficha de ${wine}?`,
    vintageHelp: (vintage: string) => `A ficha informa a safra ${vintage}. A safra corresponde ao ano em que as uvas foram colhidas.`,
    barrel: "Quantos meses em barrica sua ficha informa?",
    monthOption: (months: number) => `${months} meses`,
    barrelHelp: (months: number) => `A ficha informa ${months} meses em barrica durante a elaboração do vinho.`,
  },
} as const;

function factOptions(answer: string, alternatives: string[]) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return [answer, ...alternatives.filter(value => normalize(value) !== normalize(answer)).slice(0, 2)];
}

/** Local education only. Real quizzes still come from the tenant's published configuration. */
export function demoWineTrivia({ productName, wineryName, locale, facts }: DemoWineTriviaInput): ClientTriviaQuestion[] {
  const copy = COPY[locale];
  const year = Number(facts?.vintage);
  const validFacts = facts && facts.region.trim() && /^\d{4}$/.test(facts.vintage)
    && year >= 1800 && year <= 2199 && Number.isInteger(facts.barrelMonths) && facts.barrelMonths >= 0 && facts.barrelMonths <= 60;
  if (validFacts) {
    return [
      { id: "demo-wine-region", prompt: copy.region(productName), options: factOptions(facts.region, ["Valle del Maipo", "Valle de Casablanca", "Valle de Colchagua"]), correctIndex: 0, explanation: copy.regionHelp(productName, wineryName, facts.region), insightTag: "wine-origin" },
      { id: "demo-wine-vintage", prompt: copy.vintage(productName), options: [String(year - 1), facts.vintage, String(year + 1)], correctIndex: 1, explanation: copy.vintageHelp(facts.vintage), insightTag: "wine-vintage" },
      { id: "demo-wine-barrel", prompt: copy.barrel, options: factOptions(copy.monthOption(facts.barrelMonths), [0, 6, 12, 18].map(copy.monthOption)), correctIndex: 0, explanation: copy.barrelHelp(facts.barrelMonths), insightTag: "wine-making" },
    ];
  }
  return [
    { id: "demo-wine-storage", prompt: copy.storage, options: [...copy.storageOptions], correctIndex: 0, explanation: copy.storageHelp, insightTag: "wine-storage" },
    { id: "demo-wine-origin", prompt: copy.origin, options: [...copy.originOptions], correctIndex: 1, explanation: copy.originHelp, insightTag: "wine-origin" },
    { id: "demo-wine-pairing", prompt: copy.pairing, options: [...copy.pairingOptions], correctIndex: 2, explanation: copy.pairingHelp, insightTag: "wine-pairing" },
  ];
}
