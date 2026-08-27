const { Client } = require('pg');

const url = "postgresql://vyra_db_user:eGdFTXD86J4wBGL9v4oDP6heaOfR5W1g@dpg-d9achfu7r5hc73cghhmg-a.singapore-postgres.render.com/vyra_db?sslmode=require";

async function testConnection() {
  for (let i = 0; i < 5; i++) {
    console.log(`Connecting to Render PostgreSQL (Attempt ${i + 1})...`);
    const client = new Client({
      connectionString: url,
      ssl: {
        rejectUnauthorized: false
      }
    });

    try {
      await client.connect();
      console.log("Successfully connected!");
      await client.end();
      return;
    } catch (err) {
      console.error("Connection error:", err.message);
    } finally {
      // client.end() is redundant if connect fails but just in case
      try { await client.end(); } catch (e) {}
    }
    
    // Wait for 5 seconds before retrying
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

testConnection();
