export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

export async function GET() {
  const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);
  return Response.json({
    ok: true,
    service: "api",
    now: new Date().toISOString(),
    uptimeSec,
    modules: ["verify", "passport", "rights", "registry", "reseller_os"],
    docs: {
      home: "/",
      stack: "/stack",
      glossary: "/glossary",
      faq: "/docs#faq",
    },
  });
}
