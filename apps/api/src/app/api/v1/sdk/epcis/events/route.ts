export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { enforceSdkAuthenticationRateLimit, enforceSdkRateLimit } from "../../../../../../lib/critical-rate-limit";
import {
  buildEpcisQueryDocument,
  parseEpcisQueryFilters,
  queryEpcisEvents,
} from "../../../../../../lib/epcis";
import { json } from "../../../../../../lib/http";
import { authenticateSdkRequest, logSdkUsage } from "../../../../../../lib/sdk-auth";
import { epcisErrorResponse, epcisOptions, EPCIS_ROUTE_HEADERS } from "../_shared";

export async function OPTIONS() {
  return epcisOptions("GET, OPTIONS");
}

export async function GET(req: Request) {
  const startedAt = Date.now();
  const authLimited = await enforceSdkAuthenticationRateLimit(req);
  if (authLimited) return authLimited;
  const auth = await authenticateSdkRequest(req, "sdk:epcis:read");
  if (!auth.ok) {
    await logSdkUsage({ req, endpoint: "sdk.epcis.events", statusCode: auth.response.status, startedAt, reason: "auth_failed" });
    return auth.response;
  }
  const limited = await enforceSdkRateLimit(req, auth.context);
  if (limited) return limited;
  try {
    const filters = parseEpcisQueryFilters(new URL(req.url).searchParams);
    const page = await queryEpcisEvents(auth.context.tenantId, filters);
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.epcis.events", statusCode: 200, startedAt, meta: { pageSize: page.pageSize, hasMore: Boolean(page.nextCursor) } });
    return json(buildEpcisQueryDocument(page.events), 200, {
      ...EPCIS_ROUTE_HEADERS,
      "x-nexid-page-size": String(page.pageSize),
      ...(page.nextCursor ? { "x-nexid-next-cursor": page.nextCursor } : {}),
    });
  } catch (error) {
    const response = epcisErrorResponse(error);
    await logSdkUsage({ req, context: auth.context, endpoint: "sdk.epcis.events", statusCode: response.status, startedAt, reason: "epcis_query_failed" });
    return response;
  }
}
