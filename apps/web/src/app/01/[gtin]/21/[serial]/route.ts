import { gs1OptionsResponse, resolveGs1DigitalLink } from "../../../../id/_lib/gs1-digital-link-resolver";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ gtin: string; serial: string }> }) {
  const { gtin, serial } = await context.params;
  return resolveGs1DigitalLink(req, { gtin, serial });
}

export async function HEAD(req: Request, context: { params: Promise<{ gtin: string; serial: string }> }) {
  const { gtin, serial } = await context.params;
  return resolveGs1DigitalLink(req, { gtin, serial }, { head: true });
}

export const OPTIONS = gs1OptionsResponse;
