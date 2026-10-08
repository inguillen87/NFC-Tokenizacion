"use client";

import { useState, type ReactNode } from "react";
import { ArrowUpRight, Check, Compass, Leaf, MapPin, Wine } from "lucide-react";
import type { SunLocale } from "./sun-locale";
import { VALLE_SECRETO_DEMO as wine } from "./valle-secreto-demo";
import styles from "./valle-secreto-experience.module.css";

const COPY = {
  "es-AR": {
    concept: "Experiencia de muestra para Valle Secreto", intro: "Un vino. Una historia para descubrir.",
    note: "Ficha pública de la viña. El sello, los sensores y el juego son simulaciones para esta presentación.",
    vintage: "Cosecha", aging: "Crianza", months: "meses", serving: "Servir a", sheet: "Ver ficha de Profundo 2019",
    pairing: "Para la mesa", pairingText: "Cordero, carnes de caza y pato", blend: "Las cinco cepas", oak: "Barricas Magnum nuevas de roble francés",
    treasure: "Mapa del Tesoro", treasureIntro: "Tres pistas para conocer el vino antes de visitar la viña.",
    gameNote: "Juego local de muestra. No guarda respuestas ni entrega puntos, premios o reservas.",
    start: "Descubrir la primera pista", next: "Siguiente pista", finish: "Ver mi recorrido", restart: "Volver a descubrir", clue: "Pista", of: "de", correct: "¡Encontraste la pista!", retry: "Probá otra opción. La ficha de la viña te puede ayudar.",
    complete: "Tu recorrido está completo", completeText: "Ya conocés el origen, la crianza y cómo compartir Profundo. El próximo descubrimiento puede ser en la viña.",
    questions: ["¿Dónde empieza la historia de Profundo?", "¿Qué crianza publica su ficha?", "¿A qué temperatura recomienda servirlo la viña?"],
    options: [["Cachapoal Andes", "Valle de Uco", "Rioja"], ["6 meses en acero", "24 meses en roble francés", "Sin crianza"], ["Muy frío, a 4 °C", "A 25 °C", "Entre 16 y 18 °C"]],
    explanations: ["Su origen es Cachapoal Andes, Chile.", "La cosecha 2019 tiene 24 meses en barricas Magnum nuevas de roble francés.", "16–18 °C es una recomendación de servicio de la ficha, no una medición del sensor."],
    visit: "Vivilo en la viña", visitText: "Valle Secreto ofrece un Mapa del Tesoro presencial: una caminata por la viña siguiendo pistas.", experiences: "Conocer las experiencias", map: "Buscar la viña en Google Maps", mapNote: "Búsqueda por domicilio público. No es una ubicación medida por el chip ni por tu teléfono.",
    sustainability: "De la viña a tu copa", sustainabilityIntro: "Prácticas publicadas por Valle Secreto, con sus fuentes a mano.",
    solar: "Energía solar", solarText: "La viña informa el uso de energía solar desde 2022.", water: "Cuidado del agua", waterText: "Declara tratamiento y reutilización de sus residuos líquidos industriales para riego.", reuse: "Una segunda vida", reuseText: "Publica prácticas de reutilización de barricas y gestión de materiales.",
    practices: "Leer prácticas sustentables", certificate: "Ver certificado Ecocert", certNote: "Certificación de la empresa, áreas verde, naranja y roja. Vigencia del documento: 23/12/2025–23/12/2027. No informa una huella ambiental de esta botella.",
    optionsTitle: "Elegí tu próximo descubrimiento", guide: "Consultar el vino", guideText: "Ideas para regalar, servir y acompañar.", play: "Seguir las pistas", playText: "Un recorrido breve por Profundo.", visitAction: "Visitar Valle Secreto", visitActionText: "Experiencias en el sitio oficial de la viña.", external: "Abre el sitio oficial", scenario: "Probar el estado del sello", closed: "Cerrado · demo", opened: "Abierto · demo",
  },
  en: {
    concept: "Sample experience for Valle Secreto", intro: "One wine. A story to discover.", note: "Public producer information. The seal, sensors and game are simulations for this presentation.",
    vintage: "Vintage", aging: "Aging", months: "months", serving: "Serve at", sheet: "View the Profundo 2019 sheet", pairing: "At the table", pairingText: "Lamb, game and duck", blend: "Five grape varieties", oak: "New French oak Magnum barrels",
    treasure: "Treasure Map", treasureIntro: "Three clues to discover the wine before visiting the vineyard.", gameNote: "Local sample game. It saves no answers and grants no points, prizes or bookings.", start: "Discover the first clue", next: "Next clue", finish: "View my journey", restart: "Discover it again", clue: "Clue", of: "of", correct: "You found the clue!", retry: "Try another option. The producer's sheet can help.", complete: "Your journey is complete", completeText: "You have discovered Profundo's origin, aging and serving. Your next discovery could be at the vineyard.",
    questions: ["Where does Profundo's story begin?", "What aging does its sheet report?", "What serving temperature does the producer recommend?"], options: [["Cachapoal Andes", "Valle de Uco", "Rioja"], ["6 months in steel", "24 months in French oak", "No aging"], ["Very cold, at 4 °C", "At 25 °C", "Between 16 and 18 °C"]], explanations: ["Its origin is Cachapoal Andes, Chile.", "The 2019 vintage has 24 months in new French oak Magnum barrels.", "16–18 °C is the sheet's serving recommendation, not a sensor reading."],
    visit: "Experience the vineyard", visitText: "Valle Secreto offers an outdoor Treasure Map walk through the vineyard, following clues.", experiences: "Explore the experiences", map: "Find the vineyard on Google Maps", mapNote: "Search using the public address. This is not a location measured by the chip or your phone.", sustainability: "From vineyard to glass", sustainabilityIntro: "Practices published by Valle Secreto, with sources to explore.", solar: "Solar energy", solarText: "The winery reports using solar energy since 2022.", water: "Caring for water", waterText: "It reports treatment and reuse of industrial liquid waste for irrigation.", reuse: "A second life", reuseText: "It publishes practices for barrel reuse and material management.", practices: "Read sustainability practices", certificate: "View the Ecocert certificate", certNote: "Company certification for green, orange and red areas. Document validity: 23 Dec 2025–23 Dec 2027. It does not report this bottle's environmental footprint.", optionsTitle: "Choose your next discovery", guide: "Ask about the wine", guideText: "Ideas for gifts, serving and pairing.", play: "Follow the clues", playText: "A short journey through Profundo.", visitAction: "Visit Valle Secreto", visitActionText: "Experiences on the winery's official site.", external: "Opens the official site", scenario: "Try the seal scenarios", closed: "Closed · demo", opened: "Opened · demo",
  },
  "pt-BR": {
    concept: "Experiência de exemplo para Valle Secreto", intro: "Um vinho. Uma história para descobrir.", note: "Informações públicas da vinícola. O lacre, os sensores e o jogo são simulações para esta apresentação.", vintage: "Safra", aging: "Maturação", months: "meses", serving: "Servir a", sheet: "Ver ficha do Profundo 2019", pairing: "À mesa", pairingText: "Cordeiro, carnes de caça e pato", blend: "As cinco variedades", oak: "Barricas Magnum novas de carvalho francês",
    treasure: "Mapa do Tesouro", treasureIntro: "Três pistas para conhecer o vinho antes de visitar a vinícola.", gameNote: "Jogo local de exemplo. Não salva respostas nem concede pontos, prêmios ou reservas.", start: "Descobrir a primeira pista", next: "Próxima pista", finish: "Ver meu percurso", restart: "Descobrir novamente", clue: "Pista", of: "de", correct: "Você encontrou a pista!", retry: "Experimente outra opção. A ficha da vinícola pode ajudar.", complete: "Seu percurso está completo", completeText: "Você conheceu a origem, a maturação e como compartilhar Profundo. A próxima descoberta pode ser na vinícola.", questions: ["Onde começa a história de Profundo?", "Que maturação sua ficha informa?", "A que temperatura a vinícola recomenda servir?"], options: [["Cachapoal Andes", "Valle de Uco", "Rioja"], ["6 meses em aço", "24 meses em carvalho francês", "Sem maturação"], ["Bem frio, a 4 °C", "A 25 °C", "Entre 16 e 18 °C"]], explanations: ["A origem é Cachapoal Andes, Chile.", "A safra 2019 tem 24 meses em barricas Magnum novas de carvalho francês.", "16–18 °C é a recomendação de serviço da ficha, não uma leitura de sensor."], visit: "Viva a experiência na vinícola", visitText: "Valle Secreto oferece um Mapa do Tesouro presencial: uma caminhada pela vinícola seguindo pistas.", experiences: "Conhecer as experiências", map: "Buscar a vinícola no Google Maps", mapNote: "Busca pelo endereço público. Não é uma localização medida pelo chip nem pelo seu celular.", sustainability: "Da vinícola à taça", sustainabilityIntro: "Práticas publicadas por Valle Secreto, com as fontes disponíveis.", solar: "Energia solar", solarText: "A vinícola informa o uso de energia solar desde 2022.", water: "Cuidado com a água", waterText: "Declara tratamento e reutilização de resíduos líquidos industriais para irrigação.", reuse: "Uma segunda vida", reuseText: "Publica práticas de reutilização de barricas e gestão de materiais.", practices: "Ler práticas sustentáveis", certificate: "Ver certificado Ecocert", certNote: "Certificação da empresa nas áreas verde, laranja e vermelha. Validade do documento: 23/12/2025–23/12/2027. Não informa a pegada ambiental desta garrafa.", optionsTitle: "Escolha sua próxima descoberta", guide: "Consultar o vinho", guideText: "Ideias para presentear, servir e harmonizar.", play: "Seguir as pistas", playText: "Um breve percurso por Profundo.", visitAction: "Visitar Valle Secreto", visitActionText: "Experiências no site oficial da vinícola.", external: "Abre o site oficial", scenario: "Experimentar o estado do lacre", closed: "Fechado · demo", opened: "Aberto · demo",
  },
} as const;

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={styles.link}>{children}<ArrowUpRight size={16} aria-hidden="true" /></a>;
}

export function ValleSecretoDemoServices({ locale }: { locale: SunLocale }) {
  const copy = COPY[locale];
  return <section className={styles.services} aria-labelledby="valle-secreto-services-title" data-testid="valle-secreto-services">
    <h2 id="valle-secreto-services-title">{copy.optionsTitle}</h2>
    <a className={styles.service} href="#qr-engagement" data-testid="valle-secreto-guide-link" onClick={event => {
      if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        window.dispatchEvent(new Event("sun:demo-wine-guide"));
      }
    }}><Wine aria-hidden="true" /><span><strong>{copy.guide}</strong><small>{copy.guideText}</small></span><ArrowUpRight aria-hidden="true" /></a>
    <a className={styles.service} href="#valle-secreto-treasure"><Compass aria-hidden="true" /><span><strong>{copy.play}</strong><small>{copy.playText}</small></span><ArrowUpRight aria-hidden="true" /></a>
    <a className={styles.service} href={wine.experiences} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><MapPin aria-hidden="true" /><span><strong>{copy.visitAction}</strong><small>{copy.visitActionText} {copy.external} ↗</small></span><ArrowUpRight aria-hidden="true" /></a>
  </section>;
}

export function ValleSecretoExperience({ locale }: { locale: SunLocale }) {
  const copy = COPY[locale];
  const [step, setStep] = useState(-1);
  const [answer, setAnswer] = useState<number | null>(null);
  const completed = step === 3;
  const correct = answer === step;
  const begin = () => { setStep(0); setAnswer(null); };
  const advance = () => { setStep(step + 1); setAnswer(null); };

  return <div className={styles.experience} data-testid="valle-secreto-experience" lang={locale === "es-AR" ? "es" : locale === "pt-BR" ? "pt" : "en"}>
    <header className={styles.brand}>
      {/* Original producer assets; themes switch without refetching a remote image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.logoLight} src={wine.logoLight} width={120} height={95} alt="Valle Secreto" loading="lazy" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.logoDark} src={wine.logoDark} width={120} height={96} alt="Valle Secreto" loading="lazy" />
      <p>{copy.concept}</p><h3>{copy.intro}</h3><p className={styles.note}>{copy.note}</p>
    </header>
    <dl className={styles.facts}><div><dt>{copy.vintage}</dt><dd>{wine.vintage}</dd></div><div><dt>{copy.aging}</dt><dd>{wine.barrelMonths} <small>{copy.months}</small></dd></div><div><dt>{copy.serving}</dt><dd>{wine.serving}</dd></div></dl>
    <p className={styles.oak}>{copy.oak}</p>
    <div className={styles.pairing}><Wine size={20} aria-hidden="true" /><div><h4>{copy.pairing}</h4><p>{copy.pairingText}</p></div></div>
    <details className={styles.details}><summary>{copy.blend}</summary><p>{wine.blend}</p></details>
    <ExternalLink href={wine.technicalSheet}>{copy.sheet}</ExternalLink>
    <nav className={styles.scenarios} aria-label={copy.scenario}>
      <span>{copy.scenario}</span>
      <a href={`/sun?demo=1&profile=valle-secreto&scenario=closed&lang=${locale}#sun-summary`}>{copy.closed}</a>
      <a href={`/sun?demo=1&profile=valle-secreto&scenario=opened&lang=${locale}#sun-summary`}>{copy.opened}</a>
    </nav>
    <section id="valle-secreto-treasure" className={styles.treasure} aria-labelledby="valle-treasure-title">
      <span className={styles.eyebrow}><Compass size={18} aria-hidden="true" />{copy.treasure}</span>
      <h3 id="valle-treasure-title">{copy.treasureIntro}</h3>
      <div className={styles.stamps} role="group" aria-label={`${Math.max(0, Math.min(step, 3))} / 3`}>
        {[0, 1, 2].map(index => <span key={index} data-complete={step > index ? "true" : "false"}>{step > index ? <Check size={18} aria-hidden="true" /> : index + 1}</span>)}
      </div>
      {step < 0 ? <button type="button" className={styles.primary} data-testid="wine-treasure-start" onClick={begin}>{copy.start}</button> : completed ? <div>
        <h4>{copy.complete}</h4><p>{copy.completeText}</p><ExternalLink href={wine.experiences}>{copy.experiences}</ExternalLink>
        <button type="button" className={styles.secondary} data-testid="wine-treasure-restart" onClick={begin}>{copy.restart}</button>
      </div> : <fieldset className={styles.clue}>
        <legend><span>{copy.clue} {step + 1} {copy.of} 3</span><strong>{copy.questions[step]}</strong></legend>
        {copy.options[step].map((option, index) => <button type="button" key={option} className={styles.option} data-testid="wine-treasure-option" aria-pressed={answer === index} disabled={correct} onClick={() => setAnswer(index)}>{option}{answer === index && correct ? <Check size={18} aria-hidden="true" /> : null}</button>)}
        <p role="status" aria-live="polite" className={styles.feedback}>{answer === null ? "" : correct ? `${copy.correct} ${copy.explanations[step]}` : copy.retry}</p>
        <button type="button" className={styles.primary} data-testid="wine-treasure-next" disabled={!correct} onClick={advance}>{step === 2 ? copy.finish : copy.next}</button>
      </fieldset>}
      <p className={styles.note}>{copy.gameNote}</p>
    </section>
    <section id="valle-secreto-place" className={styles.place} aria-labelledby="valle-place-title">
      <MapPin size={24} aria-hidden="true" /><h3 id="valle-place-title">{copy.visit}</h3><p>{copy.visitText}</p><address>{wine.address}</address>
      <ExternalLink href={wine.mapUrl}>{copy.map}</ExternalLink><p className={styles.note}>{copy.mapNote}</p><ExternalLink href={wine.experiences}>{copy.experiences}</ExternalLink>
    </section>
    <section className={styles.sustainability} aria-labelledby="valle-sustainability-title">
      <Leaf size={24} aria-hidden="true" /><h3 id="valle-sustainability-title">{copy.sustainability}</h3><p>{copy.sustainabilityIntro}</p>
      <ul><li><strong>{copy.solar}</strong><p>{copy.solarText}</p></li><li><strong>{copy.water}</strong><p>{copy.waterText}</p></li><li><strong>{copy.reuse}</strong><p>{copy.reuseText}</p></li></ul>
      <ExternalLink href={wine.practices}>{copy.practices}</ExternalLink>
      <details className={styles.details}><summary>{copy.certificate}</summary><p className={styles.note}>{copy.certNote}</p><ExternalLink href={wine.certificate}>{copy.certificate}</ExternalLink></details>
    </section>
  </div>;
}
