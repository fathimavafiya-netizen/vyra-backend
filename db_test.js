const { Client } = require('pg');

const url = "postgresql://sociall_user:8nyf0MHjMclojgEY7ZbsjeE5uSdSjkfT@dpg-d9u6pnnavr4c73ekqmcg-a.singapore-postgres.render.com/sociall?sslmode=require";

async function testConnection() {
  console.log("Connecting to Render PostgreSQL...");
  const client = new Client({
    connectionString: url,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log("Successfully connected!");
    const res = await client.query('SELECT NOW()');
    console.log("Query result:", res.rows[0]);

    // Check current connections
    const connRes = await client.query(`
      SELECT count(*), state 
      FROM pg_stat_activity 
      GROUP BY state;
    `);
    console.log("Current connections:", connRes.rows);

  } catch (err) {
    console.error("Connection error:", err.message);
  } finally {
    await client.end();
  }
}

testConnection();
