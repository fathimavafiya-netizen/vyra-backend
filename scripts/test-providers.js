const axios = require('axios');
require('dotenv').config();

async function testProviders() {
  console.log('Testing Fast2SMS...');
  try {
    const fast2smsRes = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
      route: 'v3',
      sender_id: 'FTWSMS',
      message: '123456 is your Sociall verification code. It is valid for 5 minutes.',
      language: 'english',
      flash: 0,
      numbers: '9876543210' // some random number to see if account is active
    }, {
      headers: {
        'authorization': process.env.FAST2SMS_API_KEY,
        'Content-Type': 'application/json',
      }
    });
    console.log('Fast2SMS response:', fast2smsRes.data);
  } catch (e) {
    console.log('Fast2SMS failed:', e.response?.data || e.message);
  }

  console.log('\nTesting Resend...');
  try {
    const resendRes = await axios.post('https://api.resend.com/emails', {
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: 'test@example.com',
      subject: '123456 is your Sociall verification code',
      html: '<p>123456</p>'
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Resend response:', resendRes.data);
  } catch (e) {
    console.log('Resend failed:', e.response?.data || e.message);
  }
}

testProviders();
