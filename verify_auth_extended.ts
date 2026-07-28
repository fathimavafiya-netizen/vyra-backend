import axios from 'axios';
import jwt from 'jsonwebtoken';

async function testAuthExtended() {
  const BASE_URL = 'http://localhost:5000/api/v1/auth';
  let accessToken = '';
  let refreshToken = '';

  console.log("=== 1. Test Duplicate Registration ===");
  try {
    await axios.post(`${BASE_URL}/register`, {
      fullName: "Test User",
      username: "testuser1",
      email: "test1@example.com",
      password: "Password123!",
      confirmPassword: "Password123!",
      consentGiven: true,
      deviceId: "dev-device-123",
      deviceName: "Test Machine",
      platform: "WEB",
      appVersion: "1.0.0",
      rememberDevice: true
    });
    console.log("FAIL: Duplicate registration should have failed.");
  } catch (e: any) {
    if (e.response) {
      console.log("SUCCESS: Duplicate registration failed with status:", e.response.status, e.response.data.message);
    } else {
      console.log("Error:", e.message);
    }
  }

  console.log("\n=== 2. Login (to get tokens) ===");
  try {
    const res = await axios.post(`${BASE_URL}/login`, {
      email: "test1@example.com",
      password: "Password123!",
      deviceId: "dev-device-123",
      deviceName: "Test Machine",
      platform: "WEB",
      appVersion: "1.0.0",
      rememberDevice: true
    });
    accessToken = res.data.data.accessToken;
    refreshToken = res.data.data.refreshToken;
    console.log("SUCCESS: Logged in.");
  } catch (e: any) {
    console.log("FAIL: Login failed.", e.message);
    return;
  }

  console.log("\n=== 3. Verify JWT Contents ===");
  try {
    const decoded: any = jwt.decode(accessToken);
    console.log("Decoded JWT claims:");
    console.log(`- userId: ${decoded.userId}`);
    console.log(`- role: ${decoded.role}`);
    console.log(`- iat: ${decoded.iat}`);
    console.log(`- exp: ${decoded.exp}`);
    if (decoded.password) {
       console.log("FAIL: JWT contains sensitive password info!");
    } else {
       console.log("SUCCESS: JWT does not contain sensitive password hash.");
    }
  } catch (e: any) {
    console.log("FAIL: Error decoding JWT:", e.message);
  }

  console.log("\n=== 4. Test Route Protection (/me) ===");
  try {
    const resMe = await axios.get(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    console.log("SUCCESS: /me works with token. User ID:", resMe.data.user.id);
  } catch (e: any) {
    console.log("FAIL: /me failed with token:", e.message);
  }

  try {
    await axios.get(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer invalidtoken` }
    });
    console.log("FAIL: /me should have failed with invalid token.");
  } catch (e: any) {
    console.log("SUCCESS: /me failed with invalid token. Status:", e.response?.status);
  }

  console.log("\n=== 5. Verify Refresh Token Flow ===");
  try {
    const resRefresh = await axios.post(`${BASE_URL}/refresh`, {
      refreshToken: refreshToken,
      deviceId: "dev-device-123",
      deviceName: "Test Machine",
      platform: "WEB",
      appVersion: "1.0.0",
      ipAddress: "127.0.0.1",
      userAgent: "axios"
    });
    console.log("SUCCESS: Refresh token generated new access token.");
    console.log("Old Access Token length:", accessToken.length);
    console.log("New Access Token length:", resRefresh.data.data.accessToken.length);
  } catch (e: any) {
    console.log("FAIL: Refresh token flow failed.", e.response?.data || e.message);
  }
}

testAuthExtended();
