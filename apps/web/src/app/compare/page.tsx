import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Nfc, QrCode, ShieldCheck, Smartphone } from "lucide-react";
import type { CSSProperties } from "react";
import { PublicSiteHeader } from "../../components/public-site-header";
import { getWebI18n } from "../../lib/locale";
import styles from "./compare.module.css";

type ApproachKey = "qr" | "app" | "label" | "nexid";
type CompareCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  lead: string;
  scope: string;
  approachesLabel: string;
  approaches: Record<ApproachKey, { name: string; hint: string }>;
  criteria: Array<{ question: string; answers: Record<ApproachKey, string> }>;
  boundaryTitle: string;
  boundary: string;
  demo: string;
  contact: string;
};

const APPROACH_ORDER: readonly ApproachKey[] = ["qr", "app", "label", "nexid"];
const APPROACH_ICON = { qr: QrCode, app: Smartphone, label: ShieldCheck, nexid: Nfc } as const;

const copyByLocale: Record<"es-AR" | "pt-BR" | "en", CompareCopy> = {
  "es-AR": {
    metaTitle: "nexID frente a otros enfoques | Pasaporte Digital de Producto",
    metaDescription: "Compará un QR común, una app propia, una etiqueta física de seguridad y nexID: qué necesita la persona, qué se comprueba y qué vuelve a la marca.",
    eyebrow: "Comparar enfoques",
    title: "Cuatro formas de conectar un producto. Qué cambia en cada una.",
    lead: "Un QR común, una app propia, una etiqueta física de seguridad o nexID. La misma pregunta para los cuatro, con sus límites a la vista.",
    scope: "Comparación general de enfoques, no de proveedores concretos. Una solución real puede combinar varios.",
    approachesLabel: "Enfoques comparados",
    approaches: {
      qr: { name: "QR común", hint: "Un código impreso que abre una página" },
      app: { name: "App de la marca", hint: "La lectura ocurre dentro de una app" },
      label: { name: "Etiqueta física de seguridad", hint: "Holograma, sello o marca difícil de imitar" },
      nexid: { name: "nexID", hint: "NFC o QR hacia un pasaporte digital" },
    },
    criteria: [
      {
        question: "¿Qué necesita la persona?",
        answers: {
          qr: "La cámara del celular.",
          app: "Descargar e instalar una app antes de leer.",
          label: "Mirar la etiqueta con atención; a veces, un lector o una lupa.",
          nexid: "Acercar el celular a la etiqueta NFC o escanear el QR. Sin instalar nada.",
        },
      },
      {
        question: "¿Qué pasa si alguien copia la etiqueta?",
        answers: {
          qr: "Un QR impreso se puede fotografiar y reimprimir. La copia abre la misma página.",
          app: "Depende de la etiqueta que lea la app.",
          label: "Está pensada para ser difícil de reproducir, pero la comprobación la hace la persona a ojo.",
          nexid: "Cada tap NFC genera un mensaje nuevo que se comprueba una sola vez; uno repetido se detecta. El QR de nexID se comporta como cualquier QR.",
        },
      },
      {
        question: "¿Qué se comprueba?",
        answers: {
          qr: "Que el enlace abre la página del producto.",
          app: "Lo que la app esté preparada para leer.",
          label: "Que la etiqueta parece original.",
          nexid: "El mensaje del tag y la política de la marca. No certifica por sí solo el objeto físico, y un sello abierto tampoco demuestra falsificación.",
        },
      },
      {
        question: "¿Qué recibe la persona después?",
        answers: {
          qr: "Una página web, igual para todos.",
          app: "Las funciones de la app, si la instaló.",
          label: "Nada digital.",
          nexid: "El pasaporte del producto: origen e información publicada, y los servicios que la marca habilite, como beneficios o contacto.",
        },
      },
      {
        question: "¿Qué vuelve a la marca?",
        answers: {
          qr: "Visitas a la página.",
          app: "Actividad de quienes instalaron la app.",
          label: "Nada, salvo reclamos.",
          nexid: "Lecturas por producto o lote y las acciones registradas, según permisos y consentimiento.",
        },
      },
    ],
    boundaryTitle: "El límite que no escondemos",
    boundary: "nexID comprueba evidencia digital del tag y muestra lo que la marca declara. No reemplaza una pericia sobre el objeto físico. Por eso cada resultado dice qué se comprobó y qué no.",
    demo: "Probar la demo",
    contact: "Agendar demo para mi marca",
  },
  "pt-BR": {
    metaTitle: "nexID diante de outras abordagens | Passaporte Digital de Produto",
    metaDescription: "Compare um QR comum, um app próprio, uma etiqueta física de segurança e a nexID: o que a pessoa precisa, o que é conferido e o que volta para a marca.",
    eyebrow: "Comparar abordagens",
    title: "Quatro formas de conectar um produto. O que muda em cada uma.",
    lead: "Um QR comum, um app próprio, uma etiqueta física de segurança ou a nexID. A mesma pergunta para os quatro, com os limites à vista.",
    scope: "Comparação geral de abordagens, não de fornecedores específicos. Uma solução real pode combinar várias.",
    approachesLabel: "Abordagens comparadas",
    approaches: {
      qr: { name: "QR comum", hint: "Um código impresso que abre uma página" },
      app: { name: "App da marca", hint: "A leitura acontece dentro de um app" },
      label: { name: "Etiqueta física de segurança", hint: "Holograma, lacre ou marca difícil de imitar" },
      nexid: { name: "nexID", hint: "NFC ou QR para um passaporte digital" },
    },
    criteria: [
      {
        question: "O que a pessoa precisa?",
        answers: {
          qr: "A câmera do celular.",
          app: "Baixar e instalar um app antes de ler.",
          label: "Olhar a etiqueta com atenção; às vezes, um leitor ou uma lupa.",
          nexid: "Aproximar o celular da etiqueta NFC ou ler o QR. Sem instalar nada.",
        },
      },
      {
        question: "O que acontece se alguém copiar a etiqueta?",
        answers: {
          qr: "Um QR impresso pode ser fotografado e reimpresso. A cópia abre a mesma página.",
          app: "Depende da etiqueta que o app lê.",
          label: "Foi pensada para ser difícil de reproduzir, mas a conferência é feita a olho pela pessoa.",
          nexid: "Cada toque NFC gera uma mensagem nova, conferida uma única vez; uma repetida é detectada. O QR da nexID se comporta como qualquer QR.",
        },
      },
      {
        question: "O que é conferido?",
        answers: {
          qr: "Que o link abre a página do produto.",
          app: "O que o app estiver preparado para ler.",
          label: "Que a etiqueta parece original.",
          nexid: "A mensagem da tag e a política da marca. Não certifica sozinha o objeto físico, e um lacre aberto também não demonstra falsificação.",
        },
      },
      {
        question: "O que a pessoa recebe depois?",
        answers: {
          qr: "Uma página web, igual para todos.",
          app: "As funções do app, se instalou.",
          label: "Nada digital.",
          nexid: "O passaporte do produto: origem e informação publicada, e os serviços que a marca habilitar, como benefícios ou contato.",
        },
      },
      {
        question: "O que volta para a marca?",
        answers: {
          qr: "Visitas à página.",
          app: "Atividade de quem instalou o app.",
          label: "Nada, além de reclamações.",
          nexid: "Leituras por produto ou lote e as ações registradas, conforme permissões e consentimento.",
        },
      },
    ],
    boundaryTitle: "O limite que não escondemos",
    boundary: "A nexID confere evidência digital da tag e mostra o que a marca declara. Não substitui uma perícia sobre o objeto físico. Por isso cada resultado diz o que foi conferido e o que não foi.",
    demo: "Testar a demo",
    contact: "Agendar demo para minha marca",
  },
  en: {
    metaTitle: "nexID next to other approaches | Digital Product Passport",
    metaDescription: "Compare a plain QR code, a brand app, a physical security label and nexID: what the person needs, what is checked and what returns to the brand.",
    eyebrow: "Compare approaches",
    title: "Four ways to connect a product. What changes in each.",
    lead: "A plain QR code, a brand app, a physical security label or nexID. The same question for all four, with the limits in plain sight.",
    scope: "A general comparison of approaches, not of specific vendors. A real solution may combine several.",
    approachesLabel: "Approaches compared",
    approaches: {
      qr: { name: "Plain QR code", hint: "A printed code that opens a page" },
      app: { name: "Brand app", hint: "Reading happens inside an app" },
      label: { name: "Physical security label", hint: "A hologram, seal or hard-to-imitate mark" },
      nexid: { name: "nexID", hint: "NFC or QR to a digital passport" },
    },
    criteria: [
      {
        question: "What does the person need?",
        answers: {
          qr: "The phone camera.",
          app: "To download and install an app before reading.",
          label: "A careful look at the label; sometimes a reader or a loupe.",
          nexid: "To tap the NFC label or scan the QR code. Nothing to install.",
        },
      },
      {
        question: "What happens if someone copies the label?",
        answers: {
          qr: "A printed QR code can be photographed and reprinted. The copy opens the same page.",
          app: "It depends on the label the app reads.",
          label: "It is designed to be hard to reproduce, but the person checks it by eye.",
          nexid: "Each NFC tap produces a new message that is checked once; a repeated one is detected. The nexID QR code behaves like any QR code.",
        },
      },
      {
        question: "What is checked?",
        answers: {
          qr: "That the link opens the product page.",
          app: "Whatever the app is built to read.",
          label: "That the label looks original.",
          nexid: "The tag message and the brand policy. It does not certify the physical object on its own, and an open seal does not prove a counterfeit either.",
        },
      },
      {
        question: "What does the person get afterwards?",
        answers: {
          qr: "A web page, the same for everyone.",
          app: "The app features, if they installed it.",
          label: "Nothing digital.",
          nexid: "The product passport: origin and published information, plus the services the brand enables, such as benefits or contact.",
        },
      },
      {
        question: "What returns to the brand?",
        answers: {
          qr: "Page visits.",
          app: "Activity from people who installed the app.",
          label: "Nothing, apart from complaints.",
          nexid: "Reads by product or batch and the recorded actions, subject to permissions and consent.",
        },
      },
    ],
    boundaryTitle: "The limit we do not hide",
    boundary: "nexID checks digital evidence from the tag and shows what the brand declares. It does not replace an expert assessment of the physical object. That is why every result says what was checked and what was not.",
    demo: "Try the demo",
    contact: "Book a demo for my brand",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getWebI18n();
  const copy = copyByLocale[locale];
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: { canonical: "/compare" },
    openGraph: { title: copy.metaTitle, description: copy.metaDescription, url: "/compare" },
  };
}

export default async function ComparePage() {
  const { locale } = await getWebI18n();
  const copy = copyByLocale[locale];

  return (
    <>
      <PublicSiteHeader />
      <main id="main-content" tabIndex={-1} data-nav-inert className={styles.page}>
        <div className={styles.glow} aria-hidden="true"><span /><span /></div>
        <header className={`container-shell ${styles.intro}`}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className={styles.lead}>{copy.lead}</p>
          <p className={styles.scope}>{copy.scope}</p>
        </header>

        <section className={`container-shell ${styles.matrix}`} aria-label={copy.approachesLabel}>
          <ul className={styles.approaches} aria-hidden="true">
            {APPROACH_ORDER.map((key) => {
              const Icon = APPROACH_ICON[key];
              return (
                <li key={key} data-approach={key}>
                  <span className={styles.approachIcon}><Icon size={20} /></span>
                  <strong>{copy.approaches[key].name}</strong>
                  <small>{copy.approaches[key].hint}</small>
                </li>
              );
            })}
          </ul>

          {copy.criteria.map((criterion, index) => (
            <article key={criterion.question} className={styles.criterion} style={{ "--row-i": index } as CSSProperties}>
              <h2>{criterion.question}</h2>
              <dl>
                {APPROACH_ORDER.map((key) => (
                  <div key={key} data-approach={key}>
                    <dt>{copy.approaches[key].name}</dt>
                    <dd>{criterion.answers[key]}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </section>

        <section className={`container-shell ${styles.boundary}`} aria-labelledby="compare-boundary">
          <div>
            <h2 id="compare-boundary">{copy.boundaryTitle}</h2>
            <p>{copy.boundary}</p>
          </div>
          <div className={styles.actions}>
            <Link href="/demo-lab" prefetch={false} className={styles.primary}>{copy.demo}<ArrowRight size={16} aria-hidden="true" /></Link>
            <Link href="/?contact=demo#contact-modal" prefetch={false} className={styles.secondary}>{copy.contact}</Link>
          </div>
        </section>
      </main>
    </>
  );
}
