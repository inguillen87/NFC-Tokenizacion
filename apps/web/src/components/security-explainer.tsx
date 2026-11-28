"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Blocks, EyeOff, Fingerprint, KeyRound, PackageOpen, Repeat2, type LucideIcon } from "lucide-react";
import { useId, useState } from "react";
import styles from "./security-explainer.module.css";

type ExplainerLocale = "es-AR" | "en" | "pt-BR";
type Level = "simple" | "technical";
type Topic = { key: string; title: string; analogy: string; simple: string; technical: string };

const ICONS: Record<string, LucideIcon> = {
  unique: KeyRound,
  replay: Repeat2,
  seal: PackageOpen,
  chain: Blocks,
  privacy: EyeOff,
  limit: Fingerprint,
};

const COPY: Record<ExplainerLocale, {
  eyebrow: string;
  title: string;
  body: string;
  levelLabel: string;
  levels: Record<Level, string>;
  analogyLabel: string;
  topics: Topic[];
}> = {
  "es-AR": {
    eyebrow: "Seguridad, explicada",
    title: "Qué pasa por dentro, contado de dos maneras.",
    body: "Elegí cómo leerlo: con ejemplos de todos los días o con el detalle técnico. Es la misma verdad en los dos casos.",
    levelLabel: "Nivel de detalle",
    levels: { simple: "En simple", technical: "Para técnicos" },
    analogyLabel: "Es como",
    topics: [
      { key: "unique", title: "Cada toque genera un mensaje único", analogy: "el código de un solo uso que te manda el banco", simple: "Cada vez que acercás el celular, la etiqueta arma un mensaje nuevo. Si alguien lo copia, ese mensaje ya se usó y no sirve.", technical: "La etiqueta NTAG 424 DNA genera por lectura un mensaje SUN/SDM con un contador y un CMAC. El servidor comprueba el CMAC con la clave del tag y que el contador avance." },
      { key: "replay", title: "Un mensaje repetido se detecta", analogy: "una entrada de cine que ya fue cortada", simple: "Mostrar otra vez el mismo mensaje no abre nada nuevo: el sistema ve que ya pasó y lo marca.", technical: "El contador es monotónico por tag. Un valor igual o menor al último aceptado se registra como replay y bloquea las acciones protegidas." },
      { key: "seal", title: "El tag avisa si el sello se abrió", analogy: "el precinto de una botella", simple: "Algunos tags tienen un lazo que se corta al abrir el producto, y desde entonces lo informan. Abierto no significa falso: qué hacer lo decide cada marca.", technical: "TagTamper incluye el estado del lazo dentro del mensaje firmado. La política del tenant define qué acciones habilita cada estado." },
      { key: "chain", title: "Blockchain, solo cuando suma", analogy: "anotar algo en un libro público que nadie puede borrar", simple: "Sirve para dejar constancia de quién es dueño de un producto o de su certificado. No se usa en cada toque.", technical: "Capa opcional por política para propiedad, certificado o traspaso de garantía. No se envía cada tap ni se escriben datos personales en la cadena." },
      { key: "privacy", title: "Leer un producto no te identifica", analogy: "mirar una vidriera: nadie te pide documento", simple: "Podés ver el pasaporte sin dar tus datos. Solo se guardan si vos aceptás, por ejemplo para registrar una garantía.", technical: "La analítica usa identificadores hasheados, nunca el UID crudo. Los datos personales requieren base válida y consentimiento, con permisos por tenant y por rol." },
      { key: "limit", title: "Lo que nexID no promete", analogy: "un escribano: da fe del documento, no de lo que hay dentro de la caja", simple: "nexID comprueba el mensaje de la etiqueta y muestra lo que la marca declara. No reemplaza una pericia sobre el objeto físico.", technical: "El resultado cubre evidencia digital del tag y política aplicada. Origen, lote y contenido son datos declarados por la organización responsable." },
    ],
  },
  en: {
    eyebrow: "Security, explained",
    title: "What happens inside, told two ways.",
    body: "Choose how to read it: with everyday examples or with the technical detail. It is the same truth either way.",
    levelLabel: "Level of detail",
    levels: { simple: "In plain words", technical: "For engineers" },
    analogyLabel: "It is like",
    topics: [
      { key: "unique", title: "Every tap produces a unique message", analogy: "the one-time code your bank sends you", simple: "Each time you tap, the label builds a new message. If someone copies it, that message was already used and is worthless.", technical: "The NTAG 424 DNA label produces a SUN/SDM message per read with a counter and a CMAC. The server checks the CMAC against the tag key and that the counter advances." },
      { key: "replay", title: "A repeated message is detected", analogy: "a cinema ticket that was already torn", simple: "Showing the same message again opens nothing new: the system sees it already happened and flags it.", technical: "The counter is monotonic per tag. A value equal to or lower than the last accepted one is recorded as a replay and blocks protected actions." },
      { key: "seal", title: "The tag reports if the seal was opened", analogy: "the tamper band on a bottle", simple: "Some tags have a loop that breaks when the product is opened, and they report it from then on. Open does not mean fake: each brand decides what to do.", technical: "TagTamper carries the loop state inside the signed message. The tenant policy defines which actions each state enables." },
      { key: "chain", title: "Blockchain, only where it helps", analogy: "writing in a public ledger nobody can erase", simple: "It records who owns a product or its certificate. It is not used on every tap.", technical: "An optional, policy-driven layer for ownership, certificates or warranty transfer. Taps are not sent on-chain and no personal data is written to it." },
      { key: "privacy", title: "Reading a product does not identify you", analogy: "looking at a shop window: nobody asks for your ID", simple: "You can see the passport without giving your details. They are stored only if you agree, for example to register a warranty.", technical: "Analytics use hashed identifiers, never the raw UID. Personal data requires a valid basis and consent, with permissions by tenant and by role." },
      { key: "limit", title: "What nexID does not promise", analogy: "a notary: they attest the document, not what is inside the box", simple: "nexID checks the label message and shows what the brand declares. It does not replace an expert assessment of the physical object.", technical: "The result covers digital tag evidence and the applied policy. Origin, batch and contents are data declared by the responsible organisation." },
    ],
  },
  "pt-BR": {
    eyebrow: "Segurança, explicada",
    title: "O que acontece por dentro, contado de duas maneiras.",
    body: "Escolha como ler: com exemplos do dia a dia ou com o detalhe técnico. É a mesma verdade nos dois casos.",
    levelLabel: "Nível de detalhe",
    levels: { simple: "Em palavras simples", technical: "Para técnicos" },
    analogyLabel: "É como",
    topics: [
      { key: "unique", title: "Cada toque gera uma mensagem única", analogy: "o código de uso único que o banco envia", simple: "Cada vez que você aproxima o celular, a etiqueta monta uma mensagem nova. Se alguém copiar, essa mensagem já foi usada e não serve.", technical: "A etiqueta NTAG 424 DNA gera por leitura uma mensagem SUN/SDM com um contador e um CMAC. O servidor confere o CMAC com a chave da tag e que o contador avance." },
      { key: "replay", title: "Uma mensagem repetida é detectada", analogy: "um ingresso de cinema que já foi destacado", simple: "Mostrar de novo a mesma mensagem não abre nada novo: o sistema vê que já aconteceu e sinaliza.", technical: "O contador é monotônico por tag. Um valor igual ou menor que o último aceito é registrado como replay e bloqueia as ações protegidas." },
      { key: "seal", title: "A tag avisa se o lacre foi aberto", analogy: "o lacre de uma garrafa", simple: "Algumas tags têm um laço que se rompe ao abrir o produto, e passam a informar isso. Aberto não significa falso: cada marca decide o que fazer.", technical: "O TagTamper inclui o estado do laço dentro da mensagem assinada. A política do tenant define quais ações cada estado habilita." },
      { key: "chain", title: "Blockchain, só quando agrega", analogy: "anotar em um livro público que ninguém pode apagar", simple: "Serve para registrar quem é dono de um produto ou do seu certificado. Não é usada em cada toque.", technical: "Camada opcional por política para propriedade, certificado ou transferência de garantia. Os toques não vão para a cadeia e nenhum dado pessoal é gravado nela." },
      { key: "privacy", title: "Ler um produto não identifica você", analogy: "olhar uma vitrine: ninguém pede documento", simple: "Você pode ver o passaporte sem informar seus dados. Eles só são guardados se você aceitar, por exemplo para registrar uma garantia.", technical: "A analítica usa identificadores com hash, nunca o UID bruto. Dados pessoais exigem base válida e consentimento, com permissões por tenant e por papel." },
      { key: "limit", title: "O que a nexID não promete", analogy: "um tabelião: atesta o documento, não o que está dentro da caixa", simple: "A nexID confere a mensagem da etiqueta e mostra o que a marca declara. Não substitui uma perícia sobre o objeto físico.", technical: "O resultado cobre evidência digital da tag e a política aplicada. Origem, lote e conteúdo são dados declarados pela organização responsável." },
    ],
  },
};

function normalizeLocale(locale: string): ExplainerLocale {
  return locale === "en" || locale === "pt-BR" ? locale : "es-AR";
}

// The same six facts at two reading levels. Both texts are always in the DOM
// order a screen reader expects; only the selected level is rendered.
export function SecurityExplainer({ locale }: { locale: string }) {
  const copy = COPY[normalizeLocale(locale)];
  const [level, setLevel] = useState<Level>("simple");
  const reducedMotion = useReducedMotion();
  const groupId = useId();

  return (
    <section className={`container-shell ${styles.explainer}`} aria-labelledby="security-explainer" data-level={level}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h2 id="security-explainer">{copy.title}</h2>
        <p>{copy.body}</p>
        <div className={styles.toggle} role="radiogroup" aria-label={copy.levelLabel}>
          {(Object.keys(copy.levels) as Level[]).map((option) => (
            <label key={option} className={styles.option} data-active={level === option}>
              <input type="radio" name={groupId} value={option} checked={level === option} onChange={() => setLevel(option)} />
              {level === option ? <motion.span layoutId={`${groupId}-pill`} className={styles.pill} transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} /> : null}
              <span>{copy.levels[option]}</span>
            </label>
          ))}
        </div>
      </header>

      <ol className={styles.grid}>
        {copy.topics.map((topic, index) => {
          const Icon = ICONS[topic.key] ?? KeyRound;
          return (
            <motion.li
              key={topic.key}
              className={styles.card}
              data-topic={topic.key}
              initial={false}
              whileHover={reducedMotion ? undefined : { y: -5 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
            >
              <span className={styles.icon} aria-hidden="true"><Icon size={22} /></span>
              <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <h3>{topic.title}</h3>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={level}
                  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: reducedMotion ? 0 : 0.2, delay: reducedMotion ? 0 : index * 0.03 }}
                >
                  {level === "simple" ? (
                    <>
                      <p className={styles.analogy}><em>{copy.analogyLabel}</em> {topic.analogy}.</p>
                      <p>{topic.simple}</p>
                    </>
                  ) : (
                    <p className={styles.technical}>{topic.technical}</p>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
