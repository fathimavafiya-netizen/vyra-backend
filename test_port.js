const net = require('net');

const host = 'dpg-d9achfu7r5hc73cghhmg-a.singapore-postgres.render.com';
const port = 5432;

console.log(`Connecting to ${host}:${port}...`);
const client = net.createConnection({ port, host }, () => {
  console.log('Successfully connected to port 5432!');
  client.end();
});

client.on('error', (err) => {
  console.error('Connection error:', err.message);
});

client.on('end', () => {
  console.log('Disconnected from server');
});
