import { forwardTenantMarketplace } from "./route-helpers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (req: Request) => forwardTenantMarketplace(req);
export const POST = (req: Request) => forwardTenantMarketplace(req);
