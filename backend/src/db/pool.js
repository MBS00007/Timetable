const path = require("node:path");
const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Copy backend/.env.example to backend/.env and add your Supabase PostgreSQL connection string.",
  );
}

const isSupabaseConnection = /supabase\.(co|com)|pooler\.supabase\.com/i.test(
  process.env.DATABASE_URL,
);
const sslEnabled =
  process.env.PGSSL === "true" ||
  (process.env.PGSSL !== "false" && isSupabaseConnection);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  max: Number(process.env.PGPOOL_MAX) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

module.exports = pool;
