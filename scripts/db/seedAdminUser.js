/**
 * Seeds (or updates) the initial admin user.
 * Usage: npm run db:seed-admin
 */
require("dotenv").config({ path: ".env.local" });
const bcrypt = require("bcryptjs");
const { neon } = require("@neondatabase/serverless");

const ADMIN = {
  username: "jangbersahaja",
  email: "mmuter4@gmail.com",
  password: "jang1234",
  role: "ADMIN",
};

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set (check .env.local)");
    process.exit(1);
  }

  const sql = neon(connectionString);
  const passwordHash = await bcrypt.hash(ADMIN.password, 10);

  await sql`
    INSERT INTO users (username, email, password_hash, role)
    VALUES (${ADMIN.username}, ${ADMIN.email}, ${passwordHash}, ${ADMIN.role})
    ON CONFLICT (username) DO UPDATE
      SET email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role
  `;

  console.log(`✅ Admin user ready: ${ADMIN.username} (${ADMIN.email})`);
}

main().catch((err) => {
  console.error("❌ Seeding admin user failed:", err);
  process.exit(1);
});
