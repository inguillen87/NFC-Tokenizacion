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
import { requestSommelierAnswer, SOMMELIER_QUESTION_MAX_CHARS } from "../../lib/sommelier-conversation";
import { demoSommelierAnswer, demoSommelierCopy } from "./sun-demo-sommelier";
import { demoWineTrivia } from "./sun-demo-wine-quiz";
import type { DemoWineProfile } from "./valle-secreto-demo";
import styles from "./qr-engagement-suite.module.css";
import { configuredTriviaQuiz, confirmedPreviousTrivia, confirmedTriviaResult, triviaContextAvailable, triviaRecoveryCopy, triviaRecoveryDescription, triviaSubmissionBody, type ClientTriviaQuestion, type TriviaResult } from "./sun-trivia-model";

const FEEDBACK_COPY = {
  "es-AR": { explanation: "Tu opinión se envía a la marca junto con esta lectura.", rating: (star: number) => `Calificar con ${star} estrella${star > 1 ? "s" : ""}`, comment: "Comentario corto", commentHint: "Comentario opcional para la marca", send: "Enviar opinión", saving: "Guardando..." },
  en: { explanation: "Your opinion is sent to the brand with this reading.", rating: (star: number) => `Rate ${star} star${star > 1 ? "s" : ""}`, comment: "Short comment", commentHint: "Optional comment for the brand", send: "Send opinion", saving: "Saving..." },
  "pt-BR": { explanation: "Sua opinião é enviada à marca junto com esta leitura.", rating: (star: number) => `Avaliar com ${star} estrela${star > 1 ? "s" : ""}`, comment: "Comentário curto", commentHint: "Comentário opcional para a marca", send: "Enviar opinião", saving: "Salvando..." },
} as const;

const QUIZ_COPY = {
  "es-AR": {
    demoTitle: "Descubrí este vino", title: "Trivia de la marca", loading: "Cargando pregunta...",
    question: (step: number, total: number) => `Pregunta ${step} de ${total}`,
    demo: "Tres preguntas para conocer el vino. Las respuestas quedan en este navegador; no otorgan puntos ni premios.",
    answer: (index: number) => `Elegir respuesta ${index}`, next: "Siguiente pregunta", finish: "Finalizar trivia", saving: "Guardando...",
    result: "Trivia completada", localTitle: "Lo que aprendiste",
    score: (score: number, total: number, product: string) => `Acertaste ${score} de ${total} preguntas sobre ${product}.`,
    localResult: "Resultado educativo local: no se otorgaron puntos ni premios.", already: "Este tap ya tenía la trivia registrada.",
    points: (points: number) => `Se confirmaron ${points} puntos.`, localHelp: "Podés repasar las respuestas y consultar la información de la viña.",
    realHelp: "Resultado confirmado del programa de la marca.", save: "Guardar puntos en mi Pasaporte", saved: "Puntos guardados en tu Pasaporte nexID.",
    correct: "Respuesta correcta", learn: "Para recordar", restart: "Intentar de nuevo", source: "Consultar la ficha de la viña",
  },
  en: {
    demoTitle: "Discover this wine", title: "Brand quiz", loading: "Loading question...",
    question: (step: number, total: number) => `Question ${step} of ${total}`,
    demo: "Three questions to discover the wine. Answers stay in this browser and award no points or prizes.",
    answer: (index: number) => `Choose answer ${index}`, next: "Next question", finish: "Finish quiz", saving: "Saving...",
    result: "Quiz completed", localTitle: "What you learned",
    score: (score: number, total: number, product: string) => `You answered ${score} of ${total} questions about ${product} correctly.`,
    localResult: "Local educational result: no points or prizes awarded.", already: "This tap already had a recorded quiz.",
    points: (points: number) => `${points} points confirmed.`, localHelp: "Review your answers and explore the producer's information.",
    realHelp: "Confirmed result from the brand's program.", save: "Save points to my Passport", saved: "Points saved to your nexID Passport.",
    correct: "Correct answer", learn: "Something to remember", restart: "Try again", source: "View the producer's technical sheet",
  },
  "pt-BR": {
    demoTitle: "Descubra este vinho", title: "Quiz da marca", loading: "Carregando pergunta...",
    question: (step: number, total: number) => `Pergunta ${step} de ${total}`,
    demo: "Três perguntas para conhecer o vinho. As respostas ficam neste navegador e não dão pontos nem prêmios.",
    answer: (index: number) => `Escolher resposta ${index}`, next: "Próxima pergunta", finish: "Finalizar quiz", saving: "Salvando...",
    result: "Quiz concluído", localTitle: "O que você aprendeu",
    score: (score: number, total: number, product: string) => `Você acertou ${score} de ${total} perguntas sobre ${product}.`,
    localResult: "Resultado educativo local: sem pontos nem prêmios.", already: "Este tap já tinha um quiz registrado.",
    points: (points: number) => `${points} pontos confirmados.`, localHelp: "Revise as respostas e consulte as informações da vinícola.",
    realHelp: "Resultado confirmado do programa da marca.", save: "Guardar pontos no meu Passaporte", saved: "Pontos guardados no seu Passaporte nexID.",
    correct: "Resposta correta", learn: "Para lembrar", restart: "Tentar novamente", source: "Consultar a ficha da vinícola",
  },
} as const;

type EngagementTab = "sommelier" | "trivia" | "feedback" | "contact";

interface ChatMessage {
  id: string;
  sender: "sommelier" | "user";
  text: string;
  provenance?: SommelierProvenance;
  sourceUrl?: string;
  sourceLabel?: string;
  sample?: boolean;
}

type QREngagementSuiteProps = {
  wineryName: string;
  productName: string;
  tenantSlug?: string | null;
  eventId?: string | null;
  freshToken?: string;
  isDemoPreview?: boolean;
  demoWineProfile?: DemoWineProfile | null;
  bid?: string | null;
  allowedActions?: string[];
  blockedActions?: string[];
  initialTab?: EngagementTab;
  configuration?: unknown;
  canEngage?: boolean;
};

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
  demoWineProfile = null,
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
  const quizCopy = QUIZ_COPY[locale];
  const chatCopy = demoSommelierCopy(locale);
  const activeDemoWineProfile = isDemoPreview ? demoWineProfile : null;
  const commentId = useId();
  const [activeTab, setActiveTab] = useState<EngagementTab | null>(initialTab);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatRequest = useRef<AbortController | null>(null);
  const chatSendLock = useRef(false);
  const chatSequence = useRef(0);
  const chatLog = useRef<HTMLDivElement | null>(null);
  const followChat = useRef(true);
  const chatScope = JSON.stringify([productName, wineryName, locale, eventId, tenantSlug, isDemoPreview, activeDemoWineProfile?.key]);
  const currentChatScope = useRef(chatScope);
  currentChatScope.current = chatScope;
  const [configurationOverride, setConfigurationOverride] = useState<{ base: unknown; value: unknown } | null>(null);
  const effectiveConfiguration = configurationOverride && configurationOverride.base === configuration ? configurationOverride.value : configuration;
  const availability = resolveTenantActionAvailability({ configuration: effectiveConfiguration,
    verifiedTenant: Boolean(tenantSlug && /^[a-z0-9][a-z0-9._-]{0,119}$/.test(tenantSlug)), canEngage,
    isDemoPreview, allowedActions, blockedActions });
  const currentAvailability = useRef(availability);
  currentAvailability.current = availability;

  const fallbackTrivia = useMemo(() => isDemoPreview ? demoWineTrivia({ productName, wineryName, locale,
    facts: activeDemoWineProfile ? { region: activeDemoWineProfile.region, vintage: activeDemoWineProfile.vintage, barrelMonths: activeDemoWineProfile.barrelMonths } : undefined }) : [], [isDemoPreview, productName, wineryName, locale, activeDemoWineProfile]);
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
    ...(availability.feedback && !activeDemoWineProfile ? [{ id: "feedback" as const, label: "Calificar", Icon: Star, title: "Enviar opinión breve del producto o experiencia" }] : []),
    ...(availability.lead && !activeDemoWineProfile ? [{ id: "contact" as const, label: "Novedades", Icon: Gift, title: "Autorizar contacto para novedades reales publicadas por la marca" }] : []),
  ], [availability.sommelier, availability.trivia, availability.feedback, availability.lead, hasDraft, previousTriviaDraft.length, showTriviaResult, triviaCopy.savedAnswers, activeDemoWineProfile]);
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
    chatRequest.current?.abort();
    chatRequest.current = null;
    chatSendLock.current = false;
    setIsTyping(false);
    setChatError(null);
    setChatInput("");
    followChat.current = true;
    setMessages([
      {
        id: "welcome",
        sender: "sommelier",
        text: chatCopy.welcome,
        provenance: { mode: "context" },
        sample: isDemoPreview,
      },
    ]);
    return () => {
      chatRequest.current?.abort();
      chatRequest.current = null;
      chatSendLock.current = false;
    };
  }, [chatScope, chatCopy.welcome, isDemoPreview]);

  useEffect(() => {
    if (!availability.sommelier) {
      chatRequest.current?.abort();
      chatRequest.current = null;
      chatSendLock.current = false;
      setIsTyping(false);
    }
  }, [availability.sommelier]);

  useEffect(() => {
    if (followChat.current && chatLog.current) chatLog.current.scrollTop = chatLog.current.scrollHeight;
  }, [messages, isTyping, visibleTab]);

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
    const question = textToSend.trim().slice(0, SOMMELIER_QUESTION_MAX_CHARS);
    if (!currentAvailability.current.sommelier || chatSendLock.current || !question) return;
    chatSendLock.current = true;
    const controller = new AbortController();
    chatRequest.current = controller;

    const userMsg: ChatMessage = {
      id: `chat-${++chatSequence.current}`,
      sender: "user",
      text: question,
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsTyping(true);
    setChatError(null);
    const capturedScope = chatScope;

    try {
      if (isDemoPreview) {
        const answer = demoSommelierAnswer(question, locale, activeDemoWineProfile);
        setMessages(prev => [...prev, { id: `chat-${++chatSequence.current}`, sender: "sommelier", ...answer, sample: true }]);
        return;
      }
      const result = await requestSommelierAnswer(question, { productName, brandName: wineryName }, { signal: controller.signal, postTapEventId: eventId });
      if (currentChatScope.current !== capturedScope || controller.signal.aborted || !currentAvailability.current.sommelier) return;
      if (result.status !== "received") throw new Error("sommelier_unavailable");
      const data = result.data;
      const provenance = classifySommelierResponse(data);

      setMessages((prev) => [...prev, {
        id: `chat-${++chatSequence.current}`,
        sender: "sommelier",
        text: data.optimizedText,
        provenance,
      }]);
    } catch {
      if (currentChatScope.current !== capturedScope || controller.signal.aborted || !currentAvailability.current.sommelier) return;
      setChatError(TENANT_ACTION_COPY[locale].unavailable);
      setChatInput(previous => previous || question);
    } finally {
      if (chatRequest.current === controller) {
        chatRequest.current = null;
        chatSendLock.current = false;
        if (currentChatScope.current === capturedScope) setIsTyping(false);
      }
    }
  };

  const onChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSendChat(chatInput);
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
              <span>{chatCopy.label}</span>
              <span className="flex items-center gap-1 text-amber-400"><Sparkles className="h-3 w-3" aria-hidden="true" /> {chatCopy.general}</span>
            </div>

            {isDemoPreview ? <p data-testid="sun-sommelier-demo-notice" className="text-xs leading-relaxed text-slate-300">{chatCopy.demo}</p> : null}

            <div className="flex flex-wrap gap-2" data-testid="sun-sommelier-prompts">
              {chatCopy.prompts.map(prompt => <button key={prompt} type="button" disabled={isTyping} onClick={() => { void handleSendChat(prompt); }} className="min-h-11 rounded-xl border border-amber-300/25 px-3 py-2 text-sm leading-snug text-amber-200 transition hover:bg-amber-400/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400">{prompt}</button>)}
            </div>

            <div ref={chatLog} role="log" aria-label={chatCopy.log} aria-live="polite" aria-relevant="additions text" aria-busy={isTyping} tabIndex={0}
              onScroll={event => { const log = event.currentTarget; followChat.current = log.scrollHeight - log.scrollTop - log.clientHeight < 64; }}
              className={`${styles.chatLog} v3-space-y-3.5 overflow-y-auto rounded-xl border border-white/5 bg-black/45 p-3 focus-visible:outline-2 focus-visible:outline-amber-400`}>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`min-w-0 max-w-[90%] break-words rounded-xl px-3.5 py-2.5 leading-relaxed ${
                    msg.sender === "user" ? "bg-amber-500 font-semibold text-slate-950" : "border border-white/5 bg-slate-900 text-slate-200"
                  }`}>
                    {msg.sender === "sommelier" ? (
                      msg.sample ? <span className="mb-1 block text-xs font-semibold text-cyan-300">{msg.sourceLabel || chatCopy.sample}</span> :
                        <details className="mb-2 text-xs text-cyan-300"><summary className="min-h-11 cursor-pointer font-semibold">{msg.provenance?.mode === "live" ? chatCopy.label : chatCopy.general}</summary><p className="mt-1 leading-relaxed text-slate-400">{sommelierProvenanceLabel(msg.provenance)}</p></details>
                    ) : null}
                    {msg.text}
                    {msg.sourceUrl ? <a href={msg.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex min-h-11 items-center text-xs font-semibold text-cyan-300 underline">{msg.sourceLabel} ↗</a> : null}
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
                title={chatCopy.placeholder}
                aria-label={chatCopy.placeholder}
                placeholder={chatCopy.placeholder}
                maxLength={SOMMELIER_QUESTION_MAX_CHARS}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className={`${styles.chatInput} min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-slate-100 placeholder:text-slate-500 transition focus:border-amber-500 focus:outline-hidden`}
              />
              <button
                type="submit"
                title={chatCopy.send}
                aria-label={chatCopy.send}
                disabled={!chatInput.trim() || isTyping}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-500 text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
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
                  <span className="flex items-center gap-1 text-cyan-200"><Brain className="h-3.5 w-3.5" aria-hidden="true" /> {isDemoPreview ? quizCopy.demoTitle : quizCopy.title}</span>
                  <span>{triviaLoading ? quizCopy.loading : quizCopy.question(triviaStep + 1, triviaQuestions.length)}</span>
                </div>

                {isDemoPreview ? <p data-testid="sun-trivia-demo-notice" className="text-xs text-slate-300">{quizCopy.demo}</p> : null}

                <h4 className="text-sm font-bold leading-normal text-white">
                  {currentQuestion?.prompt || quizCopy.loading}
                </h4>

                <div className="grid gap-2">
                  {(currentQuestion?.options || []).map((option, idx) => (
                    <button
                      key={`${currentQuestion.id}-${idx}`}
                      type="button"
                      title={quizCopy.answer(idx + 1)}
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
                  title={triviaStep === triviaQuestions.length - 1 ? quizCopy.finish : quizCopy.next}
                  disabled={!canPlayTrivia || selectedAnswer === null || triviaSubmitting || triviaLoading}
                  onClick={handleNextQuestion}
                  className={`${styles.triviaButton} w-full rounded-xl bg-amber-500 py-3 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-amber-400 disabled:opacity-50`}
                >
                  {triviaSubmitting ? quizCopy.saving : triviaStep === triviaQuestions.length - 1 ? quizCopy.finish : quizCopy.next}
                </button>
              </div>
            ) : (
              <div className="v3-space-y-4 py-2 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <h4 data-testid="sun-trivia-result-title" className="text-base font-black text-white">{triviaResult?.isLocal ? quizCopy.localTitle : quizCopy.result}</h4>
                  <p className="mt-1 text-xs text-slate-400">
                    {quizCopy.score(triviaResult?.score ?? 0, triviaResult?.total ?? triviaQuestions.length, productName)}
                  </p>
                </div>

                <div className="mx-auto max-w-sm v3-space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs">
                  <p className="font-bold leading-relaxed text-slate-200">
                    {triviaResult?.isLocal
                      ? quizCopy.localResult
                      : triviaResult?.alreadyCompleted
                        ? quizCopy.already
                        : quizCopy.points(triviaResult?.pointsAwarded ?? 0)}
                  </p>
                  <p className="text-[11px] leading-normal text-slate-400">
                    {triviaResult?.isLocal ? quizCopy.localHelp : quizCopy.realHelp}
                  </p>
                  {triviaResult?.isLocal && activeDemoWineProfile ? <a href={activeDemoWineProfile.technicalSheet} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center text-cyan-300 underline">{quizCopy.source} ↗</a> : null}
                  {!triviaResult?.isLocal && triviaResult?.requiresLogin ? (
                    <Link
                      href="/login?next=/me"
                      className="block w-full rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 py-2.5 text-center text-[11px] font-black uppercase tracking-wider text-slate-950"
                    >
                      {quizCopy.save}
                    </Link>
                  ) : !triviaResult?.isLocal ? (
                    <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold text-emerald-200">
                      {quizCopy.saved}
                    </div>
                  ) : null}
                </div>

                {triviaResult?.explanations?.length ? (
                  <div className="v3-space-y-2 text-left">
                    {triviaResult.explanations.slice(0, 3).map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
                        <div className="text-[10px] font-black uppercase tracking-wider text-cyan-200">
                          {item.correct ? quizCopy.correct : quizCopy.learn}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{item.explanation}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {isDemoPreview ? <button
                  type="button"
                  title={quizCopy.restart}
                  onClick={handleRestartTrivia}
                  className="mx-auto block min-h-11 text-xs font-bold text-slate-400 underline transition hover:text-white"
                >
                  {quizCopy.restart}
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
