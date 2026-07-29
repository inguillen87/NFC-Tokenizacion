import { gs1OptionsResponse, resolveGs1DigitalLink } from "../../../../_lib/gs1-digital-link-resolver";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ gtin: string; lot: string }> }) {
  const { gtin, lot } = await context.params;
  return resolveGs1DigitalLink(req, { gtin, lot });
}

export async function HEAD(req: Request, context: { params: Promise<{ gtin: string; lot: string }> }) {
  const { gtin, lot } = await context.params;
  return resolveGs1DigitalLink(req, { gtin, lot }, { head: true });
}

export const OPTIONS = gs1OptionsResponse;
