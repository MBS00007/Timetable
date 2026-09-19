/**
 * Shared PostgreSQL pool for Vercel serverless functions.
 * Uses the same Supabase connection as backend/src/db/pool.js.
 */
const { Pool } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres.swcfymujkdmicmueoedp:%24%23%40h%21d%28%28%23%29%29@aws-1-eu-west-1.pooler.supabase.com:5432/postgres";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

module.exports = pool;
