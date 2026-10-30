require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const pool = require("./db");

async function main() {
  try {
    const result = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('orders', 'customers')
      ORDER BY table_name, ordinal_position
    `);

    console.table(result.rows);
  } catch (err) {
    console.error("Schema inspection failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
