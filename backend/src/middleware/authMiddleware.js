const { createClient } = require("@supabase/supabase-js");
const pool = require("../db/pool");

const supabaseUrl = process.env.SUPABASE_URL || "https://swcfymujkdmicmueoedp.supabase.co";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3Y2Z5bXVqa2RtaWNtdWVvZWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMTcwMDEsImV4cCI6MjEwNDg5MzAwMX0.t_Vvf7GVyOG0VD4VFdskr5zQC159NMYrxAJV6o_WS3k";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function requireAdminAuth(request, response, next) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return response.status(401).json({ error: "Authentication required. Bearer token missing." });
    }

    const token = authHeader.split(" ")[1];
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return response.status(401).json({ error: "Invalid or expired authentication token." });
    }

    const userId = data.user.id;

    // Check if user exists in public.admin_users with role = 'admin'
    const adminCheck = await pool.query(
      `SELECT user_id, role
       FROM public.admin_users
       WHERE user_id = $1 AND role = 'admin'
       LIMIT 1`,
      [userId]
    );

    if (!adminCheck.rowCount) {
      return response.status(403).json({ error: "Access denied. Administrator privileges required." });
    }

    request.user = data.user;
    request.adminRole = adminCheck.rows[0].role;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    response.status(500).json({ error: "Internal server error during authentication check." });
  }
}

async function requireClassRepOrAdminAuth(request, response, next) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return response.status(401).json({ error: "Authentication required. Bearer token missing." });
    }

    const token = authHeader.split(" ")[1];
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return response.status(401).json({ error: "Invalid or expired authentication token." });
    }

    const userId = data.user.id;

    // Check if user exists in public.admin_users with role = 'admin' OR 'class_rep'
    const roleCheck = await pool.query(
      `SELECT user_id, role
       FROM public.admin_users
       WHERE user_id = $1 AND role IN ('admin', 'class_rep')
       LIMIT 1`,
      [userId]
    );

    if (!roleCheck.rowCount) {
      return response.status(403).json({ error: "Access denied. Class Rep or Administrator privileges required." });
    }

    request.user = data.user;
    request.userRole = roleCheck.rows[0].role;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    response.status(500).json({ error: "Internal server error during authentication check." });
  }
}

module.exports = { requireAdminAuth, requireClassRepOrAdminAuth };

