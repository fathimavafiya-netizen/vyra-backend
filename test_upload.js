const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

async function run() {
  try {
    console.log('Logging in...');
    const loginRes = await axios.post('http://localhost:5000/api/v1/auth/login', {
      email: 'sarah.jenkins.dev@example.com', password: 'SociallTestSecure!3', deviceId: 'test_dev', deviceName: 'Test', platform: 'WEB', appVersion: '1.0'
    }, { validateStatus: () => true });
    
    let token = null;
    if (!loginRes.data.success) {
      console.log('Login failed, registering...');
      await axios.post('http://localhost:5000/api/v1/auth/register', {
        fullName: 'Sarah Jenkins', username: 'sarah.jenkins.dev', email: 'sarah.jenkins.dev@example.com', password: 'SociallTestSecure!3', confirmPassword: 'SociallTestSecure!3', consentGiven: true, deviceId: 'test_dev', deviceName: 'Test', platform: 'WEB', appVersion: '1.0'
      });
      const loginRes2 = await axios.post('http://localhost:5000/api/v1/auth/login', {
        email: 'sarah.jenkins.dev@example.com', password: 'SociallTestSecure!3', deviceId: 'test_dev', deviceName: 'Test', platform: 'WEB', appVersion: '1.0'
      });
      token = loginRes2.data.data.accessToken;
    } else {
      token = loginRes.data.data.accessToken;
    }
    console.log('Token acquired.');
    
    console.log('Uploading image...');
    const form = new FormData();
    form.append('image', fs.createReadStream('d:\\\\Desktop\\\\sociall\\\\mobile\\\\assets\\\\favicon.png'));
    
    const uploadRes = await axios.post('http://localhost:5000/api/v1/upload/image', form, {
      headers: { 'Authorization': 'Bearer ' + token, ...form.getHeaders() }
    });
    console.log('Upload Response:', uploadRes.data);
    
    const jobId = uploadRes.data.jobId;
    if (!jobId) return;
    
    console.log('Polling status for jobId:', jobId);
    let jobData;
    for (let i = 0; i < 5; i++) {
      const statusRes = await axios.get('http://localhost:5000/api/v1/upload/' + jobId, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      jobData = statusRes.data;
      console.log('Poll ' + i + ':', jobData);
      if (jobData.job && jobData.job.status === 'COMPLETED') break;
      await new Promise(r => setTimeout(r, 2000));
    }
    
    if (jobData && jobData.job && jobData.job.status === 'COMPLETED') {
      console.log('Creating story with URL:', jobData.job.secureUrl);
      const storyRes = await axios.post('http://localhost:5000/api/v1/stories', {
        mediaUrl: jobData.job.secureUrl, mediaType: 'IMAGE', caption: 'Test story'
      }, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      console.log('Story Create Response:', storyRes.data);
    } else {
      console.log('Upload not completed or URL missing.');
    }
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
run();
