"use client";

import { useMemo, useState, useEffect } from "react";
import { Sparkles, HelpCircle, Star, Send, Gift, CheckCircle2, Bot, ArrowRight, Brain, Trophy } from "lucide-react";
import Link from "next/link";

type EngagementTab = "sommelier" | "trivia" | "feedback" | "sorteo";

interface ChatMessage {
  id: string;
  sender: "sommelier" | "user";
  text: string;
}

type ClientTriviaQuestion = {
  id: string;
  prompt: string;
  options: string[];
  explanation?: string;
  insightTag?: string;
  correctIndex?: number;
};

type TriviaResult = {
  score: number;
  total: number;
  pointsAwarded: number;
  requiresLogin?: boolean;
  alreadyCompleted?: boolean;
  explanations?: Array<ClientTriviaQuestion & { correct?: boolean; answerIndex?: number; correctIndex?: number }>;
};

type QREngagementSuiteProps = {
  wineryName: string;
  productName: string;
  tenantSlug?: string | null;
  eventId?: string | null;
  bid?: string | null;
};

function localTrivia(productName: string, wineryName: string): ClientTriviaQuestion[] {
  return [
    {
      id: "local-origin",
      prompt: `¿Qué confirma mejor la autenticidad de ${productName}?`,
      options: ["El tap NFC y el lote de la marca", "Una captura reenviada", "Un comentario anónimo", "Un precio escrito a mano"],
      correctIndex: 0,
      explanation: "El tap físico une producto, lote, ubicación aproximada y marca en una señal confiable para el cliente y la empresa.",
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
    pointsAwarded: score * 10 + (score >= 2 ? 15 : 0),
    requiresLogin: true,
    explanations: questions.map((question) => ({
      ...question,
      answerIndex: answers[question.id],
      correct: answers[question.id] === question.correctIndex,
      correctIndex: question.correctIndex,
    })),
  };
}

export function QREngagementSuite({ wineryName, productName, tenantSlug = "demobodega", eventId = null, bid = null }: QREngagementSuiteProps) {
  const [activeTab, setActiveTab] = useState<EngagementTab>("sommelier");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const fallbackTrivia = useMemo(() => localTrivia(productName, wineryName), [productName, wineryName]);
  const [triviaQuestions, setTriviaQuestions] = useState<ClientTriviaQuestion[]>(fallbackTrivia);
  const [triviaStep, setTriviaStep] = useState(0);
  const [triviaAnswers, setTriviaAnswers] = useState<Record<string, number>>({});
  const [triviaDone, setTriviaDone] = useState(false);
  const [triviaLoading, setTriviaLoading] = useState(false);
  const [triviaSubmitting, setTriviaSubmitting] = useState(false);
  const [triviaError, setTriviaError] = useState<string | null>(null);
  const [triviaResult, setTriviaResult] = useState<TriviaResult | null>(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const [contact, setContact] = useState("");
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState("regalo");
  const [gender, setGender] = useState("prefiero_no_decir");
  const [raffleSubmitted, setRaffleSubmitted] = useState(false);
  const [submittingLead, setSubmittingLead] = useState(false);

  const currentQuestion = triviaQuestions[triviaStep] || triviaQuestions[0];
  const selectedAnswer = currentQuestion ? triviaAnswers[currentQuestion.id] ?? null : null;

  const getDeviceMeta = () => ({
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    mobile: /mobile|iphone|android|ipad/i.test(navigator.userAgent),
  });

  const getGps = () => new Promise<Record<string, unknown>>((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        source: "browser",
      }),
      () => resolve({}),
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
  }, quiet = false) => {
    if (!quiet) setSubmittingLead(true);
    try {
      const gps = await getGps();
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: "es-AR",
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
    } finally {
      if (!quiet) setSubmittingLead(false);
    }
  };

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        sender: "sommelier",
        text: `Hola. Soy tu sommelier virtual nexID. Estás viendo "${productName}" de ${wineryName}. Preguntame por temperatura de servicio, maridaje, notas de cata o beneficios del club.`,
      },
    ]);
  }, [productName, wineryName]);

  useEffect(() => {
    setTriviaQuestions(fallbackTrivia);
    setTriviaStep(0);
    setTriviaAnswers({});
    setTriviaDone(false);
    setTriviaResult(null);
    setTriviaError(null);
  }, [fallbackTrivia, eventId]);

  useEffect(() => {
    if (activeTab !== "trivia" || !eventId) return;
    const triviaEventId = eventId;
    let cancelled = false;
    async function loadTrivia() {
      setTriviaLoading(true);
      setTriviaError(null);
      try {
        const triviaParams = new URLSearchParams({
          locale: "es-AR",
          tenant: tenantSlug || "",
          product: productName,
          winery: wineryName,
        });
        const response = await fetch(`/api/mobile/passport/${encodeURIComponent(triviaEventId)}/loyalty/trivia?${triviaParams.toString()}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false || !Array.isArray(payload?.quiz?.questions)) {
          throw new Error(payload?.error || "trivia_unavailable");
        }
        if (cancelled) return;
        setTriviaQuestions(payload.quiz.questions as ClientTriviaQuestion[]);
        if (payload.previousAttempt) {
          setTriviaResult({
            score: Number(payload.previousAttempt.score || 0),
            total: Number(payload.previousAttempt.total_questions || payload.quiz.questions.length || 0),
            pointsAwarded: Number(payload.previousAttempt.points_awarded || 0),
            alreadyCompleted: true,
            requiresLogin: !payload.member?.consumerLinked,
          });
          setTriviaDone(true);
        }
      } catch (error) {
        if (!cancelled) {
          setTriviaQuestions(fallbackTrivia);
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
  }, [activeTab, eventId, fallbackTrivia]);

  const handleSendChat = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
    void submitLead({
      source: "qr_sommelier",
      contact: "anonymous_qr_sommelier",
      message: textToSend,
      roleInterest: "sommelier_ai_question",
      extra: { question: textToSend },
    }, true);

    try {
      const res = await fetch("/api/cognitive-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Vino: ${productName}. Bodega: ${wineryName}. Pregunta del cliente: ${textToSend}`,
          tone: "sommelier-chat",
        }),
      });

      if (!res.ok) throw new Error("AI failed");
      const data = await res.json();
      if (!data?.optimizedText) throw new Error("Empty AI response");

      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        sender: "sommelier",
        text: data.optimizedText,
      }]);
    } catch {
      const clean = textToSend.toLowerCase();
      let replyText = `Este ${productName} muestra muy buena tipicidad. Te sugiero descorcharlo 15 a 20 minutos antes para abrir aromas y servirlo en copa amplia.`;

      if (clean.includes("maridaje") || clean.includes("comer") || clean.includes("comida") || clean.includes("acompañar")) {
        replyText = `Para maridar ${productName}, probá carnes asadas, pastas con salsa intensa, vegetales grillados o quesos de pasta dura.`;
      } else if (clean.includes("temperatura") || clean.includes("servir") || clean.includes("frio") || clean.includes("frío")) {
        replyText = "Para un tinto reserva, lo ideal suele estar entre 16 °C y 18 °C. Evitá servirlo demasiado caliente para no tapar fruta y taninos.";
      } else if (clean.includes("cata") || clean.includes("aroma") || clean.includes("sabor")) {
        replyText = "En copa buscá fruta roja madura, especias suaves y notas de crianza. Si lo dejás respirar, aparece más volumen y persistencia.";
      } else if (clean.includes("premio") || clean.includes("puntos") || clean.includes("calificacion") || clean.includes("calificación")) {
        replyText = `nexID puede mostrar premios, reseñas verificadas y trazabilidad del lote cuando la bodega publica esos datos en el pasaporte del producto.`;
      } else if (clean.includes("regalo") || clean.includes("cena") || clean.includes("evento")) {
        replyText = `Como regalo o cena especial, ${productName} funciona mejor si lo acompañás con una experiencia: cata, visita, historia del lote y beneficio del club.`;
      }

      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        sender: "sommelier",
        text: replyText,
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const onChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput;
    setChatInput("");
    void handleSendChat(text);
  };

  const handleNextQuestion = async () => {
    if (!currentQuestion || selectedAnswer === null) return;
    if (triviaStep < triviaQuestions.length - 1) {
      setTriviaStep((prev) => prev + 1);
      return;
    }

    setTriviaSubmitting(true);
    setTriviaError(null);
    try {
      const answers = triviaQuestions.map((question) => ({
        questionId: question.id,
        answerIndex: triviaAnswers[question.id] ?? -1,
      }));
      const triviaEventId = eventId;
      if (!triviaEventId) {
        setTriviaResult(asResultFromLocal(triviaQuestions, triviaAnswers));
        setTriviaDone(true);
        return;
      }
      const response = await fetch(`/api/mobile/passport/${encodeURIComponent(triviaEventId)}/loyalty/trivia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: "es-AR", tenantSlug, productName, brandName: wineryName, answers }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "trivia_submit_failed");
      }
      setTriviaResult({
        score: Number(payload.score || 0),
        total: Number(payload.total || triviaQuestions.length),
        pointsAwarded: Number(payload.pointsAwarded || 0),
        requiresLogin: Boolean(payload.requiresLogin),
        alreadyCompleted: Boolean(payload.alreadyCompleted),
        explanations: Array.isArray(payload.explanations) ? payload.explanations : [],
      });
      setTriviaDone(true);
    } catch (error) {
      setTriviaError(error instanceof Error ? error.message : "trivia_submit_failed");
      setTriviaResult(asResultFromLocal(triviaQuestions, triviaAnswers));
      setTriviaDone(true);
    } finally {
      setTriviaSubmitting(false);
    }
  };

  const handleRestartTrivia = () => {
    setTriviaStep(0);
    setTriviaAnswers({});
    setTriviaResult(null);
    setTriviaDone(false);
    setTriviaError(null);
  };

  return (
    <div className="mt-4 w-full overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-950/70 shadow-xl backdrop-blur-md">
      <div className="flex border-b border-white/5 bg-black/40 text-[10px] md:text-xs">
        {[
          { id: "sommelier" as const, label: "Sommelier", Icon: Bot, title: "Consultar maridajes, cata, temperatura y recomendaciones" },
          { id: "trivia" as const, label: "Trivia", Icon: HelpCircle, title: "Responder preguntas del producto para sumar puntos e insights" },
          { id: "feedback" as const, label: "Calificar", Icon: Star, title: "Enviar opinión breve del producto o experiencia" },
          { id: "sorteo" as const, label: "Sorteo", Icon: Gift, title: "Registrarte para beneficios, premios o campañas del tenant" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            title={tab.title}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 border-b-2 py-3.5 font-bold uppercase tracking-wider transition ${
              activeTab === tab.id
                ? "border-amber-500 bg-amber-500/5 text-amber-300"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <span className="flex items-center justify-center gap-1">
              <tab.Icon className="h-3.5 w-3.5" /> {tab.label}
            </span>
          </button>
        ))}
      </div>

      <div className="p-5">
        {activeTab === "sommelier" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span>Asistente enólogo</span>
              <span className="flex items-center gap-1 text-amber-400"><Sparkles className="h-3 w-3 animate-pulse" /> IA contextual</span>
            </div>

            <div className="h-[200px] space-y-3.5 overflow-y-auto rounded-xl border border-white/5 bg-black/45 p-3 text-xs">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 leading-relaxed ${
                    msg.sender === "user" ? "bg-amber-500 font-semibold text-slate-950" : "border border-white/5 bg-slate-900 text-slate-200"
                  }`}>
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
                className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 transition focus:border-amber-500 focus:outline-none"
              />
              <button
                type="submit"
                title="Enviar pregunta"
                disabled={!chatInput.trim() || isTyping}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {activeTab === "trivia" && (
          <div className="space-y-4">
            {!triviaDone ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <span className="flex items-center gap-1 text-cyan-200"><Brain className="h-3.5 w-3.5" /> Market quiz</span>
                  <span>{triviaLoading ? "Cargando" : `Pregunta ${triviaStep + 1} de ${triviaQuestions.length}`}</span>
                </div>

                {triviaError ? (
                  <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-[11px] leading-relaxed text-amber-100">
                    Trivia funcionando en modo local por falta de conexión con API. El flujo real guarda intentos y puntos cuando el tap tiene evento válido.
                  </div>
                ) : null}

                <h4 className="text-sm font-bold leading-normal text-white">
                  {currentQuestion?.prompt || "Cargando pregunta del producto..."}
                </h4>

                <div className="grid gap-2">
                  {(currentQuestion?.options || []).map((option, idx) => (
                    <button
                      key={`${currentQuestion.id}-${idx}`}
                      type="button"
                      title={`Elegir respuesta ${idx + 1}`}
                      onClick={() => setTriviaAnswers((prev) => ({ ...prev, [currentQuestion.id]: idx }))}
                      className={`w-full rounded-xl border p-3.5 text-left text-xs transition-all ${
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
                  title={triviaStep === triviaQuestions.length - 1 ? "Enviar respuestas y calcular puntos" : "Pasar a la siguiente pregunta"}
                  disabled={selectedAnswer === null || triviaSubmitting || triviaLoading}
                  onClick={handleNextQuestion}
                  className="w-full rounded-xl bg-amber-500 py-3 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
                >
                  {triviaSubmitting ? "Guardando..." : triviaStep === triviaQuestions.length - 1 ? "Finalizar trivia" : "Siguiente pregunta"}
                </button>
              </div>
            ) : (
              <div className="space-y-4 py-2 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">Trivia completada</h4>
                  <p className="mt-1 text-xs text-slate-400">
                    Acertaste {triviaResult?.score ?? 0} de {triviaResult?.total ?? triviaQuestions.length} preguntas sobre {productName}.
                  </p>
                </div>

                <div className="mx-auto max-w-sm space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs">
                  <p className="font-bold leading-relaxed text-slate-200">
                    {triviaResult?.alreadyCompleted ? "Este tap ya tenía la trivia registrada." : `Sumaste ${triviaResult?.pointsAwarded || 0} puntos de conocimiento.`}
                  </p>
                  <p className="text-[11px] leading-normal text-slate-400">
                    Tus respuestas ayudan a {wineryName} a entender interés por ciudad, producto y experiencia sin mostrar datos privados.
                  </p>
                  {triviaResult?.requiresLogin ? (
                    <Link
                      href="/login?next=/me"
                      className="block w-full rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 py-2.5 text-center text-[11px] font-black uppercase tracking-wider text-slate-950"
                    >
                      Guardar puntos en mi Pasaporte
                    </Link>
                  ) : (
                    <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold text-emerald-200">
                      Puntos guardados en tu Pasaporte nexID.
                    </div>
                  )}
                </div>

                {triviaResult?.explanations?.length ? (
                  <div className="space-y-2 text-left">
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

                <button
                  type="button"
                  title="Reiniciar la trivia en este navegador"
                  onClick={handleRestartTrivia}
                  className="mx-auto block text-xs font-bold text-slate-400 underline transition hover:text-white"
                >
                  Intentar de nuevo
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "feedback" && (
          <div className="space-y-4">
            {!feedbackSubmitted ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-white">¿Qué te parece este {productName}?</h4>
                  <p className="mt-0.5 text-[11px] text-slate-400">Tu opinión queda asociada al contexto del tap para analítica del tenant.</p>
                </div>

                <div className="flex justify-center gap-1.5 py-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      title={`Calificar con ${star} estrella${star > 1 ? "s" : ""}`}
                      onClick={() => setRating(star)}
                      className="transition active:scale-95 hover:scale-110"
                    >
                      <Star className={`h-8 w-8 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-slate-600 hover:text-slate-400"}`} />
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Comentario corto</label>
                  <textarea
                    rows={3}
                    title="Comentario opcional para la bodega"
                    placeholder="Contanos qué te pareció en boca, temperatura, aroma o presentación."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 transition focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  title="Enviar feedback al CRM"
                  disabled={rating === 0 || submittingLead}
                  onClick={async () => {
                    await submitLead({
                      source: "qr_feedback",
                      contact: "anonymous_qr_feedback",
                      message: comment,
                      roleInterest: "wine_feedback",
                      rating,
                      extra: { comment },
                    });
                    setFeedbackSubmitted(true);
                  }}
                  className="w-full rounded-xl bg-amber-500 py-3 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
                >
                  {submittingLead ? "Guardando..." : "Enviar feedback"}
                </button>
              </div>
            ) : (
              <div className="space-y-4 py-4 text-center">
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
                  className="text-xs font-bold text-amber-400 transition hover:text-amber-300"
                >
                  Enviar otra opinión
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "sorteo" && (
          <div className="space-y-4">
            {!raffleSubmitted ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Beneficio del club</h4>
                    <p className="mt-0.5 text-[11px] text-slate-400">Participá por premios, visitas guiadas o campañas vinculadas a este producto.</p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <label className="block space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Nombre
                    <input
                      type="text"
                      title="Nombre para registrar el beneficio"
                      placeholder="Tu nombre completo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs normal-case tracking-normal text-slate-100 placeholder:text-slate-500 transition focus:border-amber-500 focus:outline-none"
                    />
                  </label>
                  <label className="block space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    WhatsApp o email
                    <input
                      type="text"
                      title="Contacto para avisarte si ganás o recibís un beneficio"
                      placeholder="ej. +549261... o mail@ejemplo.com"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      className="block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs normal-case tracking-normal text-slate-100 placeholder:text-slate-500 transition focus:border-amber-500 focus:outline-none"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Ocasión
                      <select
                        title="Contexto de compra o consumo"
                        value={occasion}
                        onChange={(e) => setOccasion(e.target.value)}
                        className="block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs normal-case tracking-normal text-slate-100 transition focus:border-amber-500 focus:outline-none"
                      >
                        <option value="regalo">Regalo</option>
                        <option value="fiesta">Fiesta</option>
                        <option value="consumo_personal">Tomarlo en casa</option>
                        <option value="festejo_especial">Festejo especial</option>
                      </select>
                    </label>
                    <label className="block space-y-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Género
                      <select
                        title="Dato opcional para segmentación agregada"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs normal-case tracking-normal text-slate-100 transition focus:border-amber-500 focus:outline-none"
                      >
                        <option value="prefiero_no_decir">Prefiero no decir</option>
                        <option value="mujer">Mujer</option>
                        <option value="hombre">Hombre</option>
                        <option value="otro">Otro</option>
                      </select>
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  title="Registrar contacto para beneficio o sorteo"
                  disabled={!name.trim() || !contact.trim() || submittingLead}
                  onClick={async () => {
                    await submitLead({
                      source: "qr_raffle",
                      contact,
                      name,
                      message: `Beneficio QR ${productName}`,
                      roleInterest: "raffle",
                      extra: { raffle: "monthly_winery_box" },
                    });
                    setRaffleSubmitted(true);
                  }}
                  className="w-full rounded-xl bg-indigo-500 py-3 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-indigo-400 disabled:opacity-50"
                >
                  {submittingLead ? "Registrando..." : "Registrarme"}
                </button>
              </div>
            ) : (
              <div className="space-y-4 py-4 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Ya estás participando</h4>
                  <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-400">
                    Registramos el contacto <span className="font-mono font-bold text-slate-300">{contact}</span>. La marca puede enviarte beneficios por este canal si corresponde.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setContact("");
                    setName("");
                    setRaffleSubmitted(false);
                  }}
                  className="text-xs font-bold text-indigo-400 transition hover:text-indigo-300"
                >
                  Registrar otro participante
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
