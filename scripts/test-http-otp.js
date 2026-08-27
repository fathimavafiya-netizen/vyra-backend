const axios = require('axios');

async function testHttpOtp() {
  try {
    const email = 'testuser2@example.com';
    const mobile = '+911234567890';
    
    // Create a user first so it exists for PASSWORD_RESET
    try {
      await axios.post('http://localhost:5000/api/v1/auth/register', {
        fullName: 'Test User Mobile',
        username: 'testusermob',
        mobile: mobile,
        countryCode: '+91',
        password: 'Password123!',
      });
      console.log('User registered.');
    } catch (e) {
      console.log('User might already exist:', JSON.stringify(e.response?.data || e.message));
    }
    
    console.log('Sending forgot password request...');
    const forgotRes = await axios.post('http://localhost:5000/api/v1/auth/forgot-password', {
      mobile,
    });
    console.log('Forgot response:', JSON.stringify(forgotRes.data));
    
    const devCode = forgotRes.data.data.devCode;
    console.log('Got devCode:', devCode);
    
    console.log('Verifying OTP...');
    const verifyRes = await axios.post('http://localhost:5000/api/v1/auth/verify-otp', {
      mobile,
      otp: devCode,
      purpose: 'PASSWORD_RESET'
    });
    console.log('Verify response:', JSON.stringify(verifyRes.data));
    
  } catch (error) {
    console.error('Error:', JSON.stringify(error.response?.data || error.message));
  }
}

testHttpOtp();
