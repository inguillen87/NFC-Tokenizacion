export async function GET() {
  return Response.json({ ok: true, service: "api", now: new Date().toISOString() });
}
