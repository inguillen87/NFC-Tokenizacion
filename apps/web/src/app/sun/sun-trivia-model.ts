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

export function triviaRecoveryDescription(error: string | null, canSubmit: boolean) {
  if (error === "unauthorized") return "Ingresá a tu cuenta para consultar la trivia publicada por la marca. Después realizá una nueva lectura NFC para participar.";
  if (!canSubmit || error === "fresh_tap_capability_required") return "Para participar necesitás una lectura NFC nueva con autorización vigente. Esta consulta no confirma respuestas, puntos ni premios.";
  if (error === "quiz_not_configured") return "La marca no tiene una trivia publicada para este producto. No se sustituyen sus preguntas por ejemplos.";
  if (error === "trivia_submit_failed" || error === "trivia_result_unconfirmed") return "No pudimos confirmar el envío. Conservamos tus respuestas en esta pantalla; no se confirman puntos ni se repite el envío. Consultá tu cuenta o realizá una nueva lectura NFC.";
  return "No pudimos consultar la trivia publicada. No se muestran preguntas ni beneficios sin confirmar su fuente.";
}

export function triviaSubmissionBody({ eventId, tenantSlug, freshToken, locale, answers }: {
  eventId: string | null; tenantSlug: string | null; freshToken: string; locale: string;
  answers: { questionId: string; answerIndex: number }[];
}) {
  if (!triviaContextAvailable(eventId, tenantSlug, freshToken)
    || !answers.length || answers.length > 30 || answers.some(answer => !text(answer.questionId, 100) || !natural(answer.answerIndex) || answer.answerIndex > 9)) return null;
  return { locale: ["es-AR", "en", "pt-BR"].includes(locale) ? locale : "es-AR", tenantSlug, fresh_token: freshToken, answers };
}
