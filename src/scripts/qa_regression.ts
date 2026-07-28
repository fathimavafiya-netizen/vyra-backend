import axios from 'axios';
import { io } from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const BASE_URL = 'http://localhost:5000/api/v1';
const SOCKET_URL = 'http://localhost:5000';

const TEST_EMAIL = `qa_test_${Date.now()}@example.com`;
const TEST_PASSWORD = 'QaPassword123!';
const TEST_USERNAME = `qa_user_${Date.now()}`;

let authToken = '';
let userId = '';
let socket: any;

const report: any[] = [];

async function logResult(name: string, execute: () => Promise<any>) {
  const start = Date.now();
  let result: any;
  let status = 'PASS';
  let errorMsg = '';
  let payload: any;
  
  try {
    const res = await execute();
    result = res?.data || res;
  } catch (err: any) {
    status = 'FAIL';
    errorMsg = err.response?.data?.message || err.message;
    result = err.response?.data || err;
  }
  
  const time = Date.now() - start;
  
  report.push({
    test: name,
    status,
    timeMs: time,
    response: result,
    error: errorMsg
  });
  
  console.log(`[${status}] ${name} (${time}ms)`);
  if (status === 'FAIL') {
    console.error(`  -> Error: ${errorMsg}`);
  }
}

async function runTests() {
  console.log('--- STARTING QA REGRESSION TESTS ---');
  
  // 1. Register
  await logResult('AUTH: Register', () => axios.post(`${BASE_URL}/auth/register`, {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    confirmPassword: TEST_PASSWORD,
    username: TEST_USERNAME,
    fullName: 'QA Tester',
    consentGiven: true,
    deviceId: 'qa-device-123',
    deviceName: 'QA Test Device',
    appVersion: '1.0.0',
    platform: 'WEB'
  }));

  // 2. Login
  await logResult('AUTH: Login', async () => {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      deviceId: 'qa-device-123',
      deviceName: 'QA Test Device',
      appVersion: '1.0.0',
      platform: 'WEB'
    });
    authToken = res.data.data.accessToken;
    userId = res.data.data.user.id;
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    return res;
  });

  // 3. Invalid Credentials
  await logResult('AUTH: Invalid Credentials', async () => {
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        email: TEST_EMAIL,
        password: 'WrongPassword',
        deviceId: 'qa-device-123',
        deviceName: 'QA Test Device',
        appVersion: '1.0.0',
        platform: 'WEB'
      });
      throw new Error('Should have failed');
    } catch (e: any) {
      if (e.response?.status === 401) return { success: true };
      throw e;
    }
  });

  // 4. Update Profile
  await logResult('PROFILE: Update Profile', () => axios.put(`${BASE_URL}/users/profile`, {
    bio: 'QA Test Bio'
  }));

  // 5. Media Upload (Create a dummy image)
  let uploadedMediaUrl = '';
  await logResult('UPLOAD: Image', async () => {
    const dummyImagePath = path.join(__dirname, 'dummy.png');
    // 1x1 transparent PNG base64
    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    fs.writeFileSync(dummyImagePath, Buffer.from(pngBase64, 'base64'));
    
    const form = new FormData();
    form.append('image', fs.createReadStream(dummyImagePath));
    
    const res = await axios.post(`${BASE_URL}/upload/image`, form, {
      headers: { ...form.getHeaders() }
    });
    
    uploadedMediaUrl = res.data.data.url;
    fs.unlinkSync(dummyImagePath);
    return res;
  });

  // 6. Create Post
  let postId = '';
  await logResult('POSTS: Create Post', async () => {
    const res = await axios.post(`${BASE_URL}/posts`, {
      caption: 'QA Test Post',
      mediaUrl: uploadedMediaUrl || 'https://example.com/test.jpg',
      type: 'POST'
    });
    postId = res.data.post?.id || res.data.post?._id;
    return res;
  });

  // 7. Feed Refresh
  await logResult('POSTS: Feed Refresh', () => axios.get(`${BASE_URL}/posts/feed?limit=5`));

  // 8. Delete Post
  await logResult('POSTS: Delete Post', () => {
    if (!postId) throw new Error('No postId');
    return axios.delete(`${BASE_URL}/posts/${postId}`);
  });

  // 9. Search
  await logResult('SEARCH: Users', () => axios.get(`${BASE_URL}/search?q=QA&type=USER`));
  await logResult('SEARCH: Posts', () => axios.get(`${BASE_URL}/search?q=QA&type=POST`));

  // 10. Story Upload
  let storyId = '';
  await logResult('STORIES: Upload Story', async () => {
    const res = await axios.post(`${BASE_URL}/stories`, {
      mediaUrl: uploadedMediaUrl || 'https://example.com/story.jpg',
      mediaType: 'IMAGE'
    });
    storyId = res.data.story?.id || res.data.story?._id;
    return res;
  });

  await logResult('STORIES: View Feed', () => axios.get(`${BASE_URL}/stories/feed`));
  
  await logResult('STORIES: Delete Story', () => {
    if (!storyId) throw new Error('No storyId');
    return axios.delete(`${BASE_URL}/stories/${storyId}`);
  });

  // 12. AI Features
  await logResult('AI: Background Replace', () => axios.post(`${BASE_URL}/ai/background-replace`, {
    imageUrl: uploadedMediaUrl || 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    prompt: 'A beautiful sunset on a beach'
  }));

  await logResult('AI: Style Transfer', () => axios.post(`${BASE_URL}/ai/style-transfer`, {
    imageUrl: uploadedMediaUrl || 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    style: 'cartoon'
  }));

  // 13. Templates
  await logResult('TEMPLATES: Generate Template', () => axios.post(`${BASE_URL}/posts/template`, {
    templateId: 'birthday_01',
    mediaUrl: uploadedMediaUrl || 'https://example.com/test.jpg'
  }));

  // 14. Socket.IO Test
  await logResult('CHAT: Socket Connection & Messaging', () => {
    return new Promise((resolve, reject) => {
      socket = io(SOCKET_URL, {
        auth: { token: authToken },
        transports: ['websocket']
      });

      const timeout = setTimeout(() => {
        reject(new Error('Socket operation timed out'));
        socket.disconnect();
      }, 5000);

      socket.on('connect', () => {
        // Join a test room
        socket.emit('join_room', { roomId: 'qa_room' });
      });

      socket.on('user_joined', () => {
        // Test typing
        socket.emit('typing', { roomId: 'qa_room', isTyping: true });
        
        // Send message
        socket.emit('send_message', {
          roomId: 'qa_room',
          text: 'QA Test Message'
        });
      });

      socket.on('new_message', (msg: any) => {
        clearTimeout(timeout);
        socket.disconnect();
        resolve(msg);
      });

      socket.on('connect_error', (err: any) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  });

  // Write Final Report
  fs.writeFileSync(path.join(process.cwd(), 'qa_automated_report.json'), JSON.stringify(report, null, 2));
  console.log('\n--- QA REGRESSION TESTS COMPLETE ---');
  console.log(`Results saved to qa_automated_report.json`);
}

runTests().catch(console.error);
