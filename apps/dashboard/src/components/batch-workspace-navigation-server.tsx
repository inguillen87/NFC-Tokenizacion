import "server-only";
import { BatchWorkspaceNavigation } from "./batch-workspace-navigation";
import { buildBatchWorkspaceNavigation, type BatchWorkspaceView } from "../lib/batch-workspace-navigation";
import { getDashboardI18n } from "../lib/locale";
import type { DashboardSession } from "../lib/session";

/** Only the allowlisted view projection is passed on; no session or credential enters the navigation markup. */
export async function BatchWorkspaceNavigationServer({ bid, tenant, current, session }: {
  bid: string; tenant: string; current: BatchWorkspaceView; session: DashboardSession;
}) {
  const { locale } = await getDashboardI18n();
  return <BatchWorkspaceNavigation model={buildBatchWorkspaceNavigation(bid, tenant, current, session)} locale={locale} />;
}
