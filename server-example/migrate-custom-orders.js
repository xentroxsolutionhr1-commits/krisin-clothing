require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const pool = require("./db");

async function migrate() {
  try {
    console.log("Checking Neon PostgreSQL connection...");
    await pool.query("SELECT 1");

    console.log("Adding customized order columns if not exist...");
    await pool.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_customized BOOLEAN DEFAULT FALSE;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS custom_image_url TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS printing_fee NUMERIC DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_message TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS custom_details JSONB;
    `);

    console.log("Creating store_settings table if not exists...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS store_settings (
        key VARCHAR(64) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO store_settings (key, value)
      VALUES ('printing_fee', '200')
      ON CONFLICT (key) DO NOTHING;
    `);

    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'orders'
      ORDER BY ordinal_position;
    `);
    console.log("Current orders table columns:");
    console.table(cols.rows);

    const setting = await pool.query("SELECT * FROM store_settings");
    console.log("Store settings:", setting.rows);

    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration error:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
