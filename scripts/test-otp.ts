import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import otpUtil from '../src/utils/otp';

const prisma = new PrismaClient();

async function test() {
  const contact = 'test@example.com';
  const type = 'EMAIL';
  const purpose = 'PASSWORD_RESET';
  
  const code = otpUtil.generateOtp();
  console.log('Generated OTP:', code);
  
  await otpUtil.saveOtpToDB(contact, code, type, purpose);
  console.log('Saved to DB');

  const { valid } = await otpUtil.verifyOtpFromDB(contact, code, type, purpose);
  console.log('Verification result:', valid);
}

test().catch(console.error).finally(() => prisma.$disconnect());
