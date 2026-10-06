import { createConfigurationHandlers } from "../../../../lib/tenant-loyalty-configuration-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const { GET, POST } = createConfigurationHandlers();
