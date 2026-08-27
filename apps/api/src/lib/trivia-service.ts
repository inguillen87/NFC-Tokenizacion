import { createHash } from "node:crypto";
import { sql } from "./db";
import { getActiveProgram, getTapEvent } from "./loyalty-service";
import { evaluateTapCommercialRights, readCurrentTapCommercialRights } from "./tap-commercial-rights";
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
    productName: cleanText(row.product_name, cleanText(row.grape_varietal, "Producto asociado")),
    brandName,
    region: cleanText(row.region, cleanText(row.city, "origen informado")),
    varietal: cleanText(row.grape_varietal, "vino premium"),
    vintage: cleanText(row.vintage),
    bid: row.bid || null,
  };
}

async function findConfiguredQuizForTap(context: ProductContext, program: any) {
  const code = `posttap-${context.vertical}-${hashShort(`${program.id}:${context.productName}:${context.brandName}:${context.region}`)}`;
  return (await sql/*sql*/`
    SELECT *
    FROM loyalty_quizzes
    WHERE program_id = ${program.id}
      AND code = ${code}
      AND status = 'active'
      AND starts_at <= now()
      AND (ends_at IS NULL OR ends_at >= now())
    LIMIT 1
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
  if (isExplicitPreviewId(input.eventId)) return previewTrivia(input);
  if (!isDurableEventId(input.eventId)) return { ok: false as const, status: 400, error: "invalid_event_id" as const };
  if (!input.consumerId) return { ok: false as const, status: 401, error: "consumer_auth_required" as const };

  const event = await getTapEvent(input.eventId);
  if (!event) return { ok: false as const, status: 404, error: "event_not_found" as const };
  if (!evaluateTapCommercialRights(event).allowed) {
    return { ok: false as const, status: 403, error: "tap_commercial_rights_blocked" as const };
  }
  const program = await getActiveProgram(event.tenant_id);
  if (!program) return { ok: false as const, status: 404, error: "program_not_found" as const };
  const context = await loadProductContext(String(event.id));
  if (!context) return { ok: false as const, status: 404, error: "context_not_found" as const };
  const quiz = await findConfiguredQuizForTap(context, program);
  if (!quiz) return { ok: false as const, status: 404, error: "quiz_not_configured" as const };
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

  const setup = await getTriviaForTap(input);
  if (!setup.ok) return setup;

  const event = await getTapEvent(input.eventId);
  const program = event ? await getActiveProgram(event.tenant_id) : null;
  if (!event || !program) return { ok: false as const, status: 404, error: "event_not_found" as const };
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
  const questions = questionsFromQuiz(quiz);
  const idempotencyKey = `quiz:${quiz.id}:event:${event.id}:member:${member.id}`;
  const ledgerIdempotencyKey = `${idempotencyKey}:points`;
  const scoring = scoreTriviaAnswers(questions, input.answers || []);
  const pointsPerCorrect = Number(quiz.points_per_correct || 10);
  const completionBonus = scoring.score >= Number(quiz.pass_threshold || 1) ? Number(quiz.completion_bonus || 0) : 0;
  const pointsToAward = scoring.score * pointsPerCorrect + completionBonus;
  await ensureTenantMembership({ consumerId: input.consumerId, tenantId: event.tenant_id, tapEventId: String(event.id), source: "trivia" });
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
  });
  const atomicRows = await sql/*sql*/`
    WITH tap_rights AS MATERIALIZED (
      SELECT true AS allowed
      FROM events source_event
      LEFT JOIN tag_manual_tamper_overrides manual_override
        ON manual_override.batch_id = source_event.batch_id
       AND UPPER(manual_override.uid_hex) = UPPER(source_event.uid_hex)
      WHERE source_event.id = ${event.id}::bigint
        AND UPPER(COALESCE(source_event.result, '')) NOT IN ('MANUAL_OPENED', 'VALID_MANUAL_OPENED')
        AND UPPER(COALESCE(source_event.reason, '')) NOT LIKE '%MANUAL_TAMPER_OPENED%'
        AND UPPER(COALESCE(source_event.reason, '')) NOT LIKE '%MANUAL_OPENED%'
        AND UPPER(COALESCE(manual_override.tamper_status, '')) NOT IN ('MANUAL_OPENED', 'OPENED')
        AND UPPER(COALESCE(manual_override.reason, '')) NOT LIKE '%MANUAL_TAMPER_OPENED%'
        AND UPPER(COALESCE(manual_override.reason, '')) NOT LIKE '%MANUAL_OPENED%'
    ),
    locked_member AS MATERIALIZED (
      SELECT id, points_balance, lifetime_points
      FROM loyalty_members
      JOIN tap_rights ON tap_rights.allowed = true
      WHERE id = ${member.id}
        AND tenant_id = ${event.tenant_id}
        AND program_id = ${program.id}
        AND consumer_id = ${input.consumerId}
        AND status IN ('enrolled', 'verified')
      FOR UPDATE
    ),
    reserved_attempt AS MATERIALIZED (
      INSERT INTO loyalty_quiz_attempts (
        tenant_id, program_id, quiz_id, member_id, tap_event_id, consumer_id,
        score, total_questions, points_awarded, answers_json, status, idempotency_key, metadata_json
      )
      SELECT
        ${event.tenant_id}, ${program.id}, ${quiz.id}, locked_member.id, ${event.id}, ${input.consumerId},
        ${scoring.score}, ${scoring.total}, 0, ${JSON.stringify(scoring.details)}::jsonb,
        'processing', ${idempotencyKey}, ${attemptMetadata}::jsonb
      FROM locked_member
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
    ),
    reserved_ledger AS MATERIALIZED (
      INSERT INTO points_ledger (
        tenant_id, program_id, member_id, tap_event_id, source, delta,
        balance_after, idempotency_key, reason, metadata_json
      )
      SELECT
        ${event.tenant_id}, ${program.id}, locked_member.id, ${event.id},
        'QUIZ_COMPLETED'::points_source, ${pointsToAward}, 0, ${ledgerIdempotencyKey},
        ${`Trivia ${quiz.code}`}, ${awardMetadata}::jsonb
      FROM locked_member, reserved_attempt
      WHERE ${pointsToAward} > 0
      ON CONFLICT (idempotency_key) DO NOTHING
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
    finalized_ledger AS MATERIALIZED (
      UPDATE points_ledger ledger
      SET balance_after = updated_member.points_balance
      FROM reserved_ledger, updated_member
      WHERE ledger.id = reserved_ledger.id
      RETURNING ledger.id
    ),
    projected_membership AS MATERIALIZED (
      UPDATE tenant_consumer_memberships membership_projection
      SET points_balance = updated_member.points_balance,
          lifetime_points = updated_member.lifetime_points,
          loyalty_program_id = ${program.id},
          last_tap_event_id = ${event.id},
          last_activity_at = now(),
          metadata_json = COALESCE(membership_projection.metadata_json, '{}'::jsonb) || '{"pointsProjectionSource":"loyalty_members"}'::jsonb,
          updated_at = now()
      FROM updated_member
      WHERE membership_projection.tenant_id = ${event.tenant_id}
        AND membership_projection.consumer_id = ${input.consumerId}
      RETURNING membership_projection.id
    ),
    finalized_attempt AS (
      UPDATE loyalty_quiz_attempts attempt
      SET points_awarded = updated_member.awarded_points,
          status = 'completed'
      FROM updated_member, projected_membership
      WHERE attempt.id = updated_member.attempt_id
      RETURNING attempt.id, attempt.score, attempt.total_questions, attempt.points_awarded, attempt.status, attempt.created_at, updated_member.points_balance
    )
    SELECT * FROM finalized_attempt
  `;
  const attempt = atomicRows[0] || (await sql/*sql*/`
    SELECT attempt.id, attempt.score, attempt.total_questions, attempt.points_awarded, attempt.status, attempt.created_at,
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
    return { ok: false as const, status: 503, error: "quiz_completion_unavailable" as const };
  }
  const duplicateAttempt = atomicRows.length === 0;

  return {
    ok: true as const,
    status: 200,
    score: scoring.score,
    total: scoring.total,
    pointsAwarded: Number(attempt.points_awarded || 0),
    duplicateAttempt,
    alreadyCompleted: duplicateAttempt,
    requiresLogin: !input.consumerId,
    attempt,
    explanations: scoring.details,
    member: {
      id: member.id,
      pointsBalance: Number(attempt.points_balance || 0),
      consumerLinked: Boolean(input.consumerId),
    },
  };
}
