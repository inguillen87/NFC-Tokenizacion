"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Bot, CalendarDays, CircleAlert, Coffee, GlassWater, Send, Thermometer } from "lucide-react";
import { classifySommelierResponse, normalizeSommelierProductContext, safeSommelierGuidance, sommelierProvenanceLabel, type SommelierProvenance } from "../../../lib/sommelier-guidance";
import { sommelierWelcome } from "../../../lib/sommelier-conversation";
import { consumerSommelierFailureKind, requestManagedSommelierAnswer, sommelierHistory, MANAGED_SOMMELIER_QUESTION_MAX_CHARS, type SommelierSource } from "../../../lib/managed-sommelier";
import { consumerSommelierEventId } from "./consumer-sommelier-scope";
import styles from "./sommelier.module.css";

type ChatMessage = { id: string; sender: "sommelier" | "user"; text: string; provenance?: SommelierProvenance; delivery?: "pending" | "received" | "unconfirmed"; sources?: SommelierSource[]; suggestedQuestions?: string[] };
const VISIBLE_MESSAGE_LIMIT = 24;
const starters = [
  { label: "Elegir un maridaje", question: "¿Qué debería tener en cuenta para elegir un maridaje?", Icon: Coffee },
  { label: "Servir el vino", question: "¿Cómo elijo la temperatura para servir un vino?", Icon: Thermometer },
  { label: "Entender la cata", question: "¿Cómo interpreto las notas de cata de una ficha técnica?", Icon: GlassWater },
  { label: "Conservarlo", question: "¿Qué debería revisar antes de guardar un vino?", Icon: CalendarDays },
] as const;

function responseTitle(provenance?: SommelierProvenance) {
  if (provenance?.mode === "live") return "Respuesta con IA";
  if (provenance?.mode === "local-fallback") return "Guía local";
  if (provenance?.mode === "server-fallback") return "Guía general del servicio";
  return "Para empezar";
}

export default function SommelierClient({ productName, brandName, eventId }: { productName: string; brandName: string; eventId?: string }) {
  const context = useMemo(() => normalizeSommelierProductContext({ productName, brandName }), [productName, brandName]);
  const welcome = useMemo((): ChatMessage => ({ id: "welcome", sender: "sommelier", text: eventId ? `Conversemos sobre ${context.productName || "tu producto"}. La marca habilita esta consulta; el servicio usa su información publicada cuando está disponible.` : sommelierWelcome({}), provenance: { mode: "context" } }), [context, eventId]);
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [recovery, setRecovery] = useState<"session" | "access" | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const followConversation = useRef(true);
  const sequence = useRef(0);
  const inputId = useId();
  const hintId = useId();

  useEffect(() => {
    requestRef.current?.abort(); requestRef.current = null;
    setMessages([welcome]); setInput(""); setPending(false); setFeedback(""); setRecovery(null);
    return () => { requestRef.current?.abort(); requestRef.current = null; };
  }, [welcome]);

  useEffect(() => {
    if (followConversation.current && conversationRef.current) conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
  }, [messages]);

  async function handleSendMessage(textToSend: string) {
    if (!textToSend.trim() || requestRef.current || recovery) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const questionId = `question-${++sequence.current}`;
    followConversation.current = true;
    setPending(true); setFeedback("");
    setMessages(previous => [...previous, { id: questionId, sender: "user" as const, text: textToSend.trim(), delivery: "pending" as const }].slice(-VISIBLE_MESSAGE_LIMIT));
    // Only confirmed turns enter the next question; failed retries do not
    // duplicate themselves, and local guidance is never a product fact.
    const history = sommelierHistory(messages.filter(message => message.sender === "user" ? message.delivery === "received" : message.provenance?.mode === "live"));
    const result = await requestManagedSommelierAnswer(textToSend.trim(), { locale: "es-AR", history, signal: controller.signal, ...(eventId ? { eventId } : {}) });
    // Navigation/context changes cancel the request and must never restore old replies.
    if (controller.signal.aborted || requestRef.current !== controller) return;
    if (result.status === "received") {
      const data = result.data;
      const provenance = classifySommelierResponse(data);
      setMessages(previous => [...previous.map(msg => msg.id === questionId ? { ...msg, delivery: data.fallback ? "unconfirmed" as const : "received" as const } : msg), { id: `answer-${++sequence.current}`, sender: "sommelier" as const, text: data.optimizedText, provenance, sources: data.sources, suggestedQuestions: data.suggestedQuestions }].slice(-VISIBLE_MESSAGE_LIMIT));
      if (!data.fallback) setInput("");
      setFeedback(data.fallback ? "La IA no está disponible ahora. Recibimos una guía general del servicio y conservamos tu consulta para que puedas reintentar." : "Respuesta recibida. Podés hacer otra consulta.");
    } else {
      const kind = consumerSommelierFailureKind(result);
      if (kind === "session" || kind === "access") {
        setMessages(previous => previous.map(msg => msg.id === questionId ? { ...msg, delivery: "unconfirmed" as const } : msg));
        setRecovery(kind);
        setFeedback(kind === "session"
          ? "Necesitás entrar a tu cuenta para continuar. Conservamos tu consulta en esta pantalla. El ingreso se abre en otra pestaña; después volvé y revisá tu pregunta antes de enviarla."
          : "No pudimos confirmar tu acceso al asistente de este producto. Conservamos tu consulta en esta pantalla. Abrí la lectura en otra pestaña para revisar las opciones de la marca; después volvé y revisá tu pregunta.");
      } else {
        const replyText = safeSommelierGuidance(textToSend, context);
        setMessages(previous => [...previous.map(msg => msg.id === questionId ? { ...msg, delivery: "unconfirmed" as const } : msg), { id: `answer-${++sequence.current}`, sender: "sommelier" as const, text: replyText, provenance: { mode: "local-fallback" as const } }].slice(-VISIBLE_MESSAGE_LIMIT));
        setFeedback(kind === "service"
          ? "El asistente no está disponible por el momento. Conservamos tu consulta; podés volver a enviarla más tarde. La guía local no es una respuesta de IA."
          : "No pudimos recibir una respuesta del servicio. Conservamos tu consulta para que puedas volver a enviarla. La guía local no confirma una respuesta de IA.");
      }
    }
    requestRef.current = null;
    setPending(false);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleSendMessage(input);
  }

  const privateEventId = consumerSommelierEventId(eventId);
  // Only the server-provided canonical reading can survive a normal login.
  // Questions and brand/product labels stay in this component's memory.
  const loginNext = privateEventId ? `/me/sommelier?eventId=${encodeURIComponent(privateEventId)}` : "/me/sommelier";

  return <div className={styles.assistant} data-testid="sommelier-conversation">
    <Link href="/me/products" className={styles.back}><ArrowLeft size={18} aria-hidden="true" />Volver a mis productos</Link>
    <div className={styles.layout}>
      <section className={styles.chat} aria-labelledby="sommelier-chat-title">
        <header className={styles.chatHeading}><span className={styles.avatar}><Bot size={24} aria-hidden="true" /></span><div><h2 id="sommelier-chat-title">Conversemos sobre vinos</h2><p>Orientación general, con el origen de cada respuesta visible.</p></div></header>
        <div ref={conversationRef} className={styles.conversation} role="log" aria-label="Conversación con el asistente de vinos" aria-live="polite" aria-relevant="additions" tabIndex={0} onScroll={event => { const log = event.currentTarget; followConversation.current = log.scrollHeight - log.scrollTop - log.clientHeight < 64; }}>
          {messages.map(msg => <article key={msg.id} className={`${styles.message} ${msg.sender === "user" ? styles.userMessage : styles.assistantMessage}`}>
            <span className={styles.messageLabel}>{msg.sender === "user" ? "Tu consulta" : responseTitle(msg.provenance)}</span>
            <p>{msg.text}</p>
            {msg.sender === "sommelier" && msg.provenance?.mode !== "context" ? <details className={styles.provenance}><summary>Origen y alcance de esta respuesta</summary><p>{sommelierProvenanceLabel(msg.provenance)}</p>{msg.sources?.length ? <ul className={styles.sources}>{msg.sources.map(source => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{source.label} ↗</a> : source.label}</li>)}</ul> : null}</details> : null}
            {msg.suggestedQuestions?.length ? <div className={styles.followUps} aria-label="Continuar la conversación">{msg.suggestedQuestions.map(question => <button key={question} type="button" disabled={pending} onClick={() => { setInput(question); inputRef.current?.focus(); }}>{question}</button>)}</div> : null}
            {msg.delivery === "unconfirmed" ? <span className={styles.delivery}>Respuesta de IA no confirmada</span> : null}
          </article>)}
        </div>
        <form className={styles.composer} onSubmit={onSubmit} aria-busy={pending}>
          <label htmlFor={inputId}>Tu pregunta sobre vinos</label>
          <textarea ref={inputRef} id={inputId} value={input} onChange={event => setInput(event.target.value)} maxLength={MANAGED_SOMMELIER_QUESTION_MAX_CHARS} readOnly={pending} aria-describedby={hintId} rows={3} placeholder="Por ejemplo: ¿cómo elijo un vino para una cena?" />
          <div className={styles.composerFooter}><p id={hintId}>Elegí una sugerencia o escribí tu pregunta. Vos decidís cuándo enviarla.</p><button type="submit" disabled={pending || Boolean(recovery) || !input.trim()}><Send size={18} aria-hidden="true" />{pending ? "Consultando…" : "Enviar consulta"}</button></div>
          <p className={styles.feedback} role="status" aria-live="polite" aria-atomic="true">{pending ? "Consultando el servicio. Tu pregunta sigue visible." : feedback}</p>
          {recovery === "session" ? <>
            <Link className={styles.back} href={`/login?consumer=1&next=${encodeURIComponent(loginNext)}`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" prefetch={false}>Entrar a mi cuenta ↗</Link>
            <button type="button" onClick={() => { setRecovery(null); setFeedback("Revisá tu pregunta y elegí Enviar consulta. El servicio comprobará tu sesión y el acceso al producto de nuevo."); inputRef.current?.focus(); }}>Ya ingresé, revisar mi pregunta</button>
          </> : recovery === "access" ? <>
            <Link className={styles.back} href={privateEventId ? `/me/taps/${encodeURIComponent(privateEventId)}` : "/me/products"} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" prefetch={false}>{privateEventId ? "Revisar mi lectura ↗" : "Revisar mis productos ↗"}</Link>
            <button type="button" onClick={() => { setRecovery(null); setFeedback("Revisá tu pregunta y elegí Enviar consulta. El servicio comprobará tu sesión y el acceso al producto de nuevo."); inputRef.current?.focus(); }}>Ya revisé, volver a consultar</button>
          </> : null}
        </form>
      </section>
      <aside className={styles.sidebar} aria-label="Ideas y contexto de la consulta">
        <section className={styles.panel} aria-labelledby="sommelier-starters-title"><span className={styles.eyebrow}>Ideas para conversar</span><h2 id="sommelier-starters-title">Empezá por lo que necesitás</h2><p>Estas sugerencias preparan una pregunta. Después podés editarla y enviarla.</p><div className={styles.starters}>{starters.map(({ label, question, Icon }) => <button type="button" key={label} disabled={pending} onClick={() => { setInput(question); inputRef.current?.focus(); }}><Icon size={20} aria-hidden="true" /><span>{label}</span></button>)}</div></section>
        <section className={styles.panel} aria-labelledby="sommelier-context-title"><span className={styles.eyebrow}>{eventId ? "Producto de tu cuenta" : "Orientación general"}</span><h2 id="sommelier-context-title">Contexto de tu consulta</h2><dl className={styles.context}><dt>Producto</dt><dd>{eventId ? context.productName || "Producto guardado" : "Sin producto seleccionado"}</dd><dt>Marca</dt><dd>{eventId ? context.brandName || "No informada" : "Sin marca seleccionada"}</dd></dl>{eventId ? <Link className={styles.back} href={`/me/taps/${encodeURIComponent(eventId)}`} prefetch={false}>Consultar mi lectura</Link> : null}<p className={styles.contextNote}><CircleAlert size={18} aria-hidden="true" /><span>El asistente usa la información que la marca publicó. Una respuesta no verifica el contenido, el sello ni la autenticidad física del producto.</span></p></section>
      </aside>
    </div>
  </div>;
}
