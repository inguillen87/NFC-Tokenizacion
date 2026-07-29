import { gs1OptionsResponse, resolveGs1DigitalLink } from "../../../../../../_lib/gs1-digital-link-resolver";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ gtin: string; lot: string; serial: string }> }) {
  const { gtin, lot, serial } = await context.params;
  return resolveGs1DigitalLink(req, { gtin, lot, serial });
}

export async function HEAD(req: Request, context: { params: Promise<{ gtin: string; lot: string; serial: string }> }) {
  const { gtin, lot, serial } = await context.params;
  return resolveGs1DigitalLink(req, { gtin, lot, serial }, { head: true });
}

export const OPTIONS = gs1OptionsResponse;
