/**
 * One-time / idempotent DB migration runner.
 * Usage: npm run db:init
 */
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set (check .env.local)");
    process.exit(1);
  }

  const sql = neon(connectionString);
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  // Split into individual statements (schema.sql has no semicolons inside
  // string literals, so a naive split is safe here). A statement is kept if
  // it has any non-comment, non-blank content (comments may precede the
  // actual SQL within the same statement chunk).
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => {
      const withoutComments = s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
      return withoutComments.length > 0;
    });

  console.log(`Running ${statements.length} statements against Neon...`);

  for (const statement of statements) {
    await sql.query(statement);
  }

  console.log("✅ Database schema is up to date.");
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
