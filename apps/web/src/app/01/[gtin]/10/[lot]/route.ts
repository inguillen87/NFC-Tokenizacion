import { gs1OptionsResponse, resolveGs1DigitalLink } from "../../../../id/_lib/gs1-digital-link-resolver";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ gtin: string; lot: string }> };

export async function GET(request: Request, context: Context) {
  return resolveGs1DigitalLink(request, await context.params);
}

export async function HEAD(request: Request, context: Context) {
  return resolveGs1DigitalLink(request, await context.params, { head: true });
}

export const OPTIONS = gs1OptionsResponse;
