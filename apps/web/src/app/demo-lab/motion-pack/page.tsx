import type { Metadata } from "next";
import type { CSSProperties } from "react";

export const metadata: Metadata = {
  title: "Motion Pack | nexID Demo Lab",
  description: "Export-ready animated concepts for nexID product identity, NFC authentication, ownership, tokenization and marketplace flows.",
  openGraph: {
    title: "Motion Pack | nexID Demo Lab",
    description: "World-class motion concepts for connected products, digital passports and tokenized ownership.",
    images: [{ url: "/opengraph-image?surface=demo-lab&campaign=motion-pack", width: 1200, height: 630 }],
  },
};

const benchmarkMoves = [
  {
    source: "Qliktag",
    move: "NFC + tokenizacion",
    upgrade: "SUN anti-replay, UID hasheado, claim y marketplace en el mismo relato.",
    href: "https://qliktag.com/",
  },
  {
    source: "Arianee",
    move: "Digital passport + ownership",
    upgrade: "Pasaporte, duenio, postventa, recompra y token gate sin friccion para LatAm.",
    href: "https://www.arianee.com/digital-product-passport",
  },
  {
    source: "Authentic Vision",
    move: "Seguridad fisica visible",
    upgrade: "Etiqueta NFC cerrada, apertura, tamper y replay bloqueado como escena entendible.",
    href: "https://www.authenticvision.com/authentic-visions-unique-patented-holographic-fingerprint/",
  },
  {
    source: "Certilogo",
    move: "Journey de autenticacion",
    upgrade: "El consumidor no solo verifica: reclama, guarda, recibe beneficios y compra.",
    href: "https://discover.certilogo.com/pages/secure-by-design-product-authentication",
  },
  {
    source: "atma.io / Digimarc",
    move: "Escala + DPP + trazabilidad",
    upgrade: "Vista enterprise con lote, cadena, riesgo, datos, demanda y compliance operativo.",
    href: "https://www.atma.io/",
  },
  {
    source: "collectID",
    move: "Producto fisico + NFT + fandom",
    upgrade: "NFT utilitario conectado a producto real, evento, club, wallet y marketplace.",
    href: "https://www.sportsbusinessjournal.com/Daily/Issues/2022/11/09/Technology/collectid-physical-merchandise-products-authentication-nfc-tags-web3-metaverse-fans",
  },
] as const;

const motionFormats = [
  {
    id: "story",
    format: "9:16 Story / Reel",
    spec: "1080 x 1920",
    title: "Del tap al NFT en 12 segundos",
    body: "Para Instagram, ventas por WhatsApp y demo rapida: producto real, NFC cerrado, tap vivo, riesgo bloqueado y beneficio abierto.",
    label: "Social acquisition",
    stat: "12s",
    frameClass: "nexid-motion-frame--story",
    beats: ["Producto real", "NFC cerrado", "Tap valido", "NFT + claim"],
  },
  {
    id: "square",
    format: "1:1 Feed / Ads",
    spec: "1080 x 1080",
    title: "Un producto, cuatro ingresos",
    body: "Para feed y paid media: autenticidad, ownership, recompra y datos accionables en una pieza facil de leer.",
    label: "Commercial proof",
    stat: "4 loops",
    frameClass: "nexid-motion-frame--square",
    beats: ["Confianza", "Duenio", "Comunidad", "Marketplace"],
  },
  {
    id: "wide",
    format: "16:9 Pitch / Deck",
    spec: "1920 x 1080",
    title: "Infraestructura enterprise para marcas",
    body: "Para deck, landing y reuniones: item-level ID, cadena de custodia, SUN, wallet, analytics y revenue layer.",
    label: "Enterprise pitch",
    stat: "1 platform",
    frameClass: "nexid-motion-frame--wide",
    beats: ["Item ID", "Chain", "Risk", "Revenue"],
  },
] as const;

const productSet = ["Wine", "Seeds", "Cream", "Perfume", "Bracelet", "Ticket"] as const;

export default function MotionPackPage() {
  return (
    <main className="nexid-motion-pack">
      <section className="nexid-motion-hero">
        <div>
          <p>nexID Motion Pack</p>
          <h1>Versiones visuales listas para competir contra los mejores connected product platforms.</h1>
          <span>
            La direccion es clara: no copiamos pantallas, copiamos el nivel de claridad. Producto fisico, prueba criptografica,
            antifraude, ownership, NFT, marketplace y datos tienen que sentirse como una sola historia premium.
          </span>
          <div className="nexid-motion-hero-actions">
            <a href="/demo-lab">Volver al Demo Lab</a>
            <a href="#formats">Ver formatos exportables</a>
          </div>
        </div>
        <aside className="nexid-motion-hero-card" aria-label="Resumen competitivo">
          <div className="nexid-motion-logo-mark">N</div>
          <strong>Tap - SUN - Claim - NFT - Marketplace</strong>
          <span>Una demo vendible para bodegas, pharma, agro, beauty, eventos, lujo y deporte.</span>
          <div>
            <em>Anti replay</em>
            <em>Owner graph</em>
            <em>Token gate</em>
          </div>
        </aside>
      </section>

      <section className="nexid-motion-benchmark" aria-label="Benchmark competitivo">
        <div className="nexid-motion-section-heading">
          <p>Benchmark sintetizado</p>
          <h2>Lo mejor de cada jugador, convertido en una narrativa propia.</h2>
        </div>
        <div className="nexid-motion-benchmark-grid">
          {benchmarkMoves.map((item) => (
            <a key={item.source} href={item.href} target="_blank" rel="noreferrer" className="nexid-motion-benchmark-card">
              <small>{item.source}</small>
              <strong>{item.move}</strong>
              <span>{item.upgrade}</span>
            </a>
          ))}
        </div>
      </section>

      <section id="formats" className="nexid-motion-formats" aria-label="Formatos exportables">
        <div className="nexid-motion-section-heading">
          <p>Export-ready</p>
          <h2>Tres piezas madre para social, feed y pitch enterprise.</h2>
        </div>
        <div className="nexid-motion-format-grid">
          {motionFormats.map((format, index) => (
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
              <MotionFrame format={format} index={index} />
            </article>
          ))}
        </div>
      </section>

      <section className="nexid-motion-products" aria-label="Sistema visual de productos">
        <div className="nexid-motion-section-heading">
          <p>Product system</p>
          <h2>Los productos tienen que verse fisicos, premium y diferentes por vertical.</h2>
        </div>
        <div className="nexid-motion-product-grid">
          {productSet.map((product) => (
            <article key={product} className={`nexid-motion-product-card nexid-motion-product-card--${product.toLowerCase()}`}>
              <ProductGlyph product={product} />
              <strong>{product}</strong>
              <span>NFC seal + digital passport + commerce layer</span>
            </article>
          ))}
        </div>
      </section>

      <section className="nexid-motion-storyboard" aria-label="Storyboard comercial">
        <div className="nexid-motion-section-heading">
          <p>Storyboard base</p>
          <h2>La historia que tiene que repetirse en cada video, demo y pitch.</h2>
        </div>
        <div className="nexid-motion-storyboard-rail">
          {["Producto nace", "Tap fisico", "SUN valida", "Replay bloqueado", "Duenio reclama", "NFT + marketplace"].map((step, index) => (
            <article key={step}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <strong>{step}</strong>
              <span>{storyCopy(index)}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function MotionFrame({ format, index }: { format: (typeof motionFormats)[number]; index: number }) {
  return (
    <div className={`nexid-motion-frame ${format.frameClass}`} aria-label={`${format.format}: ${format.title}`}>
      <span className="nexid-motion-frame-grid" aria-hidden="true" />
      <span className="nexid-motion-frame-scan" aria-hidden="true" />
      <div className="nexid-motion-frame-topline">
        <span>{format.label}</span>
        <strong>{format.stat}</strong>
      </div>
      <div className="nexid-motion-frame-product">
        <ProductGlyph product={index === 0 ? "Wine" : index === 1 ? "Perfume" : "Bracelet"} />
        <div className="nexid-motion-nfc-band">
          <b>NFC</b>
          <em>{index === 2 ? "CHAIN OK" : "SUN OK"}</em>
        </div>
      </div>
      <div className="nexid-motion-proof-cluster">
        {format.beats.map((beat, beatIndex) => (
          <span key={beat} className={beatIndex === 2 ? "active" : ""}>{beat}</span>
        ))}
      </div>
      <div className="nexid-motion-token-chip">
        <small>DIGITAL PASSPORT</small>
        <strong>{index === 0 ? "Mint ready" : index === 1 ? "Owner graph" : "Enterprise feed"}</strong>
      </div>
      <div className="nexid-motion-chart" aria-hidden="true">
        {[42, 78, 58, 92].map((height, barIndex) => <span key={barIndex} style={{ "--motion-bar": `${height}%` } as CSSProperties} />)}
      </div>
    </div>
  );
}

function ProductGlyph({ product }: { product: (typeof productSet)[number] | "Wine" | "Perfume" | "Bracelet" }) {
  return (
    <div className={`nexid-motion-glyph nexid-motion-glyph--${product.toLowerCase()}`} aria-hidden="true">
      <span className="nexid-motion-glyph-body" />
      <span className="nexid-motion-glyph-label" />
      <span className="nexid-motion-glyph-seal" />
    </div>
  );
}

function storyCopy(index: number) {
  const copy = [
    "La marca asigna UID, lote y experiencia antes de que el consumidor toque el producto.",
    "El consumidor verifica desde el celular, sin app obligatoria y con distancia/origen claro.",
    "El sistema une tap fresco, tenant, producto, ubicacion y politicas comerciales.",
    "Copiar una URL no abre rewards, claim, tokenizacion ni marketplace sensible.",
    "El usuario guarda producto, garantia, beneficios y relacion directa con la marca.",
    "El pasaporte se vuelve activo: NFT, historial, recompra, eventos y datos accionables.",
  ];
  return copy[index] ?? "";
}
