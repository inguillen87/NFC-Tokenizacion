"use client";

import Image from "next/image";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from "framer-motion";
import { Activity, BadgeCheck, BatteryFull, Check, ChevronRight, Gift, LayoutGrid, Lock, MapPin, Nfc, PackageCheck, ShieldCheck, Signal, Sparkles, Wifi } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import bottle from "../../public/landing/valle-secreto-profundo-bottle.webp";
import styles from "./scroll-story.module.css";

type StoryLocale = "es-AR" | "en" | "pt-BR";

const COPY: Record<StoryLocale, {
  eyebrow: string;
  title: string;
  chapters: Array<{ step: string; title: string; body: string }>;
  nfcReady: string;
  bannerApp: string;
  bannerTitle: string;
  bannerBody: string;
  checking: string;
  checks: [string, string, string];
  checked: string;
  sample: string;
  origin: string;
  seal: string;
  sealBody: string;
  cta: string;
  tabs: [string, string, string, string];
  rows: [string, string];
  holo: [string, string, string];
  credit: string;
}> = {
  "es-AR": {
    eyebrow: "La experiencia, paso a paso",
    title: "Un toque. El producto te cuenta su historia.",
    chapters: [
      { step: "01", title: "El celular toca el producto", body: "La etiqueta NFC responde con un mensaje único para esa lectura y el teléfono ofrece abrirlo. No hace falta instalar ninguna app." },
      { step: "02", title: "nexID comprueba la lectura", body: "El servidor compara el mensaje con el registro de la marca y aplica su política. Te dice qué se comprobó y qué no." },
      { step: "03", title: "Se abre el pasaporte", body: "Así se ve en el celular: producto, estado del sello, origen y los servicios que la marca habilitó." },
    ],
    nfcReady: "NFC listo",
    bannerApp: "ETIQUETA NFC",
    bannerTitle: "Abrir nexid.lat",
    bannerBody: "Pasaporte del producto",
    checking: "Comprobando la lectura",
    checks: ["Mensaje único de esta lectura", "Registro de la marca", "Política aplicada"],
    checked: "Lectura comprobada",
    sample: "MUESTRA DEMO · SIN TAP FÍSICO",
    origin: "Cachapoal Andes, Chile · Ensamblaje de cinco cepas",
    seal: "El tag de muestra informa: sello cerrado",
    sealBody: "Simulación sin tap físico.",
    cta: "Conocer el producto",
    tabs: ["Resumen", "Origen", "Estado", "Servicios"],
    rows: ["Qué informa esta lectura", "Ubicación y horario"],
    holo: ["Origen declarado", "Beneficios", "Garantía"],
    credit: "Fotografía: Valle Secreto · referencia visual de la demo",
  },
  en: {
    eyebrow: "The experience, step by step",
    title: "One touch. The product tells its own story.",
    chapters: [
      { step: "01", title: "The phone touches the product", body: "The NFC label answers with a message that is unique to that reading and the phone offers to open it. There is no app to install." },
      { step: "02", title: "nexID checks the reading", body: "The server compares the message with the brand record and applies its policy. It tells you what was checked and what was not." },
      { step: "03", title: "The passport opens", body: "This is how it looks on the phone: product, seal status, origin and the services the brand enabled." },
    ],
    nfcReady: "NFC ready",
    bannerApp: "NFC TAG",
    bannerTitle: "Open nexid.lat",
    bannerBody: "Product passport",
    checking: "Checking the reading",
    checks: ["Unique message for this reading", "Brand record", "Policy applied"],
    checked: "Reading checked",
    sample: "DEMO SAMPLE · NO PHYSICAL TAP",
    origin: "Cachapoal Andes, Chile · Five-variety blend",
    seal: "The demo tag reports: seal closed",
    sealBody: "Simulation without a physical tap.",
    cta: "Discover the product",
    tabs: ["Summary", "Origin", "Status", "Services"],
    rows: ["What this reading reports", "Location and time"],
    holo: ["Declared origin", "Benefits", "Warranty"],
    credit: "Photograph: Valle Secreto · demo visual reference",
  },
  "pt-BR": {
    eyebrow: "A experiência, passo a passo",
    title: "Um toque. O produto conta a própria história.",
    chapters: [
      { step: "01", title: "O celular toca o produto", body: "A etiqueta NFC responde com uma mensagem única para essa leitura e o telefone oferece abri-la. Não é preciso instalar nenhum app." },
      { step: "02", title: "A nexID confere a leitura", body: "O servidor compara a mensagem com o registro da marca e aplica a política. Diz o que foi conferido e o que não foi." },
      { step: "03", title: "O passaporte se abre", body: "É assim que aparece no celular: produto, estado do lacre, origem e os serviços que a marca habilitou." },
    ],
    nfcReady: "NFC pronto",
    bannerApp: "ETIQUETA NFC",
    bannerTitle: "Abrir nexid.lat",
    bannerBody: "Passaporte do produto",
    checking: "Conferindo a leitura",
    checks: ["Mensagem única desta leitura", "Registro da marca", "Política aplicada"],
    checked: "Leitura conferida",
    sample: "AMOSTRA DEMO · SEM TOQUE FÍSICO",
    origin: "Cachapoal Andes, Chile · Blend de cinco castas",
    seal: "A tag de demonstração informa: lacre fechado",
    sealBody: "Simulação sem toque físico.",
    cta: "Conhecer o produto",
    tabs: ["Resumo", "Origem", "Estado", "Serviços"],
    rows: ["O que esta leitura informa", "Localização e horário"],
    holo: ["Origem declarada", "Benefícios", "Garantia"],
    credit: "Fotografia: Valle Secreto · referência visual da demo",
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

// A scroll-driven walkthrough of one tap. The phone is a CSS 3D object turned
// by the scroll position and tilted by a fine pointer. Under reduced motion the
// section becomes a static list with the final passport screen.
export function ScrollStory({ locale }: { locale: string }) {
  const copy = COPY[normalizeLocale(locale)];
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [isStatic, setIsStatic] = useState(false);
  useEffect(() => setIsStatic(Boolean(prefersReducedMotion)), [prefersReducedMotion]);

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
  const productTurn = useTransform(progress, [0, 0.3, 1], [-24, -30, -38]);
  const contact = useTransform(progress, [0.2, 0.3, 0.44, 0.62], [0, 1, 0.75, 0]);
  const beam = useTransform(progress, [0.26, 0.34, 0.58, 0.66], [0, 1, 1, 0]);
  const gridShift = useTransform(progress, [0, 1], [0, 220]);
  const gridPosition = useTransform(gridShift, (value) => `0px ${value}px`);
  const holo = useTransform(progress, [0.72, 0.86], [0, 1]);
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
  const passportCta = useTransform(progress, [0.82, 0.9], [0, 1]);
  const checkSteps = [checkOne, checkTwo, checkThree];
  const holoRise = useTransform(progress, [0.72, 1], [40, 0]);
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

  return (
    <section ref={sectionRef} id="como-funciona" className={styles.story} data-static={isStatic || undefined} aria-labelledby="home-scroll-story">
      <div className={styles.sticky}>
        <div className={styles.backdrop} aria-hidden="true"><span /><span /></div>
        <div className={`container-shell ${styles.layout}`}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h2 id="home-scroll-story">{copy.title}</h2>
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
            <p className={styles.credit}>{copy.credit}</p>
          </div>

          <div className={styles.stage} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} aria-hidden="true">
            <motion.span className={styles.grid} style={{ backgroundPosition: gridPosition }} />
            <motion.span className={styles.halo} style={{ opacity: haloOpacity }} />

            <motion.div className={styles.product} style={{ x: productX, opacity: productOpacity, rotateY: productTurn }}>
              <Image src={bottle} alt="" fill sizes="(min-width: 860px) 190px, 110px" className={styles.bottle} />
              <span className={styles.tag}>
                <Nfc size={16} />
                <motion.i style={{ opacity: contact }} />
                <motion.i style={{ opacity: contact }} />
              </span>
            </motion.div>

            <motion.svg className={styles.beam} viewBox="0 0 200 60" preserveAspectRatio="none" style={{ opacity: beam }}>
              <path d="M6 44C60 4 140 4 194 30" pathLength="1" />
              <path d="M6 44C60 4 140 4 194 30" pathLength="1" />
            </motion.svg>

            <motion.span className={`${styles.holo} ${styles.holoOne}`} style={{ opacity: holo, y: holoRise }}><MapPin size={14} />{copy.holo[0]}</motion.span>
            <motion.span className={`${styles.holo} ${styles.holoTwo}`} style={{ opacity: holo, y: holoRise }}><Gift size={14} />{copy.holo[1]}</motion.span>
            <motion.span className={`${styles.holo} ${styles.holoThree}`} style={{ opacity: holo, y: holoRise }}><ShieldCheck size={14} />{copy.holo[2]}</motion.span>

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
                      <em>{copy.bannerBody}</em>
                    </span>
                  </motion.div>
                  <span className={styles.rings}><i /><i /><i /><Nfc size={28} /></span>
                  <strong className={styles.nfcReady}>{copy.nfcReady}</strong>
                  <span className={styles.homeBar} />
                </motion.div>

                <motion.div className={`${styles.view} ${styles.viewBrowser}`} style={{ opacity: screenOpacity[1] }}>
                  <span className={styles.urlBar}><Lock size={10} />nexid.lat/sun</span>
                  <span className={styles.loadTrack}><motion.i style={{ scaleX: loadBar }} /></span>
                  <span className={styles.scan} />
                  <strong className={styles.checkingTitle}>{copy.checking}</strong>
                  <ul>
                    {copy.checks.map((check, index) => (
                      <motion.li key={check} style={{ opacity: checkSteps[index] }}><span><Check size={11} strokeWidth={3} /></span>{check}</motion.li>
                    ))}
                  </ul>
                  <motion.strong className={styles.verdict} style={{ opacity: verdict, scale: verdictScale }}><BadgeCheck size={16} />{copy.checked}</motion.strong>
                </motion.div>

                <motion.div className={`${styles.view} ${styles.viewPassport}`} style={{ opacity: screenOpacity[2] }}>
                  <span className={styles.urlBar}><Lock size={10} />nexid.lat/sun</span>
                  <motion.div className={styles.passportHero} style={{ y: passportHero }}>
                    <span className={styles.passportShot}><Image src={bottle} alt="" fill sizes="70px" /></span>
                    <span className={styles.passportMeta}>
                      <small className={styles.sample}>{copy.sample}</small>
                      <em>Valle Secreto</em>
                      <strong>Profundo 2019</strong>
                      <span>{copy.origin}</span>
                    </span>
                  </motion.div>
                  <motion.div className={styles.seal} style={{ opacity: passportSeal }}>
                    <PackageCheck size={16} />
                    <span><strong>{copy.seal}</strong><em>{copy.sealBody}</em></span>
                  </motion.div>
                  <motion.span className={styles.passportCta} style={{ opacity: passportCta }}>{copy.cta}<ChevronRight size={14} /></motion.span>
                  <motion.span className={styles.rows} style={{ opacity: passportCta }}>
                    <span><ShieldCheck size={12} />{copy.rows[0]}<ChevronRight size={12} /></span>
                    <span><MapPin size={12} />{copy.rows[1]}<ChevronRight size={12} /></span>
                  </motion.span>
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
