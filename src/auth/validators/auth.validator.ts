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
    platform: z.preprocess((val) => String(val).toUpperCase(), z.enum(['IOS', 'ANDROID', 'WEB'])),
    appVersion: z.string().min(1, 'appVersion is required'),
    rememberDevice: z.boolean().optional().default(false),
    pushToken: z.string().optional(),
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
    platform: z.preprocess((val) => String(val).toUpperCase(), z.enum(['IOS', 'ANDROID', 'WEB'])),
    appVersion: z.string().min(1, 'appVersion is required'),
    rememberDevice: z.boolean().optional().default(false),
    pushToken: z.string().optional(),
  }),
});

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'Full Name must be at least 2 characters long'),
    username: z.string().min(3, 'Username must be at least 3 characters long'),
    email: emailSchema.optional(),
    mobile: mobileSchema.optional(),
    countryCode: z.string().optional(),
    password: z.string().regex(passwordRegex, 'Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    confirmPassword: z.string(),
    consentGiven: z.boolean().refine(val => val === true, 'You must accept the Terms and Conditions'),
    deviceId: z.string().min(1, 'deviceId is required'),
    deviceName: z.string().min(1, 'deviceName is required'),
    platform: z.preprocess((val) => String(val).toUpperCase(), z.enum(['IOS', 'ANDROID', 'WEB'])),
    appVersion: z.string().min(1, 'appVersion is required'),
    rememberDevice: z.boolean().optional().default(false),
    pushToken: z.string().optional(),
  }).refine(data => data.email || data.mobile, {
    message: 'Either email or mobile number is required',
    path: ['email']
  }).refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema.optional(),
    mobile: mobileSchema.optional(),
    password: z.string().min(1, 'Password is required'),
    deviceId: z.string().min(1, 'deviceId is required'),
    deviceName: z.string().min(1, 'deviceName is required'),
    platform: z.preprocess((val) => String(val).toUpperCase(), z.enum(['IOS', 'ANDROID', 'WEB'])),
    appVersion: z.string().min(1, 'appVersion is required'),
    rememberDevice: z.boolean().optional().default(false),
    pushToken: z.string().optional()
  }).refine(data => data.email || data.mobile, {
    message: 'Either email or mobile number is required',
    path: ['email']
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema.optional(),
    mobile: mobileSchema.optional()
  }).refine(data => data.email || data.mobile, {
    message: 'Either email or mobile number is required',
    path: ['email']
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: emailSchema.optional(),
    mobile: mobileSchema.optional(),
    otp: otpSchema,
    password: z.string().regex(passwordRegex, 'Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    confirmPassword: z.string()
  }).refine(data => data.email || data.mobile, {
    message: 'Either email or mobile number is required',
    path: ['email']
  }).refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })
});

export const googleSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, 'Google idToken is required'),
    deviceId: z.string().min(1, 'deviceId is required'),
    deviceName: z.string().min(1, 'deviceName is required'),
    platform: z.preprocess((val) => String(val).toUpperCase(), z.enum(['IOS', 'ANDROID', 'WEB'])),
    appVersion: z.string().min(1, 'appVersion is required'),
    rememberDevice: z.boolean().optional().default(false),
    pushToken: z.string().optional()
  })
});

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

export default {
  sendEmailOtpSchema,
  verifyEmailOtpSchema,
  sendMobileOtpSchema,
  verifyMobileOtpSchema,
  changeEmailSchema,
  changeMobileSchema,
  deleteAccountSchema,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  googleSchema,
};
