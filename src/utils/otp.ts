import { Resend } from 'resend';
import prisma from '../config/db';
import twilio from 'twilio';
import logger from './logger';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Twilio
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null;

const isDev = process.env.NODE_ENV !== 'production';

// ─── OTP GENERATION ───
export const generateOtp = (): string => {
  // Cryptographically secure pseudorandom 6-digit number
  return randomInt(100000, 1000000).toString();
};

// ─── SAVE OTP TO DATABASE ───
export const saveOtpToDB = async (
  contact: string,
  code: string,
  type: 'EMAIL' | 'MOBILE',
  purpose = 'LOGIN'
): Promise<void> => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minute expiry

  // Find existing OTP record for this contact/type/purpose compound unique key
  const existing = await prisma.otpVerification.findUnique({
    where: {
      contact_type_purpose: { contact, type, purpose },
    },
  });

  if (existing) {
    // 1. Check lock status (Bypassed in development mode)
    if (!isDev && existing.lockedUntil && existing.lockedUntil > now) {
      const remainingMinutes = Math.ceil((existing.lockedUntil.getTime() - now.getTime()) / (60 * 1000));
      throw new Error(`This contact is temporarily locked due to suspicious activity. Try again in ${remainingMinutes} minute(s).`);
    }

    // 2. Prevent duplicate requests: 30 second cooldown check
    const timeSinceLastSent = now.getTime() - existing.lastSentAt.getTime();
    if (timeSinceLastSent < 30 * 1000) {
      throw new Error('OTP already sent. Please wait 30 seconds.');
    }

    // 3. Resend Limit checks: Hour and Day
    let hourCount = existing.resendCountHour;
    let dayCount = existing.resendCountDay;

    // Reset hour limit if last sent was over an hour ago
    if (now.getTime() - existing.lastSentAt.getTime() > 60 * 60 * 1000) {
      hourCount = 0;
    }
    // Reset day limit if last sent was over 24 hours ago
    if (now.getTime() - existing.lastSentAt.getTime() > 24 * 60 * 60 * 1000) {
      dayCount = 0;
    }

    // Check limits (Bypassed in development mode for easier local testing/debugging)
    if (!isDev && hourCount >= 5) {
      throw new Error('Too many OTP requests (Limit: 5/hour). Please try again later.');
    }
    if (!isDev && dayCount >= 20) {
      // Lock contact for 24 hours
      await prisma.otpVerification.update({
        where: {
          contact_type_purpose: { contact, type, purpose },
        },
        data: {
          lockedUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          resendCountHour: 0,
          resendCountDay: 0,
        },
      });
      throw new Error('Suspicious activity detected. Daily OTP limit exceeded. Locked for 24 hours.');
    }

    // 4. Hash and save the new OTP code
    const otpHash = await bcrypt.hash(code, 10);
    await prisma.otpVerification.update({
      where: {
        contact_type_purpose: { contact, type, purpose },
      },
      data: {
        otpHash,
        expiresAt,
        attempts: 0,
        verified: false,
        lastSentAt: now,
        resendCountHour: hourCount + 1,
        resendCountDay: dayCount + 1,
      },
    });
  } else {
    // Brand new contact record
    const otpHash = await bcrypt.hash(code, 10);
    await prisma.otpVerification.create({
      data: {
        contact,
        type,
        purpose,
        otpHash,
        expiresAt,
        attempts: 0,
        verified: false,
        lastSentAt: now,
        resendCountHour: 1,
        resendCountDay: 1,
      },
    });
  }
};

// ─── VERIFY OTP FROM DATABASE ───
export const verifyOtpFromDB = async (
  contact: string,
  code: string,
  type: 'EMAIL' | 'MOBILE',
  purpose = 'LOGIN'
): Promise<{ valid: boolean }> => {
  const now = new Date();

  const record = await prisma.otpVerification.findUnique({
    where: {
      contact_type_purpose: { contact, type, purpose },
    },
  });

  if (!record) {
    return { valid: false };
  }

  // 1. Check lock status (Bypassed in development mode)
  if (!isDev && record.lockedUntil && record.lockedUntil > now) {
    const remainingMinutes = Math.ceil((record.lockedUntil.getTime() - now.getTime()) / (60 * 1000));
    throw new Error(`This contact is temporarily locked. Try again in ${remainingMinutes} minute(s).`);
  }

  // 2. Check if expired or already verified
  if (record.expiresAt < now || record.verified) {
    return { valid: false };
  }

  // 3. Match code using bcrypt
  const isMatch = await bcrypt.compare(code, record.otpHash);

  if (!isMatch) {
    const updatedAttempts = record.attempts + 1;

    if (updatedAttempts >= 5) {
      // Lock contact for 10 minutes on 5 consecutive failures
      await prisma.otpVerification.update({
        where: {
          contact_type_purpose: { contact, type, purpose },
        },
        data: {
          attempts: 0,
          lockedUntil: new Date(now.getTime() + 10 * 60 * 1000),
          expiresAt: now, // Invalidate current OTP
        },
      });
      throw new Error('OTP expired. Please request a new OTP.');
    } else {
      await prisma.otpVerification.update({
        where: {
          contact_type_purpose: { contact, type, purpose },
        },
        data: { attempts: updatedAttempts },
      });
      return { valid: false };
    }
  }

  // 4. Verification success: reset attempts, mark verified
  await prisma.otpVerification.update({
    where: {
      contact_type_purpose: { contact, type, purpose },
    },
    data: {
      verified: true,
      attempts: 0,
    },
  });

  return { valid: true };
};

// ─── SEND EMAIL OTP via RESEND ───
export const sendOtpViaEmail = async (email: string, code: string): Promise<{ success: boolean; devCode?: string }> => {
  logger.info(`\n==========================================`);
  logger.info(`📧 EMAIL OTP for [${email}] → CODE: ${code}`);
  logger.info(`==========================================\n`);

  if (!process.env.RESEND_API_KEY) {
    logger.warn('⚠️ RESEND_API_KEY missing. OTP only shown in console.');
    return { success: true, devCode: isDev ? code : undefined };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: email,
      subject: `${code} is your Vyra verification code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #090A0F; color: #fff; border-radius: 16px;">
          <h1 style="color: #00F2FE; font-size: 32px; margin-bottom: 4px;">Vyra</h1>
          <p style="color: #8E9A9E; margin-top: 0;">Create. Connect. Inspire.</p>
          <hr style="border-color: rgba(255,255,255,0.08); margin: 24px 0;" />
          <p style="font-size: 16px; color: #C5C6C7;">Your one-time verification code is:</p>
          <div style="background: rgba(0,242,254,0.1); border: 1px solid #00F2FE; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 48px; font-weight: bold; letter-spacing: 12px; color: #00F2FE;">${code}</span>
          </div>
          <p style="color: #8E9A9E; font-size: 14px;">This code expires in <strong style="color:#fff;">5 minutes</strong>. Do not share it with anyone.</p>
          <p style="color: #45A29E; font-size: 12px; margin-top: 32px;">If you did not request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      logger.error(`❌ Resend error: ${JSON.stringify(error)}`);
      return { success: true, devCode: isDev ? code : undefined };
    }

    logger.info(`📧 [EMAIL SENT] OTP delivered to ${email} via Resend. ID: ${data?.id}`);
    return { success: true };
  } catch (err: any) {
    logger.error(`❌ Failed to send email OTP: ${err.message}`);
    return { success: true, devCode: isDev ? code : undefined };
  }
};

// ─── SEND SMS OTP via FAST2SMS or TWILIO ───
export const sendOtpViaSms = async (mobile: string, code: string): Promise<{ success: boolean; devCode?: string }> => {
  logger.info(`\n==========================================`);
  logger.info(`📲 MOBILE OTP for [${mobile}] → CODE: ${code}`);
  logger.info(`==========================================\n`);

  const isUsaNumber = mobile.startsWith('+1');

  if (isUsaNumber) {
    if (!twilioClient || !twilioPhone) {
      logger.warn('⚠️ Twilio config missing. Twilio SMS skipped.');
      return { success: true, devCode: isDev ? code : undefined };
    }

    try {
      const message = await twilioClient.messages.create({
        body: `Your Vyra verification code is: ${code}. Valid for 5 minutes.`,
        from: twilioPhone,
        to: mobile,
      });
      logger.info(`📲 [TWILIO SMS SENT] Dispatched to ${mobile}. SID: ${message.sid}`);
      return { success: true };
    } catch (err: any) {
      logger.error(`❌ Failed to send SMS via Twilio: ${err.message}`);
      return { success: true, devCode: isDev ? code : undefined };
    }
  } else {
    const apiKey = process.env.FAST2SMS_API_KEY;

    if (!apiKey) {
      logger.warn('⚠️ FAST2SMS_API_KEY missing. Fast2SMS SMS skipped.');
      return { success: true, devCode: isDev ? code : undefined };
    }

    try {
      const cleanMobile = mobile.replace(/^\+91/, '').replace(/\D/g, '');
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'q',
          message: `Your Vyra verification code is: ${code}. Valid for 5 minutes. Do not share this code with anyone.`,
          language: 'english',
          flash: 0,
          numbers: cleanMobile,
        }),
      });

      const responseData = await response.json() as any;

      if (responseData.return === true) {
        logger.info(`📲 [FAST2SMS SMS SENT] Sent to ${mobile} via Fast2SMS Quick Route`);
        return { success: true };
      } else {
        logger.error(`❌ Fast2SMS error: ${JSON.stringify(responseData)}`);
        return { success: true, devCode: isDev ? code : undefined };
      }
    } catch (err: any) {
      logger.error(`❌ Failed to send SMS via Fast2SMS: ${err.message}`);
      return { success: true, devCode: isDev ? code : undefined };
    }
  }
};

export default {
  generateOtp,
  saveOtpToDB,
  verifyOtpFromDB,
  sendOtpViaEmail,
  sendOtpViaSms,
};
