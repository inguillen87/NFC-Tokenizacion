import OgImage from "../og-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supportedLocales = new Set(["es-AR", "en", "pt-BR"]);
const supportedSurfaces = new Set(["home", "sun", "pricing", "demo-lab"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedLocale = url.searchParams.get("locale") || "es-AR";
  const requestedSurface = url.searchParams.get("surface") || "home";
  const response = OgImage({
    searchParams: {
      locale: supportedLocales.has(requestedLocale) ? requestedLocale : "es-AR",
      surface: supportedSurfaces.has(requestedSurface) ? requestedSurface : "home",
      campaign: "default",
    },
  });

  response.headers.set("Cache-Control", "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800");
  return response;
}
