import type { SunLocale } from "./sun-locale";
import type { DemoWineProfile } from "./valle-secreto-demo";

const COPY = {
  "es-AR": {
    welcome: "¿Lo vas a regalar o compartir en una comida? Probá una pregunta abajo o escribí la tuya.",
    demo: "Demo interactiva · respuestas de muestra, sin enviar consultas a la marca.",
    label: "Guía de vinos", source: "Información de la viña", general: "Orientación general", sample: "Respuesta de muestra",
    placeholder: "¿Qué te gustaría saber de este vino?", send: "Enviar pregunta", log: "Conversación sobre el vino",
    prompts: ["¿Qué regalo puedo elegir?", "¿Con qué comida lo acompaño?", "¿Cómo lo sirvo?"],
    gift: "Para elegir un regalo, empezá por el gusto de la persona: ¿prefiere vinos suaves o con más cuerpo? Elegí después la presentación y tu presupuesto. La disponibilidad y el precio se consultan con la bodega.",
    pairing: "Para pensar un maridaje, contame qué vas a cocinar. La intensidad del plato, su salsa y la ocasión ayudan a elegir un estilo. La recomendación de este producto depende de la ficha de la bodega.",
    serving: "Consultá la temperatura recomendada en la ficha. Usá una copa limpia y dejá que el vino se abra de a poco; podés probarlo primero antes de decidir si necesita aireación.",
    storage: "Guardá la botella lejos del sol y del calor, en un lugar con temperatura estable. La capacidad de guarda de una cosecha se consulta con la bodega; no se puede deducir sólo del nombre del vino.",
    unknown: "Puedo ayudarte a elegir un regalo, pensar una comida o preparar el servicio. Probá una de las preguntas sugeridas. No tengo un catálogo ni precios confirmados para esta muestra.",
    facts: (p: DemoWineProfile) => `${p.name} es el vino ícono que presenta Valle Secreto. Su ficha indica origen ${p.region} y ${p.barrelMonths} meses en ${p.barrel.toLowerCase()}.`,
    officialGift: (p: DemoWineProfile) => `Para alguien que disfruta tintos con estructura, podés considerar ${p.name}. La ficha lo presenta como el vino ícono de la viña. Antes de elegir, preguntá sus preferencias y consultá precio, stock y presentación directamente con Valle Secreto.`,
    officialServing: (p: DemoWineProfile) => `La viña recomienda servir ${p.name} a ${p.serving}. Es la temperatura de servicio publicada; no es una medición de esta botella ni del sensor de la demo.`,
    officialPairing: (p: DemoWineProfile) => `La ficha de ${p.name} propone ${p.pairing.toLowerCase()}. ¿Qué plato tenés pensado? Podés usar esas recomendaciones como punto de partida.`,
    barrel: (p: DemoWineProfile) => `La ficha de la cosecha ${p.vintage} informa ${p.barrelMonths} meses en ${p.barrel.toLowerCase()}. La simulación NFC no mide la crianza.`,
    treasure: "Valle Secreto ofrece un Mapa del Tesoro: una caminata por la viña siguiendo pistas. El recorrido digital de esta demo muestra una idea para conectarlo al pasaporte; no reserva una visita ni entrega premios.",
    sustainability: "La viña publica prácticas de energía solar, tratamiento de residuos líquidos y reutilización de materiales. Podés consultar sus documentos en la sección de sustentabilidad de esta demo. No contamos con una huella ambiental por botella.",
  },
  en: {
    welcome: "A gift or a meal with friends? Try a question below or write your own.", demo: "Interactive demo · sample answers, with no question sent to the brand.",
    label: "Wine guide", source: "Producer information", general: "General guidance", sample: "Sample answer", placeholder: "What would you like to know about this wine?", send: "Send question", log: "Wine conversation",
    prompts: ["How do I choose a gift?", "What food can I pair it with?", "How should I serve it?"],
    gift: "Start with the recipient's preferences: lighter wines or more body? Then choose a presentation and budget. Ask the winery for availability and prices.",
    pairing: "Tell me what you plan to cook. The dish, sauce and occasion can help you choose a style. Product-specific pairings need the producer's technical sheet.",
    serving: "Check the producer's recommended serving temperature. Use a clean glass and taste the wine before deciding whether to aerate it.",
    storage: "Keep bottles away from sunlight and heat, at a stable temperature. Ask the producer about a particular vintage's aging potential.",
    unknown: "I can help you choose a gift, plan a pairing or prepare the serving. Try a suggested question. This sample has no confirmed catalog or prices.",
    facts: (p: DemoWineProfile) => `${p.name} is Valle Secreto's flagship wine. Its sheet lists ${p.region} as its origin and ${p.barrelMonths} months in new French oak Magnum barrels.`,
    officialGift: (p: DemoWineProfile) => `Consider ${p.name} for someone who likes structured red wines. The producer presents it as its flagship wine. Check the recipient's tastes, price, stock and packaging with Valle Secreto.`,
    officialServing: (p: DemoWineProfile) => `The producer recommends serving ${p.name} at ${p.serving}. This is a published recommendation, not a measurement of this bottle or the demo sensor.`,
    officialPairing: (p: DemoWineProfile) => `The sheet for ${p.name} suggests lamb, game and duck. What are you planning to cook? Those pairings can be a starting point.`,
    barrel: (p: DemoWineProfile) => `The ${p.vintage} sheet reports ${p.barrelMonths} months in new French oak Magnum barrels. The NFC simulation does not measure aging.`,
    treasure: "Valle Secreto offers a Treasure Map walk through the vineyard, following clues. The digital demo explores a passport connection; it does not book a visit or award prizes.",
    sustainability: "The winery publishes practices for solar energy, liquid waste treatment and material reuse. View its documents in this demo's sustainability section. No bottle-level footprint is available.",
  },
  "pt-BR": {
    welcome: "Um presente ou uma refeição com amigos? Experimente uma pergunta abaixo ou escreva a sua.", demo: "Demo interativa · respostas de exemplo, sem enviar consultas à marca.",
    label: "Guia de vinhos", source: "Informações da vinícola", general: "Orientação geral", sample: "Resposta de exemplo", placeholder: "O que gostaria de saber sobre este vinho?", send: "Enviar pergunta", log: "Conversa sobre o vinho",
    prompts: ["Como escolher um presente?", "Com que comida posso harmonizar?", "Como devo servir?"],
    gift: "Comece pelo gosto da pessoa: vinhos mais leves ou encorpados? Depois escolha a apresentação e o orçamento. Consulte disponibilidade e preço com a vinícola.",
    pairing: "Conte o que vai cozinhar. A intensidade do prato, o molho e a ocasião ajudam a escolher um estilo. A harmonização deste produto depende da ficha da vinícola.",
    serving: "Confira a temperatura de serviço recomendada pelo produtor. Use uma taça limpa e prove antes de decidir se precisa de aeração.",
    storage: "Guarde longe do sol e do calor, em temperatura estável. Consulte a vinícola sobre o potencial de guarda de cada safra.",
    unknown: "Posso ajudar a escolher um presente, pensar numa refeição ou preparar o serviço. Experimente uma pergunta sugerida. Esta demo não tem catálogo ou preços confirmados.",
    facts: (p: DemoWineProfile) => `${p.name} é o vinho ícone da Valle Secreto. A ficha informa origem ${p.region} e ${p.barrelMonths} meses em barricas Magnum novas de carvalho francês.`,
    officialGift: (p: DemoWineProfile) => `Considere ${p.name} para quem gosta de tintos estruturados. A vinícola o apresenta como seu vinho ícone. Consulte preferências, preço, estoque e embalagem com Valle Secreto.`,
    officialServing: (p: DemoWineProfile) => `A vinícola recomenda servir ${p.name} a ${p.serving}. É uma recomendação publicada, não uma medição desta garrafa ou do sensor da demo.`,
    officialPairing: (p: DemoWineProfile) => `A ficha de ${p.name} sugere cordeiro, carnes de caça e pato. Qual prato você pretende preparar? Essas sugestões são um ponto de partida.`,
    barrel: (p: DemoWineProfile) => `A ficha da safra ${p.vintage} informa ${p.barrelMonths} meses em barricas Magnum novas de carvalho francês. A simulação NFC não mede a maturação.`,
    treasure: "Valle Secreto oferece um Mapa do Tesouro: uma caminhada pela vinícola seguindo pistas. O percurso digital da demo explora uma conexão ao passaporte; não reserva visitas nem entrega prêmios.",
    sustainability: "A vinícola publica práticas de energia solar, tratamento de resíduos líquidos e reutilização de materiais. Consulte os documentos na seção de sustentabilidade. Não há pegada ambiental por garrafa disponível.",
  },
} as const;

export function demoSommelierCopy(locale: SunLocale) { return COPY[locale]; }

export function demoSommelierAnswer(question: string, locale: SunLocale, wine?: DemoWineProfile | null) {
  const text = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const copy = COPY[locale];
  let answer: string;
  let sourceUrl: string | undefined;
  if (wine && /tesoro|treasure|pista|caminata|tour|visita/.test(text)) { answer = copy.treasure; sourceUrl = wine.experiences; }
  else if (wine && /sustent|sustain|solar|agua|water|carbon|co2|recicl/.test(text)) { answer = copy.sustainability; sourceUrl = wine.practices; }
  else if (/regalo|present|gift|comprar|buy|compra/.test(text)) { answer = wine ? copy.officialGift(wine) : copy.gift; sourceUrl = wine?.technicalSheet; }
  else if (/marida|comida|comer|food|pair|harmon|plato|prato|meal/.test(text)) { answer = wine ? copy.officialPairing(wine) : copy.pairing; sourceUrl = wine?.technicalSheet; }
  else if (/serv|sirv|temper|frio|cold/.test(text)) { answer = wine ? copy.officialServing(wine) : copy.serving; sourceUrl = wine?.technicalSheet; }
  else if (wine && /barrica|barrel|oak|crianza|matur|meses|months/.test(text)) { answer = copy.barrel(wine); sourceUrl = wine.technicalSheet; }
  else if (/guard|stor|tiempo|aging/.test(text)) { answer = copy.storage; }
  else if (wine && /origen|origin|cepa|grape|vino|wine|safra|cosecha|profundo/.test(text)) { answer = copy.facts(wine); sourceUrl = wine.technicalSheet; }
  else { answer = copy.unknown; }
  return { text: answer, sourceUrl, sourceLabel: sourceUrl ? copy.source : copy.general };
}
