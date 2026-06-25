import { createHash } from "node:crypto";
import { sql } from "./db";
import { ensureLoyaltySchema } from "./loyalty-schema";
import { awardPoints, getActiveProgram, getOrCreateMember, getTapEvent } from "./loyalty-service";
import { ensureTenantMembership } from "./consumer-portal-service";

export type TriviaQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  insightTag: string;
};

type ProductContext = {
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
      options: optionSet(`Origen verificado por NFC y lote de ${brand}`, ["Una foto reenviada por chat", "Un precio escrito a mano", "Un comentario anónimo sin tap"]),
      correctIndex: 0,
      explanation: "El tap físico vincula producto, lote, ubicación y marca. Eso convierte la experiencia en dato comercial confiable.",
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
    return { questionId: answer.questionId || questions[index]?.id, answerIndex: Number(answer.answerIndex) };
  });
  let score = 0;
  const details = questions.map((question, index) => {
    const answer = normalized.find((item) => item.questionId === question.id) || normalized[index];
    const answerIndex = Number.isFinite(answer?.answerIndex) ? Number(answer?.answerIndex) : -1;
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

async function loadProductContext(eventId: string): Promise<ProductContext | null> {
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
    LEFT JOIN batches b ON b.id = e.batch_id
    LEFT JOIN tags tg ON tg.uid_hex = e.uid_hex AND (e.batch_id IS NULL OR tg.batch_id = e.batch_id)
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
    productName: cleanText(row.product_name, cleanText(row.grape_varietal, "Producto verificado")),
    brandName,
    region: cleanText(row.region, cleanText(row.city, "origen verificado")),
    varietal: cleanText(row.grape_varietal, "vino premium"),
    vintage: cleanText(row.vintage),
    bid: row.bid || null,
  };
}

async function ensureQuizForTap(context: ProductContext, program: any) {
  await ensureLoyaltySchema();
  const code = `posttap-${context.vertical}-${hashShort(`${program.id}:${context.productName}:${context.brandName}:${context.region}`)}`;
  const questions = buildDefaultTriviaQuestions(context);
  const existing = (await sql/*sql*/`
    SELECT *
    FROM loyalty_quizzes
    WHERE program_id = ${program.id}
      AND code = ${code}
      AND status = 'active'
      AND starts_at <= now()
      AND (ends_at IS NULL OR ends_at >= now())
    LIMIT 1
  `)[0];
  if (existing) return existing;

  return (await sql/*sql*/`
    INSERT INTO loyalty_quizzes (
      tenant_id, program_id, code, title, description, vertical, product_filter_json,
      questions_json, points_per_correct, completion_bonus, pass_threshold, status
    )
    VALUES (
      ${context.tenantId},
      ${program.id},
      ${code},
      ${`Trivia post-tap ${context.productName}`},
      ${`Preguntas de conocimiento y preferencia para ${context.brandName}`},
      ${context.vertical},
      ${JSON.stringify({ productName: context.productName, brandName: context.brandName, region: context.region, bid: context.bid })}::jsonb,
      ${JSON.stringify(questions)}::jsonb,
      10,
      15,
      2,
      'active'
    )
    ON CONFLICT (program_id, code)
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      product_filter_json = EXCLUDED.product_filter_json,
      updated_at = now()
    RETURNING *
  `)[0];
}

function questionsFromQuiz(quiz: any): TriviaQuestion[] {
  const raw = typeof quiz.questions_json === "string" ? JSON.parse(quiz.questions_json || "[]") : quiz.questions_json;
  return Array.isArray(raw) ? raw as TriviaQuestion[] : [];
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
  if (!isUuid(input.eventId)) return previewTrivia(input);

  const event = await getTapEvent(input.eventId);
  if (!event) return { ok: false as const, status: 404, error: "event_not_found" as const };
  const program = await getActiveProgram(event.tenant_id);
  if (!program) return { ok: false as const, status: 404, error: "program_not_found" as const };
  const context = await loadProductContext(String(event.id));
  if (!context) return { ok: false as const, status: 404, error: "context_not_found" as const };
  const quiz = await ensureQuizForTap(context, program);
  const member = await getOrCreateMember({
    tenantId: event.tenant_id,
    programId: program.id,
    eventId: String(event.id),
    memberKey: input.memberKey,
    consumerId: input.consumerId || null,
    locale: input.locale || "es-AR",
    email: input.email || null,
    phone: input.phone || null,
    country: event.country_code || null,
  });
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
      title: quiz.title,
      description: quiz.description,
      pointsPerCorrect: Number(quiz.points_per_correct || 10),
      completionBonus: Number(quiz.completion_bonus || 0),
      passThreshold: Number(quiz.pass_threshold || 1),
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
  if (!isUuid(input.eventId)) {
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

  const setup = await getTriviaForTap(input);
  if (!setup.ok) return setup;

  const event = await getTapEvent(input.eventId);
  const program = event ? await getActiveProgram(event.tenant_id) : null;
  if (!event || !program) return { ok: false as const, status: 404, error: "event_not_found" as const };

  const member = await getOrCreateMember({
    tenantId: event.tenant_id,
    programId: program.id,
    eventId: String(event.id),
    memberKey: input.memberKey,
    consumerId: input.consumerId || null,
    locale: input.locale || "es-AR",
    email: input.email || null,
    phone: input.phone || null,
    country: event.country_code || null,
  });
  const quiz = await ensureQuizForTap(setup.context, program);
  const questions = questionsFromQuiz(quiz);
  const idempotencyKey = `quiz:${quiz.id}:event:${event.id}:member:${member.id}`;
  const existing = (await sql/*sql*/`
    SELECT id, score, total_questions, points_awarded, status, created_at
    FROM loyalty_quiz_attempts
    WHERE idempotency_key = ${idempotencyKey}
    LIMIT 1
  `)[0];
  if (existing) {
    return {
      ok: true as const,
      status: 200,
      duplicateAttempt: true,
      score: Number(existing.score || 0),
      total: Number(existing.total_questions || questions.length),
      pointsAwarded: Number(existing.points_awarded || 0),
      alreadyCompleted: true,
      requiresLogin: !input.consumerId,
      explanations: questions.map(publicTriviaQuestion),
      member: { id: member.id, pointsBalance: member.points_balance, consumerLinked: Boolean(input.consumerId) },
    };
  }

  const scoring = scoreTriviaAnswers(questions, input.answers || []);
  const pointsPerCorrect = Number(quiz.points_per_correct || 10);
  const completionBonus = scoring.score >= Number(quiz.pass_threshold || 1) ? Number(quiz.completion_bonus || 0) : 0;
  const pointsToAward = scoring.score * pointsPerCorrect + completionBonus;
  const award = pointsToAward > 0 ? await awardPoints({
    tenantId: event.tenant_id,
    programId: program.id,
    memberId: member.id,
    tapEventId: String(event.id),
    delta: pointsToAward,
    source: "QUIZ_COMPLETED",
    idempotencyKey,
    reason: `Trivia ${quiz.code}`,
    metadata: {
      quizId: quiz.id,
      score: scoring.score,
      total: scoring.total,
      city: event.city || null,
      productName: setup.context.productName,
      brandName: setup.context.brandName,
      insightTags: scoring.details.map((detail) => detail.insightTag),
    },
  }) : { awarded: false, duplicate: false, entry: null as any };

  if (input.consumerId && pointsToAward > 0 && award.awarded) {
    await ensureTenantMembership({ consumerId: input.consumerId, tenantId: event.tenant_id, tapEventId: String(event.id), source: "trivia" });
    await sql/*sql*/`
      UPDATE tenant_consumer_memberships
      SET points_balance = points_balance + ${pointsToAward},
          lifetime_points = lifetime_points + ${pointsToAward},
          last_activity_at = now(),
          updated_at = now()
      WHERE tenant_id = ${event.tenant_id}
        AND consumer_id = ${input.consumerId}
    `;
  }

  const attempt = (await sql/*sql*/`
    INSERT INTO loyalty_quiz_attempts (
      tenant_id, program_id, quiz_id, member_id, tap_event_id, consumer_id,
      score, total_questions, points_awarded, answers_json, status, idempotency_key, metadata_json
    )
    VALUES (
      ${event.tenant_id},
      ${program.id},
      ${quiz.id},
      ${member.id},
      ${event.id},
      ${input.consumerId || null},
      ${scoring.score},
      ${scoring.total},
      ${award.awarded ? pointsToAward : 0},
      ${JSON.stringify(scoring.details)}::jsonb,
      ${input.consumerId ? "completed" : "pending_auth"},
      ${idempotencyKey},
      ${JSON.stringify({
        city: event.city || null,
        country: event.country_code || null,
        productName: setup.context.productName,
        brandName: setup.context.brandName,
        region: setup.context.region,
        vertical: setup.context.vertical,
        pointsPerCorrect,
        completionBonus,
      })}::jsonb
    )
    RETURNING id, score, total_questions, points_awarded, status, created_at
  `)[0];

  return {
    ok: true as const,
    status: 200,
    score: scoring.score,
    total: scoring.total,
    pointsAwarded: award.awarded ? pointsToAward : 0,
    requiresLogin: !input.consumerId,
    attempt,
    explanations: scoring.details,
    member: {
      id: member.id,
      pointsBalance: Number(member.points_balance || 0) + (award.awarded ? pointsToAward : 0),
      consumerLinked: Boolean(input.consumerId),
    },
  };
}
