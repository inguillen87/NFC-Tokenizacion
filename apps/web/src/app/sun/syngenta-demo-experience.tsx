"use client";

import { useState, type ReactNode } from "react";
import { ArrowUpRight, Check, ClipboardCheck, FileText, Leaf, MessageCircle, PackageCheck, ShieldAlert } from "lucide-react";
import type { SunLocale } from "./sun-locale";
import type { SunDemoScenario } from "./sun-demo-scenario";
import { SYNGENTA_DEMO as product } from "./syngenta-demo";
import { SyngentaDemoMap } from "./syngenta-demo-map";
import { SyngentaProductAssistant } from "./syngenta-product-assistant";
import styles from "./syngenta-demo-experience.module.css";

const COPY = {
  "es-AR": {
    concept: "Propuesta de piloto · NexID × Syngenta", title: "Conocé AMISTAR XTRA.",
    intro: "Catálogo público de Syngenta Argentina. El lote y los estados del sello son ejemplos de esta presentación.",
    category: "Tipo de producto", categoryValue: "Fungicida", formulation: "Formulación", formulationValue: "Suspensión concentrada", registration: "Registro publicado", registrationNote: "N.º informado en el catálogo de la marca. Esta demo no verifica la autorización ni el envase.",
    container: "Envase", containerValue: "Bidón de 5 L", sealTitle: "Información y sello, desde el bidón", sealBenefit: "Al acercar el teléfono al bidón, podrías abrir la documentación y revisar el estado de apertura registrado en esa lectura.", sealDetails: "Propuesta para el sello de apertura", sealDesign: "Se propone una etiqueta que cruce el cierre. El montaje requiere pruebas mecánicas con el envase real; todavía no hay un sello físico validado.", sealActivation: "El chip es pasivo y comprueba el circuito al activarse con NFC. No vigila continuamente: el diseño físico debe dificultar que alguien corte y vuelva a unir el circuito entre lecturas.", sealLimit: "El registro NFC no certifica la composición química ni el contenido. Un sello abierto requiere revisión y no demuestra por sí solo falsificación. Aquí los estados son simulados.", sealSource: "Ver documentación de NXP · AN12196 §6.5",
    documents: "Documentación oficial, a un toque", label: "Leer la etiqueta", labelText: "Usos e indicaciones en el documento de Syngenta.", safety: "Hoja de seguridad", safetyText: "Información de seguridad publicada por la marca.", catalogue: "Ver el producto", catalogueText: "Ficha en el catálogo argentino de Syngenta.", external: "Abre el sitio de Syngenta", caution: "Antes de usar el producto, consultá la etiqueta y a tu asesor técnico. La demo no indica dosis ni recomienda aplicaciones.",
    journey: "Una propuesta para cada etapa", journeyIntro: "Así podría acompañar NexID al envase. El recorrido real se configura con la empresa y sus integraciones.", stages: ["Envasado", "Distribución", "En tus manos"], stageText: ["Identificar el envase y asociarlo a su lote.", "Consultar los eventos que informe la cadena.", "Revisar el sello y abrir la documentación."], journeyNote: "Recorrido conceptual: sin movimientos, ubicaciones ni sensores registrados para este envase.",
    origin: "El lote de esta muestra", originText: "Lote de muestra", originNote: "El lote es ilustrativo. El mapa muestra una referencia comercial y una zona de ejemplo o compartida con permiso; no certifica dónde se fabricó el envase ni su recorrido.",
    assistantAction: "Preguntar sobre el producto", assistantDescription: "Información y comparaciones con fuentes visibles.", explore: "Explorá el producto",
    checklist: "Conocé tu envase en tres pasos", checklistIntro: "Una experiencia breve para encontrar la información útil, sin lenguaje técnico.", start: "Empezar", restart: "Volver a recorrer", next: "Siguiente paso", finish: "Terminar", step: "Paso", of: "de", complete: "Ya sabés dónde consultar", completeText: "Etiqueta, seguridad y estado del sello: tres accesos para seguir explorando el producto.", quizNote: "Actividad de muestra, sólo en esta pantalla. No guarda respuestas ni otorga puntos o premios.", correct: "Exacto.", retry: "Probá otra opción.",
    questions: ["¿Dónde consultás las indicaciones antes de usar el producto?", "¿Qué documento reúne la información de seguridad?", "¿Qué significa que el sello aparece abierto?"],
    options: [["En la etiqueta oficial", "En una foto de redes", "En el color del envase"], ["En el precio de venta", "En la hoja de seguridad", "En el nombre del lote"], ["Que el producto es falso", "Que ya podés usarlo", "Que hay que revisar su condición"]],
    explanations: ["La etiqueta oficial es el punto de partida; consultá también a tu asesor técnico.", "Tenés un acceso directo a la hoja publicada por Syngenta.", "Una apertura requiere atención. Por sí sola no demuestra falsificación."],
    services: "¿Qué querés consultar?", closed: "Ejemplo de sello cerrado", opened: "Ejemplo de sello abierto", invalid: "Ejemplo de lectura no válida", closedNote: "El estado es simulado. No habilita compras, beneficios ni registra un envase real.", openedNote: "La información sigue disponible. Un sello abierto requiere revisión y no demuestra por sí solo falsificación.", invalidNote: "La lectura del ejemplo no se valida. La documentación pública sigue disponible; las acciones protegidas están bloqueadas.", play: "Recorrer los tres pasos", playText: "Aprendé dónde consultar etiqueta, seguridad y sello.",
  },
  en: {
    concept: "Pilot proposal · NexID × Syngenta", title: "Discover AMISTAR XTRA.", intro: "Syngenta Argentina's public catalogue. The lot and seal states are examples for this presentation.", category: "Product type", categoryValue: "Fungicide", formulation: "Formulation", formulationValue: "Suspension concentrate", registration: "Published registration", registrationNote: "Number reported in the brand's catalogue. This demo does not verify authorization or the container.",
    container: "Container", containerValue: "5 L canister", sealTitle: "Information and seal, from the canister", sealBenefit: "By tapping the canister with your phone, you could open its documents and review the opening state recorded during that reading.", sealDetails: "Proposal for the opening seal", sealDesign: "A label spanning the closure is proposed. Its mounting requires mechanical tests on the actual container; no physical seal has been validated yet.", sealActivation: "The chip is passive and checks the loop when activated by NFC. It does not monitor continuously: the physical design must make it harder to cut and reconnect the loop between readings.", sealLimit: "An NFC record does not certify chemical composition or contents. An open seal needs review and does not by itself prove counterfeiting. The states shown here are simulated.", sealSource: "Read NXP documentation · AN12196 §6.5",
    documents: "Official documents, one tap away", label: "Read the label", labelText: "Uses and instructions in Syngenta's document.", safety: "Safety data sheet", safetyText: "Safety information published by the brand.", catalogue: "View the product", catalogueText: "Entry in Syngenta's Argentine catalogue.", external: "Opens Syngenta's website", caution: "Before using the product, read the label and consult your technical adviser. This demo provides no dosages or application recommendations.",
    journey: "A proposal for every stage", journeyIntro: "How NexID could accompany the container. The actual journey is configured with the company and its integrations.", stages: ["Packaging", "Distribution", "In your hands"], stageText: ["Identify the container and associate its lot.", "Consult events reported by the supply chain.", "Review the seal and open the documents."], journeyNote: "Conceptual journey: no movements, locations or sensor readings recorded for this container.",
    origin: "The lot in this sample", originText: "Sample lot", originNote: "This lot is illustrative. The map shows a commercial reference and a sample or consented area; it does not certify the container's manufacturing origin or its journey.",
    assistantAction: "Ask about the product", assistantDescription: "Product information and comparisons with visible sources.", explore: "Explore the product",
    checklist: "Discover your container in three steps", checklistIntro: "A short experience to find useful information, in plain language.", start: "Start", restart: "Explore again", next: "Next step", finish: "Finish", step: "Step", of: "of", complete: "You know where to look", completeText: "Label, safety and seal state: three ways to keep exploring the product.", quizNote: "Sample activity on this screen only. It saves no answers and grants no points or prizes.", correct: "Exactly.", retry: "Try another option.", questions: ["Where do you find instructions before using the product?", "Which document contains the safety information?", "What does an open seal mean?"], options: [["On the official label", "In a social media photo", "In the container's colour"], ["In the selling price", "In the safety data sheet", "In the lot's name"], ["The product is counterfeit", "It is ready to use", "Its condition needs review"]], explanations: ["Start with the official label and consult your technical adviser.", "You have a direct link to the sheet published by Syngenta.", "Opening needs attention. By itself it does not prove counterfeiting."],
    services: "What would you like to check?", closed: "Closed seal example", opened: "Open seal example", invalid: "Invalid reading example", closedNote: "This state is simulated. It enables no purchases or benefits and registers no real container.", openedNote: "Information remains available. An open seal needs review and does not by itself prove counterfeiting.", invalidNote: "The sample reading is not validated. Public documents remain available; protected actions are blocked.", play: "Explore the three steps", playText: "Learn where to check the label, safety and seal.",
  },
  "pt-BR": {
    concept: "Proposta de piloto · NexID × Syngenta", title: "Conheça AMISTAR XTRA.", intro: "Catálogo público da Syngenta Argentina. O lote e os estados do lacre são exemplos desta apresentação.", category: "Tipo de produto", categoryValue: "Fungicida", formulation: "Formulação", formulationValue: "Suspensão concentrada", registration: "Registro publicado", registrationNote: "Número informado no catálogo da marca. Esta demo não verifica a autorização nem a embalagem.",
    container: "Embalagem", containerValue: "Galão de 5 L", sealTitle: "Informação e lacre, a partir do galão", sealBenefit: "Ao aproximar o celular do galão, você poderia abrir os documentos e conferir o estado de abertura registrado naquela leitura.", sealDetails: "Proposta para o lacre de abertura", sealDesign: "Propõe-se uma etiqueta que atravesse o fechamento. A montagem exige testes mecânicos na embalagem real; ainda não há um lacre físico validado.", sealActivation: "O chip é passivo e verifica o circuito quando ativado por NFC. Não monitora continuamente: o projeto físico deve dificultar o corte e a reconexão do circuito entre leituras.", sealLimit: "O registro NFC não certifica a composição química nem o conteúdo. Um lacre aberto exige revisão e não comprova falsificação por si só. Os estados apresentados aqui são simulados.", sealSource: "Ver documentação da NXP · AN12196 §6.5",
    documents: "Documentação oficial, em um toque", label: "Ler o rótulo", labelText: "Usos e instruções no documento da Syngenta.", safety: "Ficha de segurança", safetyText: "Informações de segurança publicadas pela marca.", catalogue: "Ver o produto", catalogueText: "Ficha no catálogo argentino da Syngenta.", external: "Abre o site da Syngenta", caution: "Antes de usar o produto, leia o rótulo e consulte seu assessor técnico. A demo não indica doses nem recomenda aplicações.",
    journey: "Uma proposta para cada etapa", journeyIntro: "Como a NexID poderia acompanhar a embalagem. O percurso real é configurado com a empresa e suas integrações.", stages: ["Embalagem", "Distribuição", "Em suas mãos"], stageText: ["Identificar a embalagem e associar seu lote.", "Consultar os eventos informados pela cadeia.", "Verificar o lacre e abrir a documentação."], journeyNote: "Percurso conceitual: sem movimentos, localizações ou sensores registrados para esta embalagem.",
    origin: "O lote desta amostra", originText: "Lote de exemplo", originNote: "O lote é ilustrativo. O mapa mostra uma referência comercial e uma área de exemplo ou compartilhada com permissão; não certifica onde a embalagem foi fabricada nem seu percurso.",
    assistantAction: "Perguntar sobre o produto", assistantDescription: "Informações e comparações com fontes visíveis.", explore: "Explore o produto",
    checklist: "Conheça sua embalagem em três passos", checklistIntro: "Uma experiência breve para encontrar informações úteis, em linguagem simples.", start: "Começar", restart: "Explorar novamente", next: "Próximo passo", finish: "Concluir", step: "Passo", of: "de", complete: "Você sabe onde consultar", completeText: "Rótulo, segurança e estado do lacre: três acessos para continuar explorando o produto.", quizNote: "Atividade de exemplo, apenas nesta tela. Não salva respostas nem concede pontos ou prêmios.", correct: "Isso mesmo.", retry: "Tente outra opção.", questions: ["Onde consultar as instruções antes de usar o produto?", "Qual documento reúne as informações de segurança?", "O que significa um lacre aberto?"], options: [["No rótulo oficial", "Em uma foto nas redes", "Na cor da embalagem"], ["No preço de venda", "Na ficha de segurança", "No nome do lote"], ["Que o produto é falso", "Que está pronto para usar", "Que sua condição precisa de revisão"]], explanations: ["Comece pelo rótulo oficial e consulte seu assessor técnico.", "Há um acesso direto à ficha publicada pela Syngenta.", "Uma abertura requer atenção. Por si só, não comprova falsificação."],
    services: "O que você quer consultar?", closed: "Exemplo de lacre fechado", opened: "Exemplo de lacre aberto", invalid: "Exemplo de leitura inválida", closedNote: "O estado é simulado. Não habilita compras ou benefícios nem registra uma embalagem real.", openedNote: "As informações seguem disponíveis. Um lacre aberto requer revisão e não comprova falsificação por si só.", invalidNote: "A leitura do exemplo não é validada. Os documentos públicos seguem disponíveis; ações protegidas estão bloqueadas.", play: "Explorar os três passos", playText: "Descubra onde consultar rótulo, segurança e lacre.",
  },
} as const;

function OfficialLink({ href, title, description, icon }: { href: string; title: string; description: string; icon: ReactNode }) {
  return <a className={styles.action} href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" data-syngenta-document>
    {icon}<span><strong>{title}</strong><small>{description}</small></span><ArrowUpRight size={18} aria-hidden="true" />
  </a>;
}

export function SyngentaDemoOrigin({ locale }: { locale: SunLocale }) {
  const copy = COPY[locale];
  return <div data-testid="syngenta-demo-origin"><SyngentaDemoMap locale={locale} /><details className={styles.origin}><summary>{copy.origin}<span>{product.lot}</span></summary><p>{copy.originText} · <strong>{product.lot}</strong></p><p className={styles.note}>{copy.originNote}</p></details></div>;
}

export function SyngentaDemoServices({ locale, scenario }: { locale: SunLocale; scenario: SunDemoScenario }) {
  const copy = COPY[locale];
  const stateNote = scenario === "closed" ? copy.closedNote : scenario === "opened" ? copy.openedNote : copy.invalidNote;
  return <section className={styles.services} aria-labelledby="syngenta-services-title" data-testid="syngenta-demo-services" data-scenario={scenario}>
    <h2 id="syngenta-services-title">{copy.services}</h2>
    <p className={styles.stateNotice}>{scenario === "closed" ? <PackageCheck size={20} aria-hidden="true" /> : <ShieldAlert size={20} aria-hidden="true" />}<span><strong>{copy[scenario]}</strong><small>{stateNote}</small></span></p>
    <a className={`${styles.action} ${styles.assistantAction}`} href="#syngenta-assistant"><MessageCircle size={22} aria-hidden="true" /><span><strong>{copy.assistantAction}</strong><small>{copy.assistantDescription}</small></span><ArrowUpRight size={18} aria-hidden="true" /></a>
    <OfficialLink href={product.label} title={copy.label} description={`${copy.labelText} ${copy.external} ↗`} icon={<FileText size={22} aria-hidden="true" />} />
    <OfficialLink href={product.safetySheet} title={copy.safety} description={`${copy.safetyText} ${copy.external} ↗`} icon={<ShieldAlert size={22} aria-hidden="true" />} />
    <a className={styles.action} href="#syngenta-checklist"><ClipboardCheck size={22} aria-hidden="true" /><span><strong>{copy.play}</strong><small>{copy.playText}</small></span><ArrowUpRight size={18} aria-hidden="true" /></a>
  </section>;
}

export function SyngentaDemoExperience({ locale, scenario }: { locale: SunLocale; scenario: SunDemoScenario }) {
  const copy = COPY[locale];
  const [step, setStep] = useState(-1);
  const [answer, setAnswer] = useState<number | null>(null);
  const completed = step === 3;
  const correct = answer === step;
  const begin = () => { setStep(0); setAnswer(null); };
  const advance = () => { setStep(current => current + 1); setAnswer(null); };
  return <div className={styles.experience} data-testid="syngenta-demo-experience" data-scenario={scenario} lang={locale === "es-AR" ? "es" : locale === "pt-BR" ? "pt" : "en"}>
    <header className={styles.brand}>
      {/* Original brand asset on a fixed white surface for legibility in both themes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <span className={styles.logoSurface}><img src={product.logo} width={160} height={48} alt="Syngenta" loading="lazy" /></span>
      <p className={styles.eyebrow}>{copy.concept}</p><h2>{copy.title}</h2><p className={styles.note}>{copy.intro}</p>
    </header>
    <div className={styles.assistantAnchor}><SyngentaProductAssistant locale={locale} /></div>
    <dl className={styles.facts}><div><dt>{copy.category}</dt><dd>{copy.categoryValue}</dd></div><div><dt>{copy.formulation}</dt><dd>{copy.formulationValue}</dd></div><div><dt>{copy.registration}</dt><dd>{product.registrationNumber}</dd></div><div><dt>{copy.container}</dt><dd>{locale === "es-AR" ? product.container : copy.containerValue}</dd></div></dl>
    <p className={styles.note}>{copy.registrationNote}</p>
    <section id="syngenta-documents" className={styles.panel} aria-labelledby="syngenta-documents-title">
      <h3 id="syngenta-documents-title">{copy.documents}</h3>
      <OfficialLink href={product.label} title={copy.label} description={`${copy.labelText} ${copy.external} ↗`} icon={<FileText size={22} aria-hidden="true" />} />
      <OfficialLink href={product.safetySheet} title={copy.safety} description={`${copy.safetyText} ${copy.external} ↗`} icon={<ShieldAlert size={22} aria-hidden="true" />} />
      <OfficialLink href={product.productPage} title={copy.catalogue} description={`${copy.catalogueText} ${copy.external} ↗`} icon={<Leaf size={22} aria-hidden="true" />} />
      <p className={styles.note}>{copy.caution}</p>
    </section>
    <section className={`${styles.panel} ${styles.sealProposal}`} aria-labelledby="syngenta-seal-proposal-title" data-testid="syngenta-seal-proposal">
      <h3 id="syngenta-seal-proposal-title">{copy.sealTitle}</h3><p>{copy.sealBenefit}</p>
      <details data-testid="syngenta-seal-details">
        <summary>{copy.sealDetails}</summary>
        <p className={styles.note}><strong>{product.tagProposal}</strong>. {copy.sealDesign}</p>
        <p className={styles.note}>{copy.sealActivation}</p><p className={styles.note}>{copy.sealLimit}</p>
        <a href={product.tagSource} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" data-syngenta-tag-source>{copy.sealSource}<ArrowUpRight size={16} aria-hidden="true" /></a>
      </details>
    </section>
    <details id="syngenta-journey" className={`${styles.panel} ${styles.journeyDetails}`}>
      <summary>{copy.journey}</summary><p>{copy.journeyIntro}</p>
      <ol className={styles.journey}>{copy.stages.map((stage, index) => <li key={stage}><span aria-hidden="true">{index + 1}</span><div><strong>{stage}</strong><p>{copy.stageText[index]}</p></div></li>)}</ol>
      <p className={styles.note}>{copy.journeyNote}</p>
    </details>
    <section id="syngenta-checklist" className={`${styles.panel} ${styles.checklist}`} aria-labelledby="syngenta-checklist-title">
      <span className={styles.eyebrow}><ClipboardCheck size={18} aria-hidden="true" />{copy.explore}</span><h3 id="syngenta-checklist-title">{copy.checklist}</h3><p>{copy.checklistIntro}</p>
      <div className={styles.steps} role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={Math.max(0, Math.min(step, 3))} aria-label={copy.checklist}>{[0, 1, 2].map(index => <span key={index} data-complete={step > index ? "true" : "false"}>{step > index ? <Check size={18} aria-hidden="true" /> : index + 1}</span>)}</div>
      {step < 0 ? <button type="button" className={styles.primary} data-testid="syngenta-checklist-start" onClick={begin}>{copy.start}</button> : completed ? <div data-testid="syngenta-checklist-complete"><h4>{copy.complete}</h4><p>{copy.completeText}</p><button type="button" className={styles.secondary} data-testid="syngenta-checklist-restart" onClick={begin}>{copy.restart}</button></div> : <fieldset className={styles.question}>
        <legend><span>{copy.step} {step + 1} {copy.of} 3</span><strong>{copy.questions[step]}</strong></legend>
        {copy.options[step].map((option, index) => <button type="button" key={option} className={styles.option} data-testid="syngenta-checklist-option" aria-pressed={answer === index} disabled={correct} onClick={() => setAnswer(index)}>{option}{answer === index && correct ? <Check size={18} aria-hidden="true" /> : null}</button>)}
        <p role="status" aria-live="polite" className={styles.feedback}>{answer === null ? "" : correct ? `${copy.correct} ${copy.explanations[step]}` : copy.retry}</p>
        <button type="button" className={styles.primary} data-testid="syngenta-checklist-next" disabled={!correct} onClick={advance}>{step === 2 ? copy.finish : copy.next}</button>
      </fieldset>}
      <p className={styles.note}>{copy.quizNote}</p>
    </section>
  </div>;
}
