import { randomBytes } from "crypto";
import { sql } from "../../../lib/db";
import { checkAdmin } from "../../../lib/auth";
import { encryptKey16 } from "../../../lib/keys";
import { json } from "../../../lib/http";

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const slug = String(body.slug || "").toLowerCase();
  const name = String(body.name || "");
  if (!slug || !name) return json({ ok: false, reason: "slug and name required" }, 400);

  const root = randomBytes(16);
  const rootKeyCt = encryptKey16(root);

  const rows = await sql/*sql*/`
    INSERT INTO tenants (slug, name, root_key_ct)
    VALUES (${slug}, ${name}, ${rootKeyCt})
    RETURNING id, slug, name, created_at
  `;

  return json(rows[0], 201);
}
