const http = require('http');

const data = JSON.stringify({
  fullName: 'Test User',
  username: 'testuser123',
  email: 'testuser123@sociall.com',
  password: 'Password123!',
  confirmPassword: 'Password123!',
  consentGiven: true,
  deviceId: 'test-id',
  deviceName: 'Test Device',
  platform: 'WEB',
  appVersion: '1.0.0'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(body));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
