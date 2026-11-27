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
import { BadgeCheck, Check, Gift, MapPin, MessageCircle, Nfc, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import wineScene from "../../public/landing/connected-journey/wine-journey-01.webp";
import styles from "./scroll-story.module.css";

type StoryLocale = "es-AR" | "en" | "pt-BR";

const COPY: Record<StoryLocale, {
  eyebrow: string;
  title: string;
  scope: string;
  chapters: Array<{ step: string; title: string; body: string }>;
  hold: string;
  checks: [string, string, string];
  checked: string;
  passport: string;
  origin: string;
  originValue: string;
  batch: string;
  batchValue: string;
  services: [string, string, string];
  alt: string;
}> = {
  "es-AR": {
    eyebrow: "La experiencia, paso a paso",
    title: "Un toque. El producto te cuenta su historia.",
    scope: "Demo · datos de ejemplo",
    chapters: [
      { step: "01", title: "El celular toca el producto", body: "La etiqueta NFC responde con un mensaje único para esa lectura. No hace falta instalar ninguna app." },
      { step: "02", title: "nexID comprueba la lectura", body: "El servidor compara el mensaje con el registro de la marca y aplica su política. Te dice qué se comprobó y qué no." },
      { step: "03", title: "Se abre el pasaporte", body: "Origen, información publicada y los servicios que la marca habilitó: beneficios, garantía o contacto." },
    ],
    hold: "Acercá el celular a la etiqueta",
    checks: ["Mensaje único de esta lectura", "Registro de la marca", "Política aplicada"],
    checked: "Lectura comprobada",
    passport: "Pasaporte de muestra",
    origin: "Origen declarado",
    originValue: "Dato de ejemplo",
    batch: "Lote",
    batchValue: "Demo",
    services: ["Beneficios", "Garantía", "Contacto"],
    alt: "Una mano acerca un celular a una botella con etiqueta NFC",
  },
  en: {
    eyebrow: "The experience, step by step",
    title: "One touch. The product tells its own story.",
    scope: "Demo · sample data",
    chapters: [
      { step: "01", title: "The phone touches the product", body: "The NFC label answers with a message that is unique to that reading. There is no app to install." },
      { step: "02", title: "nexID checks the reading", body: "The server compares the message with the brand record and applies its policy. It tells you what was checked and what was not." },
      { step: "03", title: "The passport opens", body: "Origin, published information and the services the brand enabled: benefits, warranty or contact." },
    ],
    hold: "Hold the phone near the label",
    checks: ["Unique message for this reading", "Brand record", "Policy applied"],
    checked: "Reading checked",
    passport: "Sample passport",
    origin: "Declared origin",
    originValue: "Sample data",
    batch: "Batch",
    batchValue: "Demo",
    services: ["Benefits", "Warranty", "Contact"],
    alt: "A hand holds a phone near a bottle with an NFC label",
  },
  "pt-BR": {
    eyebrow: "A experiência, passo a passo",
    title: "Um toque. O produto conta a própria história.",
    scope: "Demo · dados de exemplo",
    chapters: [
      { step: "01", title: "O celular toca o produto", body: "A etiqueta NFC responde com uma mensagem única para essa leitura. Não é preciso instalar nenhum app." },
      { step: "02", title: "A nexID confere a leitura", body: "O servidor compara a mensagem com o registro da marca e aplica a política. Diz o que foi conferido e o que não foi." },
      { step: "03", title: "O passaporte se abre", body: "Origem, informação publicada e os serviços que a marca habilitou: benefícios, garantia ou contato." },
    ],
    hold: "Aproxime o celular da etiqueta",
    checks: ["Mensagem única desta leitura", "Registro da marca", "Política aplicada"],
    checked: "Leitura conferida",
    passport: "Passaporte de amostra",
    origin: "Origem declarada",
    originValue: "Dado de exemplo",
    batch: "Lote",
    batchValue: "Demo",
    services: ["Benefícios", "Garantia", "Contato"],
    alt: "Uma mão aproxima um celular de uma garrafa com etiqueta NFC",
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
          </div>

          <div className={styles.stage} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} aria-hidden="true">
            <motion.span className={styles.grid} style={{ backgroundPosition: gridPosition }} />
            <motion.span className={styles.halo} style={{ opacity: haloOpacity }} />

            <motion.div className={styles.product} style={{ x: productX, opacity: productOpacity, rotateY: productTurn }}>
              <span className={styles.productFront}>
                <span className={styles.productLabel}><i /><i /><i /></span>
                <span className={styles.tag}>
                  <Nfc size={18} />
                  <motion.i style={{ opacity: contact }} />
                  <motion.i style={{ opacity: contact }} />
                </span>
              </span>
              <span className={styles.productSide} />
              <span className={styles.productTop} />
            </motion.div>

            <motion.svg className={styles.beam} viewBox="0 0 200 60" preserveAspectRatio="none" style={{ opacity: beam }}>
              <path d="M6 44C60 4 140 4 194 30" pathLength="1" />
              <path d="M6 44C60 4 140 4 194 30" pathLength="1" />
            </motion.svg>

            <motion.span className={`${styles.holo} ${styles.holoOne}`} style={{ opacity: holo, y: holoRise }}><MapPin size={14} />{copy.origin}</motion.span>
            <motion.span className={`${styles.holo} ${styles.holoTwo}`} style={{ opacity: holo, y: holoRise }}><Gift size={14} />{copy.services[0]}</motion.span>
            <motion.span className={`${styles.holo} ${styles.holoThree}`} style={{ opacity: holo, y: holoRise }}><ShieldCheck size={14} />{copy.services[1]}</motion.span>

            <motion.div className={styles.phone} style={{ x: approach, rotateY, rotateX, y: lift, scale }}>
              <span className={styles.phoneEdge} />
              <div className={styles.screen}>
                <span className={styles.notch} />
                <span className={styles.scope}>{copy.scope}</span>

                <motion.div className={`${styles.view} ${styles.viewTap}`} style={{ opacity: screenOpacity[0] }}>
                  <span className={styles.rings}><i /><i /><i /><Nfc size={30} /></span>
                  <strong>{copy.hold}</strong>
                </motion.div>

                <motion.div className={`${styles.view} ${styles.viewCheck}`} style={{ opacity: screenOpacity[1] }}>
                  <span className={styles.scan} />
                  <ul>
                    {copy.checks.map((check) => (
                      <li key={check}><span><Check size={12} strokeWidth={3} /></span>{check}</li>
                    ))}
                  </ul>
                  <strong className={styles.verdict}><BadgeCheck size={18} />{copy.checked}</strong>
                </motion.div>

                <motion.div className={`${styles.view} ${styles.viewPassport}`} style={{ opacity: screenOpacity[2] }}>
                  <span className={styles.photo}>
                    <Image src={wineScene} alt="" fill sizes="260px" />
                  </span>
                  <strong>{copy.passport}</strong>
                  <dl>
                    <div><dt>{copy.origin}</dt><dd>{copy.originValue}</dd></div>
                    <div><dt>{copy.batch}</dt><dd>{copy.batchValue}</dd></div>
                  </dl>
                  <div className={styles.services}>
                    <span><Gift size={14} />{copy.services[0]}</span>
                    <span><ShieldCheck size={14} />{copy.services[1]}</span>
                    <span><MessageCircle size={14} />{copy.services[2]}</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
