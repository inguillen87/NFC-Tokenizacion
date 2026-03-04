export function checkAdmin(req: Request): Response | null {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = process.env.ADMIN_API_KEY || "";
  if (!expected || token !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
