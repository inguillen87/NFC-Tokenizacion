"use client";

import { useId, useMemo, useState, useEffect, useRef } from "react";
import { Sparkles, HelpCircle, Star, Send, Gift, CheckCircle2, Bot, ArrowRight, Brain, Trophy } from "lucide-react";
import Link from "next/link";
import { parseTenantActionConfiguration, resolveTenantActionAvailability, TENANT_ACTION_COPY } from "./tenant-action-availability";
import {
  classifySommelierResponse,
  sommelierProvenanceLabel,
  type SommelierProvenance,
} from "../../lib/sommelier-guidance";
import { useSunLocale } from "./sun-locale-provider";
import styles from "./qr-engagement-suite.module.css";
import { configuredTriviaQuiz, confirmedPreviousTrivia, confirmedTriviaResult, triviaContextAvailable, triviaRecoveryCopy, triviaRecoveryDescription, triviaSubmissionBody, type ClientTriviaQuestion, type TriviaResult } from "./sun-trivia-model";

const FEEDBACK_COPY = {
  "es-AR": { explanation: "Tu opinión se envía a la marca junto con esta lectura.", rating: (star: number) => `Calificar con ${star} estrella${star > 1 ? "s" : ""}`, comment: "Comentario corto", commentHint: "Comentario opcional para la marca", send: "Enviar opinión", saving: "Guardando..." },
  en: { explanation: "Your opinion is sent to the brand with this reading.", rating: (star: number) => `Rate ${star} star${star > 1 ? "s" : ""}`, comment: "Short comment", commentHint: "Optional comment for the brand", send: "Send opinion", saving: "Saving..." },
  "pt-BR": { explanation: "Sua opinião é enviada à marca junto com esta leitura.", rating: (star: number) => `Avaliar com ${star} estrela${star > 1 ? "s" : ""}`, comment: "Comentário curto", commentHint: "Comentário opcional para a marca", send: "Enviar opinião", saving: "Salvando..." },
} as const;

type EngagementTab = "sommelier" | "trivia" | "feedback" | "contact";

interface ChatMessage {
  id: string;
  sender: "sommelier" | "user";
  text: string;
  provenance?: SommelierProvenance;
}

type QREngagementSuiteProps = {
  wineryName: string;
  productName: string;
  tenantSlug?: string | null;
  eventId?: string | null;
  freshToken?: string;
  isDemoPreview?: boolean;
  bid?: string | null;
  allowedActions?: string[];
  blockedActions?: string[];
  initialTab?: EngagementTab;
  configuration?: unknown;
  canEngage?: boolean;
};

function localTrivia(productName: string, wineryName: string): ClientTriviaQuestion[] {
  return [
    {
      id: "local-origin",
      prompt: `¿Qué evidencia digital frena mejor el replay de ${productName}?`,
      options: ["Un mensaje SUN fresco validado contra el batch", "Una captura reenviada", "Un comentario anónimo", "Un precio escrito a mano"],
      correctIndex: 0,
      explanation: "Un SUN fresco permite validar el mensaje dinámico asociado al tag y al batch. Por sí solo no certifica contenido físico, origen, compra ni propiedad.",
      insightTag: "origin-literacy",
    },
    {
      id: "local-experience",
      prompt: `¿Qué beneficio tiene más sentido activar para clientes interesados en ${wineryName}?`,
      options: ["Cata, visita o voucher del club", "Un formulario largo", "Un mensaje sin contexto", "Un bloqueo sin explicación"],
      correctIndex: 0,
      explanation: "El mejor momento para fidelizar es justo después del interés real: el cliente tocó el producto.",
      insightTag: "experience-fit",
    },
    {
      id: "local-market",
      prompt: "¿Qué dato ayuda más a crear campañas útiles sin invadir al cliente?",
      options: ["Ciudad y producto consultado", "Contraseña del usuario", "Variables internas de la base", "Historial privado completo"],
      correctIndex: 0,
      explanation: "Ciudad y producto permiten campañas por cercanía, preferencias y contexto sin exponer información sensible.",
      insightTag: "market-research",
    },
  ];
}

function asResultFromLocal(questions: ClientTriviaQuestion[], answers: Record<string, number>): TriviaResult {
  const score = questions.reduce((sum, question) => sum + (answers[question.id] === question.correctIndex ? 1 : 0), 0);
  return {
    score,
    total: questions.length,
    pointsAwarded: 0,
    requiresLogin: false,
    isLocal: true,
    explanations: questions.map((question) => ({
      ...question,
      answerIndex: answers[question.id],
      correct: answers[question.id] === question.correctIndex,
      correctIndex: question.correctIndex,
    })),
  };
}

export function QREngagementSuite({
  wineryName,
  productName,
  tenantSlug = null,
  eventId = null,
  freshToken = "",
  isDemoPreview = false,
  bid = null,
  allowedActions = [],
  blockedActions = [],
  initialTab = "sommelier",
  configuration,
  canEngage = true,
}: QREngagementSuiteProps) {
  const { locale } = useSunLocale();
  const feedbackCopy = FEEDBACK_COPY[locale];
  const triviaCopy = triviaRecoveryCopy[locale];
  const commentId = useId();
  const [activeTab, setActiveTab] = useState<EngagementTab | null>(initialTab);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [configurationOverride, setConfigurationOverride] = useState<{ base: unknown; value: unknown } | null>(null);
  const effectiveConfiguration = configurationOverride && configurationOverride.base === configuration ? configurationOverride.value : configuration;
  const availability = resolveTenantActionAvailability({ configuration: effectiveConfiguration,
    verifiedTenant: Boolean(tenantSlug && /^[a-z0-9][a-z0-9._-]{0,119}$/.test(tenantSlug)), canEngage,
    isDemoPreview, allowedActions, blockedActions });
  const currentAvailability = useRef(availability);
  currentAvailability.current = availability;

  const fallbackTrivia = useMemo(() => isDemoPreview ? localTrivia(productName, wineryName) : [], [isDemoPreview, productName, wineryName]);
  const [triviaQuestions, setTriviaQuestions] = useState<ClientTriviaQuestion[]>(fallbackTrivia);
  const triviaScope = JSON.stringify([eventId, tenantSlug]);
  const [configuredTriviaScope, setConfiguredTriviaScope] = useState<string | null>(null);
  const [loadedQuiz, setLoadedQuiz] = useState<{ id: string; revision: string } | null>(null);
  const [previousTriviaDraft, setPreviousTriviaDraft] = useState<{ prompt: string; answer: string }[]>([]);
  const currentScope = useRef(triviaScope);
  currentScope.current = triviaScope;
  const [triviaStep, setTriviaStep] = useState(0);
  const [triviaAnswers, setTriviaAnswers] = useState<Record<string, number>>({});
  const [triviaDone, setTriviaDone] = useState(false);
  const [triviaLoading, setTriviaLoading] = useState(false);
  const [triviaSubmitting, setTriviaSubmitting] = useState(false);
  const [triviaSubmissionLocked, setTriviaSubmissionLocked] = useState(false);
  const triviaSendLock = useRef(false);
  const [triviaError, setTriviaError] = useState<string | null>(null);
  const [triviaResult, setTriviaResult] = useState<TriviaResult | null>(null);
  const canSubmitTrivia = triviaContextAvailable(eventId, tenantSlug, freshToken);
  const quizChanged = Boolean(loadedQuiz && (!availability.trivia || loadedQuiz.id !== availability.quiz?.id || loadedQuiz.revision !== availability.quiz?.revision));
  const hasDraft = configuredTriviaScope === triviaScope && Object.keys(triviaAnswers).length > 0;
  const canPlayTrivia = isDemoPreview || availability.trivia && !quizChanged && canSubmitTrivia && !triviaSubmissionLocked && configuredTriviaScope === triviaScope && triviaQuestions.length > 0 && !triviaError;
  const showTriviaResult = triviaDone && (isDemoPreview || configuredTriviaScope === triviaScope);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const [contact, setContact] = useState("");
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState("regalo");
  const [gender, setGender] = useState("prefiero_no_decir");
  const [optInSubmitted, setOptInSubmitted] = useState(false);
  const [brandContactConsent, setBrandContactConsent] = useState(false);
  const [submittingLead, setSubmittingLead] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [shareApproximateLocation, setShareApproximateLocation] = useState(false);
  useEffect(() => {
    setFeedbackSubmitted(false); setOptInSubmitted(false); setBrandContactConsent(false);
    setShareApproximateLocation(false); setLeadError(null); setChatError(null);
    setIsTyping(false); setSubmittingLead(false);
  }, [triviaScope]);

  const currentQuestion = triviaQuestions[triviaStep] || triviaQuestions[0];
  const selectedAnswer = currentQuestion ? triviaAnswers[currentQuestion.id] ?? null : null;
  const engagementTabs = useMemo(() => [
    ...(availability.sommelier ? [{ id: "sommelier" as const, label: "Sommelier", Icon: Bot, title: "Consultar maridajes, cata, temperatura y recomendaciones" }] : []),
    ...(availability.trivia || hasDraft || previousTriviaDraft.length || showTriviaResult ? [{ id: "trivia" as const, label: availability.trivia ? "Trivia" : triviaCopy.savedAnswers, Icon: HelpCircle, title: triviaCopy.savedAnswers }] : []),
    ...(availability.feedback ? [{ id: "feedback" as const, label: "Calificar", Icon: Star, title: "Enviar opinión breve del producto o experiencia" }] : []),
    ...(availability.lead ? [{ id: "contact" as const, label: "Novedades", Icon: Gift, title: "Autorizar contacto para novedades reales publicadas por la marca" }] : []),
  ], [availability.sommelier, availability.trivia, availability.feedback, availability.lead, hasDraft, previousTriviaDraft.length, showTriviaResult, triviaCopy.savedAnswers]);
  const visibleTab = engagementTabs.some(tab => tab.id === activeTab) ? activeTab : engagementTabs[0]?.id ?? null;

  useEffect(() => {
    if (!engagementTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(engagementTabs[0]?.id ?? null);
    }
  }, [activeTab, engagementTabs]);

  const getDeviceMeta = () => ({
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    mobile: /mobile|iphone|android|ipad/i.test(navigator.userAgent),
  });

  const getGps = () => new Promise<Record<string, unknown>>((resolve) => {
    if (!shareApproximateLocation || !navigator.geolocation) {
      return resolve({ consent: false, precision: "none" });
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: Math.round(position.coords.latitude * 1_000) / 1_000,
        lng: Math.round(position.coords.longitude * 1_000) / 1_000,
        accuracy: Math.max(150, Math.round(position.coords.accuracy)),
        source: "browser_gps_approximate_consent",
        consent: true,
        precision: "approximate",
      }),
      () => resolve({ consent: false, precision: "none" }),
      { enableHighAccuracy: false, timeout: 1800, maximumAge: 10 * 60 * 1000 },
    );
  });

  const submitLead = async (payload: {
    source: string;
    contact: string;
    name?: string;
    message?: string;
    roleInterest?: string;
    rating?: number;
    extra?: Record<string, unknown>;
  }) => {
    const actionAllowed = payload.source === "qr_feedback" ? availability.feedback : payload.source === "qr_brand_opt_in" && availability.lead && brandContactConsent;
    if (!actionAllowed || !eventId || !tenantSlug || !/^[a-z0-9][a-z0-9._-]{0,119}$/.test(tenantSlug)) {
      setLeadError(TENANT_ACTION_COPY[locale].empty);
      return false;
    }
    // An explicit demo never writes customer or company records.
    if (isDemoPreview) { setLeadError(TENANT_ACTION_COPY[locale].empty); return false; }
    setSubmittingLead(true);
    setLeadError(null);
    try {
      const gps = await getGps();
      if (currentScope.current !== triviaScope || !(payload.source === "qr_feedback" ? currentAvailability.current.feedback : currentAvailability.current.lead)) return false;
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          contact: payload.contact,
          name: payload.name || "",
          company: wineryName,
          vertical: "wine",
          role_interest: payload.roleInterest || "qr_engagement",
          source: payload.source,
          message: payload.message || "",
          tenantSlug,
          eventId,
          bid,
          productName,
          gender,
          occasion,
          gps,
          device: getDeviceMeta(),
          engagement: {
            type: payload.source,
            rating: payload.rating || null,
            ...payload.extra,
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok !== true) {
        throw new Error(String(result?.error || result?.reason || "lead_save_failed"));
      }
      return currentScope.current === triviaScope;
    } catch {
      if (currentScope.current === triviaScope) setLeadError(triviaCopy.uncertain);
      return false;
    } finally {
      if (currentScope.current === triviaScope) setSubmittingLead(false);
    }
  };

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        sender: "sommelier",
        text: `Hola. Puedo darte orientación general sobre "${productName}" de ${wineryName}. Estos datos identifican la pantalla actual, pero no reemplazan una ficha técnica validada por la marca.`,
        provenance: { mode: "context" },
      },
    ]);
  }, [productName, wineryName]);

  useEffect(() => {
    setTriviaQuestions(fallbackTrivia);
    setConfiguredTriviaScope(null);
    setLoadedQuiz(null);
    setPreviousTriviaDraft([]);
    setTriviaStep(0);
    setTriviaAnswers({});
    setTriviaDone(false);
    setTriviaResult(null);
    setTriviaError(null);
    setTriviaSubmissionLocked(false);
    triviaSendLock.current = false;
    setTriviaSubmitting(false);
    setTriviaLoading(false);
  }, [fallbackTrivia, triviaScope]);

  useEffect(() => {
    if (visibleTab !== "trivia" || isDemoPreview || !availability.trivia || triviaSubmissionLocked || !canSubmitTrivia || !eventId || loadedQuiz) return;
    const triviaEventId = eventId;
    let cancelled = false;
    async function loadTrivia() {
      setTriviaLoading(true);
      setTriviaError(null);
      try {
        const triviaParams = new URLSearchParams({
          locale,
          tenant: tenantSlug || "",
        });
        const response = await fetch(`/api/mobile/passport/${encodeURIComponent(triviaEventId)}/loyalty/trivia?${triviaParams.toString()}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        const quiz = configuredTriviaQuiz(payload);
        if (!response.ok || !quiz) {
          throw new Error(payload?.error || "trivia_unavailable");
        }
        if (quiz.id !== availability.quiz?.id || quiz.revision !== availability.quiz?.revision) throw new Error("quiz_configuration_changed");
        if (cancelled) return;
        setTriviaQuestions(quiz.questions);
        setLoadedQuiz({ id: quiz.id, revision: quiz.revision });
        setConfiguredTriviaScope(triviaScope);
        if (payload.previousAttempt) {
          const previous = confirmedPreviousTrivia(payload.previousAttempt, quiz.questions.length, payload.member?.consumerLinked);
          if (!previous) throw new Error("trivia_result_unconfirmed");
          setTriviaResult(previous);
          setTriviaDone(true);
        }
      } catch (error) {
        if (!cancelled) {
          setTriviaQuestions([]);
          setConfiguredTriviaScope(null);
          setTriviaError(error instanceof Error ? error.message : "trivia_unavailable");
        }
      } finally {
        if (!cancelled) setTriviaLoading(false);
      }
    }
    void loadTrivia();
    return () => {
      cancelled = true;
    };
  }, [visibleTab, eventId, freshToken, isDemoPreview, triviaSubmissionLocked, canSubmitTrivia, locale, tenantSlug, triviaScope, availability.trivia, availability.quiz?.id, availability.quiz?.revision, loadedQuiz]);

  const handleReloadTrivia = async () => {
    if (isDemoPreview || triviaLoading || triviaSubmitting || !canSubmitTrivia || !eventId || !canEngage) return;
    const capturedScope = triviaScope;
    setTriviaLoading(true);
    setTriviaError(null);
    try {
      const configResponse = await fetch(`/api/public/passport/${encodeURIComponent(eventId)}/configuration`, { cache: "no-store" });
      const configPayload = await configResponse.json().catch(() => ({}));
      const updated = configPayload?.ok === true ? parseTenantActionConfiguration(configPayload.configuration) : null;
      if (currentScope.current !== capturedScope) return;
      if (!configResponse.ok || !updated) throw new Error("trivia_unavailable");
      setConfigurationOverride({ base: configuration, value: updated });
      const updatedAvailability = resolveTenantActionAvailability({ configuration: updated, verifiedTenant: true, canEngage, allowedActions, blockedActions });
      if (!updatedAvailability.trivia || !updatedAvailability.quiz) throw new Error("quiz_not_configured");
      const params = new URLSearchParams({ locale, tenant: tenantSlug || "" });
      const response = await fetch(`/api/mobile/passport/${encodeURIComponent(eventId)}/loyalty/trivia?${params}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      const quiz = configuredTriviaQuiz(payload);
      if (!response.ok || !quiz) throw new Error(payload?.error || "trivia_unavailable");
      if (quiz.id !== updatedAvailability.quiz.id || quiz.revision !== updatedAvailability.quiz.revision) throw new Error("quiz_configuration_changed");
      if (currentScope.current !== capturedScope) return;
      const draft = triviaQuestions.filter(question => triviaAnswers[question.id] !== undefined)
        .map(question => ({ prompt: question.prompt, answer: question.options[triviaAnswers[question.id]] }));
      if (draft.length) setPreviousTriviaDraft(draft);
      setTriviaQuestions(quiz.questions);
      setLoadedQuiz({ id: quiz.id, revision: quiz.revision });
      setConfiguredTriviaScope(triviaScope);
      setTriviaAnswers({});
      setTriviaStep(0);
      setTriviaSubmissionLocked(false);
      triviaSendLock.current = false;
      setTriviaResult(null);
      setTriviaDone(false);
    } catch (error) {
      if (currentScope.current === capturedScope) setTriviaError(error instanceof Error ? error.message : "trivia_unavailable");
    } finally {
      if (currentScope.current === capturedScope) setTriviaLoading(false);
    }
  };

  const handleSendChat = async (textToSend: string) => {
    if (!availability.sommelier || isTyping || !textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
    setChatError(null);
    const capturedScope = triviaScope;

    try {
      if (isDemoPreview) {
        setMessages(prev => [...prev, { id: `demo-${Date.now()}`, sender: "sommelier", text: "Esta es una demostración del asistente. No envía tu pregunta a la marca.", provenance: { mode: "context" } }]);
        return;
      }
      const res = await fetch("/api/cognitive-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToSend,
          tone: "sommelier-chat",
          postTapEventId: eventId,
          productContext: { productName, brandName: wineryName },
        }),
      });

      if (!res.ok) throw new Error("sommelier_unavailable");
      const data = await res.json();
      if (!data?.optimizedText) throw new Error("Empty AI response");
      if (currentScope.current !== capturedScope) return;
      const provenance = classifySommelierResponse(data);

      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        sender: "sommelier",
        text: data.optimizedText,
        provenance,
      }]);
    } catch {
      if (currentScope.current !== capturedScope) return;
      setChatError(TENANT_ACTION_COPY[locale].unavailable);
      setChatInput(previous => previous || textToSend);
    } finally {
      if (currentScope.current === capturedScope) setIsTyping(false);
    }
  };

  const onChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!availability.sommelier || !chatInput.trim() || isTyping) return;
    const text = chatInput;
    setChatInput("");
    void handleSendChat(text);
  };

  const handleNextQuestion = async () => {
    if (!canPlayTrivia || triviaSubmitting || triviaSendLock.current || !currentQuestion || selectedAnswer === null) return;
    if (triviaStep < triviaQuestions.length - 1) {
      setTriviaStep((prev) => prev + 1);
      return;
    }

    setTriviaSubmitting(true);
    setTriviaError(null);
    const capturedScope = triviaScope;
    try {
      const answers = triviaQuestions.map((question) => ({
        questionId: question.id,
        answerIndex: triviaAnswers[question.id] ?? -1,
      }));
      const triviaEventId = eventId;
      if (isDemoPreview) {
        setTriviaResult(asResultFromLocal(triviaQuestions, triviaAnswers));
        setTriviaDone(true);
        return;
      }
      const submission = triviaSubmissionBody({ eventId: triviaEventId, tenantSlug, freshToken, locale, answers, expectedQuizId: loadedQuiz?.id, expectedQuizRevision: loadedQuiz?.revision });
      if (!triviaEventId || !submission) throw new Error("fresh_tap_capability_required");
      triviaSendLock.current = true;
      setTriviaSubmissionLocked(true);
      const response = await fetch(`/api/mobile/passport/${encodeURIComponent(triviaEventId)}/loyalty/trivia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });
      const payload = await response.json().catch(() => ({}));
      if (currentScope.current !== capturedScope) return;
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "trivia_submit_failed");
      }
      const confirmed = confirmedTriviaResult(payload, triviaQuestions.length);
      if (!confirmed) throw new Error("trivia_result_unconfirmed");
      setTriviaResult(confirmed);
      setTriviaDone(true);
    } catch (error) {
      if (currentScope.current !== capturedScope) return;
      const reason = error instanceof Error ? error.message : "";
      setTriviaError(["fresh_tap_capability_required", "quiz_configuration_changed", "unauthorized", "consumer_not_enrolled"].includes(reason) ? reason : "trivia_submit_failed");
      setTriviaResult(null);
    } finally {
      if (currentScope.current === capturedScope) setTriviaSubmitting(false);
    }
  };

  const handleRestartTrivia = () => {
    if (!isDemoPreview) return;
    setTriviaStep(0);
    setTriviaAnswers({});
    setTriviaResult(null);
    setTriviaDone(false);
    setTriviaError(null);
  };

  return (
    <div className="sun-engagement-suite mt-4 w-full overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-950/70 shadow-xl backdrop-blur-md" data-sun-dock-avoid>
      {engagementTabs.length === 0 ? <p role="status" data-testid="sun-actions-unavailable" className="p-5 text-sm leading-relaxed text-slate-300">{TENANT_ACTION_COPY[locale][availability.state === "unavailable" ? "unavailable" : availability.state === "unpublished" ? "unpublished" : "empty"]}</p> : <>
      <div className={`${styles.tabs} sun-engagement-tabs border-b border-white/5 bg-black/40 text-[11px] md:text-xs`}
        style={{ gridTemplateColumns: `repeat(${Math.max(1, engagementTabs.length)}, minmax(0, 1fr))` }}>
        {engagementTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            title={tab.title}
            aria-pressed={visibleTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            data-sun-experience-event={tab.id === "trivia" ? "TRAINING_STARTED" : undefined}
            data-sun-experience-placement={tab.id === "trivia" ? "wine_education" : undefined}
            data-sun-experience-interaction={tab.id === "trivia" ? "trivia_opened" : undefined}
            className={`flex-1 border-b-2 py-3.5 font-bold uppercase tracking-wider transition ${
              visibleTab === tab.id
                ? "border-amber-500 bg-amber-500/5 text-amber-300"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <span className="flex items-center justify-center gap-1">
              <tab.Icon aria-hidden="true" className="h-3.5 w-3.5" /> {tab.label}
            </span>
          </button>
        ))}
      </div>

      <div className="p-5">
        {(visibleTab === "feedback" || visibleTab === "contact") ? (
          <label className="mb-4 flex items-start gap-2 rounded-xl border border-white/10 bg-slate-950/70 p-3 text-[11px] leading-relaxed text-slate-300">
            <input
              type="checkbox"
              checked={shareApproximateLocation}
              onChange={(event) => setShareApproximateLocation(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-900 accent-cyan-400"
            />
            <span>
              Incluir una zona aproximada en este mensaje (opcional). Se redondea antes de enviarla y nunca se guarda la coordenada exacta del dispositivo.
            </span>
          </label>
        ) : null}
        {visibleTab === "sommelier" && availability.sommelier && (
          <div className="v3-space-y-4">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span>Asistente de orientación enológica</span>
              <span className="flex items-center gap-1 text-amber-400"><Sparkles className="h-3 w-3" /> Fuente visible por respuesta</span>
            </div>

            <div role="log" aria-label="Conversación con el Sommelier" tabIndex={0} className="h-[200px] v3-space-y-3.5 overflow-y-auto rounded-xl border border-white/5 bg-black/45 p-3 text-xs focus-visible:outline-2 focus-visible:outline-amber-400">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 leading-relaxed ${
                    msg.sender === "user" ? "bg-amber-500 font-semibold text-slate-950" : "border border-white/5 bg-slate-900 text-slate-200"
                  }`}>
                    {msg.sender === "sommelier" ? (
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-cyan-300">
                        {sommelierProvenanceLabel(msg.provenance)}
                      </span>
                    ) : null}
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-slate-900 px-3.5 py-2.5 text-slate-400">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.2s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={onChatSubmit} className="flex gap-2">
              <input
                type="text"
                title="Escribí una pregunta para el sommelier virtual"
                placeholder="Preguntale al sommelier, por ejemplo: ¿con qué comida marida?"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 transition focus:border-amber-500 focus:outline-hidden"
              />
              <button
                type="submit"
                title="Enviar pregunta"
                disabled={!chatInput.trim() || isTyping}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-500 text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            {chatError ? <p role="alert" className="text-xs leading-relaxed text-rose-300">{chatError}</p> : null}
          </div>
        )}

        {visibleTab === "trivia" && (
          <div className="v3-space-y-4">
            {!canPlayTrivia && !showTriviaResult ? <div role="status" data-testid="sun-trivia-unavailable" className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-xs leading-relaxed text-slate-200">
              <strong>{triviaSubmitting ? triviaCopy.submittingTitle : triviaLoading ? triviaCopy.loadingTitle : triviaCopy.unavailableTitle}</strong>
              <p className="mt-2">{triviaSubmitting ? triviaCopy.submittingHelp : triviaLoading ? triviaCopy.loadingHelp : triviaRecoveryDescription(quizChanged ? "quiz_configuration_changed" : triviaError, canSubmitTrivia, locale)}</p>
              {(quizChanged || triviaError === "quiz_configuration_changed") && canSubmitTrivia ? <button type="button" onClick={handleReloadTrivia} disabled={triviaLoading || triviaSubmitting} className="mt-3 block min-h-11 rounded-lg border border-amber-400/40 px-3 text-amber-200">{triviaCopy.reload}</button> : null}
              <Link href="/me/rewards" className="mt-3 inline-flex min-h-11 items-center underline">{triviaCopy.benefits}</Link>
            </div> : !showTriviaResult ? (
              <div className="v3-space-y-4">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <span className="flex items-center gap-1 text-cyan-200"><Brain className="h-3.5 w-3.5" /> Market quiz</span>
                  <span>{triviaLoading ? "Cargando" : `Pregunta ${triviaStep + 1} de ${triviaQuestions.length}`}</span>
                </div>

                {isDemoPreview ? <p className="text-xs text-slate-300">Trivia ilustrativa de demostración. No guarda respuestas ni otorga puntos o premios.</p> : null}

                <h4 className="text-sm font-bold leading-normal text-white">
                  {currentQuestion?.prompt || "Cargando pregunta del producto..."}
                </h4>

                <div className="grid gap-2">
                  {(currentQuestion?.options || []).map((option, idx) => (
                    <button
                      key={`${currentQuestion.id}-${idx}`}
                      type="button"
                      title={`Elegir respuesta ${idx + 1}`}
                      aria-pressed={selectedAnswer === idx}
                      onClick={() => { if (canPlayTrivia && !triviaSubmitting && !triviaLoading) setTriviaAnswers((prev) => ({ ...prev, [currentQuestion.id]: idx })); }}
                      className={`${styles.triviaButton} w-full rounded-xl border p-3.5 text-left text-xs transition-all ${
                        selectedAnswer === idx
                          ? "border-amber-500 bg-amber-500/10 font-bold text-white"
                          : "border-white/5 bg-black/30 text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  title={triviaStep === triviaQuestions.length - 1 ? "Enviar respuestas" : "Pasar a la siguiente pregunta"}
                  disabled={!canPlayTrivia || selectedAnswer === null || triviaSubmitting || triviaLoading}
                  onClick={handleNextQuestion}
                  className={`${styles.triviaButton} w-full rounded-xl bg-amber-500 py-3 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-amber-400 disabled:opacity-50`}
                >
                  {triviaSubmitting ? "Guardando..." : triviaStep === triviaQuestions.length - 1 ? "Finalizar trivia" : "Siguiente pregunta"}
                </button>
              </div>
            ) : (
              <div className="v3-space-y-4 py-2 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">Trivia completada</h4>
                  <p className="mt-1 text-xs text-slate-400">
                    Acertaste {triviaResult?.score ?? 0} de {triviaResult?.total ?? triviaQuestions.length} preguntas sobre {productName}.
                  </p>
                </div>

                <div className="mx-auto max-w-sm v3-space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs">
                  <p className="font-bold leading-relaxed text-slate-200">
                    {triviaResult?.isLocal
                      ? "Resultado educativo local: no se otorgaron puntos ni premios."
                      : triviaResult?.alreadyCompleted
                        ? "Este tap ya tenía la trivia registrada."
                        : `Se confirmaron ${triviaResult?.pointsAwarded ?? 0} puntos.`}
                  </p>
                  <p className="text-[11px] leading-normal text-slate-400">
                    Tus respuestas ayudan a {wineryName} a entender interés por ciudad, producto y experiencia sin mostrar datos privados.
                  </p>
                  {!triviaResult?.isLocal && triviaResult?.requiresLogin ? (
                    <Link
                      href="/login?next=/me"
                      className="block w-full rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 py-2.5 text-center text-[11px] font-black uppercase tracking-wider text-slate-950"
                    >
                      Guardar puntos en mi Pasaporte
                    </Link>
                  ) : !triviaResult?.isLocal ? (
                    <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold text-emerald-200">
                      Puntos guardados en tu Pasaporte nexID.
                    </div>
                  ) : null}
                </div>

                {triviaResult?.explanations?.length ? (
                  <div className="v3-space-y-2 text-left">
                    {triviaResult.explanations.slice(0, 3).map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                        <div className="text-[10px] font-black uppercase tracking-wider text-cyan-200">
                          {item.correct ? "Respuesta correcta" : "Insight para mejorar"}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{item.explanation}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {isDemoPreview ? <button
                  type="button"
                  title="Reiniciar la trivia en este navegador"
                  onClick={handleRestartTrivia}
                  className="mx-auto block text-xs font-bold text-slate-400 underline transition hover:text-white"
                >
                  Intentar de nuevo
                </button> : null}
              </div>
            )}
            {((hasDraft && !canPlayTrivia && !showTriviaResult) || previousTriviaDraft.length > 0) ? <section data-testid="sun-trivia-saved-answers" className="rounded-xl border border-white/10 p-3 text-xs text-slate-300" aria-label={triviaCopy.savedAnswers}>
              <h4 className="font-bold">{triviaCopy.savedAnswers}</h4><p className="mt-1 leading-relaxed">{triviaCopy.previous}</p>
              <ol className="mt-3 grid gap-3">{(previousTriviaDraft.length ? previousTriviaDraft : triviaQuestions.filter(question => triviaAnswers[question.id] !== undefined).map(question => ({ prompt: question.prompt, answer: question.options[triviaAnswers[question.id]] }))).map((answer, index) => <li key={index}><p>{answer.prompt}</p><p className="mt-1 font-semibold">{answer.answer}</p></li>)}</ol>
            </section> : null}
          </div>
        )}

        {visibleTab === "feedback" && availability.feedback && (
          <div className="v3-space-y-4">
            {!feedbackSubmitted ? (
              <div className="v3-space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-white">¿Qué te parece este {productName}?</h4>
                  <p className="mt-0.5 text-[11px] text-slate-400">{feedbackCopy.explanation}</p>
                </div>

                <div className="flex justify-center gap-1.5 py-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      title={feedbackCopy.rating(star)}
                      aria-label={feedbackCopy.rating(star)}
                      aria-pressed={rating === star}
                      onClick={() => setRating(star)}
                      className={`${styles.ratingButton} transition active:scale-95 hover:scale-110`}
                    >
                      <Star aria-hidden="true" className={`h-8 w-8 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-slate-600 hover:text-slate-400"}`} />
                    </button>
                  ))}
                </div>

                <div className="v3-space-y-2">
                  <label htmlFor={commentId} className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{feedbackCopy.comment}</label>
                  <textarea
                    id={commentId}
                    rows={3}
                    title={feedbackCopy.commentHint}
                    placeholder="Contanos qué te pareció en boca, temperatura, aroma o presentación."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className={`${styles.comment} block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 transition focus:border-amber-500 focus:outline-hidden`}
                  />
                </div>

                <button
                  type="button"
                  title={feedbackCopy.send}
                  disabled={rating === 0 || submittingLead}
                  onClick={async () => {
                    const saved = await submitLead({
                      source: "qr_feedback",
                      contact: "anonymous_qr_feedback",
                      message: comment,
                      roleInterest: "wine_feedback",
                      rating,
                      extra: { comment },
                    });
                    if (saved) setFeedbackSubmitted(true);
                  }}
                  className="min-h-11 w-full rounded-xl bg-amber-500 py-3 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
                >
                  {submittingLead ? feedbackCopy.saving : feedbackCopy.send}
                </button>
                {leadError ? <p role="alert" className="text-center text-[11px] text-rose-300">{leadError}</p> : null}
              </div>
            ) : (
              <div className="v3-space-y-4 py-4 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Gracias por calificar</h4>
                  <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-400">
                    Tu feedback de cata y lote se guardó de forma agregada para mejorar la experiencia.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRating(0);
                    setComment("");
                    setFeedbackSubmitted(false);
                  }}
                  className="min-h-11 text-xs font-bold text-amber-400 transition hover:text-amber-300"
                >
                  Enviar otra opinión
                </button>
              </div>
            )}
          </div>
        )}

        {visibleTab === "contact" && availability.lead && (
          <div className="v3-space-y-4">
            {!optInSubmitted ? (
              <div className="v3-space-y-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Novedades de la marca</h4>
                    <p className="mt-0.5 text-[11px] text-slate-400">Dejá tus datos sólo para recibir novedades o campañas que la marca publique realmente. Este formulario no promete premios.</p>
                  </div>
                </div>

                <div className="v3-space-y-3.5">
                  <label className="block v3-space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Nombre
                    <input
                      type="text"
                      title="Nombre para registrar el beneficio"
                      placeholder="Tu nombre completo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs normal-case tracking-normal text-slate-100 placeholder:text-slate-500 transition focus:border-amber-500 focus:outline-hidden"
                    />
                  </label>
                  <label className="block v3-space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    WhatsApp o email
                    <input
                      type="text"
                      title="Contacto para recibir novedades autorizadas"
                      placeholder="ej. +549261... o mail@ejemplo.com"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      className="block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs normal-case tracking-normal text-slate-100 placeholder:text-slate-500 transition focus:border-amber-500 focus:outline-hidden"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block v3-space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Ocasión
                      <select
                        title="Contexto de compra o consumo"
                        value={occasion}
                        onChange={(e) => setOccasion(e.target.value)}
                        className="block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs normal-case tracking-normal text-slate-100 transition focus:border-amber-500 focus:outline-hidden"
                      >
                        <option value="regalo">Regalo</option>
                        <option value="fiesta">Fiesta</option>
                        <option value="consumo_personal">Tomarlo en casa</option>
                        <option value="festejo_especial">Festejo especial</option>
                      </select>
                    </label>
                    <label className="block v3-space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Género
                      <select
                        title="Dato opcional para segmentación agregada"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs normal-case tracking-normal text-slate-100 transition focus:border-amber-500 focus:outline-hidden"
                      >
                        <option value="prefiero_no_decir">Prefiero no decir</option>
                        <option value="mujer">Mujer</option>
                        <option value="hombre">Hombre</option>
                        <option value="otro">Otro</option>
                      </select>
                    </label>
                  </div>
                </div>

                <label className="flex min-h-11 items-start gap-2 text-xs leading-relaxed text-slate-300">
                  <input type="checkbox" checked={brandContactConsent} onChange={event => setBrandContactConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-indigo-400" />
                  <span>Autorizo a la marca a contactarme por este canal para sus novedades. Puedo pedir la baja.</span>
                </label>
                <button
                  type="button"
                  title="Registrar contacto para novedades de la marca"
                  disabled={!brandContactConsent || !name.trim() || !contact.trim() || submittingLead}
                  onClick={async () => {
                    const saved = await submitLead({
                      source: "qr_brand_opt_in",
                      contact,
                      name,
                      message: `Opt-in de novedades para ${productName}`,
                      roleInterest: "brand_updates",
                      extra: { optIn: "brand_updates" },
                    });
                    if (saved) setOptInSubmitted(true);
                  }}
                  className="min-h-11 w-full rounded-xl bg-amber-500 py-3 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
                >
                  {submittingLead ? "Registrando..." : "Registrarme"}
                </button>
                {leadError ? <p role="alert" className="text-center text-[11px] text-rose-300">{leadError}</p> : null}
              </div>
            ) : (
              <div className="v3-space-y-4 py-4 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Contacto guardado</h4>
                  <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-400">
                    Registramos el contacto <span className="font-mono font-bold text-slate-300">{contact}</span>. La marca puede enviarte novedades por este canal según tu consentimiento.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setContact("");
                    setName("");
                    setBrandContactConsent(false);
                    setOptInSubmitted(false);
                  }}
                  className="min-h-11 text-xs font-bold text-violet-300 transition hover:text-violet-200"
                >
                  Registrar otro contacto
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      </>}
    </div>
  );
}
