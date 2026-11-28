"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from "framer-motion";
import {
  Activity,
  BadgeCheck,
  BatteryFull,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  Gift,
  Headset,
  LayoutGrid,
  Lock,
  MapPin,
  Nfc,
  PackageCheck,
  ShieldCheck,
  Signal,
  Sparkles,
  Sprout,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { STORY_PRODUCTS, StoryProduct, type StoryProductKey } from "./story-products";
import styles from "./scroll-story.module.css";

type StoryLocale = "es-AR" | "en" | "pt-BR";
type ProductCopy = {
  chip: string;
  brand: string;
  name: string;
  detail: string;
  rows: [[string, string], [string, string]];
  services: [string, string, string];
};

const SERVICE_ICONS: Record<StoryProductKey, [LucideIcon, LucideIcon, LucideIcon]> = {
  wine: [BookOpen, Gift, Headset],
  seeds: [FileText, Sprout, Headset],
  jerrycan: [FileText, ShieldCheck, Headset],
  perfume: [ShieldCheck, Gift, Sparkles],
  pharma: [FileText, BookOpen, Headset],
};

const COPY: Record<StoryLocale, {
  eyebrow: string;
  title: string;
  pick: string;
  chapters: Array<{ step: string; title: string; body: string }>;
  nfcReady: string;
  nfcHint: string;
  bannerApp: string;
  bannerTitle: string;
  bannerBody: string;
  checking: string;
  checks: Array<{ title: string; note: string }>;
  checked: string;
  checkedNote: string;
  sample: string;
  seal: string;
  sealBody: string;
  servicesTitle: string;
  tabs: [string, string, string, string];
  scope: string;
  about: string;
  platform: string;
  products: Record<StoryProductKey, ProductCopy>;
}> = {
  "es-AR": {
    eyebrow: "La experiencia, paso a paso",
    title: "Un toque. El producto te cuenta su historia.",
    pick: "Elegí un producto",
    chapters: [
      { step: "01", title: "El celular toca el producto", body: "La etiqueta NFC responde con un mensaje único para esa lectura y el teléfono ofrece abrirlo. No hace falta instalar ninguna app." },
      { step: "02", title: "nexID comprueba la lectura", body: "El servidor compara el mensaje con el registro de la marca y aplica su política. Te dice qué se comprobó y qué no." },
      { step: "03", title: "Se abre el pasaporte", body: "Producto, estado del sello, datos declarados y los servicios que la marca habilitó para ese rubro." },
    ],
    nfcReady: "NFC listo",
    nfcHint: "Acercá la parte de arriba del teléfono a la etiqueta",
    bannerApp: "ETIQUETA NFC",
    bannerTitle: "Abrir nexid.lat",
    bannerBody: "Pasaporte del producto",
    checking: "Comprobando la lectura",
    checks: [
      { title: "Mensaje único", note: "Sirve para esta lectura y no se puede reutilizar." },
      { title: "Registro de la marca", note: "La etiqueta pertenece a este producto." },
      { title: "Política aplicada", note: "Define qué acciones se habilitan." },
    ],
    checked: "Lectura comprobada",
    checkedNote: "Se comprobó el mensaje de la etiqueta, no el objeto físico.",
    sample: "MUESTRA DEMO · SIN TAP FÍSICO",
    seal: "El tag de muestra informa: sello cerrado",
    sealBody: "Abierto no significaría falsificado.",
    servicesTitle: "Servicios habilitados por la marca",
    tabs: ["Resumen", "Origen", "Estado", "Servicios"],
    scope: "Productos ilustrativos · datos de ejemplo",
    about: "Conocé NexID",
    platform: "Cómo funciona en detalle",
    products: {
      wine: { chip: "Vino", brand: "Bodega de muestra", name: "Reserva Andina", detail: "Malbec · Valle de Uco, Mendoza", rows: [["Lote", "RA-2407"], ["Origen declarado", "Mendoza, AR"]], services: ["Historia", "Club", "Contacto"] },
      seeds: { chip: "Semillas", brand: "Semillero de muestra", name: "Semilla Norte", detail: "Bolsa de semillas · híbrido de muestra", rows: [["Lote", "SN-0318"], ["Tratamiento", "Declarado"]], services: ["Ficha técnica", "Siembra", "Asesor"] },
      jerrycan: { chip: "Bidón", brand: "Protección de cultivos", name: "Fitosanitario 5 L", detail: "Bidón con tapa a rosca · muestra", rows: [["Lote", "PC-1150"], ["Vencimiento", "Declarado"]], services: ["Hoja de seguridad", "Protección", "Asesor"] },
      perfume: { chip: "Perfume", brand: "Casa de muestra", name: "Bruma · Eau de Parfum", detail: "Estuche premium · edición de muestra", rows: [["Edición", "BR-07"], ["Origen declarado", "Grasse, FR"]], services: ["Garantía", "Beneficios", "Cuidado"] },
      pharma: { chip: "Medicamento", brand: "Laboratorio de muestra", name: "Comprimidos de muestra", detail: "Estuche con blíster · producto ilustrativo", rows: [["Lote", "LM-2291"], ["Vencimiento", "Declarado"]], services: ["Prospecto", "Conservación", "Consulta"] },
    },
  },
  en: {
    eyebrow: "The experience, step by step",
    title: "One touch. The product tells its own story.",
    pick: "Choose a product",
    chapters: [
      { step: "01", title: "The phone touches the product", body: "The NFC label answers with a message that is unique to that reading and the phone offers to open it. There is no app to install." },
      { step: "02", title: "nexID checks the reading", body: "The server compares the message with the brand record and applies its policy. It tells you what was checked and what was not." },
      { step: "03", title: "The passport opens", body: "Product, seal status, declared data and the services the brand enabled for that industry." },
    ],
    nfcReady: "NFC ready",
    nfcHint: "Hold the top of the phone near the label",
    bannerApp: "NFC TAG",
    bannerTitle: "Open nexid.lat",
    bannerBody: "Product passport",
    checking: "Checking the reading",
    checks: [
      { title: "Unique message", note: "Valid for this reading and cannot be reused." },
      { title: "Brand record", note: "The label belongs to this product." },
      { title: "Policy applied", note: "It defines which actions are enabled." },
    ],
    checked: "Reading checked",
    checkedNote: "The label message was checked, not the physical object.",
    sample: "DEMO SAMPLE · NO PHYSICAL TAP",
    seal: "The demo tag reports: seal closed",
    sealBody: "Open would not mean counterfeit.",
    servicesTitle: "Services enabled by the brand",
    tabs: ["Summary", "Origin", "Status", "Services"],
    scope: "Illustrative products · sample data",
    about: "About NexID",
    platform: "How it works in detail",
    products: {
      wine: { chip: "Wine", brand: "Sample winery", name: "Reserva Andina", detail: "Malbec · Uco Valley, Mendoza", rows: [["Batch", "RA-2407"], ["Declared origin", "Mendoza, AR"]], services: ["Story", "Club", "Contact"] },
      seeds: { chip: "Seeds", brand: "Sample seed company", name: "Semilla Norte", detail: "Seed bag · sample hybrid", rows: [["Batch", "SN-0318"], ["Treatment", "Declared"]], services: ["Data sheet", "Sowing", "Advisor"] },
      jerrycan: { chip: "Jerrycan", brand: "Crop protection", name: "Crop protection 5 L", detail: "Screw-cap jerrycan · sample", rows: [["Batch", "PC-1150"], ["Expiry", "Declared"]], services: ["Safety sheet", "Protection", "Advisor"] },
      perfume: { chip: "Perfume", brand: "Sample house", name: "Bruma · Eau de Parfum", detail: "Premium box · sample edition", rows: [["Edition", "BR-07"], ["Declared origin", "Grasse, FR"]], services: ["Warranty", "Benefits", "Care"] },
      pharma: { chip: "Medicine", brand: "Sample laboratory", name: "Sample tablets", detail: "Box with blister · illustrative product", rows: [["Batch", "LM-2291"], ["Expiry", "Declared"]], services: ["Leaflet", "Storage", "Enquiry"] },
    },
  },
  "pt-BR": {
    eyebrow: "A experiência, passo a passo",
    title: "Um toque. O produto conta a própria história.",
    pick: "Escolha um produto",
    chapters: [
      { step: "01", title: "O celular toca o produto", body: "A etiqueta NFC responde com uma mensagem única para essa leitura e o telefone oferece abri-la. Não é preciso instalar nenhum app." },
      { step: "02", title: "A nexID confere a leitura", body: "O servidor compara a mensagem com o registro da marca e aplica a política. Diz o que foi conferido e o que não foi." },
      { step: "03", title: "O passaporte se abre", body: "Produto, estado do lacre, dados declarados e os serviços que a marca habilitou para esse setor." },
    ],
    nfcReady: "NFC pronto",
    nfcHint: "Aproxime a parte de cima do telefone da etiqueta",
    bannerApp: "ETIQUETA NFC",
    bannerTitle: "Abrir nexid.lat",
    bannerBody: "Passaporte do produto",
    checking: "Conferindo a leitura",
    checks: [
      { title: "Mensagem única", note: "Vale para esta leitura e não pode ser reutilizada." },
      { title: "Registro da marca", note: "A etiqueta pertence a este produto." },
      { title: "Política aplicada", note: "Define quais ações ficam habilitadas." },
    ],
    checked: "Leitura conferida",
    checkedNote: "Foi conferida a mensagem da etiqueta, não o objeto físico.",
    sample: "AMOSTRA DEMO · SEM TOQUE FÍSICO",
    seal: "A tag de demonstração informa: lacre fechado",
    sealBody: "Aberto não significaria falsificado.",
    servicesTitle: "Serviços habilitados pela marca",
    tabs: ["Resumo", "Origem", "Estado", "Serviços"],
    scope: "Produtos ilustrativos · dados de exemplo",
    about: "Conheça a NexID",
    platform: "Como funciona em detalhe",
    products: {
      wine: { chip: "Vinho", brand: "Vinícola de amostra", name: "Reserva Andina", detail: "Malbec · Vale de Uco, Mendoza", rows: [["Lote", "RA-2407"], ["Origem declarada", "Mendoza, AR"]], services: ["História", "Clube", "Contato"] },
      seeds: { chip: "Sementes", brand: "Sementeira de amostra", name: "Semilla Norte", detail: "Saco de sementes · híbrido de amostra", rows: [["Lote", "SN-0318"], ["Tratamento", "Declarado"]], services: ["Ficha técnica", "Plantio", "Consultor"] },
      jerrycan: { chip: "Galão", brand: "Proteção de cultivos", name: "Fitossanitário 5 L", detail: "Galão com tampa de rosca · amostra", rows: [["Lote", "PC-1150"], ["Validade", "Declarada"]], services: ["Ficha de segurança", "Proteção", "Consultor"] },
      perfume: { chip: "Perfume", brand: "Casa de amostra", name: "Bruma · Eau de Parfum", detail: "Estojo premium · edição de amostra", rows: [["Edição", "BR-07"], ["Origem declarada", "Grasse, FR"]], services: ["Garantia", "Benefícios", "Cuidado"] },
      pharma: { chip: "Medicamento", brand: "Laboratório de amostra", name: "Comprimidos de amostra", detail: "Estojo com blister · produto ilustrativo", rows: [["Lote", "LM-2291"], ["Validade", "Declarada"]], services: ["Bula", "Conservação", "Consulta"] },
    },
  },
};

function normalizeLocale(locale: string): StoryLocale {
  return locale === "en" || locale === "pt-BR" ? locale : "es-AR";
}

// Each chapter owns one third of the scroll range and cross-fades at its edges.
function useChapterOpacity(progress: MotionValue<number>, index: number, floor = 0) {
  const start = index / 3;
  const end = (index + 1) / 3;
  const input = index === 0
    ? [0, end - 0.06, end + 0.02]
    : index === 2
      ? [start - 0.02, start + 0.06, 1]
      : [start - 0.02, start + 0.06, end - 0.06, end + 0.02];
  const output = index === 0 ? [1, 1, floor] : index === 2 ? [floor, 1, 1] : [floor, 1, 1, floor];
  return useTransform(progress, input, output);
}

// A scroll-driven walkthrough of one tap, for five illustrative products. The
// phone is a CSS 3D object turned by the scroll position and tilted by a fine
// pointer; its screens replay what a real tap shows. Under reduced motion the
// section becomes a static list with the final passport screen.
export function ScrollStory({ locale }: { locale: string }) {
  const copy = COPY[normalizeLocale(locale)];
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [isStatic, setIsStatic] = useState(false);
  const [productKey, setProductKey] = useState<StoryProductKey>("wine");
  const groupId = useId();
  const drawingId = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => setIsStatic(Boolean(prefersReducedMotion)), [prefersReducedMotion]);
  // A different product greets each visit; the server always renders the first one.
  useEffect(() => {
    const pick = STORY_PRODUCTS[Math.floor(Math.random() * STORY_PRODUCTS.length)];
    if (pick) setProductKey(pick.key);
  }, []);

  const product = STORY_PRODUCTS.find((entry) => entry.key === productKey) ?? STORY_PRODUCTS[0]!;
  const productCopy = copy.products[product.key];
  const serviceIcons = SERVICE_ICONS[product.key];

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26, restDelta: 0.0005 });

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const tiltX = useSpring(pointerX, { stiffness: 150, damping: 18 });
  const tiltY = useSpring(pointerY, { stiffness: 150, damping: 18 });

  const turn = useTransform(progress, [0, 0.3, 0.62, 1], [-34, 22, 10, 0]);
  const lean = useTransform(progress, [0, 0.3, 1], [12, 5, 0]);
  const approach = useTransform(progress, [0, 0.3, 0.62, 0.82, 1], ["-46%", "-4%", "-10%", "18%", "18%"]);
  const productX = useTransform(progress, [0, 0.62, 0.86], ["0%", "0%", "34%"]);
  const productOpacity = useTransform(progress, [0, 0.62, 0.86], [1, 1, 0.16]);
  const productTurn = useTransform(progress, [0, 0.3, 1], [-18, -24, -32]);
  const contact = useTransform(progress, [0.2, 0.3, 0.44, 0.62], [0, 1, 0.75, 0]);
  const beam = useTransform(progress, [0.26, 0.34, 0.58, 0.66], [0, 1, 1, 0]);
  const gridShift = useTransform(progress, [0, 1], [0, 220]);
  const gridPosition = useTransform(gridShift, (value) => `0px ${value}px`);
  const holo = useTransform(progress, [0.72, 0.86], [0, 1]);
  const holoRise = useTransform(progress, [0.72, 1], [40, 0]);
  const bannerY = useTransform(progress, [0.2, 0.3], [-90, 0]);
  const bannerOpacity = useTransform(progress, [0.2, 0.28], [0, 1]);
  const loadBar = useTransform(progress, [0.34, 0.6], [0.05, 1]);
  const checkOne = useTransform(progress, [0.38, 0.43], [0, 1]);
  const checkTwo = useTransform(progress, [0.45, 0.5], [0, 1]);
  const checkThree = useTransform(progress, [0.52, 0.57], [0, 1]);
  const verdict = useTransform(progress, [0.58, 0.63], [0, 1]);
  const verdictScale = useTransform(progress, [0.58, 0.63], [0.9, 1]);
  const passportHero = useTransform(progress, [0.7, 0.78], [18, 0]);
  const passportSeal = useTransform(progress, [0.76, 0.84], [0, 1]);
  const passportServices = useTransform(progress, [0.82, 0.9], [0, 1]);
  const checkSteps = [checkOne, checkTwo, checkThree];
  const rotateY = useTransform([turn, tiltX], ([base, tilt]: number[]) => base + tilt * 9);
  const rotateX = useTransform([lean, tiltY], ([base, tilt]: number[]) => base - tilt * 7);
  const lift = useTransform(progress, [0, 1], [24, -12]);
  const scale = useTransform(progress, [0, 0.3, 0.62, 1], [0.86, 0.96, 1, 1.06]);
  const railScale = useTransform(progress, [0, 1], [0.04, 1]);
  const haloOpacity = useTransform(progress, [0, 0.3, 0.45, 1], [0.9, 0.9, 0.35, 0.5]);

  const textOpacity = [useChapterOpacity(progress, 0, 0.28), useChapterOpacity(progress, 1, 0.28), useChapterOpacity(progress, 2, 0.28)];
  const screenOpacity = [useChapterOpacity(progress, 0), useChapterOpacity(progress, 1), useChapterOpacity(progress, 2)];

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (isStatic || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - box.left) / box.width - 0.5);
    pointerY.set((event.clientY - box.top) / box.height - 0.5);
  };
  const onPointerLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };
  const swap = isStatic ? { duration: 0 } : { type: "spring" as const, stiffness: 260, damping: 26 };

  return (
    <section
      ref={sectionRef}
      id="como-funciona"
      className={styles.story}
      data-static={isStatic || undefined}
      data-product={product.key}
      style={{ "--story-accent": product.accent } as CSSProperties}
      aria-labelledby="home-scroll-story"
    >
      <div className={styles.sticky}>
        <div className={styles.backdrop} aria-hidden="true"><span /><span /></div>
        <div className={`container-shell ${styles.layout}`}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h2 id="home-scroll-story">{copy.title}</h2>

            <div className={styles.picker} role="radiogroup" aria-label={copy.pick}>
              {STORY_PRODUCTS.map((entry) => (
                <label key={entry.key} className={styles.pick} data-active={entry.key === product.key}>
                  <input type="radio" name={groupId} value={entry.key} checked={entry.key === product.key} onChange={() => setProductKey(entry.key)} />
                  {entry.key === product.key ? <motion.span layoutId={`${groupId}-pick`} className={styles.pickPill} transition={swap} /> : null}
                  <span>{copy.products[entry.key].chip}</span>
                </label>
              ))}
            </div>

            <ol className={styles.chapters}>
              {copy.chapters.map((chapter, index) => (
                <motion.li key={chapter.step} style={{ "--dim": textOpacity[index], "--solo": screenOpacity[index] } as MotionStyle}>
                  <span className={styles.step}>{chapter.step}</span>
                  <div>
                    <h3>{chapter.title}</h3>
                    <p>{chapter.body}</p>
                  </div>
                </motion.li>
              ))}
            </ol>
            <div className={styles.rail} aria-hidden="true"><motion.span style={{ scaleX: railScale }} /></div>
            <p className={styles.credit}>{copy.scope}</p>
            <p className={styles.links}>
              <Link href="/platform" prefetch={false}>{copy.platform}</Link>
              <Link href="/about" prefetch={false}>{copy.about}</Link>
            </p>
          </div>

          <div className={styles.stage} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} aria-hidden="true">
            <motion.span className={styles.grid} style={{ backgroundPosition: gridPosition }} />
            <motion.span className={styles.halo} style={{ opacity: haloOpacity }} />

            <motion.div className={styles.product} style={{ x: productX, opacity: productOpacity, rotateY: productTurn }}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={product.key}
                  className={styles.productArt}
                  initial={isStatic ? false : { opacity: 0, y: 26, scale: 0.9, rotateY: 40 }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotateY: 0 }}
                  exit={isStatic ? { opacity: 0 } : { opacity: 0, y: -22, scale: 0.92, rotateY: -40 }}
                  transition={swap}
                >
                  <StoryProduct product={product.key} idPrefix={drawingId} />
                  <span className={styles.tag} style={{ top: product.tagTop, left: product.tagLeft }}>
                    <Nfc size={15} />
                    <motion.i style={{ opacity: contact }} />
                    <motion.i style={{ opacity: contact }} />
                  </span>
                </motion.span>
              </AnimatePresence>
            </motion.div>

            <motion.svg className={styles.beam} viewBox="0 0 200 60" preserveAspectRatio="none" style={{ opacity: beam }}>
              <path d="M6 44C60 4 140 4 194 30" pathLength="1" />
              <path d="M6 44C60 4 140 4 194 30" pathLength="1" />
            </motion.svg>

            {productCopy.services.map((service, index) => {
              const Icon = serviceIcons[index] ?? Sparkles;
              const slot = [styles.holoOne, styles.holoTwo, styles.holoThree][index];
              return (
                <motion.span key={`${product.key}-${service}`} className={`${styles.holo} ${slot}`} style={{ opacity: holo, y: holoRise }}>
                  <Icon size={14} />{service}
                </motion.span>
              );
            })}

            <motion.div className={styles.phone} style={{ x: approach, rotateY, rotateX, y: lift, scale }}>
              <span className={styles.phoneEdge} />
              <div className={styles.screen}>
                <span className={styles.notch} />
                <span className={styles.statusBar}><b>9:41</b><span><Signal size={11} /><Wifi size={11} /><BatteryFull size={13} /></span></span>

                <motion.div className={`${styles.view} ${styles.viewHome}`} style={{ opacity: screenOpacity[0] }}>
                  <motion.div className={styles.banner} style={{ y: bannerY, opacity: bannerOpacity }}>
                    <span className={styles.bannerIcon}><Nfc size={16} /></span>
                    <span className={styles.bannerText}>
                      <small>{copy.bannerApp}</small>
                      <strong>{copy.bannerTitle}</strong>
                      <em>{copy.bannerBody} · {productCopy.name}</em>
                    </span>
                  </motion.div>
                  <span className={styles.rings}><i /><i /><i /><Nfc size={28} /></span>
                  <strong className={styles.nfcReady}>{copy.nfcReady}</strong>
                  <span className={styles.nfcHint}>{copy.nfcHint}</span>
                  <span className={styles.homeBar} />
                </motion.div>

                <motion.div className={`${styles.view} ${styles.viewBrowser}`} style={{ opacity: screenOpacity[1] }}>
                  <span className={styles.urlBar}><Lock size={10} />nexid.lat/sun</span>
                  <span className={styles.loadTrack}><motion.i style={{ scaleX: loadBar }} /></span>
                  <span className={styles.scan} />
                  <strong className={styles.checkingTitle}>{copy.checking}</strong>
                  <ul>
                    {copy.checks.map((check, index) => (
                      <motion.li key={check.title} style={{ opacity: checkSteps[index] }}>
                        <span><Check size={11} strokeWidth={3} /></span>
                        <div><b>{check.title}</b><small>{check.note}</small></div>
                      </motion.li>
                    ))}
                  </ul>
                  <motion.div className={styles.verdict} style={{ opacity: verdict, scale: verdictScale }}>
                    <strong><BadgeCheck size={16} />{copy.checked}</strong>
                    <small>{copy.checkedNote}</small>
                  </motion.div>
                </motion.div>

                <motion.div className={`${styles.view} ${styles.viewPassport}`} style={{ opacity: screenOpacity[2] }}>
                  <span className={styles.urlBar}><Lock size={10} />nexid.lat/sun</span>
                  <motion.div className={styles.passportHero} style={{ y: passportHero }}>
                    <span className={styles.passportShot}><StoryProduct product={product.key} idPrefix={`${drawingId}t`} /></span>
                    <span className={styles.passportMeta}>
                      <small className={styles.sample}>{copy.sample}</small>
                      <em>{productCopy.brand}</em>
                      <strong>{productCopy.name}</strong>
                      <span>{productCopy.detail}</span>
                    </span>
                  </motion.div>
                  <motion.div className={styles.seal} style={{ opacity: passportSeal }}>
                    <PackageCheck size={16} />
                    <span><strong>{copy.seal}</strong><em>{copy.sealBody}</em></span>
                  </motion.div>
                  <motion.dl className={styles.facts} style={{ opacity: passportSeal }}>
                    {productCopy.rows.map(([label, value]) => (
                      <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                    ))}
                  </motion.dl>
                  <motion.div className={styles.services} style={{ opacity: passportServices }}>
                    <small>{copy.servicesTitle}</small>
                    <span>
                      {productCopy.services.map((service, index) => {
                        const Icon = serviceIcons[index] ?? Sparkles;
                        return <b key={service}><Icon size={13} />{service}<ChevronRight size={11} /></b>;
                      })}
                    </span>
                  </motion.div>
                  <span className={styles.tabs}>
                    <span data-active="true"><LayoutGrid size={13} />{copy.tabs[0]}</span>
                    <span><MapPin size={13} />{copy.tabs[1]}</span>
                    <span><Activity size={13} />{copy.tabs[2]}</span>
                    <span><Sparkles size={13} />{copy.tabs[3]}</span>
                  </span>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
