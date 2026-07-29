export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import {
  ensureAlertsSchema,
  ensureCarrierProfileSchema,
  ensureConsumerAuthSchema,
  ensureConsumerPortalSchema,
  ensureCrmOpsSchema,
  ensureEnterpriseIamSchema,
} from "../../../../lib/commercial-runtime-schema";
import { json } from "../../../../lib/http";

type BootstrapStep = {
  name: string;
  ok: boolean;
  ms: number;
  error?: string;
};

async function runStep(name: string, run: () => Promise<unknown>): Promise<BootstrapStep> {
  const startedAt = Date.now();
  try {
    await run();
    return { name, ok: true, ms: Date.now() - startedAt };
  } catch (error) {
    return {
      name,
      ok: false,
      ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req, ["super_admin"]);
  if (auth) return auth;

  const startedAt = Date.now();
  const results: BootstrapStep[] = [];

  results.push(await runStep("crm_ops_leads_tickets_orders", ensureCrmOpsSchema));
  results.push(await runStep("security_alerts", ensureAlertsSchema));
  results.push(await runStep("enterprise_iam", ensureEnterpriseIamSchema));
  results.push(await runStep("consumer_auth_sessions", ensureConsumerAuthSchema));
  results.push(await runStep("consumer_portal_loyalty_marketplace", ensureConsumerPortalSchema));
  results.push(await runStep("carrier_profiles", ensureCarrierProfileSchema));

  const ok = results.every((step) => step.ok);
  return json(
    {
      ok,
      duration_ms: Date.now() - startedAt,
      message: ok
        ? "Commercial schema is ready for leads, tickets, notifications, portal, marketplace and carrier profiles."
        : "Some schema steps failed. Check the failed step error and database permissions.",
      results,
    },
    ok ? 200 : 500,
  );
}

export async function GET(req: Request) {
  return POST(req);
}
