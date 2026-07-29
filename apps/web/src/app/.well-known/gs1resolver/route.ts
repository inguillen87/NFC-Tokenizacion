import {
  gs1OptionsResponse,
  gs1ResolverDescriptionResponse,
} from "../../id/_lib/gs1-digital-link-resolver";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return gs1ResolverDescriptionResponse(request);
}

export function HEAD(request: Request) {
  return gs1ResolverDescriptionResponse(request, { head: true });
}

export const OPTIONS = gs1OptionsResponse;
