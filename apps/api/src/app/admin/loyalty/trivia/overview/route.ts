export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminTenantScope } from "../../../../../lib/auth";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import { ensureLoyaltySchema } from "../../../../../lib/loyalty-schema";
import { maskConsumerEmail, resolveConsumerNetworkTenant } from "../../../../../lib/consumer-network-metrics";

function maskPhone(phone: string | null | undefined) {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  if (digits.length < 7) return null;
  return `+${digits.slice(0, 3)}***${digits.slice(-4)}`;
}

function pct(value: number) {
  return Math.round(value * 10) / 10;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "campaigns:read");
  if (auth) return auth;

  await ensureLoyaltySchema();
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const tenant = resolveConsumerNetworkTenant({ forcedTenantSlug, requestedTenantSlug: new URL(req.url).searchParams.get("tenant") });

  const rows = await sql/*sql*/`
    SELECT
      a.id,
      a.score,
      a.total_questions,
      a.points_awarded,
      a.status,
      a.answers_json,
      a.metadata_json,
      a.created_at,
      q.title AS quiz_title,
      q.questions_json,
      ten.slug AS tenant_slug,
      e.city,
      e.country_code,
      e.uid_hex,
      c.display_name,
      c.email,
      c.phone
    FROM loyalty_quiz_attempts a
    JOIN loyalty_quizzes q ON q.id = a.quiz_id
    JOIN tenants ten ON ten.id = a.tenant_id
    LEFT JOIN events e ON e.id = a.tap_event_id
    LEFT JOIN consumers c ON c.id = a.consumer_id
    WHERE (${tenant} = '' OR ten.slug = ${tenant})
      AND a.created_at >= now() - interval '45 days'
    ORDER BY a.created_at DESC
    LIMIT 600
  `;

  const attempts = rows.map((row) => {
    const metadata = parseJson<Record<string, any>>(row.metadata_json, {});
    return {
      id: row.id,
      score: Number(row.score || 0),
      total: Number(row.total_questions || 0),
      pointsAwarded: Number(row.points_awarded || 0),
      status: String(row.status || ""),
      city: String(row.city || metadata.city || "").trim() || null,
      country: String(row.country_code || metadata.country || "").trim() || null,
      productName: String(metadata.productName || "").trim() || "Producto asociado",
      brandName: String(metadata.brandName || "").trim() || "Marca asociada",
      region: String(metadata.region || "").trim() || null,
      displayName: String(row.display_name || "").trim() || null,
      emailMasked: maskConsumerEmail(row.email),
      phoneMasked: maskPhone(row.phone),
      createdAt: row.created_at,
      answers: parseJson<Array<Record<string, any>>>(row.answers_json, []),
      questions: parseJson<Array<Record<string, any>>>(row.questions_json, []),
    };
  });

  const totals = attempts.reduce((acc, item) => {
    acc.points += item.pointsAwarded;
    acc.score += item.score;
    acc.questions += item.total;
    if (item.status === "completed") acc.completed += 1;
    return acc;
  }, { points: 0, score: 0, questions: 0, completed: 0 });

  const cityMap = new Map<string, { city: string; attempts: number; score: number; total: number; points: number; products: Map<string, number> }>();
  const productMap = new Map<string, number>();
  const questionMap = new Map<string, {
    prompt: string;
    insightTag: string;
    attempts: number;
    correct: number;
    wrongAnswers: Map<string, number>;
  }>();

  for (const attempt of attempts) {
    const city = attempt.city || "Sin ciudad";
    const cityRow = cityMap.get(city) || { city, attempts: 0, score: 0, total: 0, points: 0, products: new Map<string, number>() };
    cityRow.attempts += 1;
    cityRow.score += attempt.score;
    cityRow.total += attempt.total;
    cityRow.points += attempt.pointsAwarded;
    cityRow.products.set(attempt.productName, (cityRow.products.get(attempt.productName) || 0) + 1);
    cityMap.set(city, cityRow);
    productMap.set(attempt.productName, (productMap.get(attempt.productName) || 0) + 1);

    for (const answer of attempt.answers) {
      const questionId = String(answer.questionId || answer.id || "");
      if (!questionId) continue;
      const prompt = String(answer.prompt || attempt.questions.find((q) => q.id === questionId)?.prompt || questionId);
      const questionRow = questionMap.get(questionId) || {
        prompt,
        insightTag: String(answer.insightTag || ""),
        attempts: 0,
        correct: 0,
        wrongAnswers: new Map<string, number>(),
      };
      questionRow.attempts += 1;
      if (answer.correct) {
        questionRow.correct += 1;
      } else {
        const label = String(answer.answerIndex ?? "sin_respuesta");
        questionRow.wrongAnswers.set(label, (questionRow.wrongAnswers.get(label) || 0) + 1);
      }
      questionMap.set(questionId, questionRow);
    }
  }

  const topCity = [...cityMap.values()].sort((a, b) => b.attempts - a.attempts)[0] || null;
  const topProduct = [...productMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const avgScorePct = totals.questions ? pct((totals.score / totals.questions) * 100) : 0;

  return json({
    ok: true,
    tenant: tenant || null,
    summary: {
      attempts: attempts.length,
      completed: totals.completed,
      pointsIssued: totals.points,
      avgScorePct,
      topCity: topCity?.city || null,
      topProduct,
      insight:
        attempts.length === 0
          ? "Sin intentos de trivia todavía. Activá una campaña post-tap para medir conocimiento real por ciudad."
          : `${topCity?.city || "La audiencia"} concentra la mayor actividad; score medio ${avgScorePct}% y ${totals.points} puntos emitidos.`,
    },
    cities: [...cityMap.values()]
      .map((item) => ({
        city: item.city,
        attempts: item.attempts,
        avgScorePct: item.total ? pct((item.score / item.total) * 100) : 0,
        pointsIssued: item.points,
        topProduct: [...item.products.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 8),
    questions: [...questionMap.values()]
      .map((item) => ({
        prompt: item.prompt,
        insightTag: item.insightTag,
        attempts: item.attempts,
        correctRatePct: item.attempts ? pct((item.correct / item.attempts) * 100) : 0,
        dominantMiss: [...item.wrongAnswers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      }))
      .sort((a, b) => a.correctRatePct - b.correctRatePct)
      .slice(0, 6),
    recent: attempts.slice(0, 8).map((item) => ({
      id: item.id,
      score: item.score,
      total: item.total,
      pointsAwarded: item.pointsAwarded,
      city: item.city,
      productName: item.productName,
      displayName: item.displayName,
      emailMasked: item.emailMasked,
      phoneMasked: item.phoneMasked,
      createdAt: item.createdAt,
    })),
  });
}
