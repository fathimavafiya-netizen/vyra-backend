const axios = require('axios');

async function testHttpOtp() {
  try {
    const mobile = '+919876543210';
    const password = 'NewPassword123!';
    
    try {
      await axios.post('http://localhost:5000/api/v1/auth/register', {
        fullName: 'Test User Mobile 3',
        username: 'testusermob3',
        mobile: mobile,
        countryCode: '+91',
        password: password,
      });
      console.log('User registered.');
    } catch (e) {
      console.log('Registration error:', e.response?.data || e.message);
    }

    console.log('Sending forgot password request...');
    const forgotRes = await axios.post('http://localhost:5000/api/v1/auth/forgot-password', {
      mobile,
    });
    const devCode = forgotRes.data.data.devCode;
    console.log('Got devCode:', devCode);
    
    console.log('Verifying OTP...');
    const verifyRes = await axios.post('http://localhost:5000/api/v1/auth/verify-otp', {
      mobile,
      otp: devCode,
      purpose: 'PASSWORD_RESET'
    });
    console.log('Verify response:', JSON.stringify(verifyRes.data));
    
    console.log('Resetting Password...');
    const resetRes = await axios.post('http://localhost:5000/api/v1/auth/reset-password', {
      mobile,
      otp: devCode,
      password: password,
      confirmPassword: password
    });
    console.log('Reset response:', JSON.stringify(resetRes.data));
    
  } catch (error) {
    console.error('Error:', JSON.stringify(error.response?.data || error.message));
  }
}

testHttpOtp();
