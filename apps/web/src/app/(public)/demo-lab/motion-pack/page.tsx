import type { Metadata } from "next";
import type { CSSProperties } from "react";
import type { AppLocale } from "@product/config";
import { getWebI18n } from "../../../lib/locale";

type ProductKey = "wine" | "seeds" | "cream" | "perfume" | "bracelet" | "ticket";

type MotionFormat = {
  id: "story" | "square" | "wide";
  format: string;
  spec: string;
  title: string;
  body: string;
  label: string;
  stat: string;
  frameClass: string;
  beats: string[];
};

type MotionLens = {
  label: string;
  title: string;
  body: string;
  signal: string;
};

type ProductStory = {
  title: string;
  body: string;
  seal: string;
};

type MotionCopy = {
  metadata: { title: string; description: string; ogDescription: string };
  benchmark: Array<{ source: string; move: string; upgrade: string; href: string }>;
  formats: MotionFormat[];
  productLabels: Record<ProductKey, string>;
  productCards: Record<ProductKey, ProductStory>;
  hero: { kicker: string; title: string; body: string; back: string; formats: string; cardTitle: string; cardBody: string; chips: string[]; status: string };
  director: { label: string; title: string; body: string; lensTitle: string; verdict: string };
  lenses: MotionLens[];
  sections: { benchmark: string; benchmarkTitle: string; formats: string; formatsTitle: string; products: string; productsTitle: string; storyboard: string; storyboardTitle: string };
  purpose: { label: string; title: string; body: string; cards: Array<{ title: string; body: string }> };
  frame: { route: string[]; nfcOk: string; chainOk: string; passport: string; tokenTitles: string[]; proofTypes: string[]; proofTitles: string[]; proofBodies: string[] };
  story: Array<{ title: string; body: string }>;
};

const productKeys: ProductKey[] = ["wine", "seeds", "cream", "perfume", "bracelet", "ticket"];

const copyByLocale: Record<AppLocale, MotionCopy> = {
  "es-AR": {
    metadata: {
      title: "Paquete visual | Laboratorio nexID",
      description: "Piezas visuales animadas para identidad de producto, autenticacion NFC, dueño, tokenizacion y tienda.",
      ogDescription: "Piezas visuales para producto conectado, pasaporte digital y dueño tokenizado.",
    },
    benchmark: [
      { source: "Qliktag", move: "NFC + tokenizacion", upgrade: "SUN anti copia, UID hasheado, reclamo de dueño y tienda en el mismo relato.", href: "https://qliktag.com/" },
      { source: "Arianee", move: "Pasaporte digital + dueño", upgrade: "Pasaporte, dueño, postventa, recompra y acceso por token sin friccion para LatAm.", href: "https://www.arianee.com/digital-product-passport" },
      { source: "Authentic Vision", move: "Seguridad fisica visible", upgrade: "Etiqueta NFC cerrada, apertura, sello roto y copia bloqueada como escena entendible.", href: "https://www.authenticvision.com/authentic-visions-unique-patented-holographic-fingerprint/" },
      { source: "Certilogo", move: "Recorrido de autenticacion", upgrade: "El consumidor no solo verifica: reclama, guarda, recibe beneficios y compra.", href: "https://discover.certilogo.com/pages/secure-by-design-product-authentication" },
      { source: "atma.io / Digimarc", move: "Escala + pasaporte + trazabilidad", upgrade: "Vista para empresas con lote, cadena, riesgo, datos, demanda y cumplimiento operativo.", href: "https://www.atma.io/" },
      { source: "collectID", move: "Producto fisico + NFT + comunidad", upgrade: "NFT utilitario conectado a producto real, evento, club, billetera y tienda.", href: "https://www.sportsbusinessjournal.com/Daily/Issues/2022/11/09/Technology/collectid-physical-merchandise-products-authentication-nfc-tags-web3-metaverse-fans" },
    ],
    formats: [
      { id: "story", format: "9:16 Historia / video corto", spec: "1080 x 1920", title: "Story: del toque al dueño en 12 segundos", body: "Para Instagram, ventas por WhatsApp y prueba rapida: producto real, NFC cerrado, toque vivo, copia bloqueada y beneficio abierto.", label: "Venta en redes", stat: "12 s", frameClass: "nexid-motion-frame--story", beats: ["Producto real", "NFC cerrado", "Toque valido", "NFT + reclamo"] },
      { id: "square", format: "1:1 Publicacion / anuncio", spec: "1080 x 1080", title: "Post: por que un producto genera ingresos", body: "Para publicaciones y anuncios: autenticidad, dueño, recompra y datos accionables en una pieza facil de leer.", label: "Prueba comercial", stat: "4 caminos", frameClass: "nexid-motion-frame--square", beats: ["Confianza", "Dueño", "Comunidad", "Tienda"] },
      { id: "wide", format: "16:9 Presentacion / reunion", spec: "1920 x 1080", title: "Deck: infraestructura que escala por marca", body: "Para reuniones y presentaciones: ID por pieza, cadena de custodia, SUN, billetera, datos y capa comercial.", label: "Presentacion empresas", stat: "1 plataforma", frameClass: "nexid-motion-frame--wide", beats: ["ID de pieza", "Cadena", "Riesgo", "Ingresos"] },
    ],
    productLabels: { wine: "Vino", seeds: "Semillas", cream: "Crema", perfume: "Perfume", bracelet: "Pulsera", ticket: "Entrada" },
    productCards: {
      wine: { title: "Botella premium", body: "Capsula y corcho muestran el sello tamper: si se abre, cambia el estado y se corta la promesa visual.", seal: "Sello TT en capsula" },
      seeds: { title: "Bolsa agricola", body: "UID por lote, origen y lectura de campo para trazabilidad sin que parezca solo un QR.", seal: "QR + NFC UID" },
      cream: { title: "Frasco cosmetico", body: "Etiqueta puente entre tapa y cuerpo para que la apertura sea evidente y entendible.", seal: "Puente tapa-cuerpo" },
      perfume: { title: "Perfume edicion limitada", body: "Sello en cuello y tapa: el punto de apertura se vuelve la prueba anti falsificacion.", seal: "Sello cuello-tapa" },
      bracelet: { title: "Pulsera de evento", body: "Una mano, un celular y una validacion de ingreso: acceso, club y recompra quedan en una misma escena.", seal: "Tap real de ingreso" },
      ticket: { title: "Entrada tokenizada", body: "El pase deja de ser un PDF: se transforma en acceso, identidad y post evento.", seal: "Ticket + wallet" },
    },
    hero: {
      kicker: "Motion como sales studio",
      title: "Una pelicula corta de producto: tocar, confiar, reclamar y vender.",
      body: "El motion pack no debe competir con Demo Lab: debe convertir esa demo en material de venta. Cada pieza arranca con un producto real, muestra el punto fisico donde se rompe o valida el sello, lleva al consumidor al claim/NFT y cierra con datos, tienda y relacion directa.",
      back: "Volver al laboratorio",
      formats: "Ver formatos",
      cardTitle: "Producto real / toque vivo / negocio",
      cardBody: "La pieza tiene que contestar en segundos: donde esta el sello, que cambia al abrir, quien queda como dueño y que se activa despues.",
      chips: ["Producto primero", "Cero jerga", "Claim + NFT + tienda"],
      status: "Tap valido",
    },
    director: {
      label: "Punto de vista",
      title: "Mantenerlo, pero con una razon: que sea el estudio narrativo de nexID.",
      body: "Si solo muestra formatos, sobra. Si cuenta la historia como una mini pelicula premium, sirve para vender a bodegas, laboratorios, eventos, gobiernos e inversores sin abrir veinte pantallas. La perspectiva correcta no es tecnica: es valor percibido, confianza fisica y post venta activable.",
      lensTitle: "Cuatro lecturas en la misma escena",
      verdict: "Decision: el motion pack queda, pero deja de ser maqueta y pasa a ser biblioteca comercial exportable.",
    },
    lenses: [
      { label: "Consumidor", title: "Toco y entiendo que ahora es mio", body: "El celular valida, explica el sello y ofrece claim, garantia, wallet y beneficios sin pedirle que entienda blockchain.", signal: "Claim + wallet" },
      { label: "Marca", title: "Convierto packaging en canal propio", body: "Cada producto abre datos de demanda, recompra, comunidad y marketplace con una experiencia que parece premium.", signal: "CRM + venta" },
      { label: "Operaciones", title: "Veo trazabilidad y riesgo real", body: "La pieza muestra ruta, lote, apertura, copia bloqueada y puntos de lectura como evidencia para equipos internos.", signal: "Mapa + riesgo" },
      { label: "Inversor", title: "El activo fisico produce datos e ingresos", body: "La historia cierra en token/NFT, owner graph, tienda y analitica: no es autenticacion aislada, es plataforma.", signal: "NFT + revenue" },
    ],
    sections: {
      benchmark: "Aprendizajes de mercado",
      benchmarkTitle: "La competencia gana cuando simplifica confianza. nexID tiene que sumar algo mas: producto fisico, mapa, dueño, NFT y comercio en una sola historia.",
      formats: "Listo para exportar",
      formatsTitle: "Cada formato cuenta el mismo guion, pero con distinto ritmo: red social, anuncio y reunion ejecutiva.",
      products: "Sistema de productos",
      productsTitle: "Cada vertical debe mostrar donde vive el sello y por que el toque tiene valor real.",
      storyboard: "Guion base",
      storyboardTitle: "El guion unico que se repite en landing, Demo Lab, portal, dashboard y mobile tap.",
    },
    purpose: {
      label: "Para que existe",
      title: "No es motion por motion. Es una prueba corta para vender sin confundir.",
      body: "Si una bodega, laboratorio, ticketera o marca premium no entiende el valor en pocos segundos, perdimos. El pack fuerza la explicacion a ir al hueso: producto real, prueba viva, dueño y canal de venta.",
      cards: [
        { title: "Vender sin explicar blockchain", body: "Primero se ve el producto y la prueba. Blockchain aparece solo cuando suma dueño, historial, reventa o acceso." },
        { title: "Superar la autenticacion comun", body: "No termina en \"es original\". Despues del toque abre reclamo, beneficios, tienda, datos y relacion directa con la marca." },
        { title: "Unificar todas las superficies", body: "La misma historia debe vivir en landing, demo, dashboard, app, pitch, redes y reuniones comerciales." },
        { title: "Crear material exportable", body: "Story, post y deck salen del mismo sistema visual para probar, vender, iterar y comparar contra referencias reales." },
      ],
    },
    frame: {
      route: ["Origen", "Toque", "Dueño"],
      nfcOk: "SUN OK",
      chainOk: "Cadena OK",
      passport: "Pasaporte digital",
      tokenTitles: ["NFT listo", "Mapa de dueños", "Panel de empresas"],
      proofTypes: ["Celular", "Celular", "Panel"],
      proofTitles: ["Reclamar ahora", "Beneficios abiertos", "Riesgo limpio"],
      proofBodies: ["billetera + tienda", "club + recompra", "tx_hash + demanda"],
    },
    story: [
      { title: "Producto nace", body: "La marca asigna UID, lote y experiencia antes de que el consumidor toque el producto." },
      { title: "Toque fisico", body: "El consumidor verifica desde el celular, sin app obligatoria y con distancia/origen claro." },
      { title: "SUN valida", body: "El sistema une toque fresco, cuenta de marca, producto, ubicacion y reglas comerciales." },
      { title: "Copia bloqueada", body: "Copiar una URL no abre beneficios, reclamo, tokenizacion ni tienda sensible." },
      { title: "Dueño reclama", body: "El usuario guarda producto, garantia, beneficios y relacion directa con la marca." },
      { title: "NFT + tienda", body: "El pasaporte se vuelve activo: NFT, historial, recompra, eventos y datos accionables." },
    ],
  },
  "pt-BR": {
    metadata: {
      title: "Pacote visual | Laboratorio demo nexID",
      description: "Pecas visuais animadas para identidade de produto, autenticacao NFC, dono, tokenizacao e loja.",
      ogDescription: "Pecas visuais para produto conectado, passaporte digital e dono tokenizado.",
    },
    benchmark: [
      { source: "Qliktag", move: "NFC + tokenizacao", upgrade: "SUN anti copia, UID com hash, reivindicacao de dono e loja no mesmo relato.", href: "https://qliktag.com/" },
      { source: "Arianee", move: "Passaporte digital + dono", upgrade: "Passaporte, dono, pos-venda, recompra e acesso por token sem friccao para LatAm.", href: "https://www.arianee.com/digital-product-passport" },
      { source: "Authentic Vision", move: "Seguranca fisica visivel", upgrade: "Etiqueta NFC fechada, abertura, lacre rompido e copia bloqueada em uma cena simples.", href: "https://www.authenticvision.com/authentic-visions-unique-patented-holographic-fingerprint/" },
      { source: "Certilogo", move: "Jornada de autenticacao", upgrade: "O consumidor nao so verifica: reivindica, salva, recebe beneficios e compra.", href: "https://discover.certilogo.com/pages/secure-by-design-product-authentication" },
      { source: "atma.io / Digimarc", move: "Escala + passaporte + rastreio", upgrade: "Visao para empresas com lote, cadeia, risco, dados, demanda e operacao.", href: "https://www.atma.io/" },
      { source: "collectID", move: "Produto fisico + NFT + comunidade", upgrade: "NFT utilitario conectado a produto real, evento, clube, carteira e loja.", href: "https://www.sportsbusinessjournal.com/Daily/Issues/2022/11/09/Technology/collectid-physical-merchandise-products-authentication-nfc-tags-web3-metaverse-fans" },
    ],
    formats: [
      { id: "story", format: "9:16 Historia / video curto", spec: "1080 x 1920", title: "Story: do toque ao dono em 12 segundos", body: "Para Instagram, vendas por WhatsApp e demo rapida: produto real, NFC fechado, toque vivo, copia bloqueada e beneficio aberto.", label: "Venda em redes", stat: "12 s", frameClass: "nexid-motion-frame--story", beats: ["Produto real", "NFC fechado", "Toque valido", "NFT + dono"] },
      { id: "square", format: "1:1 Publicacao / anuncio", spec: "1080 x 1080", title: "Post: por que um produto gera receita", body: "Para publicacoes e anuncios: autenticidade, dono, recompra e dados acionaveis em uma peca facil de ler.", label: "Prova comercial", stat: "4 caminhos", frameClass: "nexid-motion-frame--square", beats: ["Confianca", "Dono", "Comunidade", "Loja"] },
      { id: "wide", format: "16:9 Apresentacao / reuniao", spec: "1920 x 1080", title: "Deck: infraestrutura que escala por marca", body: "Para reunioes e apresentacoes: ID por item, cadeia de custodia, SUN, carteira, dados e camada comercial.", label: "Apresentacao empresas", stat: "1 plataforma", frameClass: "nexid-motion-frame--wide", beats: ["ID do item", "Cadeia", "Risco", "Receita"] },
    ],
    productLabels: { wine: "Vinho", seeds: "Sementes", cream: "Creme", perfume: "Perfume", bracelet: "Pulseira", ticket: "Ingresso" },
    productCards: {
      wine: { title: "Garrafa premium", body: "Capsula e rolha mostram o lacre tamper: se abre, o estado muda e a promessa visual se rompe.", seal: "Selo TT na capsula" },
      seeds: { title: "Saco agricola", body: "UID por lote, origem e leitura de campo para rastreio sem parecer apenas um QR.", seal: "QR + NFC UID" },
      cream: { title: "Frasco cosmetico", body: "Etiqueta ponte entre tampa e corpo para que a abertura fique evidente.", seal: "Ponte tampa-corpo" },
      perfume: { title: "Perfume edicao limitada", body: "Selo no pescoco e tampa: o ponto de abertura vira prova antifalsificacao.", seal: "Selo pescoco-tampa" },
      bracelet: { title: "Pulseira de evento", body: "Uma mao, um celular e uma validacao de entrada: acesso, clube e recompra na mesma cena.", seal: "Tap real de entrada" },
      ticket: { title: "Ingresso tokenizado", body: "O passe deixa de ser um PDF: vira acesso, identidade e pos-evento.", seal: "Ticket + wallet" },
    },
    hero: {
      kicker: "Motion como sales studio",
      title: "Um filme curto de produto: tocar, confiar, reivindicar e vender.",
      body: "O motion pack nao deve competir com o Demo Lab: deve transformar a demo em material de venda. Cada peca comeca com produto real, mostra o ponto fisico onde o selo rompe ou valida, leva o consumidor ao claim/NFT e fecha com dados, loja e relacao direta.",
      back: "Voltar ao laboratorio",
      formats: "Ver formatos",
      cardTitle: "Produto real / toque vivo / negocio",
      cardBody: "A peca precisa responder em segundos: onde esta o selo, o que muda ao abrir, quem vira dono e o que ativa depois.",
      chips: ["Produto primeiro", "Sem jargao", "Claim + NFT + loja"],
      status: "Toque valido",
    },
    director: {
      label: "Ponto de vista",
      title: "Manter, mas com uma razao: ser o estudio narrativo da nexID.",
      body: "Se so mostra formatos, sobra. Se conta a historia como um mini filme premium, vende para vinicolas, laboratorios, eventos, governos e investidores sem abrir vinte telas. A perspectiva certa nao e tecnica: e valor percebido, confianca fisica e pos-venda ativavel.",
      lensTitle: "Quatro leituras na mesma cena",
      verdict: "Decisao: o motion pack fica, mas deixa de ser maquete e vira biblioteca comercial exportavel.",
    },
    lenses: [
      { label: "Consumidor", title: "Toco e entendo que agora e meu", body: "O celular valida, explica o selo e oferece claim, garantia, wallet e beneficios sem explicar blockchain.", signal: "Claim + wallet" },
      { label: "Marca", title: "Transformo embalagem em canal proprio", body: "Cada produto abre demanda, recompra, comunidade e marketplace com experiencia premium.", signal: "CRM + venda" },
      { label: "Operacao", title: "Vejo rastreio e risco real", body: "A peca mostra rota, lote, abertura, copia bloqueada e pontos de leitura como evidencia interna.", signal: "Mapa + risco" },
      { label: "Investidor", title: "O ativo fisico produz dados e receita", body: "A historia fecha em token/NFT, owner graph, loja e analitica: nao e autenticacao isolada, e plataforma.", signal: "NFT + receita" },
    ],
    sections: {
      benchmark: "Aprendizados de mercado",
      benchmarkTitle: "A concorrencia ganha quando simplifica confianca. nexID precisa somar algo mais: produto fisico, mapa, dono, NFT e comercio em uma so historia.",
      formats: "Pronto para exportar",
      formatsTitle: "Cada formato conta o mesmo roteiro, mas com ritmo diferente: rede social, anuncio e reuniao executiva.",
      products: "Sistema de produtos",
      productsTitle: "Cada vertical deve mostrar onde vive o selo e por que o toque tem valor real.",
      storyboard: "Roteiro base",
      storyboardTitle: "O roteiro unico que se repete em landing, Demo Lab, portal, dashboard e mobile tap.",
    },
    purpose: {
      label: "Para que existe",
      title: "Nao e motion por motion. E uma prova curta para vender sem confundir.",
      body: "Se uma vinicola, laboratorio, bilheteria ou marca premium nao entende o valor em poucos segundos, perdemos. O pack forca a explicacao a ir direto ao ponto: produto real, prova viva, dono e canal de venda.",
      cards: [
        { title: "Vender sem explicar blockchain", body: "Primeiro aparece o produto e a prova. Blockchain entra so quando soma dono, historico, revenda ou acesso." },
        { title: "Superar autenticacao comum", body: "Nao termina em \"e original\". Depois do toque abre dono, beneficios, loja, dados e relacao direta com a marca." },
        { title: "Unificar todas as superficies", body: "A mesma historia deve viver em landing, demo, dashboard, app, pitch, redes e reunioes comerciais." },
        { title: "Criar material exportavel", body: "Story, post e deck saem do mesmo sistema visual para provar, vender, iterar e comparar com referencias reais." },
      ],
    },
    frame: {
      route: ["Origem", "Toque", "Dono"],
      nfcOk: "SUN OK",
      chainOk: "Cadeia OK",
      passport: "Passaporte digital",
      tokenTitles: ["Claim pendente", "Mapa de donos", "Painel empresas"],
      proofTypes: ["Celular", "Celular", "Painel"],
      proofTitles: ["Reivindicar agora", "Beneficios abertos", "Risco limpo"],
      proofBodies: ["carteira + loja", "clube + recompra", "tx_hash + demanda"],
    },
    story: [
      { title: "Produto nasce", body: "A marca atribui UID, lote e experiencia antes do consumidor tocar o produto." },
      { title: "Toque fisico", body: "O consumidor verifica pelo celular, sem app obrigatorio e com distancia/origem claros." },
      { title: "SUN valida", body: "O sistema une toque fresco, tenant, produto, localizacao e regras comerciais." },
      { title: "Copia bloqueada", body: "Copiar uma URL nao abre beneficios, dono, tokenizacao nem loja sensivel." },
      { title: "Dono reivindica", body: "O usuario salva produto, garantia, beneficios e relacao direta com a marca." },
      { title: "NFT + loja", body: "O passaporte fica ativo: NFT, historico, recompra, eventos e dados acionaveis." },
    ],
  },
  en: {
    metadata: {
      title: "Visual pack | nexID Demo Lab",
      description: "Animated visual pieces for product identity, NFC authentication, ownership, tokenization and commerce.",
      ogDescription: "Visual pieces for connected products, digital passports and tokenized ownership.",
    },
    benchmark: [
      { source: "Qliktag", move: "NFC + tokenization", upgrade: "Anti-copy SUN, hashed UID, ownership claim and commerce in one story.", href: "https://qliktag.com/" },
      { source: "Arianee", move: "Digital passport + ownership", upgrade: "Passport, owner, after-sale, repurchase and token access with low friction.", href: "https://www.arianee.com/digital-product-passport" },
      { source: "Authentic Vision", move: "Visible physical security", upgrade: "Closed NFC label, opening, broken seal and blocked copy as a clear scene.", href: "https://www.authenticvision.com/authentic-visions-unique-patented-holographic-fingerprint/" },
      { source: "Certilogo", move: "Authentication journey", upgrade: "The consumer does not only verify: they claim, save, get benefits and buy.", href: "https://discover.certilogo.com/pages/secure-by-design-product-authentication" },
      { source: "atma.io / Digimarc", move: "Scale + passport + traceability", upgrade: "Enterprise view with lot, chain, risk, data, demand and operating control.", href: "https://www.atma.io/" },
      { source: "collectID", move: "Physical product + NFT + community", upgrade: "Useful NFT connected to a real product, event, club, wallet and store.", href: "https://www.sportsbusinessjournal.com/Daily/Issues/2022/11/09/Technology/collectid-physical-merchandise-products-authentication-nfc-tags-web3-metaverse-fans" },
    ],
    formats: [
      { id: "story", format: "9:16 Story / short video", spec: "1080 x 1920", title: "Story: tap to owner in 12 seconds", body: "For Instagram, WhatsApp sales and quick demos: real product, closed NFC, live tap, blocked copy and open benefit.", label: "Social sales", stat: "12 s", frameClass: "nexid-motion-frame--story", beats: ["Real product", "Closed NFC", "Valid tap", "NFT + claim"] },
      { id: "square", format: "1:1 Post / ad", spec: "1080 x 1080", title: "Post: why one product creates revenue", body: "For posts and ads: authenticity, owner, repurchase and actionable data in one readable piece.", label: "Commercial proof", stat: "4 paths", frameClass: "nexid-motion-frame--square", beats: ["Trust", "Owner", "Community", "Store"] },
      { id: "wide", format: "16:9 Presentation / meeting", spec: "1920 x 1080", title: "Deck: infrastructure that scales by brand", body: "For meetings and presentations: item ID, chain of custody, SUN, wallet, data and commerce layer.", label: "Enterprise presentation", stat: "1 platform", frameClass: "nexid-motion-frame--wide", beats: ["Item ID", "Chain", "Risk", "Revenue"] },
    ],
    productLabels: { wine: "Wine", seeds: "Seeds", cream: "Cream", perfume: "Perfume", bracelet: "Bracelet", ticket: "Ticket" },
    productCards: {
      wine: { title: "Premium bottle", body: "Capsule and cork show the tamper seal: if it opens, status changes and the visual promise breaks.", seal: "TT seal on capsule" },
      seeds: { title: "Agriculture bag", body: "UID by lot, origin and field read for traceability that feels stronger than a plain QR.", seal: "QR + NFC UID" },
      cream: { title: "Cosmetic jar", body: "Bridge label between lid and body so opening becomes visible and easy to understand.", seal: "Lid-body bridge" },
      perfume: { title: "Limited perfume", body: "Seal on neck and cap: the opening point becomes the anti-counterfeit proof.", seal: "Neck-cap seal" },
      bracelet: { title: "Event wristband", body: "A hand, a phone and a real entry validation: access, club and repurchase in one scene.", seal: "Real entry tap" },
      ticket: { title: "Tokenized ticket", body: "The pass stops being a PDF: it becomes access, identity and post-event relationship.", seal: "Ticket + wallet" },
    },
    hero: {
      kicker: "Motion as sales studio",
      title: "A short product film: tap, trust, claim and sell.",
      body: "The motion pack should not compete with Demo Lab: it should turn that demo into sales material. Every piece starts with a real product, shows the physical point where the seal breaks or validates, takes the consumer to claim/NFT and closes with data, commerce and direct relationship.",
      back: "Back to lab",
      formats: "See formats",
      cardTitle: "Real product / live tap / business",
      cardBody: "The piece must answer in seconds: where the seal lives, what changes when opened, who becomes owner and what activates next.",
      chips: ["Product first", "No jargon", "Claim + NFT + store"],
      status: "Valid tap",
    },
    director: {
      label: "Point of view",
      title: "Keep it, but with a reason: make it nexID's narrative studio.",
      body: "If it only shows formats, it is redundant. If it tells the story as a premium short product film, it sells to wineries, labs, events, governments and investors without opening twenty screens. The right perspective is not technical: perceived value, physical trust and activated post-sale.",
      lensTitle: "Four readings in the same scene",
      verdict: "Decision: the motion pack stays, but becomes an exportable commercial library instead of a mockup.",
    },
    lenses: [
      { label: "Consumer", title: "I tap and understand it is mine", body: "The phone validates, explains the seal and offers claim, warranty, wallet and benefits without teaching blockchain.", signal: "Claim + wallet" },
      { label: "Brand", title: "I turn packaging into a direct channel", body: "Each product opens demand data, repurchase, community and marketplace with a premium experience.", signal: "CRM + sale" },
      { label: "Operations", title: "I see traceability and real risk", body: "The piece shows route, lot, opening, blocked copy and read points as internal evidence.", signal: "Map + risk" },
      { label: "Investor", title: "The physical asset creates data and revenue", body: "The story closes with token/NFT, owner graph, store and analytics: not isolated auth, a platform.", signal: "NFT + revenue" },
    ],
    sections: {
      benchmark: "Market learnings",
      benchmarkTitle: "Competitors win when they simplify trust. nexID has to add more: physical product, map, owner, NFT and commerce in one story.",
      formats: "Ready to export",
      formatsTitle: "Each format tells the same script with a different rhythm: social, ad and executive meeting.",
      products: "Product system",
      productsTitle: "Each vertical must show where the seal lives and why the tap has real value.",
      storyboard: "Base script",
      storyboardTitle: "The one script repeated across landing, Demo Lab, portal, dashboard and mobile tap.",
    },
    purpose: {
      label: "Why it exists",
      title: "This is not motion for motion. It is a short proof to sell without confusion.",
      body: "If a winery, lab, ticketing company or premium brand cannot understand the value in a few seconds, we lose. The pack forces the explanation to go straight to the point: real product, live proof, owner and sales channel.",
      cards: [
        { title: "Sell without explaining blockchain", body: "The product and proof come first. Blockchain only appears when it adds ownership, history, resale or access." },
        { title: "Beat common authentication", body: "It does not end at \"it is original\". After the tap it opens claim, benefits, store, data and a direct brand relationship." },
        { title: "Unify every surface", body: "The same story must work across landing, demo, dashboard, app, pitch, social and sales meetings." },
        { title: "Create exportable material", body: "Story, post and deck come from the same visual system to prove, sell, iterate and compare against real references." },
      ],
    },
    frame: {
      route: ["Origin", "Tap", "Owner"],
      nfcOk: "SUN OK",
      chainOk: "Chain OK",
      passport: "Digital passport",
      tokenTitles: ["Claim pending", "Owner map", "Enterprise panel"],
      proofTypes: ["Phone", "Phone", "Panel"],
      proofTitles: ["Claim now", "Benefits open", "Risk clean"],
      proofBodies: ["wallet + store", "club + repurchase", "tx_hash + demand"],
    },
    story: [
      { title: "Product is born", body: "The brand assigns UID, lot and experience before the consumer taps the product." },
      { title: "Physical tap", body: "The consumer verifies from the phone, with no mandatory app and clear distance/origin." },
      { title: "SUN validates", body: "The system joins fresh tap, tenant, product, location and commercial rules." },
      { title: "Copy blocked", body: "Copying a URL does not open benefits, claim, tokenization or sensitive store actions." },
      { title: "Owner claims", body: "The user saves product, warranty, benefits and a direct brand relationship." },
      { title: "NFT + store", body: "The passport becomes active: NFT, history, repurchase, events and actionable data." },
    ],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getWebI18n();
  const copy = copyByLocale[locale] || copyByLocale["es-AR"];
  return {
    title: copy.metadata.title,
    description: copy.metadata.description,
    openGraph: {
      title: copy.metadata.title,
      description: copy.metadata.ogDescription,
      images: [{ url: `/opengraph-image?surface=demo-lab&campaign=motion-pack&locale=${encodeURIComponent(locale)}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.metadata.title,
      description: copy.metadata.description,
      images: [`/twitter-image?surface=demo-lab&campaign=motion-pack&locale=${encodeURIComponent(locale)}`],
    },
  };
}

export default async function MotionPackPage() {
  const { locale } = await getWebI18n();
  const copy = copyByLocale[locale] || copyByLocale["es-AR"];

  return (
    <main className="nexid-motion-pack">
      <section className="nexid-motion-hero">
        <div>
          <p>{copy.hero.kicker}</p>
          <h1>{copy.hero.title}</h1>
          <span>{copy.hero.body}</span>
          <div className="nexid-motion-hero-actions">
            <a href="/demo-lab">{copy.hero.back}</a>
            <a href="#formats">{copy.hero.formats}</a>
          </div>
        </div>
        <aside className="nexid-motion-hero-card" aria-label={copy.hero.cardTitle}>
          <div className="nexid-motion-logo-mark">N</div>
          <div className="nexid-motion-hero-product">
            <ProductGlyph product="wine" />
            <span className="nexid-motion-hero-status">{copy.hero.status}</span>
          </div>
          <strong>{copy.hero.cardTitle}</strong>
          <span>{copy.hero.cardBody}</span>
          <div>
            {copy.hero.chips.map((chip) => <em key={chip}>{chip}</em>)}
          </div>
        </aside>
      </section>

      <section className="nexid-motion-director" aria-label={copy.director.label}>
        <div className="nexid-motion-director-copy">
          <p>{copy.director.label}</p>
          <h2>{copy.director.title}</h2>
          <span>{copy.director.body}</span>
          <strong>{copy.director.verdict}</strong>
        </div>
        <div className="nexid-motion-lens-stack">
          <p>{copy.director.lensTitle}</p>
          <div className="nexid-motion-lens-grid">
            {copy.lenses.map((lens) => (
              <article key={lens.label} className="nexid-motion-lens-card">
                <small>{lens.label}</small>
                <strong>{lens.title}</strong>
                <span>{lens.body}</span>
                <em>{lens.signal}</em>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="nexid-motion-purpose" aria-label={copy.purpose.label}>
        <div className="nexid-motion-purpose-copy">
          <p>{copy.purpose.label}</p>
          <h2>{copy.purpose.title}</h2>
          <span>{copy.purpose.body}</span>
        </div>
        <div className="nexid-motion-purpose-grid">
          {copy.purpose.cards.map((item) => (
            <article key={item.title} className="nexid-motion-purpose-card">
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="nexid-motion-benchmark" aria-label={copy.sections.benchmark}>
        <div className="nexid-motion-section-heading">
          <p>{copy.sections.benchmark}</p>
          <h2>{copy.sections.benchmarkTitle}</h2>
        </div>
        <div className="nexid-motion-benchmark-grid">
          {copy.benchmark.map((item) => (
            <a key={item.source} href={item.href} target="_blank" rel="noreferrer" className="nexid-motion-benchmark-card">
              <small>{item.source}</small>
              <strong>{item.move}</strong>
              <span>{item.upgrade}</span>
            </a>
          ))}
        </div>
      </section>

      <section id="formats" className="nexid-motion-formats" aria-label={copy.sections.formats}>
        <div className="nexid-motion-section-heading">
          <p>{copy.sections.formats}</p>
          <h2>{copy.sections.formatsTitle}</h2>
        </div>
        <div className="nexid-motion-format-grid">
          {copy.formats.map((format, index) => (
            <article key={format.id} className="nexid-motion-format-card">
              <div className="nexid-motion-format-copy">
                <small>{format.format}</small>
                <h3>{format.title}</h3>
                <p>{format.body}</p>
                <div>
                  <span>{format.spec}</span>
                  <span>{format.label}</span>
                  <span>{format.stat}</span>
                </div>
              </div>
              <MotionFrame format={format} index={index} copy={copy} />
            </article>
          ))}
        </div>
      </section>

      <section className="nexid-motion-products" aria-label={copy.sections.products}>
        <div className="nexid-motion-section-heading">
          <p>{copy.sections.products}</p>
          <h2>{copy.sections.productsTitle}</h2>
        </div>
        <div className="nexid-motion-product-grid">
          {productKeys.map((product) => {
            const card = copy.productCards[product];

            return (
              <article key={product} className={`nexid-motion-product-card nexid-motion-product-card--${product}`}>
                <ProductGlyph product={product} />
                <small>{copy.productLabels[product]}</small>
                <strong>{card.title}</strong>
                <span>{card.body}</span>
                <em>{card.seal}</em>
              </article>
            );
          })}
        </div>
      </section>

      <section className="nexid-motion-storyboard" aria-label={copy.sections.storyboard}>
        <div className="nexid-motion-section-heading">
          <p>{copy.sections.storyboard}</p>
          <h2>{copy.sections.storyboardTitle}</h2>
        </div>
        <div className="nexid-motion-storyboard-rail">
          {copy.story.map((step, index) => (
            <article key={step.title}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <strong>{step.title}</strong>
              <span>{step.body}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function MotionFrame({ format, index, copy }: { format: MotionFormat; index: number; copy: MotionCopy }) {
  return (
    <div className={`nexid-motion-frame ${format.frameClass}`} aria-label={`${format.format}: ${format.title}`}>
      <span className="nexid-motion-frame-grid" aria-hidden="true" />
      <span className="nexid-motion-frame-scan" aria-hidden="true" />
      <div className="nexid-motion-route-path" aria-hidden="true">
        {copy.frame.route.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="nexid-motion-map-pulse" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="nexid-motion-frame-topline">
        <span>{format.label}</span>
        <strong>{format.stat}</strong>
      </div>
      <div className="nexid-motion-frame-product">
        <ProductGlyph product={index === 0 ? "wine" : index === 1 ? "perfume" : "bracelet"} />
        <div className="nexid-motion-nfc-band">
          <b>NFC</b>
          <em>{index === 2 ? copy.frame.chainOk : copy.frame.nfcOk}</em>
        </div>
      </div>
      <div className="nexid-motion-proof-cluster">
        {format.beats.map((beat, beatIndex) => (
          <span key={beat} className={beatIndex === 2 ? "active" : ""}>{beat}</span>
        ))}
      </div>
      <div className="nexid-motion-script-rail" aria-hidden="true">
        {format.beats.map((beat, beatIndex) => (
          <span key={`${beat}-script`}>
            <small>{String(beatIndex + 1).padStart(2, "0")}</small>
            <b>{beat}</b>
          </span>
        ))}
      </div>
      <div className="nexid-motion-token-chip">
        <small>{copy.frame.passport}</small>
        <strong>{copy.frame.tokenTitles[index]}</strong>
      </div>
      <div className="nexid-motion-phone-proof" aria-hidden="true">
        <small>{copy.frame.proofTypes[index]}</small>
        <strong>{copy.frame.proofTitles[index]}</strong>
        <span>{copy.frame.proofBodies[index]}</span>
      </div>
      <div className="nexid-motion-chart" aria-hidden="true">
        {[42, 78, 58, 92].map((height, barIndex) => <span key={barIndex} style={{ "--motion-bar": `${height}%` } as CSSProperties} />)}
      </div>
    </div>
  );
}

function ProductGlyph({ product }: { product: ProductKey }) {
  return (
    <div className={`nexid-motion-glyph nexid-motion-glyph--${product}`} aria-hidden="true">
      <span className="nexid-motion-glyph-body" />
      <span className="nexid-motion-glyph-label" />
      <span className="nexid-motion-glyph-seal" />
    </div>
  );
}
