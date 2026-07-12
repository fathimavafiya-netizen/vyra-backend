import prisma from '../config/db';
import otpUtil from '../utils/otp';
import jwtUtil, { hashToken } from '../utils/jwt';
import authService from '../services/AuthService';
import lockUtil from '../utils/lock';
import auditUtil from '../utils/audit';
import metricsUtil from '../utils/metrics';

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
        { email: { startsWith: 'v3_verify_' } },
        { mobile: { startsWith: '+919999' } },
      ],
    },
  });
  const ids = users.map(u => u.id);
  if (ids.length > 0) {
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.profile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.userSettings.deleteMany({ where: { userId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  // Clear OTP verifications
  await prisma.otpVerification.deleteMany({
    where: {
      OR: [
        { contact: { startsWith: 'v3_verify_' } },
        { contact: { startsWith: '+919999' } },
      ],
    },
  });
}

async function run() {
  console.log('\n🧪 Phase 1 V3.0 Enterprise Production Verification Suite\n');

  await cleanupTestData();

  const testUserEmail = 'v3_verify_test@test.com';

  // ─────────────────────────────────────────
  // 1. Key ID (kid) Secret Rotation
  // ─────────────────────────────────────────
  // Sign token via active key
  const token = jwtUtil.generateAccessToken('v3_test_user_id', 'USER', 'session_abc_123', 1);
  const decodedHeader = jwtUtil.verifyAccessToken(token);
  assert(decodedHeader.sub === 'v3_test_user_id', 'V3-01 Token signed and verified successfully');
  
  // Verify token encodes Key ID 'kid' (defaults to key1)
  const completeDecoded = require('jsonwebtoken').decode(token, { complete: true }) as any;
  assert(completeDecoded?.header?.kid === 'key1', 'V3-02 JWT header includes correct Key ID (kid)');

  // ─────────────────────────────────────────
  // 2. Distributed Locking
  // ─────────────────────────────────────────
  const lockKey = 'lock:verify:otp:1';
  const acquiredFirst = await lockUtil.acquireLock(lockKey, 2000);
  assert(acquiredFirst === true, 'V3-03 Lock acquired successfully on first request');

  const acquiredSecond = await lockUtil.acquireLock(lockKey, 2000);
  assert(acquiredSecond === false, 'V3-04 Duplicate lock request blocked (concurrency safety)');

  await lockUtil.releaseLock(lockKey);
  const acquiredThird = await lockUtil.acquireLock(lockKey, 2000);
  assert(acquiredThird === true, 'V3-05 Lock released and re-acquired successfully');
  await lockUtil.releaseLock(lockKey);

  // ─────────────────────────────────────────
  // 3. Session Limits & Eviction (Max 5 sessions)
  // ─────────────────────────────────────────
  // Register the user
  const reg = await authService.register({
    name: 'V3 Evict User',
    email: testUserEmail,
    deviceId: 'device_0',
    platform: 'WEB',
    deviceName: 'Chrome Web',
    appVersion: '1.0.0',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla',
    rememberDevice: true,
  });

  // Log in 5 more times with different deviceIds (creating total 6 sessions)
  for (let i = 1; i <= 5; i++) {
    await authService.login({
      email: testUserEmail,
      deviceId: `device_${i}`,
      platform: 'WEB',
      deviceName: `Chrome Web ${i}`,
      appVersion: '1.0.0',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla',
      rememberDevice: true,
    });
  }

  // Verify oldest session (device_0) was evicted (isValid = false)
  const sessions = await prisma.session.findMany({
    where: { userId: reg.user.id },
    orderBy: { createdAt: 'asc' },
  });

  assert(sessions.length === 6, 'V3-06 Total session records persisted in DB');
  assert(sessions[0].deviceId === 'device_0' && sessions[0].isValid === false, 'V3-07 Session limits: oldest session successfully evicted (isValid = false)');
  
  const activeSessionsCount = await prisma.session.count({
    where: { userId: reg.user.id, isValid: true },
  });
  assert(activeSessionsCount === 5, 'V3-08 Maximum concurrent sessions strictly limited to 5 devices');

  // ─────────────────────────────────────────
  // 4. Refresh Token Families & Replay Detection
  // ─────────────────────────────────────────
  // Login to get a valid token family
  const famLogin = await authService.login({
    email: testUserEmail,
    deviceId: 'device_family_test',
    platform: 'IOS',
    deviceName: 'iPhone Client',
    appVersion: '2.0.0',
    ipAddress: '127.0.0.1',
    userAgent: 'iOS Mobile',
  });

  // Perform rotation once (RTR)
  const rotated = await authService.refreshToken({
    refreshToken: famLogin.refreshToken,
    ipAddress: '127.0.0.1',
    userAgent: 'iOS Mobile',
  });
  assert(rotated.accessToken !== undefined, 'V3-09 Valid token rotated successfully');

  // Attempt replay: submit the OLD refresh token again
  let replayBlocked = false;
  try {
    await authService.refreshToken({
      refreshToken: famLogin.refreshToken,
      ipAddress: '127.0.0.1',
      userAgent: 'iOS Mobile',
    });
  } catch (err: any) {
    if (err.message.includes('revoked') || err.message.includes('activity')) {
      replayBlocked = true;
    }
  }
  assert(replayBlocked === true, 'V3-10 Refresh token replay attempt rejected with security exception');

  // Assert that ALL sessions in the family got invalidated immediately
  const familySession = await prisma.session.findUnique({
    where: { id: famLogin.sessionId },
  });

  const siblingSessions = await prisma.session.findMany({
    where: { familyId: familySession!.familyId, isValid: true },
  });
  assert(siblingSessions.length === 0, 'V3-11 Replay detection: revoked entire token family to prevent session hijacking');

  // ─────────────────────────────────────────
  // 5. Audit logs severity levels
  // ─────────────────────────────────────────
  // Query critical audit events logged during replay
  const auditLogs = await prisma.auditLog.findMany({
    where: { userId: reg.user.id, severity: 'CRITICAL' },
  });
  assert(auditLogs.length > 0, 'V3-12 Critical severity audit log persisted on replay detection');
  assert(auditLogs[0].action === 'REFRESH_ROTATED', 'V3-13 Audit log maps correct action enum name');

  // Cleanup
  await cleanupTestData();

  const total = passed + failed;
  console.log(`\n──────────────────────────────────────`);
  if (failed > 0) {
    console.error(`Phase 1 V3.0 Verification: ${passed}/${total} passed. ${failed} test(s) FAILED`);
    process.exit(1);
  } else {
    console.log(`Phase 1 V3.0 Verification: 13/13 Enterprise security tests passed successfully.`);
    console.log(`🎉 All enterprise authentication, authorization, and security verification tests completed successfully.`);
    process.exit(0);
  }
}

run().catch(async err => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
