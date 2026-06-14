import { neon } from "@neondatabase/serverless";

const dbUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_ZJirQYxsW3K6@ep-fancy-morning-ai5gdrnd-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";

try {
  const sql = neon(dbUrl);
  const email = "guillen.marce@gmail.com";
  const phone = "+5492613168608";
  
  // Clear the phone number from any other consumer records
  await sql`
    UPDATE consumers
    SET phone = null,
        status = 'registered'
    WHERE phone = ${phone} AND (email IS NULL OR email != ${email})
  `;
  
  // Update consumer to be verified with both email and phone
  const rows = await sql`
    UPDATE consumers
    SET phone = ${phone},
        status = 'verified',
        updated_at = now()
    WHERE email = ${email}
    RETURNING *
  `;
  
  if (rows.length > 0) {
    console.log("Updated Consumer:", rows[0]);
    
    // Insert phone identity if not exists
    await sql`
      INSERT INTO consumer_identities (consumer_id, provider, provider_subject, verified_at)
      VALUES (${rows[0].id}, 'phone_otp', ${phone}, now())
      ON CONFLICT (provider, provider_subject)
      DO UPDATE SET verified_at = now(), updated_at = now()
    `;
    console.log("Phone identity verified successfully.");
  } else {
    console.log("No consumer found with email:", email);
  }
  
  process.exit(0);
} catch (e) {
  console.error("Error linking phone:", e.message);
  process.exit(1);
}
