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

type MotionCopy = {
  metadata: { title: string; description: string; ogDescription: string };
  benchmark: Array<{ source: string; move: string; upgrade: string; href: string }>;
  formats: MotionFormat[];
  productLabels: Record<ProductKey, string>;
  productCardBody: string;
  hero: { kicker: string; title: string; body: string; back: string; formats: string; cardTitle: string; cardBody: string; chips: string[]; status: string };
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
    productCardBody: "Sello NFC + pasaporte digital + capa comercial",
    hero: {
      kicker: "Motion con sentido comercial",
      title: "Que una marca entienda nexID en un toque: prueba, dueño, NFT y venta.",
      body: "Lo hicimos para transformar una tecnologia dificil en una historia vendible. En vez de mostrar pantallas sueltas, cada pieza muestra producto fisico, SUN fresco, copia bloqueada, reclamo de dueño, token/NFT y proxima compra.",
      back: "Volver al laboratorio",
      formats: "Ver formatos",
      cardTitle: "Producto real / prueba viva / ingreso",
      cardBody: "La pieza tiene que contestar en segundos: que se toca, que se valida, quien queda como dueño y que se puede vender despues.",
      chips: ["No jerga", "Sin app obligatoria", "Ingreso post tap"],
      status: "Tap valido",
    },
    sections: {
      benchmark: "Contra quien competimos",
      benchmarkTitle: "La vara es alta: identidad, autenticacion y trazabilidad. Nuestro diferencial es unir todo en una accion comercial.",
      formats: "Listo para exportar",
      formatsTitle: "Cada formato cuenta el mismo guion, adaptado al canal.",
      products: "Sistema de productos",
      productsTitle: "Los productos tienen que verse fisicos, de alto valor y diferentes por vertical.",
      storyboard: "Guion base",
      storyboardTitle: "El guion unico: tocar, validar, reclamar y vender.",
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
    productCardBody: "Selo NFC + passaporte digital + camada comercial",
    hero: {
      kicker: "Motion com sentido comercial",
      title: "Que uma marca entenda nexID em um toque: prova, dono, NFT e venda.",
      body: "Fizemos isto para transformar uma tecnologia dificil em uma historia vendavel. Em vez de mostrar telas soltas, cada peca mostra produto fisico, SUN fresco, copia bloqueada, reivindicacao de dono, token/NFT e proxima compra.",
      back: "Voltar ao laboratorio",
      formats: "Ver formatos",
      cardTitle: "Produto real / prova viva / receita",
      cardBody: "A peca precisa responder em segundos: o que se toca, o que se valida, quem vira dono e o que pode ser vendido depois.",
      chips: ["Sem jargao", "Sem app obrigatorio", "Receita pos toque"],
      status: "Toque valido",
    },
    sections: {
      benchmark: "Contra quem competimos",
      benchmarkTitle: "A barra e alta: identidade, autenticacao e rastreio. Nosso diferencial e unir tudo em uma acao comercial.",
      formats: "Pronto para exportar",
      formatsTitle: "Cada formato conta o mesmo roteiro, adaptado ao canal.",
      products: "Sistema de produtos",
      productsTitle: "Os produtos precisam parecer fisicos, premium e diferentes por vertical.",
      storyboard: "Roteiro base",
      storyboardTitle: "O roteiro unico: tocar, validar, reivindicar e vender.",
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
      tokenTitles: ["NFT pronto", "Mapa de donos", "Painel empresas"],
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
    productCardBody: "NFC seal + digital passport + commerce layer",
    hero: {
      kicker: "Motion with commercial purpose",
      title: "Make a brand understand nexID in one tap: proof, owner, NFT and sale.",
      body: "We built this to turn a difficult technology into a sellable story. Instead of showing loose screens, every piece shows the physical product, fresh SUN, blocked copy, owner claim, token/NFT and next purchase.",
      back: "Back to lab",
      formats: "See formats",
      cardTitle: "Real product / live proof / revenue",
      cardBody: "The piece must answer in seconds: what gets tapped, what gets validated, who becomes the owner and what can be sold next.",
      chips: ["No jargon", "No mandatory app", "Post-tap revenue"],
      status: "Valid tap",
    },
    sections: {
      benchmark: "Who we compete against",
      benchmarkTitle: "The bar is high: identity, authentication and traceability. Our edge is joining it all into a commercial action.",
      formats: "Ready to export",
      formatsTitle: "Each format tells the same script, adapted to its channel.",
      products: "Product system",
      productsTitle: "Products must look physical, premium and different by vertical.",
      storyboard: "Base script",
      storyboardTitle: "The one script: tap, validate, claim and sell.",
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
      tokenTitles: ["NFT ready", "Owner map", "Enterprise panel"],
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
          {productKeys.map((product) => (
            <article key={product} className={`nexid-motion-product-card nexid-motion-product-card--${product}`}>
              <ProductGlyph product={product} />
              <strong>{copy.productLabels[product]}</strong>
              <span>{copy.productCardBody}</span>
            </article>
          ))}
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
