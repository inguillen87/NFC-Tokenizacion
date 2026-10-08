"use client";

import { ArrowRight, Smartphone, Sparkles } from "lucide-react";
import { DEMO_PRODUCT_PROFILES } from "../../lib/demo-product-profiles";
import { sunDemoScenarioHref, VALLE_SECRETO_DEMO_HREF } from "../../lib/sun-demo-links";
import { SunDemoScenarioSelector } from "./sun-demo-scenario-selector";
import { SunPassportHeader } from "./sun-passport-header";
import { useSunLocale } from "./sun-locale-provider";
import { VALLE_SECRETO_DEMO } from "./valle-secreto-demo";
import styles from "./sun-demo-gallery.module.css";

const COPY = {
  "es-AR": {
    eyebrow: "PASAPORTES PARA EXPLORAR", title: "Elegí una experiencia", intro: "Elegí un producto y probá lo que ve el cliente al acercar su teléfono.",
    featured: "EXPERIENCIA DESTACADA", wine: "Bodegas", wineBody: "Descubrí Profundo: su origen, el sommelier y un recorrido por la viña.", open: "Explorar Valle Secreto", other: "Más rubros para descubrir", try: "Explorar demo",
    agrochem: "Agroquímicos", agrochemBody: "Ficha del producto, lote y un recorrido de trazabilidad de muestra.", fragrance: "Perfumería", fragranceBody: "La historia de una fragancia y su experiencia después del tap.", packaging: "Packaging", packagingBody: "Un estuche conectado que abre el mundo de la marca.",
    photoCaption: "Marca de muestra · foto de referencia", disclaimer: "Todas son demos. No verifican etiquetas reales ni activan compras, propiedad o beneficios.", tapTitle: "¿Tenés un producto con NexID?", tapBody: "Acercá el teléfono a su etiqueta NFC y abrí el enlace que aparezca.",
  },
  en: {
    eyebrow: "PASSPORTS TO EXPLORE", title: "Choose an experience", intro: "Choose a product and try what the customer sees when they tap their phone.",
    featured: "FEATURED EXPERIENCE", wine: "Wineries", wineBody: "Discover Profundo: its origin, the sommelier and a journey through the vineyard.", open: "Explore Valle Secreto", other: "More industries to discover", try: "Explore demo",
    agrochem: "Agrochemicals", agrochemBody: "Product information, batch and a sample traceability journey.", fragrance: "Fragrances", fragranceBody: "A fragrance's story and its experience after the tap.", packaging: "Packaging", packagingBody: "Connected packaging opens the brand's world.",
    photoCaption: "Sample brand · reference photo", disclaimer: "These are demos. They verify no real tags and activate no purchases, ownership or benefits.", tapTitle: "Have a product with NexID?", tapBody: "Hold your phone near its NFC tag and open the link that appears.",
  },
  "pt-BR": {
    eyebrow: "PASSAPORTES PARA EXPLORAR", title: "Escolha uma experiência", intro: "Escolha um produto e veja o que o cliente encontra ao aproximar o celular.",
    featured: "EXPERIÊNCIA EM DESTAQUE", wine: "Vinícolas", wineBody: "Descubra Profundo: sua origem, o sommelier e um passeio pela vinícola.", open: "Explorar Valle Secreto", other: "Mais setores para descobrir", try: "Explorar demo",
    agrochem: "Agroquímicos", agrochemBody: "Informações do produto, lote e um percurso ilustrativo de rastreabilidade.", fragrance: "Perfumaria", fragranceBody: "A história de uma fragrância e sua experiência após o tap.", packaging: "Packaging", packagingBody: "Uma embalagem conectada abre o universo da marca.",
    photoCaption: "Marca de exemplo · foto de referência", disclaimer: "Todas são demos. Não verificam etiquetas reais nem ativam compras, propriedade ou benefícios.", tapTitle: "Tem um produto com NexID?", tapBody: "Aproxime o celular da etiqueta NFC e abra o link exibido.",
  },
} as const;

export function SunDemoGallery() {
  const { locale } = useSunLocale();
  const copy = COPY[locale];
  const profiles = [
    { key: "agrochem" as const, profile: DEMO_PRODUCT_PROFILES.agrochem, title: copy.agrochem, body: copy.agrochemBody },
    { key: "fragrance" as const, profile: DEMO_PRODUCT_PROFILES.fragrance, title: copy.fragrance, body: copy.fragranceBody },
    { key: "perfume" as const, profile: DEMO_PRODUCT_PROFILES.perfume, title: copy.packaging, body: copy.packagingBody },
  ];
  const localized = (href: string) => `${href}&lang=${encodeURIComponent(locale)}`;

  return (
    <main className={styles.gallery} data-testid="sun-demo-gallery">
      <div className={styles.shell}>
        <SunPassportHeader isQrScan={false} livePillLabel="Muestra demo" pulseClass="bg-amber-400" />
        <section className={styles.intro} aria-labelledby="sun-demo-gallery-title">
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1 id="sun-demo-gallery-title">{copy.title}</h1>
          <p>{copy.intro}</p>
        </section>
        <article className={styles.featured}>
        <a href={localized(VALLE_SECRETO_DEMO_HREF)} className={styles.featuredLink} data-demo-profile="valle-secreto" referrerPolicy="no-referrer">
          <div className={styles.wineMedia}>
            <span className={styles.demoBadge}>DEMO</span>
            <img src={VALLE_SECRETO_DEMO.imageUrl} alt="" width={900} height={2560} decoding="async" fetchPriority="high" />
          </div>
          <div className={styles.wineCopy}>
            <span className={styles.featuredLabel}><Sparkles size={14} aria-hidden="true" />{copy.featured}</span>
            <p className={styles.category}>{copy.wine}</p>
            <h2>Valle Secreto</h2>
            <p className={styles.productName}>Profundo 2019</p>
            <p className={styles.body}>{copy.wineBody}</p>
            <span className={styles.primary}>{copy.open}<ArrowRight size={18} aria-hidden="true" /></span>
          </div>
        </a>
        <SunDemoScenarioSelector profile="valle-secreto" compact />
        </article>
        <section className={styles.industries} aria-labelledby="sun-demo-industries-title">
          <h2 id="sun-demo-industries-title">{copy.other}</h2>
          <div className={styles.cards}>
            {profiles.map(({ key, profile, title, body }) => (
              <article key={key} className={styles.card}>
              <a href={localized(sunDemoScenarioHref(key, "closed"))} className={styles.cardLink} data-demo-profile={key} referrerPolicy="no-referrer">
                <div className={styles.cardMedia}><img src={profile.images[0]} alt="" width={600} height={450} loading="lazy" decoding="async" /><span className={styles.demoBadge}>DEMO</span></div>
                <div className={styles.cardCopy}><h3>{title}</h3><p>{body}</p><small className={styles.photoCaption}>{copy.photoCaption}</small><span className={styles.cardAction}>{copy.try}<ArrowRight size={17} aria-hidden="true" /></span></div>
              </a>
              <SunDemoScenarioSelector profile={key} compact />
              </article>
            ))}
          </div>
        </section>
        <p className={styles.disclaimer}>{copy.disclaimer}</p>
        <aside className={styles.physicalTap}>
          <Smartphone size={22} aria-hidden="true" /><div><h2>{copy.tapTitle}</h2><p>{copy.tapBody}</p></div>
        </aside>
      </div>
    </main>
  );
}
