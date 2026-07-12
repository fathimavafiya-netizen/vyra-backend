import prisma from '../config/db';
import otpUtil from '../utils/otp';
import tokenService from '../auth/services/TokenService';
import authenticationFacade from '../auth/facade/AuthenticationFacade';
import userRepository from '../auth/repositories/UserRepository';
import sessionRepository from '../auth/repositories/SessionRepository';
import deviceRepository from '../auth/repositories/DeviceRepository';
import auditRepository from '../auth/repositories/AuditRepository';
import metricsService from '../monitoring/metrics.service';
import queueManager from '../queue/queue';

const PASS = '✅';
const FAIL = '❌';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`${PASS} ${label}`);
    passed++;
  } else {
    console.error(`${FAIL} FAILED: ${label}`);
    failed++;
  }
}

async function cleanupTestData() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { startsWith: 'v4_verify_' } },
        { mobile: { startsWith: '+919999' } },
      ],
    },
  });
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.device.deleteMany({ where: { userId: { in: ids } } });
    await prisma.profile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.userSettings.deleteMany({ where: { userId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  await prisma.otpVerification.deleteMany({
    where: {
      OR: [
        { contact: { startsWith: 'v4_verify_' } },
        { contact: { startsWith: '+919999' } },
      ],
    },
  });
}

async function run() {
  console.log('\n🧪 Phase 1 V4.0 Enterprise Production Verification Suite\n');

  await cleanupTestData();

  const testUserEmail = 'v4_verify_test@test.com';

  // ─── 1. KEY ID SIGNATURE ROTATION ───
  const token = tokenService.generateAccessToken('v4_test_user', 'USER', 'session_abc_123', 1);
  const decodedHeader = tokenService.verifyAccessToken(token);
  assert(decodedHeader.sub === 'v4_test_user', 'V4-01 Token signed and verified successfully via kid mapping');

  const completeDecoded = require('jsonwebtoken').decode(token, { complete: true }) as any;
  assert(completeDecoded?.header?.kid === 'key1', 'V4-02 JWT header includes correct Key ID (kid)');

  // ─── 2. DECOUPLED DATA REPOSITORIES ───
  const checkUser = await userRepository.findByEmail(testUserEmail);
  assert(checkUser === null, 'V4-03 UserRepository lookup is isolated');

  // ─── 3. PASSWORDLESS LOGIN & SESSION LIMITS ───
  // Create first session via Facade (registers user auto)
  const loginRes = await authenticationFacade.loginOrRegister({
    email: testUserEmail,
    name: 'V4 Verification User',
    deviceId: 'device_0',
    deviceName: 'Chrome Web V4',
    platform: 'WEB',
    appVersion: '1.0.0',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla',
    rememberDevice: true,
  });

  assert(loginRes.accessToken !== undefined, 'V4-04 Facade passwordless auto-registration and login succeeded');

  const user = await userRepository.findByEmail(testUserEmail);
  assert(user !== null, 'V4-05 User successfully auto-registered in database');

  // Login 5 more times to exceed concurrent sessions limits (max 5)
  for (let i = 1; i <= 5; i++) {
    await authenticationFacade.loginOrRegister({
      email: testUserEmail,
      deviceId: `device_${i}`,
      deviceName: `Chrome Web V4 ${i}`,
      platform: 'WEB',
      appVersion: '1.0.0',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla',
      rememberDevice: true,
    });
  }

  const activeSessionsCount = await sessionRepository.countActiveByUserId(user!.id);
  assert(activeSessionsCount === 5, 'V4-06 Max concurrent sessions strictly capped at 5 active sessions');

  const sessions = await sessionRepository.findActiveByUserId(user!.id);
  const oldestSession = await prisma.session.findFirst({
    where: { userId: user!.id, deviceId: 'device_0' },
  });
  assert(oldestSession?.isValid === false, 'V4-07 Max session limit reached: oldest device session successfully evicted');

  // ─── 4. REPLAY ATTACK DETECTION (RTR) ───
  const famLogin = await authenticationFacade.loginOrRegister({
    email: testUserEmail,
    deviceId: 'device_family_test',
    deviceName: 'iPhone V4 client',
    platform: 'IOS',
    appVersion: '2.0.0',
    ipAddress: '127.0.0.1',
    userAgent: 'iOS Mobile',
  });

  // Perform rotation
  const rotated = await authenticationFacade.refreshTokens(famLogin.refreshToken, '127.0.0.1', 'iOS Mobile');
  assert(rotated.accessToken !== undefined, 'V4-08 RTR rotation generated new tokens');

  // Attempt replay attack
  let replayBlocked = false;
  try {
    await authenticationFacade.refreshTokens(famLogin.refreshToken, '127.0.0.1', 'iOS Mobile');
  } catch (err: any) {
    if (err.message.includes('suspicious') || err.message.includes('activity') || err.message.includes('revoked')) {
      replayBlocked = true;
    }
  }
  assert(replayBlocked === true, 'V4-09 Refresh token reuse attempt rejected with family-invalidation safety check');

  const familySession = await prisma.session.findUnique({
    where: { id: famLogin.sessionId },
  });
  const siblingSessions = await prisma.session.findMany({
    where: { familyId: familySession!.familyId, isValid: true },
  });
  assert(siblingSessions.length === 0, 'V4-10 Token reuse detected: invalidated entire token family');

  // ─── 5. BACKGROUND JOB PRIORITY QUEUE ───
  let jobFired: any = false;
  queueManager.registerWorker('security_alert', async (payload) => {
    jobFired = true;
    return true;
  });

  await queueManager.addJob('security_alert', { email: testUserEmail }, 'high');
  // Wait short time to allow queue setInterval loop to process
  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert(jobFired === true, 'V4-11 High-priority security alert job dispatched and processed successfully');

  // ─── 6. AUDIT & METRICS LOGGING ───
  const criticalAudit = await prisma.auditLog.findMany({
    where: { userId: user!.id, severity: 'CRITICAL' },
  });
  assert(criticalAudit.length > 0, 'V4-12 Critical security replay log captured successfully');

  const metricsText = metricsService.getPrometheusMetrics();
  assert(metricsText.includes('vyra_replay_attacks'), 'V4-13 Metrics service exposed Prometheus formatted metrics');

  await cleanupTestData();

  const total = passed + failed;
  console.log(`\n──────────────────────────────────────`);
  if (failed > 0) {
    console.error(`Phase 1 V4.0 Verification: ${passed}/${total} passed. ${failed} test(s) FAILED`);
    process.exit(1);
  } else {
    console.log(`Phase 1 V4.0 Verification: 13/13 Enterprise security tests passed successfully.`);
    console.log(`🎉 All enterprise authentication, authorization, and security verification tests completed successfully.`);
    process.exit(0);
  }
}

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
