import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Read .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envObj = {};

envContent.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let value = parts.slice(1).join('=').trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      envObj[key] = value;
    }
  }
});

const dbUrl = envObj['DATABASE_URL'];

if (!dbUrl) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

try {
  console.log("Generating migration SQL...");
  execSync(`npx prisma migrate diff --from-url "${dbUrl}" --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_nexid_enterprise/migration.sql`, {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit'
  });
  console.log("Migration generated.");
} catch (e) {
  console.error(e);
}
