import fs from "fs";
import pg from "pg";
const { Client } = pg;

async function applyDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const client = new Client({ connectionString: url });
  await client.connect();
  
  console.log("Connected to DB via pg.");
  
  const body = fs.readFileSync("db/schema.sql", "utf8");
  console.log("Applying schema.sql...");
  
  try {
    await client.query(body);
    console.log("Schema applied successfully.");
  } catch (err) {
    console.error("Failed to apply schema:");
    console.error(err);
  } finally {
    await client.end();
  }
}

applyDb().catch(console.error);
