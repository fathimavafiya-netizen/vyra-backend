import prisma from '../config/db';
import * as otpUtil from '../utils/otp';
import bcrypt from 'bcryptjs';

async function diagnose() {
  const contact = 'fathima.vafiya@lead.ac.in';
  const type = 'EMAIL';
  const purpose = 'LOGIN';

  console.log('--- DIAGNOSING OTP ISSUE ---');
  
  // 1. Generate and Save OTP
  const code = otpUtil.generateOtp();
  console.log(`Generated OTP: "${code}"`);

  await otpUtil.saveOtpToDB(contact, code, type, purpose);
  console.log('Saved OTP to DB.');

  // 2. Read from DB
  const record = await prisma.otpVerification.findUnique({
    where: {
      contact_type_purpose: { contact, type, purpose },
    },
  });

  if (!record) {
    console.error('ERROR: Record not found in DB!');
    return;
  }

  console.log('Record in DB:', {
    contact: record.contact,
    type: record.type,
    purpose: record.purpose,
    otpHash: record.otpHash,
    expiresAt: record.expiresAt,
    verified: record.verified,
    attempts: record.attempts,
    lockedUntil: record.lockedUntil,
  });

  const now = new Date();
  console.log(`Current Time (now): ${now.toISOString()}`);
  console.log(`Expires At: ${record.expiresAt.toISOString()}`);
  console.log(`Is Expired? ${record.expiresAt < now}`);
  console.log(`Is Verified? ${record.verified}`);

  // 3. Bcrypt Check
  const isMatch = await bcrypt.compare(code, record.otpHash);
  console.log(`Bcrypt compare match with "${code}": ${isMatch}`);

  const isMatch123456 = await bcrypt.compare('123456', record.otpHash);
  console.log(`Bcrypt compare match with "123456": ${isMatch123456}`);

  // 4. Run verify
  const verifyResult = await otpUtil.verifyOtpFromDB(contact, code, type, purpose);
  console.log('Verification Result:', verifyResult);
}

diagnose()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
