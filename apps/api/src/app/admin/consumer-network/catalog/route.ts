export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { createCatalogHandlers } from "../../../../lib/tenant-marketplace-catalog-http";
export const { GET, POST } = createCatalogHandlers();
