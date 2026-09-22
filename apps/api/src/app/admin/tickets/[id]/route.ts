import { handleAdminTicketLookup } from "../../../../lib/admin-ticket-lookup";
import { handleAdminTicketWorkflowTransition } from "../../../../lib/admin-ticket-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleAdminTicketLookup(req, id);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleAdminTicketWorkflowTransition(req, id);
}
