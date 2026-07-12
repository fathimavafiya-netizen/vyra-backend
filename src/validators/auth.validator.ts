import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

// Helper to validate phone numbers (India +91 & USA +1)
const isValidPhone = (val: string) => {
  const trimmed = val.trim();
  if (trimmed.startsWith('+91')) {
    const digits = trimmed.slice(3);
    return /^[6-9]\d{9}$/.test(digits);
  } else if (trimmed.startsWith('+1')) {
    const parsed = parsePhoneNumberFromString(trimmed);
    return parsed ? parsed.isValid() : false;
  }
  return false;
};

// Base reusable fields
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address')
  .refine((val) => {
    const parts = val.split('@');
    if (parts.length !== 2) return false;
    const domain = parts[1];
    return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
  }, { message: 'Invalid email domain structure' });

const mobileSchema = z
  .string()
  .trim()
  .refine(isValidPhone, {
    message: 'Mobile number must start with +91 (India) or +1 (USA, valid phone format)',
  });

const otpSchema = z
  .string()
  .trim()
  .length(6, 'OTP must be exactly 6 digits')
  .regex(/^\d+$/, 'OTP must contain only numbers');

const deviceDetailsSchema = z.object({
  deviceId: z.string().min(1, 'deviceId is required'),
  deviceName: z.string().min(1, 'deviceName is required'),
  platform: z.enum(['IOS', 'ANDROID', 'WEB']),
  appVersion: z.string().min(1, 'appVersion is required'),
  rememberDevice: z.boolean().optional().default(false),
});

// Zod schemas for routes
export const sendEmailOtpSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export const verifyEmailOtpSchema = z.object({
  body: z.object({
    email: emailSchema,
    otp: otpSchema,
    name: z.string().min(2, 'Name must be at least 2 characters long').optional(),
    deviceId: z.string().min(1, 'deviceId is required'),
    deviceName: z.string().min(1, 'deviceName is required'),
    platform: z.enum(['IOS', 'ANDROID', 'WEB']),
    appVersion: z.string().min(1, 'appVersion is required'),
    rememberDevice: z.boolean().optional().default(false),
  }),
});

export const sendMobileOtpSchema = z.object({
  body: z.object({
    mobile: mobileSchema,
  }),
});

export const verifyMobileOtpSchema = z.object({
  body: z.object({
    mobile: mobileSchema,
    otp: otpSchema,
    deviceId: z.string().min(1, 'deviceId is required'),
    deviceName: z.string().min(1, 'deviceName is required'),
    platform: z.enum(['IOS', 'ANDROID', 'WEB']),
    appVersion: z.string().min(1, 'appVersion is required'),
    rememberDevice: z.boolean().optional().default(false),
  }),
});

// Sensitive operations validation (Account Recovery Protection)
export const changeEmailSchema = z.object({
  body: z.object({
    newEmail: emailSchema,
    otp: otpSchema,
  }),
});

export const changeMobileSchema = z.object({
  body: z.object({
    newMobile: mobileSchema,
    otp: otpSchema,
  }),
});

export const deleteAccountSchema = z.object({
  body: z.object({
    otp: otpSchema,
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

// Retaining mock compatibilities
export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: emailSchema.optional(),
    mobile: mobileSchema.optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema.optional(),
    mobile: mobileSchema.optional(),
  }),
});

export default {
  sendEmailOtpSchema,
  verifyEmailOtpSchema,
  sendMobileOtpSchema,
  verifyMobileOtpSchema,
  changeEmailSchema,
  changeMobileSchema,
  deleteAccountSchema,
  refreshSchema,
  registerSchema,
  loginSchema,
};
