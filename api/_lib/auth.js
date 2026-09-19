/**
 * Shared auth verification for Vercel serverless functions.
 * Mirrors backend/src/middleware/authMiddleware.js.
 */
const { createClient } = require("@supabase/supabase-js");
const pool = require("./db");

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://swcfymujkdmicmueoedp.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3Y2Z5bXVqa2RtaWNtdWVvZWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMTcwMDEsImV4cCI6MjEwNDg5MzAwMX0.t_Vvf7GVyOG0VD4VFdskr5zQC159NMYrxAJV6o_WS3k";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Verify the Bearer token and return the Supabase user, or null.
 */
async function verifyUser(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.split(" ")[1];
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/**
 * Check if the user has one of the allowed roles in admin_users table.
 * Returns the role string, or null if no match.
 */
async function checkRole(userId, allowedRoles) {
  const result = await pool.query(
    `SELECT role FROM public.admin_users WHERE user_id = $1 AND role = ANY($2) LIMIT 1`,
    [userId, allowedRoles]
  );
  return result.rows[0]?.role || null;
}

/**
 * Require admin auth. Returns { user, role } or sends an error response.
 */
async function requireAdmin(req, res) {
  const user = await verifyUser(req);
  if (!user) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Authentication required. Bearer token missing." }));
    return null;
  }
  const role = await checkRole(user.id, ["admin"]);
  if (!role) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Access denied. Administrator privileges required." }));
    return null;
  }
  return { user, role };
}

/**
 * Require class_rep or admin auth. Returns { user, role } or sends an error response.
 */
async function requireClassRepOrAdmin(req, res) {
  const user = await verifyUser(req);
  if (!user) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Authentication required. Bearer token missing." }));
    return null;
  }
  const role = await checkRole(user.id, ["admin", "class_rep"]);
  if (!role) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: "Access denied. Class Rep or Administrator privileges required." }));
    return null;
  }
  return { user, role };
}

module.exports = { verifyUser, checkRole, requireAdmin, requireClassRepOrAdmin };
