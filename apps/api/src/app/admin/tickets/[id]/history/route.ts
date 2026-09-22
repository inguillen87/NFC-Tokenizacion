import { handleAdminTicketWorkflowHistory } from "../../../../../lib/admin-ticket-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleAdminTicketWorkflowHistory(req, id);
}
