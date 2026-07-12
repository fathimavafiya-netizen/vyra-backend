import prisma from '../config/db';
import authController from '../auth/controllers/AuthController';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as otpUtil from '../utils/otp';

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

// Mock Request & Response helpers
function mockRequest(body = {}, headers: Record<string, string> = {}): Partial<Request> {
  return {
    body,
    ip: '127.0.0.1',
    get: (name: string) => headers[name] || 'mock-agent',
  } as any;
}

function mockResponse() {
  const res: any = {};
  const statusSpy = jestSpy();
  const jsonSpy = jestSpy();
  const cookieSpy = jestSpy();

  res.status = (code: number) => {
    statusSpy.calledWith = code;
    return res;
  };
  res.json = (data: any) => {
    jsonSpy.calledWith = data;
    return res;
  };
  res.cookie = (name: string, value: any, options?: any) => {
    cookieSpy.calledWith = { name, value, options };
    return res;
  };

  return { res: res as Response, statusSpy, jsonSpy, cookieSpy };
}

function jestSpy() {
  const spyObj = {
    calledWith: null as any,
    getCall() {
      return this.calledWith;
    }
  };
  return spyObj;
}

async function cleanupTestData() {
  const testEmails = ['test_auth_user@vyra.com', 'google_v2_test@gmail.com'];
  const testPhones = ['+919876543219', '+12025550199'];
  const testUsernames = ['auth_tester_123', 'google_v2_test'];

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: testEmails } },
        { mobile: { in: testPhones } },
        { username: { in: testUsernames } },
      ],
    },
  });

  const ids = users.map(u => u.id);
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
      contact: { in: [...testEmails, ...testPhones] },
    },
  });
}

async function run() {
  console.log('\n🧪 Upgraded Authentication Module Verification Suite\n');

  await cleanupTestData();

  // Test credentials details
  const registerPayload = {
    fullName: 'Auth Verification Tester',
    username: 'auth_tester_123',
    email: 'test_auth_user@vyra.com',
    mobile: '+919876543219',
    countryCode: '+91',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    consentGiven: true,
    deviceId: 'test_device_001',
    deviceName: 'Expo Mobile Tester',
    platform: 'ANDROID',
    appVersion: '1.0.0',
    rememberDevice: true,
  };

  // ─── 1. USER REGISTRATION ───
  const regReq = mockRequest(registerPayload);
  const regRes = mockResponse();

  await authController.register(regReq as Request, regRes.res as Response, () => {});

  const regResponseData = regRes.jsonSpy.getCall();
  assert(regResponseData?.success === true, 'AUTH-01 Successfully registered new user with email and password');
  
  const createdUser = await prisma.user.findFirst({
    where: { email: registerPayload.email },
    include: { profile: true },
  });
  
  assert(createdUser !== null, 'AUTH-02 User successfully inserted into database');
  assert(createdUser?.fullName === registerPayload.fullName, 'AUTH-03 Full Name correctly populated in User table');
  assert(createdUser?.username === registerPayload.username, 'AUTH-04 Username correctly populated in User table');
  assert(createdUser?.phone === registerPayload.mobile, 'AUTH-05 Phone correctly mapped to Mobile');
  assert(createdUser?.provider === 'credentials', 'AUTH-06 Authentication provider set to credentials');
  
  const isPassHashed = await bcrypt.compare(registerPayload.password, createdUser?.password || '');
  assert(isPassHashed === true, 'AUTH-07 Password correctly hashed using bcrypt');

  // ─── 2. DUPLICATE REGISTRATION PREVENTION ───
  // Try duplicate email
  const dupEmailReq = mockRequest({ ...registerPayload, username: 'another_user' });
  const dupEmailRes = mockResponse();
  await authController.register(dupEmailReq as Request, dupEmailRes.res as Response, () => {});
  const dupEmailData = dupEmailRes.jsonSpy.getCall();
  assert(dupEmailData?.success === false && dupEmailData?.code === 'EMAIL_ALREADY_EXISTS', 'AUTH-08 Prevents duplicate email registration');

  // Try duplicate phone
  const dupPhoneReq = mockRequest({ ...registerPayload, email: 'another@vyra.com', username: 'another_user_2' });
  const dupPhoneRes = mockResponse();
  await authController.register(dupPhoneReq as Request, dupPhoneRes.res as Response, () => {});
  const dupPhoneData = dupPhoneRes.jsonSpy.getCall();
  assert(dupPhoneData?.success === false && dupPhoneData?.code === 'MOBILE_ALREADY_EXISTS', 'AUTH-09 Prevents duplicate phone registration');

  // Try duplicate username
  const dupUserReq = mockRequest({ ...registerPayload, email: 'another@vyra.com', mobile: '+12025550199' });
  const dupUserRes = mockResponse();
  await authController.register(dupUserReq as Request, dupUserRes.res as Response, () => {});
  const dupUserData = dupUserRes.jsonSpy.getCall();
  assert(dupUserData?.success === false && dupUserData?.code === 'USERNAME_TAKEN', 'AUTH-10 Prevents duplicate username registration');

  // ─── 3. EMAIL/PHONE PASSWORD LOGINS ───
  // Email Login
  const loginEmailReq = mockRequest({
    email: registerPayload.email,
    password: registerPayload.password,
    deviceId: registerPayload.deviceId,
    deviceName: registerPayload.deviceName,
    platform: registerPayload.platform,
    appVersion: registerPayload.appVersion,
  });
  const loginEmailRes = mockResponse();
  await authController.login(loginEmailReq as Request, loginEmailRes.res as Response, () => {});
  const loginEmailData = loginEmailRes.jsonSpy.getCall();
  assert(loginEmailData?.success === true, 'AUTH-11 Successfully logged in using email and password');
  assert(loginEmailData?.data?.accessToken !== undefined, 'AUTH-12 Access JWT returned on successful login');

  // Mobile Login
  const loginMobileReq = mockRequest({
    mobile: registerPayload.mobile,
    password: registerPayload.password,
    deviceId: registerPayload.deviceId,
    deviceName: registerPayload.deviceName,
    platform: registerPayload.platform,
    appVersion: registerPayload.appVersion,
  });
  const loginMobileRes = mockResponse();
  await authController.login(loginMobileReq as Request, loginMobileRes.res as Response, () => {});
  const loginMobileData = loginMobileRes.jsonSpy.getCall();
  assert(loginMobileData?.success === true, 'AUTH-13 Successfully logged in using mobile number and password');

  // Invalid password
  const invalidPassReq = mockRequest({
    email: registerPayload.email,
    password: 'WrongPassword123!',
    deviceId: registerPayload.deviceId,
    deviceName: registerPayload.deviceName,
    platform: registerPayload.platform,
    appVersion: registerPayload.appVersion,
  });
  const invalidPassRes = mockResponse();
  await authController.login(invalidPassReq as Request, invalidPassRes.res as Response, () => {});
  const invalidPassData = invalidPassRes.jsonSpy.getCall();
  assert(invalidPassData?.success === false && invalidPassData?.code === 'LOGIN_FAILED', 'AUTH-14 Login fails with incorrect credentials');

  // ─── 4. PASSWORD RECOVERY (OTP & RESET) ───
  // Send reset code
  const resetCodeReq = mockRequest({ email: registerPayload.email });
  const resetCodeRes = mockResponse();
  await authController.forgotPassword(resetCodeReq as Request, resetCodeRes.res as Response, () => {});
  const resetCodeData = resetCodeRes.jsonSpy.getCall();
  assert(resetCodeData?.success === true, 'AUTH-15 Send forgot password OTP dispatched successfully');

  // Verify OTP
  const generatedOtp = resetCodeData?.data?.devCode || '123456';
  const verifyOtpReq = mockRequest({ email: registerPayload.email, otp: generatedOtp, purpose: 'PASSWORD_RESET' });
  const verifyOtpRes = mockResponse();
  await authController.verifyGeneralOtp(verifyOtpReq as Request, verifyOtpRes.res as Response, () => {});
  const verifyOtpData = verifyOtpRes.jsonSpy.getCall();
  assert(verifyOtpData?.success === true, 'AUTH-16 OTP code validated successfully');

  // Reset password
  const resetPassReq = mockRequest({
    email: registerPayload.email,
    otp: generatedOtp,
    password: 'NewPassword123!',
    confirmPassword: 'NewPassword123!',
  });
  const resetPassRes = mockResponse();
  await authController.resetPassword(resetPassReq as Request, resetPassRes.res as Response, () => {});
  const resetPassData = resetPassRes.jsonSpy.getCall();
  assert(resetPassData?.success === true, 'AUTH-17 Password reset transaction committed successfully');

  // Login with new password
  const loginNewPassReq = mockRequest({
    email: registerPayload.email,
    password: 'NewPassword123!',
    deviceId: registerPayload.deviceId,
    deviceName: registerPayload.deviceName,
    platform: registerPayload.platform,
    appVersion: registerPayload.appVersion,
  });
  const loginNewPassRes = mockResponse();
  await authController.login(loginNewPassReq as Request, loginNewPassRes.res as Response, () => {});
  const loginNewPassData = loginNewPassRes.jsonSpy.getCall();
  assert(loginNewPassData?.success === true, 'AUTH-18 Successfully logged in using the newly reset password');

  // ─── 5. GOOGLE SIGN-IN & AUTO LINKING ───
  const googleReq = mockRequest({
    idToken: 'google_v2_test@gmail.com',
    deviceId: registerPayload.deviceId,
    deviceName: registerPayload.deviceName,
    platform: registerPayload.platform,
    appVersion: registerPayload.appVersion,
  });
  const googleRes = mockResponse();
  await authController.google(googleReq as Request, googleRes.res as Response, () => {});
  const googleData = googleRes.jsonSpy.getCall();
  assert(googleData?.success === true, 'AUTH-19 Google authentication login/signup stubs executed successfully');

  const googleUser = await prisma.user.findFirst({
    where: { email: 'google_v2_test@gmail.com' },
  });
  assert(googleUser !== null, 'AUTH-20 Auto-registers google user if not exists');
  assert(googleUser?.provider === 'google', 'AUTH-21 Provider correctly set to google');

  await cleanupTestData();

  const total = passed + failed;
  console.log(`\n──────────────────────────────────────`);
  if (failed > 0) {
    console.error(`Verification FAILED: ${passed}/${total} passed. ${failed} failure(s)`);
    process.exit(1);
  } else {
    console.log(`Verification SUCCESS: ${passed}/${total} assertions passed successfully.`);
    console.log(`🎉 All upgraded authentication system unit and integration tests passed successfully.`);
    process.exit(0);
  }
}

run().catch(async err => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
