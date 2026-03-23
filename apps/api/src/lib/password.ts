import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const PREFIX = "scrypt";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${PREFIX}$${salt}$${derived}`;
}

export function verifyPassword(password: string, hash: string) {
  const [prefix, salt, stored] = String(hash || "").split("$");
  if (prefix !== PREFIX || !salt || !stored) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(stored, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
