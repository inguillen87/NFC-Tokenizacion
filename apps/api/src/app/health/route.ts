export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

export async function GET() {
  const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);
  return Response.json(
    {
      ok: true,
      service: "api",
      check: "process_liveness",
      now: new Date().toISOString(),
      uptimeSec,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
