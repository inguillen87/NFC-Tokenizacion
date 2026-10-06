import { createHash } from "node:crypto";
import { sql } from "./db";
import { getActiveProgram, getTapEvent } from "./loyalty-service";
import { readCurrentTapCommercialRights } from "./tap-commercial-rights";
import { ensureConsumerPortalSchema } from "./commercial-runtime-schema";
import { isCurrentLoyaltyTapEligible, LOYALTY_TAP_RESULTS } from "./loyalty-tap-policy";

export type TriviaQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  insightTag: string;
};

export type ProductContext = {
  eventId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  vertical: string;
  city: string | null;
  country: string | null;
  productName: string;
  brandName: string;
  region: string;
  varietal: string;
  vintage: string;
  bid: string | null;
};

function cleanText(value: unknown, fallback = "") {
  const clean = String(value || "").trim();
  return clean || fallback;
}

function hashShort(value: string) {
  return createHash("sha256").update(value).digest("base64url").slice(0, 10).toLowerCase();
}

function normalizeVertical(value: unknown) {
  const clean = String(value || "").toLowerCase();
  if (clean.includes("wine") || clean.includes("vino") || clean.includes("bodega")) return "wine";
  if (clean.includes("agro") || clean.includes("seed") || clean.includes("semilla")) return "agro";
  if (clean.includes("event")) return "events";
  return clean.replace(/[^a-z0-9-]/g, "").slice(0, 32) || "other";
}

function isDurableEventId(value: string) {
  return /^[1-9]\d*$/.test(String(value || "").trim());
}

function isExplicitPreviewId(value: string) {
  return /^(?:preview|demo-preview):[a-z0-9._-]{1,80}$/i.test(String(value || "").trim());
}

function optionSet(correct: string, wrong: string[]) {
  return [correct, ...wrong].slice(0, 4);
}

export function buildDefaultTriviaQuestions(context: ProductContext): TriviaQuestion[] {
  const brand = context.brandName || context.tenantName || "la marca";
  const product = context.productName || "este producto";
  const region = context.region || context.city || "su zona de origen";
  const varietal = context.varietal || "su variedad principal";

  if (context.vertical === "agro") {
    return [
      {
        id: "agro-trust-01",
        prompt: `¿Por qué conviene verificar ${product} antes de comprar o sembrar?`,
        options: optionSet("Para confirmar origen, lote y trazabilidad", ["Para ocultar el proveedor", "Para cambiar la fecha del lote", "Para evitar registrar el tap"]),
        correctIndex: 0,
        explanation: "La verificación NFC protege al comprador y al productor: ata el producto físico a un lote y a un historial auditable.",
        insightTag: "agro-traceability-awareness",
      },
      {
        id: "agro-market-02",
        prompt: "¿Qué señal comercial es más útil para una campaña agro post-tap?",
        options: optionSet("Ciudad, cultivo/interés y producto consultado", ["Solo el color del packaging", "El horario del servidor", "La cantidad de botones del portal"]),
        correctIndex: 0,
        explanation: "Con ciudad e interés real, la empresa puede enviar asesoramiento, bonos o invitaciones sin disparar campañas genéricas.",
        insightTag: "agro-market-segmentation",
      },
      {
        id: "agro-risk-03",
        prompt: "Si un lote tiene señales de adulteración, ¿qué debería hacer el CRM?",
        options: optionSet("Bloquear beneficios y abrir revisión de riesgo", ["Premiarlo igual", "Borrar el evento", "Cambiarlo a válido sin auditoría"]),
        correctIndex: 0,
        explanation: "La fidelización solo sirve si también cuida confianza, stock y reputación de la marca.",
        insightTag: "agro-risk-education",
      },
    ];
  }

  return [
    {
      id: "wine-origin-01",
      prompt: `¿Qué dato confirma mejor la historia de ${product}?`,
      options: optionSet(`Origen declarado por ${brand} y lote asociado al evento NFC`, ["Una foto reenviada por chat", "Un precio escrito a mano", "Un comentario anónimo sin tap"]),
      correctIndex: 0,
      explanation: "El evento NFC vincula el mensaje del tag con el lote y el origen declarado por la marca; no prueba por si solo el origen ni el recorrido fisico.",
      insightTag: "wine-origin-literacy",
    },
    {
      id: "wine-terroir-02",
      prompt: `¿Qué vuelve accionable para ${brand} saber que este tap ocurrió en ${context.city || region}?`,
      options: optionSet("Permite activar beneficios, visitas o campañas por cercanía", ["Sirve solo para decorar un mapa", "Obliga a pedir contraseña antes del tap", "No aporta información comercial"]),
      correctIndex: 0,
      explanation: "La ubicación aproximada permite campañas por ciudad, ferias, vinotecas o cercanía a la bodega sin exponer datos sensibles.",
      insightTag: "geo-campaign-understanding",
    },
    {
      id: "wine-product-03",
      prompt: `Si ${product} es un ${varietal}, ¿qué experiencia premium tiene más sentido ofrecer después del tap?`,
      options: optionSet("Cata guiada, visita o voucher del club", ["Un formulario largo antes de ver el producto", "Un mensaje sin relación con el vino", "Un bloqueo sin explicación"]),
      correctIndex: 0,
      explanation: "La mejor fidelización aparece en el momento de interés: el cliente está frente al producto y la marca puede convertirlo en relación.",
      insightTag: "post-tap-experience-fit",
    },
  ];
}

function previewContext(input: {
  eventId: string;
  tenantSlug?: string | null;
  tenantName?: string | null;
  productName?: string | null;
  brandName?: string | null;
  city?: string | null;
  country?: string | null;
}): ProductContext {
  const tenantName = cleanText(input.tenantName, cleanText(input.brandName, "Bodega Balmec"));
  const brandName = cleanText(input.brandName, tenantName);
  return {
    eventId: input.eventId,
    tenantId: "00000000-0000-0000-0000-000000000000",
    tenantSlug: cleanText(input.tenantSlug, "bodega-balmec"),
    tenantName,
    vertical: normalizeVertical(tenantName || brandName || "wine"),
    city: cleanText(input.city, "Mendoza"),
    country: cleanText(input.country, "AR"),
    productName: cleanText(input.productName, "Gran Reserva Malbec"),
    brandName,
    region: "Mendoza",
    varietal: "Malbec",
    vintage: "",
    bid: null,
  };
}

function previewTrivia(input: {
  eventId: string;
  memberKey: string;
  tenantSlug?: string | null;
  tenantName?: string | null;
  productName?: string | null;
  brandName?: string | null;
  city?: string | null;
  country?: string | null;
}) {
  const context = previewContext(input);
  const questions = buildDefaultTriviaQuestions(context);
  return {
    ok: true as const,
    status: 200,
    preview: true,
    context,
    quiz: {
      id: `preview-${hashShort(input.eventId)}`,
      title: `Trivia post-tap ${context.productName}`,
      description: `Preguntas de conocimiento y preferencia para ${context.brandName}`,
      pointsPerCorrect: 10,
      completionBonus: 15,
      passThreshold: 2,
      questions: questions.map(publicTriviaQuestion),
    },
    member: {
      id: input.memberKey,
      status: "anonymous",
      pointsBalance: 0,
      consumerLinked: false,
    },
    previousAttempt: null,
  };
}

export function publicTriviaQuestion(question: TriviaQuestion) {
  return {
    id: question.id,
    prompt: question.prompt,
    options: question.options,
    explanation: question.explanation,
    insightTag: question.insightTag,
  };
}

export function scoreTriviaAnswers(questions: TriviaQuestion[], answers: Array<{ questionId?: string; answerIndex?: number } | number>) {
  const normalized = answers.map((answer, index) => {
    if (typeof answer === "number") return { questionId: questions[index]?.id, answerIndex: answer };
    return { questionId: answer?.questionId || questions[index]?.id, answerIndex: Number.isSafeInteger(answer?.answerIndex) ? answer.answerIndex : -1 };
  });
  let score = 0;
  const details = questions.map((question, index) => {
    const answer = normalized.find((item) => item.questionId === question.id) || normalized[index];
    const answerIndex = Number.isSafeInteger(answer?.answerIndex) ? Number(answer?.answerIndex) : -1;
    const correct = answerIndex === question.correctIndex;
    if (correct) score += 1;
    return {
      questionId: question.id,
      prompt: question.prompt,
      answerIndex,
      correctIndex: question.correctIndex,
      correct,
      insightTag: question.insightTag,
      explanation: question.explanation,
    };
  });
  return { score, total: questions.length, details };
}

export async function loadProductContext(eventId: string): Promise<ProductContext | null> {
  const rows = await sql/*sql*/`
    SELECT
      e.id,
      e.tenant_id,
      e.city,
      e.country_code,
      e.uid_hex,
      ten.slug AS tenant_slug,
      ten.name AS tenant_name,
      b.bid,
      tp.product_name,
      tp.winery,
      tp.region,
      tp.grape_varietal,
      tp.vintage,
      sp.vertical
    FROM events e
    JOIN tenants ten ON ten.id = e.tenant_id
    LEFT JOIN batches b ON b.id = e.batch_id AND b.tenant_id = e.tenant_id
    LEFT JOIN tags tg ON UPPER(tg.uid_hex) = UPPER(e.uid_hex) AND tg.batch_id = b.id
    LEFT JOIN tag_profiles tp ON tp.tag_id = tg.id
    LEFT JOIN tenant_sun_profiles sp ON sp.tenant_id = e.tenant_id
    WHERE e.id = ${eventId}
    ORDER BY tg.created_at ASC NULLS LAST
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  const tenantName = cleanText(row.tenant_name, row.tenant_slug || "nexID tenant");
  const brandName = cleanText(row.winery, tenantName);
  return {
    eventId: String(row.id),
    tenantId: String(row.tenant_id),
    tenantSlug: cleanText(row.tenant_slug),
    tenantName,
    vertical: normalizeVertical(row.vertical || row.winery || row.tenant_name),
    city: row.city || null,
    country: row.country_code || null,
    productName: cleanText(row.product_name, cleanText(row.grape_varietal, "Producto asociado")),
    brandName,
    region: cleanText(row.region, cleanText(row.city, "origen informado")),
    varietal: cleanText(row.grape_varietal, "vino premium"),
    vintage: cleanText(row.vintage),
    bid: row.bid || null,
  };
}

export async function findConfiguredQuizForTap(context: ProductContext, program: any) {
  const code = `posttap-${context.vertical}-${hashShort(`${program.id}:${context.productName}:${context.brandName}:${context.region}`)}`;
  return (await sql/*sql*/`
    SELECT *, starts_at::text AS configuration_starts_at, ends_at::text AS configuration_ends_at, updated_at::text AS configuration_updated_at
    FROM loyalty_quizzes
    WHERE tenant_id = ${context.tenantId}
      AND program_id = ${program.id}
      AND (code = ${code} OR (
        product_filter_json @> ${JSON.stringify({ managedBy: 'nexid.tenant-loyalty.v1', scope: 'tenant', vertical: context.vertical })}::jsonb
        AND vertical = ${context.vertical}
        AND ${program.vertical === context.vertical}
      ))
      AND status = 'active'
      AND starts_at <= now()
      AND (ends_at IS NULL OR ends_at >= now())
    ORDER BY CASE WHEN code = ${code} THEN 0 ELSE 1 END, starts_at DESC, id ASC
    LIMIT 1
  `)[0];
}

function questionsFromQuiz(quiz: any): TriviaQuestion[] {
  try {
    const raw = typeof quiz.questions_json === "string" ? JSON.parse(quiz.questions_json || "[]") : quiz.questions_json;
    return Array.isArray(raw) ? raw as TriviaQuestion[] : [];
  } catch { return []; }
}

function stableJson(value: any): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value ?? null);
}

function quizConfiguration(quiz: any) {
  return Object.fromEntries(['id','tenant_id','program_id','code','title','description','vertical','product_filter_json','status','starts_at','ends_at','questions_json','points_per_correct','completion_bonus','pass_threshold','updated_at'].map(key => [key, quiz[`configuration_${key}`] ?? quiz[key] ?? null]));
}

export function quizRevision(quiz: any, program: any) {
  return createHash('sha256').update(stableJson({ quiz: quizConfiguration(quiz), program: { id: program.id, rules: program.rules_json, status: program.status, starts: program.configuration_start_at ?? program.start_at, ends: program.configuration_end_at ?? program.end_at, updated: program.configuration_updated_at ?? program.updated_at } })).digest('hex');
}

function hasValidQuizPolicy(quiz: any) {
  const questions = questionsFromQuiz(quiz);
  return questions.length > 0 && questions.length <= 50 &&
    new Set(questions.map(question => question?.id)).size === questions.length &&
    questions.every(question => question && typeof question.id === 'string' && question.id.length > 0 && typeof question.prompt === 'string' && Array.isArray(question.options) && question.options.length >= 2 && question.options.every(option => typeof option === 'string') && Number.isSafeInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < question.options.length) &&
    [quiz.points_per_correct, quiz.completion_bonus, quiz.pass_threshold].every(value => Number.isSafeInteger(value) && value >= 0) && quiz.pass_threshold <= questions.length &&
    quiz.points_per_correct * questions.length + quiz.completion_bonus <= 1_000_000;
}

// Shared by the anonymous projection and authenticated setup. This is read-only:
// it does not enroll a member, initialize schema or expose scoring answer keys.
export async function getPublishedTriviaForEvent(eventId: string, program: any) {
  const now = Date.now();
  if (!program || program.status !== 'active' || !(new Date(program.start_at).getTime() <= now) || (program.end_at != null && !(new Date(program.end_at).getTime() >= now))) return null;
  const context = await loadProductContext(eventId);
  if (!context || String(program.tenant_id) !== context.tenantId) return null;
  const quiz = await findConfiguredQuizForTap(context, program);
  if (!quiz || !hasValidQuizPolicy(quiz)) return null;
  return { id: String(quiz.id), title: quiz.title, revision: quizRevision(quiz, program), pointsPerCorrect: quiz.points_per_correct, completionBonus: quiz.completion_bonus };
}

export async function getTriviaForTap(input: {
  eventId: string;
  memberKey: string;
  consumerId?: string | null;
  email?: string | null;
  phone?: string | null;
  locale?: string | null;
  tenantSlug?: string | null;
  tenantName?: string | null;
  productName?: string | null;
  brandName?: string | null;
  city?: string | null;
  country?: string | null;
}) {
  if (isExplicitPreviewId(input.eventId)) return previewTrivia(input);
  if (!isDurableEventId(input.eventId)) return { ok: false as const, status: 400, error: "invalid_event_id" as const };
  if (!input.consumerId) return { ok: false as const, status: 401, error: "consumer_auth_required" as const };

  const event = await getTapEvent(input.eventId);
  if (!event) return { ok: false as const, status: 404, error: "event_not_found" as const };
  if (!isCurrentLoyaltyTapEligible(event)) {
    return { ok: false as const, status: 403, error: "tap_commercial_rights_blocked" as const };
  }
  const program = await getActiveProgram(event.tenant_id);
  if (!program) return { ok: false as const, status: 404, error: "program_not_found" as const };
  const context = await loadProductContext(String(event.id));
  if (!context) return { ok: false as const, status: 404, error: "context_not_found" as const };
  const quiz = await findConfiguredQuizForTap(context, program);
  if (!quiz) return { ok: false as const, status: 404, error: "quiz_not_configured" as const };
  if (!hasValidQuizPolicy(quiz)) return { ok: false as const, status: 409, error: 'quiz_configuration_changed' as const };
  const member = (await sql/*sql*/`
    SELECT member.*
    FROM loyalty_members member
    JOIN consumers consumer ON consumer.id = member.consumer_id
    WHERE member.tenant_id = ${event.tenant_id}
      AND member.program_id = ${program.id}
      AND member.consumer_id = ${input.consumerId}
      AND member.status IN ('enrolled', 'verified')
      AND consumer.status IN ('anonymous', 'registered', 'verified')
      AND NOT EXISTS (
        SELECT 1 FROM tenant_consumer_memberships membership
        WHERE membership.tenant_id = member.tenant_id
          AND membership.consumer_id = member.consumer_id
          AND membership.status IS DISTINCT FROM 'active'
      )
    LIMIT 1
  `)[0];
  if (!member) return { ok: false as const, status: 409, error: "consumer_not_enrolled" as const };
  const attempt = (await sql/*sql*/`
    SELECT id, score, total_questions, points_awarded, status, created_at
    FROM loyalty_quiz_attempts
    WHERE quiz_id = ${quiz.id}
      AND member_id = ${member.id}
      AND tap_event_id = ${event.id}
    ORDER BY created_at DESC
    LIMIT 1
  `)[0] || null;
  const questions = questionsFromQuiz(quiz);
  return {
    ok: true as const,
    status: 200,
    context,
    quiz: {
      id: quiz.id,
      revision: quizRevision(quiz, program),
      title: quiz.title,
      description: quiz.description,
      pointsPerCorrect: quiz.points_per_correct,
      completionBonus: quiz.completion_bonus,
      passThreshold: quiz.pass_threshold,
      questions: questions.map(publicTriviaQuestion),
    },
    member: {
      id: member.id,
      status: member.status,
      pointsBalance: member.points_balance,
      consumerLinked: Boolean(input.consumerId),
    },
    previousAttempt: attempt,
  };
}

export async function submitTriviaForTap(input: {
  eventId: string;
  memberKey: string;
  answers: Array<{ questionId?: string; answerIndex?: number } | number>;
  expectedQuizId?: string;
  expectedQuizRevision?: string;
  consumerId?: string | null;
  email?: string | null;
  phone?: string | null;
  locale?: string | null;
  tenantSlug?: string | null;
  tenantName?: string | null;
  productName?: string | null;
  brandName?: string | null;
  city?: string | null;
  country?: string | null;
}) {
  if (!Array.isArray(input.answers) || input.answers.length > 50 || input.answers.some(answer => {
    if (typeof answer === 'number') return !Number.isSafeInteger(answer) || answer < 0;
    return !answer || typeof answer !== 'object' || Array.isArray(answer) || !Number.isSafeInteger(answer.answerIndex) || Number(answer.answerIndex) < 0
      || (answer.questionId !== undefined && (typeof answer.questionId !== 'string' || !answer.questionId || answer.questionId.length > 200));
  })) return { ok: false as const, status: 400, error: 'invalid_trivia_answers' as const };
  if (isExplicitPreviewId(input.eventId)) {
    const setup = previewTrivia(input);
    const questions = buildDefaultTriviaQuestions(setup.context);
    const scoring = scoreTriviaAnswers(questions, input.answers || []);
    const pointsAwarded = scoring.score * setup.quiz.pointsPerCorrect + (scoring.score >= setup.quiz.passThreshold ? setup.quiz.completionBonus : 0);
    return {
      ok: true as const,
      status: 200,
      preview: true,
      score: scoring.score,
      total: scoring.total,
      pointsAwarded,
      requiresLogin: true,
      attempt: null,
      explanations: scoring.details,
      member: setup.member,
    };
  }
  if (!isDurableEventId(input.eventId)) return { ok: false as const, status: 400, error: "invalid_event_id" as const };
  if (!input.consumerId) return { ok: false as const, status: 401, error: "consumer_auth_required" as const };

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.expectedQuizId || '') || !/^[0-9a-f]{64}$/.test(input.expectedQuizRevision || '')) {
    return { ok: false as const, status: 409, error: 'quiz_configuration_changed' as const };
  }
  // An explicitly identified old operation may recover its stored receipt even
  // after withdrawal. It cannot select another quiz or recompute old results.
  const receipt = (await sql/*sql*/`
    SELECT attempt.*, loyalty_member.points_balance
    FROM loyalty_quiz_attempts attempt
    JOIN events source_event ON source_event.id = attempt.tap_event_id AND source_event.tenant_id = attempt.tenant_id
    JOIN loyalty_members loyalty_member ON loyalty_member.id = attempt.member_id
      AND loyalty_member.tenant_id = attempt.tenant_id AND loyalty_member.program_id = attempt.program_id
      AND loyalty_member.consumer_id = attempt.consumer_id
    WHERE attempt.quiz_id = ${input.expectedQuizId} AND attempt.tap_event_id = ${input.eventId}::bigint
      AND attempt.consumer_id = ${input.consumerId} AND attempt.status = 'completed'
    LIMIT 1
  `)[0];
  if (receipt) return storedTriviaResult(receipt, input, true);

  const setup = await getTriviaForTap(input);
  if (!setup.ok) return setup;

  const event = await getTapEvent(input.eventId);
  const program = event ? await getActiveProgram(event.tenant_id) : null;
  if (!event || !program) return { ok: false as const, status: 404, error: "event_not_found" as const };
  if (!isCurrentLoyaltyTapEligible(event)) return { ok: false as const, status: 403, error: "tap_commercial_rights_blocked" as const };
  const currentRights = await readCurrentTapCommercialRights(event.id);
  if (!currentRights.allowed) {
    return { ok: false as const, status: currentRights.reason === "manual_opening_declared" ? 403 : 503, error: currentRights.reason };
  }

  const member = (await sql/*sql*/`
    SELECT *
    FROM loyalty_members
    WHERE tenant_id = ${event.tenant_id}
      AND program_id = ${program.id}
      AND consumer_id = ${input.consumerId}
      AND status IN ('enrolled', 'verified')
    LIMIT 1
  `)[0];
  if (!member) return { ok: false as const, status: 409, error: "consumer_not_enrolled" as const };
  const quiz = await findConfiguredQuizForTap(setup.context, program);
  if (!quiz) return { ok: false as const, status: 404, error: "quiz_not_configured" as const };
  if (String(quiz.id) !== input.expectedQuizId || quizRevision(quiz, program) !== input.expectedQuizRevision || !hasValidQuizPolicy(quiz)) return { ok: false as const, status: 409, error: 'quiz_configuration_changed' as const };
  const questions = questionsFromQuiz(quiz);
  if (input.answers.length !== questions.length) return { ok: false as const, status: 400, error: 'invalid_trivia_answers' as const };
  const answeredIds = new Set<string>();
  for (const [index, answer] of input.answers.entries()) {
    const question = typeof answer === 'number' || answer.questionId === undefined ? questions[index] : questions.find(question => question.id === answer.questionId);
    const answerIndex = typeof answer === 'number' ? answer : Number(answer.answerIndex);
    if (!question || answerIndex >= question.options.length || answeredIds.has(question.id)) return { ok: false as const, status: 400, error: 'invalid_trivia_answers' as const };
    answeredIds.add(question.id);
  }
  if (answeredIds.size !== questions.length) return { ok: false as const, status: 400, error: 'invalid_trivia_answers' as const };
  const idempotencyKey = `quiz:${quiz.id}:event:${event.id}:member:${member.id}`;
  const ledgerIdempotencyKey = `${idempotencyKey}:points`;
  const scoring = scoreTriviaAnswers(questions, input.answers || []);
  const pointsPerCorrect = quiz.points_per_correct;
  const completionBonus = scoring.score >= quiz.pass_threshold ? quiz.completion_bonus : 0;
  const pointsToAward = scoring.score * pointsPerCorrect + completionBonus;
  await ensureConsumerPortalSchema();
  const awardMetadata = JSON.stringify({
    quizId: quiz.id,
    score: scoring.score,
    total: scoring.total,
    city: event.city || null,
    productName: setup.context.productName,
    brandName: setup.context.brandName,
    insightTags: scoring.details.map((detail) => detail.insightTag),
  });
  const attemptMetadata = JSON.stringify({
    city: event.city || null,
    country: event.country_code || null,
    productName: setup.context.productName,
    brandName: setup.context.brandName,
    region: setup.context.region,
    vertical: setup.context.vertical,
    pointsPerCorrect,
    completionBonus,
    quizRevision: input.expectedQuizRevision,
  });
  const atomicRows = await sql/*sql*/`
    WITH current_tag AS MATERIALIZED (
      SELECT tag.id
      FROM events source_event
      JOIN batches bound_batch ON bound_batch.id = source_event.batch_id AND bound_batch.tenant_id = source_event.tenant_id
      JOIN tags tag ON tag.batch_id = source_event.batch_id AND UPPER(tag.uid_hex) = UPPER(source_event.uid_hex)
      WHERE source_event.id = ${event.id}::bigint
        AND source_event.tenant_id = ${event.tenant_id}
        AND UPPER(source_event.result) = ANY(${[...LOYALTY_TAP_RESULTS]}::text[])
        AND BTRIM(COALESCE(source_event.uid_hex, '')) <> ''
        AND tag.status = 'active'
        AND tag.xmin::text = ${event.current_tag_revision ?? null}
        AND COALESCE(tag.lifecycle_state, tag.status::text) = 'active'
        AND NOT EXISTS (SELECT 1 FROM tags ambiguous_tag WHERE ambiguous_tag.batch_id = tag.batch_id AND UPPER(ambiguous_tag.uid_hex) = UPPER(tag.uid_hex) AND ambiguous_tag.id <> tag.id)
      FOR SHARE OF tag
    ), tap_rights AS MATERIALIZED (
      SELECT true AS allowed
      FROM events source_event
      JOIN current_tag ON true
      LEFT JOIN tag_manual_tamper_overrides manual_override
        ON manual_override.batch_id = source_event.batch_id
       AND UPPER(manual_override.uid_hex) = UPPER(source_event.uid_hex)
      WHERE source_event.id = ${event.id}::bigint
        AND UPPER(COALESCE(source_event.result, '')) NOT IN ('MANUAL_OPENED', 'VALID_MANUAL_OPENED')
        AND regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%MANUAL_TAMPER_OPENED%'
        AND regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%MANUAL_OPENED%'
        AND regexp_replace(UPPER(COALESCE(source_event.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%OPERATOR_DECLARED_OPEN%'
        AND UPPER(BTRIM(COALESCE(manual_override.tamper_status, ''))) NOT IN ('MANUAL_OPENED', 'OPENED')
        AND regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%MANUAL_TAMPER_OPENED%'
        AND regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%MANUAL_OPENED%'
        AND regexp_replace(UPPER(COALESCE(manual_override.reason, '')), '[[:space:]-]+', '_', 'g') NOT LIKE '%OPERATOR_DECLARED_OPEN%'
    ),
    locked_program AS MATERIALIZED (
      SELECT current_program.* FROM loyalty_programs current_program JOIN tap_rights ON true
      WHERE current_program.id = ${program.id} AND current_program.tenant_id = ${event.tenant_id}
      FOR SHARE OF current_program
    ), locked_quiz AS MATERIALIZED (
      SELECT current_quiz.* FROM loyalty_quizzes current_quiz JOIN locked_program ON true
      WHERE current_quiz.id = ${quiz.id} AND current_quiz.tenant_id = ${event.tenant_id} AND current_quiz.program_id = ${program.id}
      FOR SHARE OF current_quiz
    ), locked_member AS MATERIALIZED (
      SELECT member.id, member.points_balance, member.lifetime_points
      FROM loyalty_members member
      JOIN tap_rights ON tap_rights.allowed = true
      JOIN locked_quiz ON true
      WHERE member.id = ${member.id}
        AND member.tenant_id = ${event.tenant_id}
        AND member.program_id = ${program.id}
        AND member.consumer_id = ${input.consumerId}
        AND member.status IN ('enrolled', 'verified')
      FOR UPDATE OF member
    ), locked_membership AS MATERIALIZED (
      SELECT membership.status FROM tenant_consumer_memberships membership JOIN locked_member ON true
      WHERE membership.tenant_id = ${event.tenant_id} AND membership.consumer_id = ${input.consumerId}
      FOR UPDATE OF membership
    ), eligible_member AS MATERIALIZED (
      SELECT locked_member.* FROM locked_member JOIN locked_program ON true JOIN locked_quiz ON true
      WHERE locked_program.status = 'active' AND locked_program.start_at <= clock_timestamp()
        AND (locked_program.end_at IS NULL OR locked_program.end_at >= clock_timestamp())
        AND locked_program.rules_json = ${JSON.stringify(program.rules_json)}::jsonb
        AND locked_program.start_at IS NOT DISTINCT FROM ${program.configuration_start_at}::timestamptz
        AND locked_program.end_at IS NOT DISTINCT FROM ${program.configuration_end_at}::timestamptz
        AND locked_program.updated_at IS NOT DISTINCT FROM ${program.configuration_updated_at}::timestamptz
        AND locked_quiz.status = 'active' AND locked_quiz.starts_at <= clock_timestamp()
        AND (locked_quiz.ends_at IS NULL OR locked_quiz.ends_at >= clock_timestamp())
        AND locked_quiz.starts_at IS NOT DISTINCT FROM ${quiz.configuration_starts_at}::timestamptz
        AND locked_quiz.ends_at IS NOT DISTINCT FROM ${quiz.configuration_ends_at}::timestamptz
        AND locked_quiz.updated_at IS NOT DISTINCT FROM ${quiz.configuration_updated_at}::timestamptz
        AND jsonb_build_object('id',locked_quiz.id,'tenant_id',locked_quiz.tenant_id,'program_id',locked_quiz.program_id,'code',locked_quiz.code,'title',locked_quiz.title,'description',locked_quiz.description,'vertical',locked_quiz.vertical,'product_filter_json',locked_quiz.product_filter_json,'status',locked_quiz.status,'questions_json',locked_quiz.questions_json,'points_per_correct',locked_quiz.points_per_correct,'completion_bonus',locked_quiz.completion_bonus,'pass_threshold',locked_quiz.pass_threshold)
          = ${JSON.stringify(Object.fromEntries(Object.entries(quizConfiguration(quiz)).filter(([key]) => !['starts_at','ends_at','updated_at'].includes(key))))}::jsonb
        AND NOT EXISTS (SELECT 1 FROM locked_membership WHERE status IS DISTINCT FROM 'active')
    ),
    reserved_attempt AS MATERIALIZED (
      INSERT INTO loyalty_quiz_attempts (
        tenant_id, program_id, quiz_id, member_id, tap_event_id, consumer_id,
        score, total_questions, points_awarded, answers_json, status, idempotency_key, metadata_json
      )
      SELECT
        ${event.tenant_id}, ${program.id}, ${quiz.id}, locked_member.id, ${event.id}, ${input.consumerId},
        ${scoring.score}, ${scoring.total}, ${pointsToAward}, ${JSON.stringify(scoring.details)}::jsonb,
        'completed', ${idempotencyKey}, ${attemptMetadata}::jsonb
      FROM eligible_member locked_member
      WHERE ${pointsToAward} = 0 OR NOT EXISTS (
        SELECT 1 FROM points_ledger WHERE idempotency_key = ${ledgerIdempotencyKey}
      )
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING *
    ),
    reserved_ledger AS MATERIALIZED (
      INSERT INTO points_ledger (
        tenant_id, program_id, member_id, tap_event_id, source, delta,
        balance_after, idempotency_key, reason, metadata_json
      )
      SELECT
        ${event.tenant_id}, ${program.id}, locked_member.id, ${event.id},
        'QUIZ_COMPLETED'::points_source, ${pointsToAward}, locked_member.points_balance + ${pointsToAward}, ${ledgerIdempotencyKey},
        ${`Trivia ${quiz.code}`}, ${awardMetadata}::jsonb
      FROM locked_member, reserved_attempt
      WHERE ${pointsToAward} > 0
      RETURNING id
    ),
    award_gate AS MATERIALIZED (
      SELECT
        reserved_attempt.id AS attempt_id,
        locked_member.id AS member_id,
        CASE WHEN ${pointsToAward} = 0 OR reserved_ledger.id IS NOT NULL THEN ${pointsToAward} ELSE 0 END AS awarded_points
      FROM reserved_attempt
      JOIN locked_member ON true
      LEFT JOIN reserved_ledger ON true
      WHERE ${pointsToAward} = 0 OR reserved_ledger.id IS NOT NULL
    ),
    updated_member AS MATERIALIZED (
      UPDATE loyalty_members loyalty_member
      SET points_balance = loyalty_member.points_balance + award_gate.awarded_points,
          lifetime_points = loyalty_member.lifetime_points + award_gate.awarded_points,
          updated_at = now()
      FROM award_gate
      WHERE loyalty_member.id = award_gate.member_id
      RETURNING loyalty_member.id, loyalty_member.points_balance, loyalty_member.lifetime_points, award_gate.attempt_id, award_gate.awarded_points
    ),
    projected_membership AS MATERIALIZED (
      INSERT INTO tenant_consumer_memberships (
        tenant_id, consumer_id, loyalty_program_id, source, first_tap_event_id,
        last_tap_event_id, status, points_balance, lifetime_points, metadata_json
      )
      SELECT ${event.tenant_id}, ${input.consumerId}, ${program.id}, 'trivia', ${event.id},
        ${event.id}, 'active', updated_member.points_balance, updated_member.lifetime_points,
        '{"pointsProjectionSource":"loyalty_members"}'::jsonb
      FROM updated_member
      WHERE true
      ON CONFLICT (tenant_id, consumer_id) DO UPDATE SET
        points_balance = EXCLUDED.points_balance,
        lifetime_points = EXCLUDED.lifetime_points,
        loyalty_program_id = EXCLUDED.loyalty_program_id,
        last_tap_event_id = EXCLUDED.last_tap_event_id,
        last_activity_at = now(),
        metadata_json = COALESCE(tenant_consumer_memberships.metadata_json, '{}'::jsonb) || EXCLUDED.metadata_json,
        updated_at = now()
      WHERE tenant_consumer_memberships.status = 'active'
      RETURNING id
    )
    SELECT reserved_attempt.id, reserved_attempt.score, reserved_attempt.total_questions,
           reserved_attempt.points_awarded, reserved_attempt.status, reserved_attempt.created_at,
           reserved_attempt.answers_json, reserved_attempt.metadata_json, reserved_attempt.member_id,
           updated_member.points_balance,
           1 / (SELECT count(*)::integer FROM projected_membership) AS membership_projection_guard
    FROM reserved_attempt JOIN updated_member ON updated_member.attempt_id = reserved_attempt.id
  `.catch((error: unknown) => {
    const pgError = error as { code?: string; constraint?: string };
    // A colliding ledger reservation must roll back the entire statement,
    // including its new completed attempt and projection. Normal repeats are
    // already handled by the attempt reservation's ON CONFLICT above.
    if (pgError?.code === "23505" && pgError.constraint === "points_ledger_idempotency_key_key") return null;
    // If a previously absent membership is concurrently inserted as blocked,
    // the guarded projection returns no row. Fail the whole statement so its
    // attempt, credit and member balance cannot partially commit.
    if (pgError?.code === '22012') return null;
    throw error;
  });
  if (!atomicRows) return { ok: false as const, status: 503, error: "quiz_completion_unavailable" as const };
  const attempt = atomicRows[0] || (await sql/*sql*/`
    SELECT attempt.id, attempt.score, attempt.total_questions, attempt.points_awarded, attempt.status, attempt.created_at, attempt.answers_json, attempt.metadata_json, attempt.member_id,
           loyalty_member.points_balance
    FROM loyalty_quiz_attempts attempt
    JOIN loyalty_members loyalty_member ON loyalty_member.id = attempt.member_id
    WHERE attempt.idempotency_key = ${idempotencyKey}
      AND attempt.tenant_id = ${event.tenant_id}
      AND attempt.program_id = ${program.id}
      AND attempt.member_id = ${member.id}
      AND attempt.consumer_id = ${input.consumerId}
    LIMIT 1
  `)[0];
  if (!attempt || String(attempt.status) !== "completed") {
    const orphanLedger = (await sql/*sql*/`
      SELECT id FROM points_ledger WHERE idempotency_key = ${ledgerIdempotencyKey}
        AND tenant_id = ${event.tenant_id} AND program_id = ${program.id} AND member_id = ${member.id}
      LIMIT 1
    `)[0];
    if (orphanLedger) return { ok: false as const, status: 503, error: 'quiz_completion_unavailable' as const };
    return { ok: false as const, status: 409, error: 'quiz_configuration_changed' as const };
  }
  const duplicateAttempt = atomicRows.length === 0;

  return storedTriviaResult(attempt, input, duplicateAttempt);
}

function storedTriviaResult(attempt: any, input: { answers: Array<{questionId?: string;answerIndex?: number}|number>; expectedQuizRevision?: string; consumerId?: string|null }, duplicateAttempt: boolean) {
  const details = typeof attempt.answers_json === 'string' ? JSON.parse(attempt.answers_json) : attempt.answers_json;
  const metadata = typeof attempt.metadata_json === 'string' ? JSON.parse(attempt.metadata_json) : attempt.metadata_json;
  if (!Array.isArray(details) || (metadata?.quizRevision && metadata.quizRevision !== input.expectedQuizRevision)) return { ok: false as const, status: 409, error: 'quiz_configuration_changed' as const };
  const received = scoreTriviaAnswers(details.map(detail => ({id:detail.questionId,...detail})), input.answers || []).details;
  if (received.some((answer,index) => answer.questionId !== details[index]?.questionId || answer.answerIndex !== details[index]?.answerIndex)) return { ok: false as const, status: 409, error: 'quiz_answers_changed' as const };
  return {
    ok: true as const,
    status: 200,
    score: Number(attempt.score),
    total: Number(attempt.total_questions),
    pointsAwarded: Number(attempt.points_awarded || 0),
    duplicateAttempt,
    alreadyCompleted: duplicateAttempt,
    requiresLogin: !input.consumerId,
    attempt,
    explanations: details,
    member: {
      id: attempt.member_id,
      pointsBalance: Number(attempt.points_balance || 0),
      consumerLinked: Boolean(input.consumerId),
    },
  };
}
