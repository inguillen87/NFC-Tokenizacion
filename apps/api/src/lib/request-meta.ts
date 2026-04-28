export function getRequestMeta(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
  const userAgent = req.headers.get('user-agent') || null;
  const traceId = req.headers.get("x-nexid-trace-id") || req.headers.get("x-request-id") || `nexid_${Date.now().toString(36)}`;
  return { ip, userAgent, traceId };
}
