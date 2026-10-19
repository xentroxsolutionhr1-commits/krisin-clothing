/**
 * Neon PostgreSQL Database Connection Module
 * 
 * Works with Neon Serverless Postgres via standard connection string:
 * DATABASE_URL=postgresql://user:password@ep-xyz.region.aws.neon.tech/neondb?sslmode=require
 */

const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();

const connectionString = process.env.DATABASE_URL;

let pool = null;

function isDatabaseConfigured() {
  return Boolean(
    connectionString &&
    connectionString.trim() !== "" &&
    !connectionString.includes("your-neon-host") &&
    !connectionString.includes("xxxxxxxx")
  );
}

if (isDatabaseConfigured()) {
  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false, // Required for Neon SSL connections
    },
    max: 10, // Maximum pool connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on("error", (err) => {
    console.error("Unexpected error on idle Neon Postgres client:", err.message);
  });
} else {
  console.warn(
    "[Neon Postgres] DATABASE_URL is not set or using placeholder in .env. Database features will operate in disconnected/fallback mode."
  );
}

/**
 * Execute a SQL query with parameter binding
 * @param {string} text 
 * @param {Array} params 
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = []) {
  if (!pool) {
    throw new Error(
      "Database not configured. Please set a valid DATABASE_URL in server-example/.env"
    );
  }
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // Uncomment for debug query timing:
  // console.log(`[Neon DB] Executed query in ${duration}ms:`, { text: text.slice(0, 80), rows: res.rowCount });
  return res;
}

/**
 * Test Neon database connectivity
 */
async function testConnection() {
  if (!pool) {
    return { ok: false, error: "DATABASE_URL is not set in .env" };
  }
  try {
    const res = await pool.query("SELECT NOW() as current_time, current_database() as db_name, version()");
    return {
      ok: true,
      time: res.rows[0].current_time,
      database: res.rows[0].db_name,
      version: res.rows[0].version,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  pool,
  query,
  testConnection,
  isDatabaseConfigured,
};
