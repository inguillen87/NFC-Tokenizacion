import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const target = path.resolve(process.cwd(), "apps/api/.env.local");
const expectedSuffix = path.normalize("apps/api/.env.local").toLowerCase();
if (!target.toLowerCase().endsWith(expectedSuffix)) throw new Error("local_env_target_invalid");
if (String(process.env.NEXID_LOCAL_ENV_ROTATION_APPROVED || "") !== "YES") {
  throw new Error("local_env_rotation_confirmation_required");
}

const required = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`missing_${name}`);
  return value;
};

const replacements = new Map([
  ["DATABASE_URL", required("NEXID_ROTATED_DATABASE_URL")],
  ["POSTGRES_URL", required("NEXID_ROTATED_DATABASE_URL")],
  ["POSTGRES_URL_NON_POOLING", required("NEXID_ROTATED_DATABASE_URL_UNPOOLED")],
  ["DATABASE_URL_UNPOOLED", required("NEXID_ROTATED_DATABASE_URL_UNPOOLED")],
  ["POSTGRES_PRISMA_URL", required("NEXID_ROTATED_POSTGRES_PRISMA_URL")],
  ["POSTGRES_URL_NO_SSL", required("NEXID_ROTATED_DATABASE_URL")],
  ["PGPASSWORD", required("NEXID_ROTATED_DATABASE_PASSWORD")],
  ["POSTGRES_PASSWORD", required("NEXID_ROTATED_DATABASE_PASSWORD")],
]);

const source = await readFile(target, "utf8");
const seen = new Set();
const lines = source.split(/\r?\n/).map((line) => {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
  if (!match || !replacements.has(match[1])) return line;
  seen.add(match[1]);
  return `${match[1]}=${replacements.get(match[1])}`;
});
for (const [name, value] of replacements) {
  if (!seen.has(name)) lines.push(`${name}=${value}`);
}
await writeFile(target, lines.join("\n"), { encoding: "utf8", mode: 0o600 });
console.log(JSON.stringify({ ok: true, target: "apps/api/.env.local", updated_names: [...replacements.keys()] }));
