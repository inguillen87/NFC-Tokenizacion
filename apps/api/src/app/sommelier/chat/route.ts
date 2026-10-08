import { handleSommelierChat } from "../../../lib/sommelier-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) { return handleSommelierChat(req); }
