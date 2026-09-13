async function checkDatabase() {
  let pool;
  try {
    pool = require("./pool");
    const result = await pool.query(`
      SELECT current_database() AS database,
             current_user AS user,
             NOW() AS server_time
    `);
    console.log("Database connection successful:");
    console.table(result.rows);
  } finally {
    if (pool) await pool.end();
  }
}

checkDatabase().catch((error) => {
  console.error("Database connection failed:", error.message);
  process.exitCode = 1;
});
