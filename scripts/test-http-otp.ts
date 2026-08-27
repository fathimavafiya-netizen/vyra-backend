import axios from 'axios';

async function testHttpOtp() {
  try {
    const email = 'testuser2@example.com';
    const mobile = undefined;
    
    // Create a user first so it exists for PASSWORD_RESET
    try {
      await axios.post('http://localhost:5000/api/v1/auth/register', {
        fullName: 'Test User 2',
        username: 'testuser2',
        email: email,
        password: 'Password123!',
      });
      console.log('User registered.');
    } catch (e: any) {
      console.log('User might already exist:', e.response?.data || e.message);
    }
    
    console.log('Sending forgot password request...');
    const forgotRes = await axios.post('http://localhost:5000/api/v1/auth/forgot-password', {
      email,
      mobile,
    });
    console.log('Forgot response:', forgotRes.data);
    
    const devCode = forgotRes.data.data.devCode;
    console.log('Got devCode:', devCode);
    
    console.log('Verifying OTP...');
    const verifyRes = await axios.post('http://localhost:5000/api/v1/auth/verify-otp', {
      email,
      mobile,
      otp: devCode,
      purpose: 'PASSWORD_RESET'
    });
    console.log('Verify response:', verifyRes.data);
    
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testHttpOtp();
