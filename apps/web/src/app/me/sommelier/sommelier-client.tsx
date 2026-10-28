"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Bot, CalendarDays, CircleAlert, Coffee, GlassWater, Send, Thermometer } from "lucide-react";
import { classifySommelierResponse, normalizeSommelierProductContext, safeSommelierGuidance, sommelierProvenanceLabel, type SommelierProvenance } from "../../../lib/sommelier-guidance";
import { sommelierWelcome } from "../../../lib/sommelier-conversation";
import { MANAGED_SOMMELIER_QUESTION_MAX_CHARS, type SommelierSource } from "../../../lib/managed-sommelier";
import { useSommelierRecovery } from "../../../lib/use-sommelier-recovery";
import { portalSommelierFailure, requestPortalSommelierAnswer } from "./portal-managed-sommelier";
import styles from "./sommelier.module.css";

type ChatMessage = { id: string; sender: "sommelier" | "user"; text: string; provenance?: SommelierProvenance; delivery?: "pending" | "received" | "unconfirmed"; sources?: SommelierSource[]; suggestedQuestions?: string[] };
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

export default function SommelierClient({ productName, brandName }: { productName: string; brandName: string }) {
  const context = useMemo(() => normalizeSommelierProductContext({ productName, brandName }), [productName, brandName]);
  const welcome = useMemo((): ChatMessage => ({ id: "welcome", sender: "sommelier", text: sommelierWelcome(context), provenance: { mode: "context" } }), [context]);
  const recovery = useSommelierRecovery("es-AR", "consumer:general");
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failureKind, setFailureKind] = useState<"" | "session" | "access" | "limit" | "service">("");
  const requestRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const followConversation = useRef(true);
  const sequence = useRef(0);
  const inputId = useId();
  const hintId = useId();
  const statusId = useId();

  useEffect(() => {
    setMessages([welcome]); setPending(false); setFeedback(""); setFailureKind("");
    return () => { requestRef.current?.abort(); requestRef.current = null; };
  }, [welcome]);

  useEffect(() => {
    if (followConversation.current && conversationRef.current) conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
  }, [messages]);

  async function handleSendMessage(textToSend: string) {
    if (!textToSend.trim() || requestRef.current || recovery.isWaiting()) return;
    if (textToSend.trim().length > MANAGED_SOMMELIER_QUESTION_MAX_CHARS) { setFeedback("La pregunta debe tener hasta 1500 caracteres. Podés editarla antes de enviarla."); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    const questionId = `question-${++sequence.current}`;
    followConversation.current = true;
    setPending(true); setFeedback(""); setFailureKind("");
    setMessages(previous => [...previous, { id: questionId, sender: "user", text: textToSend.trim(), delivery: "pending" }]);
    const result = await requestPortalSommelierAnswer(textToSend.trim(), messages, { signal: controller.signal });
    // Navigation/context changes cancel the request and must never restore old replies.
    if (controller.signal.aborted || requestRef.current !== controller) return;
    recovery.remember(result);
    if (result.status === "received") {
      const data = result.data;
      const provenance = classifySommelierResponse(data);
      setMessages(previous => [...previous.map(msg => msg.id === questionId ? { ...msg, delivery: "received" as const } : msg), { id: `answer-${++sequence.current}`, sender: "sommelier", text: data.optimizedText, provenance, sources: data.sources, suggestedQuestions: data.suggestedQuestions }]);
      if (data.fallback) {
        setInput(previous => previous || textToSend.trim());
        setFeedback("Recibimos una guía general del servicio. Tu pregunta sigue visible; no confirma una respuesta de IA.");
      } else {
        setInput(previous => previous.trim() === textToSend.trim() ? "" : previous);
        setFeedback("Respuesta recibida. Podés hacer otra consulta.");
      }
    } else {
      const failure = portalSommelierFailure(result);
      setFailureKind(failure.kind);
      const replyText = safeSommelierGuidance(textToSend, context);
      setMessages(previous => [...previous.map(msg => msg.id === questionId ? { ...msg, delivery: "unconfirmed" as const } : msg), ...(failure.allowLocalGuide ? [{ id: `answer-${++sequence.current}`, sender: "sommelier" as const, text: replyText, provenance: { mode: "local-fallback" as const } }] : [])]);
      setFeedback(failure.feedback);
    }
    requestRef.current = null;
    setPending(false);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleSendMessage(input);
  }

  return <div className={styles.assistant} data-testid="sommelier-conversation">
    <Link href="/me/products" className={styles.back}><ArrowLeft size={18} aria-hidden="true" />Volver a mis productos</Link>
    <div className={styles.layout}>
      <section className={styles.chat} aria-labelledby="sommelier-chat-title">
        <header className={styles.chatHeading}><span className={styles.avatar}><Bot size={24} aria-hidden="true" /></span><div><h2 id="sommelier-chat-title">Conversemos sobre vinos</h2><p>Orientación general, con el origen de cada respuesta visible.</p></div></header>
        <div ref={conversationRef} className={styles.conversation} role="log" aria-label="Conversación con el asistente de vinos" aria-live="polite" aria-relevant="additions" tabIndex={0} onScroll={event => { const log = event.currentTarget; followConversation.current = log.scrollHeight - log.scrollTop - log.clientHeight < 64; }}>
          {messages.map(msg => <article key={msg.id} className={`${styles.message} ${msg.sender === "user" ? styles.userMessage : styles.assistantMessage}`}>
            <span className={styles.messageLabel}>{msg.sender === "user" ? "Tu consulta" : responseTitle(msg.provenance)}</span>
            <p>{msg.text}</p>
            {msg.sender === "sommelier" && msg.provenance?.mode !== "context" ? <details className={styles.provenance}><summary>Origen y alcance de esta respuesta</summary><p>{sommelierProvenanceLabel(msg.provenance)}</p></details> : null}
            {msg.sources?.length ? <details className={styles.provenance}><summary>Fuentes de esta respuesta</summary><ul>{msg.sources.map(source => <li key={source.id}>{source.url ? <a className={styles.back} href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : source.label}</li>)}</ul></details> : null}
            {msg.suggestedQuestions?.length ? <div className={styles.starters} role="group" aria-label="Preguntas sugeridas para continuar">{msg.suggestedQuestions.map((question, index) => <button type="button" key={index} disabled={pending} onClick={() => { setInput(question); inputRef.current?.focus(); }}>{question}</button>)}</div> : null}
            {msg.delivery === "unconfirmed" ? <span className={styles.delivery}>Respuesta del servicio no recibida</span> : null}
          </article>)}
        </div>
        <form className={styles.composer} onSubmit={onSubmit} aria-busy={pending}>
          <label htmlFor={inputId}>Tu pregunta sobre vinos</label>
          <textarea ref={inputRef} id={inputId} value={input} onChange={event => setInput(event.target.value)} maxLength={MANAGED_SOMMELIER_QUESTION_MAX_CHARS} readOnly={pending} aria-describedby={`${hintId} ${statusId}`} rows={3} placeholder="Por ejemplo: ¿cómo elijo un vino para una cena?" />
          <div className={styles.composerFooter}><p id={hintId}>Elegí una sugerencia o escribí tu pregunta. Vos decidís cuándo enviarla.</p><button type="submit" disabled={pending || recovery.waiting || !input.trim()}><Send size={18} aria-hidden="true" />{pending ? "Consultando…" : "Enviar consulta"}</button></div>
          <p id={statusId} className={styles.feedback} role="status" aria-live="polite" aria-atomic="true">{pending ? "Consultando el servicio. Tu pregunta sigue visible." : recovery.notice || feedback}</p>
          {failureKind === "session" ? <Link className={styles.back} href="/login?consumer=1&next=%2Fme%2Fsommelier" prefetch={false}>Volver a ingresar</Link> : failureKind === "access" ? <Link className={styles.back} href="/me/products" prefetch={false}>Revisar mis productos</Link> : null}
        </form>
      </section>
      <aside className={styles.sidebar} aria-label="Ideas y contexto de la consulta">
        <section className={styles.panel} aria-labelledby="sommelier-starters-title"><span className={styles.eyebrow}>Ideas para conversar</span><h2 id="sommelier-starters-title">Empezá por lo que necesitás</h2><p>Estas sugerencias preparan una pregunta. Después podés editarla y enviarla.</p><div className={styles.starters}>{starters.map(({ label, question, Icon }) => <button type="button" key={label} disabled={pending} onClick={() => { setInput(question); inputRef.current?.focus(); }}><Icon size={20} aria-hidden="true" /><span>{label}</span></button>)}</div></section>
        <section className={styles.panel} aria-labelledby="sommelier-context-title"><span className={styles.eyebrow}>Identidad declarada</span><h2 id="sommelier-context-title">Contexto de tu consulta</h2><dl className={styles.context}><dt>Producto indicado</dt><dd>{context.productName || "Sin producto seleccionado"}</dd><dt>Marca indicada</dt><dd>{context.brandName || "No indicada"}</dd><dt>Estado SUN/tamper:</dt><dd>No disponible en esta pantalla</dd></dl><p className={styles.contextNote}><CircleAlert size={18} aria-hidden="true" /><span>Estos datos no verifican la botella, su contenido ni el estado físico del sello. No se envían como ficha al servicio: esta pantalla ofrece orientación general desde tu cuenta. Consultá el pasaporte de tu producto para la información publicada por la marca.</span></p></section>
      </aside>
    </div>
  </div>;
}
