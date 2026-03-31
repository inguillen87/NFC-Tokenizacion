export function getRequestMeta(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
  const userAgent = req.headers.get('user-agent') || null;
  return { ip, userAgent };
}
