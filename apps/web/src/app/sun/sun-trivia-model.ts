import { publishedQuizIdentity } from "./tenant-action-availability";

export type ClientTriviaQuestion = {
  id: string;
  prompt: string;
  options: string[];
  explanation?: string;
  insightTag?: string;
  correctIndex?: number;
};

export type TriviaResult = {
  score: number;
  total: number;
  pointsAwarded: number;
  isLocal?: boolean;
  requiresLogin?: boolean;
  alreadyCompleted?: boolean;
  explanations?: Array<ClientTriviaQuestion & { correct?: boolean; answerIndex?: number; correctIndex?: number }>;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}
function natural(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** A server-configured quiz is required; caller text cannot supply questions. */
export function configuredTriviaQuestions(value: unknown): ClientTriviaQuestion[] | null {
  const payload = record(value), quiz = record(payload?.quiz);
  if (payload?.ok !== true || !quiz || !text(quiz.id, 100) || !Array.isArray(quiz.questions) || !quiz.questions.length || quiz.questions.length > 30) return null;
  const ids = new Set<string>();
  const questions: ClientTriviaQuestion[] = [];
  for (const item of quiz.questions) {
    const question = record(item);
    if (!question || !text(question.id, 100) || ids.has(question.id) || !text(question.prompt, 1200)
      || !Array.isArray(question.options) || question.options.length < 2 || question.options.length > 10
      || question.options.some(option => !text(option, 600))) return null;
    ids.add(question.id);
    // Correct answers are never accepted from the public question projection.
    questions.push({ id: question.id, prompt: question.prompt, options: question.options as string[] });
  }
  return questions;
}

export function confirmedTriviaResult(value: unknown, expectedTotal: number): TriviaResult | null {
  const payload = record(value);
  if (payload?.ok !== true || !natural(payload.score) || !natural(payload.total) || payload.total !== expectedTotal
    || payload.score > payload.total || !natural(payload.pointsAwarded)
    || typeof payload.requiresLogin !== "boolean" || typeof payload.alreadyCompleted !== "boolean") return null;
  return { score: payload.score, total: payload.total, pointsAwarded: payload.pointsAwarded,
    requiresLogin: payload.requiresLogin, alreadyCompleted: payload.alreadyCompleted };
}

export function configuredTriviaQuiz(value: unknown) {
  const payload = record(value), quiz = record(payload?.quiz), questions = configuredTriviaQuestions(value);
  return quiz && publishedQuizIdentity(quiz.id, quiz.revision) && questions
    ? { id: quiz.id, revision: quiz.revision as string, questions } : null;
}

export function confirmedPreviousTrivia(value: unknown, expectedTotal: number, consumerLinked: unknown): TriviaResult | null {
  const attempt = record(value);
  if (!attempt || attempt.status !== "completed" || typeof consumerLinked !== "boolean") return null;
  const integer = (value: unknown) => natural(value) || typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return confirmedTriviaResult({ ok: true, score: integer(attempt.score), total: integer(attempt.total_questions),
    pointsAwarded: integer(attempt.points_awarded), requiresLogin: !consumerLinked, alreadyCompleted: true }, expectedTotal);
}

export function triviaContextAvailable(eventId: string | null, tenantSlug: string | null, freshToken: string) {
  return Boolean(eventId && /^[1-9]\d{0,18}$/.test(eventId) && BigInt(eventId) <= 9223372036854775807n
    && tenantSlug && /^[a-z0-9][a-z0-9._-]{0,119}$/.test(tenantSlug) && freshToken.trim());
}

export const triviaRecoveryCopy = {
  "es-AR": {
    unavailableTitle: "Trivia no disponible", loadingTitle: "Cargando la trivia", loadingHelp: "En un momento podés consultar las preguntas de la marca.",
    submittingTitle: "Enviando tus respuestas", submittingHelp: "Esperá la confirmación del envío.", benefits: "Consultar mis beneficios",
    login: "Ingresá a tu cuenta para participar. Después acercá de nuevo el teléfono a la etiqueta del producto.",
    freshReading: "Acercá de nuevo el teléfono a la etiqueta del producto para participar.",
    unpublished: "La marca todavía no publicó una trivia para este producto.",
    uncertain: "No pudimos confirmar el envío. Conservamos tus respuestas. Revisá tu cuenta antes de volver a intentarlo.",
    unavailable: "La trivia no está disponible por el momento. Volvé a consultar más tarde.",
    notEnrolled: "La participación de tu cuenta no está habilitada para esta trivia. Consultá tus beneficios o contactá a la marca.",
    changed: "La marca cambió o retiró esta trivia. Conservamos tus respuestas para que las revises. Cargá la versión actual antes de participar de nuevo.",
    reload: "Cargar trivia actualizada", savedAnswers: "Tus respuestas anteriores", previous: "Estas respuestas se conservan como referencia. No se envían a una trivia nueva.",
  },
  en: {
    unavailableTitle: "Trivia unavailable", loadingTitle: "Loading the trivia", loadingHelp: "The brand's questions will be available in a moment.",
    submittingTitle: "Sending your answers", submittingHelp: "Please wait for confirmation.", benefits: "View my benefits",
    login: "Sign in to participate. Then hold your phone near the product's tag again.",
    freshReading: "Hold your phone near the product's tag again to participate.",
    unpublished: "The brand has not published trivia for this product yet.",
    uncertain: "We could not confirm your submission. Your answers are saved here. Check your account before trying again.",
    unavailable: "Trivia is temporarily unavailable. Please check again later.",
    notEnrolled: "Your account is not enabled to participate in this trivia. Check your benefits or contact the brand.",
    changed: "The brand changed or withdrew this trivia. Your answers are preserved for review. Load the current version before participating again.",
    reload: "Load updated trivia", savedAnswers: "Your previous answers", previous: "These answers are kept for reference. They are not submitted to a new quiz.",
  },
  "pt-BR": {
    unavailableTitle: "Trivia indisponível", loadingTitle: "Carregando a trivia", loadingHelp: "Em instantes você poderá consultar as perguntas da marca.",
    submittingTitle: "Enviando suas respostas", submittingHelp: "Aguarde a confirmação do envio.", benefits: "Consultar meus benefícios",
    login: "Entre na sua conta para participar. Depois aproxime novamente o telefone da etiqueta do produto.",
    freshReading: "Aproxime novamente o telefone da etiqueta do produto para participar.",
    unpublished: "A marca ainda não publicou uma trivia para este produto.",
    uncertain: "Não foi possível confirmar o envio. Suas respostas foram mantidas aqui. Confira sua conta antes de tentar novamente.",
    unavailable: "A trivia está temporariamente indisponível. Consulte novamente mais tarde.",
    notEnrolled: "Sua conta não está habilitada para participar desta trivia. Consulte seus benefícios ou entre em contato com a marca.",
    changed: "A marca alterou ou retirou esta trivia. Suas respostas foram preservadas para revisão. Carregue a versão atual antes de participar novamente.",
    reload: "Carregar trivia atualizada", savedAnswers: "Suas respostas anteriores", previous: "Estas respostas são mantidas como referência. Elas não são enviadas a uma nova trivia.",
  },
} as const;

export function triviaRecoveryDescription(error: string | null, canSubmit: boolean, locale: keyof typeof triviaRecoveryCopy = "es-AR") {
  const copy = triviaRecoveryCopy[locale];
  if (error === "quiz_configuration_changed") return copy.changed;
  if (error === "unauthorized") return copy.login;
  if (error === "consumer_not_enrolled") return copy.notEnrolled;
  if (!canSubmit || error === "fresh_tap_capability_required") return copy.freshReading;
  if (error === "quiz_not_configured") return copy.unpublished;
  if (error === "trivia_submit_failed" || error === "trivia_result_unconfirmed") return copy.uncertain;
  return copy.unavailable;
}

export function triviaSubmissionBody({ eventId, tenantSlug, freshToken, locale, answers, expectedQuizId, expectedQuizRevision }: {
  eventId: string | null; tenantSlug: string | null; freshToken: string; locale: string;
  answers: { questionId: string; answerIndex: number }[];
  expectedQuizId?: string; expectedQuizRevision?: string;
}) {
  if (!triviaContextAvailable(eventId, tenantSlug, freshToken)
    || !publishedQuizIdentity(expectedQuizId, expectedQuizRevision)
    || !answers.length || answers.length > 30 || answers.some(answer => !text(answer.questionId, 100) || !natural(answer.answerIndex) || answer.answerIndex > 9)) return null;
  return { locale: ["es-AR", "en", "pt-BR"].includes(locale) ? locale : "es-AR", tenantSlug, fresh_token: freshToken, expectedQuizId, expectedQuizRevision, answers };
}
