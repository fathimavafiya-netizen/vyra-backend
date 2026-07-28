import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const BASE_URL = 'http://localhost:5000/api/v1';

async function runTest() {
  try {
    console.log('--- STARTING FOLLOW AND VIDEO POST E2E VERIFICATION ---');
    const ts = Date.now();
    // 1. Register and Login user A
    const regA = await axios.post(`${BASE_URL}/auth/register`, {
      email: `testA_${ts}@sociall.com`, password: 'Password123!', confirmPassword: 'Password123!', consentGiven: true, username: `userA_${ts}`, fullName: 'User A', deviceId: 'd1', deviceName: 'D1', appVersion: '1', platform: 'WEB'
    });
    console.log('Reg A:', regA.data);
    const resA = await axios.post(`${BASE_URL}/auth/login`, {
      email: `testA_${ts}@sociall.com`, password: 'Password123!', deviceId: 'd1', deviceName: 'D1', appVersion: '1', platform: 'WEB'
    });
    console.log('Login A:', resA.data);
    const tokenA = resA.data.data.accessToken;
    const userA = resA.data.data.user.id || resA.data.data.user._id || resA.data.user.id;
    console.log('✅ User A logged in:', userA);

    // 2. Register and Login user B
    await axios.post(`${BASE_URL}/auth/register`, {
      email: `testB_${ts}@sociall.com`, password: 'Password123!', confirmPassword: 'Password123!', consentGiven: true, username: `userB_${ts}`, fullName: 'User B', deviceId: 'd2', deviceName: 'D2', appVersion: '1', platform: 'WEB'
    });
    const resB = await axios.post(`${BASE_URL}/auth/login`, {
      email: `testB_${ts}@sociall.com`, password: 'Password123!', deviceId: 'd2', deviceName: 'D2', appVersion: '1', platform: 'WEB'
    });
    const userB = resB.data.data.user.id || resB.data.data.user._id || resB.data.user.id;
    console.log('✅ User B logged in:', userB);

    // 3. Test Follow endpoint (BUG 2 Verification)
    console.log('\n--- TESTING FOLLOW ENDPOINT ---');
    try {
      const followRes = await axios.post(`${BASE_URL}/users/${userB}/follow`, {}, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      console.log('✅ Follow Request Success:', followRes.data);
    } catch (e: any) {
      console.log('❌ Follow Request Failed:', e.response?.data || e.message);
    }

    // 4. Test Video Upload endpoint (BUG 1 Verification)
    console.log('\n--- TESTING VIDEO UPLOAD ENDPOINT ---');
    
    // Create a dummy video file
    const dummyVideoPath = path.join(__dirname, 'dummy_video.mp4');
    fs.writeFileSync(dummyVideoPath, 'dummy video content');

    const form = new FormData();
    form.append('image', fs.createReadStream(dummyVideoPath));
    form.append('manifest', JSON.stringify({ trimStart: 0, trimEnd: 5 }));

    try {
      const uploadRes = await axios.post(`${BASE_URL}/upload/image`, form, {
        headers: { 
          ...form.getHeaders(),
          Authorization: `Bearer ${tokenA}` 
        }
      });
      console.log('✅ Video Upload Response:', uploadRes.data);
      const jobId = uploadRes.data.jobId;

      if (jobId) {
        console.log(`Polling job status for ${jobId}...`);
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const jobRes = await axios.get(`${BASE_URL}/upload/${jobId}`, {
            headers: { Authorization: `Bearer ${tokenA}` }
          });
          console.log(`Job status [Attempt ${i+1}]:`, jobRes.data.job.status);
          if (jobRes.data.job.status === 'COMPLETED' || jobRes.data.job.status === 'FAILED') {
            console.log('Job result:', jobRes.data.job);
            break;
          }
        }
      }
    } catch (e: any) {
      console.log('❌ Video Upload Failed:', e.response?.data || e.message);
    } finally {
      if (fs.existsSync(dummyVideoPath)) fs.unlinkSync(dummyVideoPath);
    }

    console.log('\n--- E2E VERIFICATION COMPLETE ---');
  } catch (error: any) {
    console.error('Test script error:', error.response?.data || error.message);
  }
}

runTest();
