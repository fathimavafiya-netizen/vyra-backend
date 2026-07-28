import axios from 'axios';

async function testAuth() {
  const BASE_URL = 'http://localhost:5000/api/v1/auth';
  
  try {
    console.log("Testing POST /auth/login (Wrong Password)");
    const res2 = await axios.post(`${BASE_URL}/login`, {
      email: "test1@example.com",
      password: "WrongPassword123!",
      deviceId: "dev-device-123",
      deviceName: "Test Machine",
      platform: "WEB",
      appVersion: "1.0.0",
      rememberDevice: true
    });
    console.log("Login success with wrong password! (FAIL):", Object.keys(res2.data.data));
  } catch (e: any) {
    if (e.response) {
      console.log("Login error (SUCCESS - caught error):", e.response.status, e.response.data);
    } else {
      console.log("Login error:", e.message);
    }
  }
}

testAuth();
