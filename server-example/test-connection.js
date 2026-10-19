/**
 * Test Neon Postgres Connection
 * 
 * Usage:
 *   cd server-example
 *   npm run db:test
 */

require("dotenv").config();
const { testConnection, isDatabaseConfigured } = require("./db");

async function run() {
  console.log("Checking Neon PostgreSQL connection...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL ? "(provided)" : "(MISSING)");

  if (!isDatabaseConfigured()) {
    console.error("\n❌ Neon connection string is not configured!");
    console.log("To fix this:");
    console.log("1. Go to https://neon.tech and log in (or create a free account).");
    console.log("2. Create a project named 'krisin-clothing'.");
    console.log("3. Copy your Connection string (starts with postgresql://...)");
    console.log("4. Paste it into 'server-example/.env' as DATABASE_URL=...");
    process.exit(1);
  }

  const result = await testConnection();
  if (result.ok) {
    console.log("\n✅ SUCCESS: Connected to Neon PostgreSQL!");
    console.log("Database:", result.database);
    console.log("Server Time:", result.time);
    console.log("PostgreSQL Version:", result.version);
    process.exit(0);
  } else {
    console.error("\n❌ FAILED to connect to Neon PostgreSQL:");
    console.error(result.error);
    process.exit(1);
  }
}

run();
