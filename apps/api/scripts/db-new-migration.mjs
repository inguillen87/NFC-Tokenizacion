import fs from "node:fs";
import path from "node:path";

const name = process.argv[2];
if (!name) {
  console.error("Usage: npm run db:new -- <migration_name>");
  process.exit(1);
}

const now = new Date();
const stamp = [
  now.getUTCFullYear(),
  String(now.getUTCMonth() + 1).padStart(2, "0"),
  String(now.getUTCDate()).padStart(2, "0"),
  String(now.getUTCHours()).padStart(2, "0"),
  String(now.getUTCMinutes()).padStart(2, "0"),
  String(now.getUTCSeconds()).padStart(2, "0"),
].join("");

const safe = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const file = `${stamp}_${safe}.sql`;
const out = path.join(process.cwd(), "db", "migrations", file);

fs.writeFileSync(out, `-- ${file}\n-- Write forward-only SQL here.\n\n`, "utf8");
console.log(`Created ${out}`);
