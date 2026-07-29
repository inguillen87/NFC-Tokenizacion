import { gs1OptionsResponse, resolveGs1DigitalLink } from "../../_lib/gs1-digital-link-resolver";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ gtin: string }> }) {
  const { gtin } = await context.params;
  return resolveGs1DigitalLink(req, { gtin });
}

export async function HEAD(req: Request, context: { params: Promise<{ gtin: string }> }) {
  const { gtin } = await context.params;
  return resolveGs1DigitalLink(req, { gtin }, { head: true });
}

export const OPTIONS = gs1OptionsResponse;
