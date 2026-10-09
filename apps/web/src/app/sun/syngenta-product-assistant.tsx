"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Bot, Send, RotateCcw } from "lucide-react";
import { MANAGED_SOMMELIER_QUESTION_MAX_CHARS, requestManagedSommelierAnswer, sommelierHistory, type SommelierSource } from "../../lib/managed-sommelier";
import type { SunLocale } from "./sun-locale";
import styles from "./syngenta-product-assistant.module.css";

const COPY = {
  "es-AR": {
    eyebrow: "Explorá el producto", title: "Preguntá antes de elegir", intro: "Conocé AMISTAR XTRA, encontrá sus documentos y compará las fichas de la marca.",
    suggestions: ["¿Qué debería revisar antes de comprar?", "Compará AMISTAR XTRA con AMISTAR TOP", "¿Cómo se guarda el envase?"],
    label: "Tu pregunta sobre el producto", placeholder: "¿Qué querés saber de AMISTAR XTRA?", send: "Preguntar", pending: "Revisando la información del producto…", live: "Respuesta IA · fuentes oficiales", fallback: "Información oficial · IA no disponible", sources: "Fuentes de esta respuesta", you: "Tu pregunta", assistant: "Asistente del producto", retry: "Reintentar esta pregunta", error: "No pudimos obtener la respuesta. Tu pregunta se conserva; podés reintentar.", followUp: "Seguí explorando", clear: "Nueva conversación", note: "Catálogo argentino. Para elegir una aplicación, consultá la etiqueta y a tu asesor técnico.",
  },
  en: {
    eyebrow: "Explore the product", title: "Ask before choosing", intro: "Learn about AMISTAR XTRA, find its documents and compare the brand's product sheets.",
    suggestions: ["What should I check before buying?", "Compare AMISTAR XTRA with AMISTAR TOP", "How should I store the container?"],
    label: "Your product question", placeholder: "What would you like to know about AMISTAR XTRA?", send: "Ask", pending: "Checking the product information…", live: "AI response · official sources", fallback: "Official information · AI unavailable", sources: "Sources for this answer", you: "Your question", assistant: "Product assistant", retry: "Retry this question", error: "We could not get an answer. Your question is preserved; you can retry.", followUp: "Keep exploring", clear: "New conversation", note: "Argentine catalogue. For application decisions, consult the label and your technical adviser.",
  },
  "pt-BR": {
    eyebrow: "Explore o produto", title: "Pergunte antes de escolher", intro: "Conheça AMISTAR XTRA, encontre seus documentos e compare as fichas da marca.",
    suggestions: ["O que devo conferir antes de comprar?", "Compare AMISTAR XTRA com AMISTAR TOP", "Como guardar a embalagem?"],
    label: "Sua pergunta sobre o produto", placeholder: "O que você quer saber sobre AMISTAR XTRA?", send: "Perguntar", pending: "Consultando as informações do produto…", live: "Resposta IA · fontes oficiais", fallback: "Informação oficial · IA indisponível", sources: "Fontes desta resposta", you: "Sua pergunta", assistant: "Assistente do produto", retry: "Tentar esta pergunta novamente", error: "Não conseguimos obter uma resposta. Sua pergunta foi preservada; você pode tentar novamente.", followUp: "Continue explorando", clear: "Nova conversa", note: "Catálogo argentino. Para decidir uma aplicação, consulte o rótulo e seu assessor técnico.",
  },
} as const;

type Message = { id: number; sender: "user" | "sommelier"; text: string; fallback?: boolean; sources?: SommelierSource[]; suggestions?: string[] };

export function SyngentaProductAssistant({ locale }: { locale: SunLocale }) {
  const copy = COPY[locale];
  const inputId = useId();
  const headingId = useId();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const control = useRef({ sequence: 0, nextId: 0, pending: false, controller: null as AbortController | null });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLLIElement>(null);

  useEffect(() => () => {
    control.current.sequence++;
    control.current.controller?.abort();
    control.current.pending = false;
  }, [locale]);

  const reset = () => {
    control.current.sequence++;
    control.current.controller?.abort();
    control.current.pending = false;
    setMessages([]); setQuestion(""); setFailedQuestion(null); setPending(false);
    inputRef.current?.focus();
  };
  const ask = async (value: string) => {
    const text = value.trim().slice(0, MANAGED_SOMMELIER_QUESTION_MAX_CHARS);
    if (!text || control.current.pending) return;
    const sequence = ++control.current.sequence;
    const controller = new AbortController();
    control.current.controller = controller;
    control.current.pending = true;
    const isRetry = failedQuestion === text && messages.at(-1)?.sender === "user" && messages.at(-1)?.text === text;
    const history = sommelierHistory(isRetry ? messages.slice(0, -1) : messages);
    setPending(true); setFailedQuestion(null); setQuestion(text);
    if (!isRetry) {
      const userMessage: Message = { id: ++control.current.nextId, sender: "user", text };
      setMessages(current => [...current, userMessage].slice(-14));
    }
    const result = await requestManagedSommelierAnswer(text, { locale, demoProfile: "syngenta", history, signal: controller.signal });
    if (sequence !== control.current.sequence || controller.signal.aborted) return;
    control.current.pending = false; setPending(false);
    if (result.status === "unavailable") { setFailedQuestion(text); return; }
    const answerMessage: Message = { id: ++control.current.nextId, sender: "sommelier", text: result.data.optimizedText, fallback: result.data.fallback, sources: result.data.sources, suggestions: result.data.suggestedQuestions };
    setMessages(current => [...current, answerMessage].slice(-14));
    if (!result.data.fallback) setQuestion("");
    requestAnimationFrame(() => { if (sequence === control.current.sequence) answerRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); });
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void ask(question); };
  const suggestions = messages.length ? messages.at(-1)?.suggestions ?? [] : copy.suggestions;
  const lastAnswer = [...messages].reverse().find(message => message.sender === "sommelier");

  return <section id="syngenta-assistant" className={styles.assistant} aria-labelledby={headingId} data-testid="syngenta-product-assistant" data-assistant-pending={pending} data-sun-dock-avoid>
    <header className={styles.heading}>
      <span className={styles.icon}><Bot size={24} aria-hidden="true" /></span>
      <div><span className={styles.eyebrow}>{copy.eyebrow}</span><h2 id={headingId}>{copy.title}</h2><p>{copy.intro}</p></div>
    </header>
    {messages.length ? <ol className={styles.messages} aria-label={copy.assistant}>
      {messages.map(message => <li key={message.id} ref={message === lastAnswer ? answerRef : undefined} className={message.sender === "user" ? styles.user : styles.answer} data-testid={message.sender === "user" ? "syngenta-assistant-question" : "syngenta-assistant-answer"}>
        <span className={styles.messageLabel}>{message.sender === "user" ? copy.you : message.fallback ? copy.fallback : copy.live}</span>
        <p>{message.text}</p>
        {message.sources?.length ? <ul className={styles.sources} aria-label={copy.sources}>{message.sources.filter(source => source.url).map(source => <li key={source.id}><a href={source.url!} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{source.label}<ArrowUpRight size={15} aria-hidden="true" /></a></li>)}</ul> : null}
      </li>)}
    </ol> : null}
    <p className={styles.status} role="status" aria-live="polite">{pending ? copy.pending : failedQuestion ? copy.error : ""}</p>
    {failedQuestion ? <button type="button" className={styles.retry} onClick={() => void ask(failedQuestion)} disabled={pending}><RotateCcw size={16} aria-hidden="true" />{copy.retry}</button> : null}
    {suggestions.length ? <div className={styles.suggestions} role="group" aria-label={copy.followUp}>{suggestions.map(value => <button type="button" key={value} onClick={() => void ask(value)} disabled={pending} data-testid="syngenta-assistant-suggestion">{value}</button>)}</div> : null}
    <form onSubmit={submit} className={styles.form}>
      <label htmlFor={inputId}>{copy.label}</label>
      <textarea id={inputId} ref={inputRef} value={question} onChange={event => setQuestion(event.target.value)} rows={2} maxLength={MANAGED_SOMMELIER_QUESTION_MAX_CHARS} placeholder={copy.placeholder} disabled={pending} data-testid="syngenta-assistant-input" />
      <button type="submit" className={styles.submit} disabled={pending || !question.trim()} aria-busy={pending} data-testid="syngenta-assistant-send"><Send size={18} aria-hidden="true" />{pending ? copy.pending : copy.send}</button>
    </form>
    <footer className={styles.footer}><p>{copy.note}</p>{messages.length || pending ? <button type="button" onClick={reset} className={styles.reset}>{copy.clear}</button> : null}</footer>
  </section>;
}
