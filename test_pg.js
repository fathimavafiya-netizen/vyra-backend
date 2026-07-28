const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client.connect()
  .then(() => {
    console.log('Connected successfully with pg!');
    return client.query('SELECT NOW()');
  })
  .then(res => {
    console.log('Query result:', res.rows);
  })
  .catch(err => {
    console.error('Connection error with pg:', err);
  })
  .finally(() => {
    client.end();
  });
