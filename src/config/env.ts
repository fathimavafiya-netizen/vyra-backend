import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('5000'),
  DATABASE_URL: z.string({
    required_error: 'DATABASE_URL environment variable is required',
  }),
  JWT_SECRET: z.string().default('default_jwt_secret_key_placeholder_12345'),
  JWT_REFRESH_SECRET: z.string().default('default_jwt_refresh_key_placeholder_12345'),
  CLOUDINARY_NAME: z.string().optional(),
  CLOUDINARY_KEY: z.string().optional(),
  CLOUDINARY_SECRET: z.string().optional(),
  REDIS_URL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  // Version 3.0 variables
  JWT_KEYS_JSON: z.string().default('{"key1": "default_jwt_secret_key_placeholder_12345", "key2": "backup_jwt_secret_key_placeholder_67890"}'),
  JWT_ACTIVE_KID: z.string().default('key1'),
  LOG_LEVEL: z.string().default('info'),
  COOKIE_DOMAIN: z.string().default(''),
  COOKIE_SECURE: z.string().transform(v => v === 'true').default('false'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),
  OTP_TTL: z.string().transform(v => parseInt(v, 10)).default('300'),
  OTP_MAX_ATTEMPTS: z.string().transform(v => parseInt(v, 10)).default('5'),
  OTP_COOLDOWN: z.string().transform(v => parseInt(v, 10)).default('30'),
  TRUSTED_DEVICE_DAYS: z.string().transform(v => parseInt(v, 10)).default('90'),
  MAX_ACTIVE_SESSIONS: z.string().transform(v => parseInt(v, 10)).default('5'),
  AUDIT_RETENTION_DAYS: z.string().transform(v => parseInt(v, 10)).default('30'),
  FEATURE_EMAIL_LOGIN: z.string().transform(v => v === 'true').default('true'),
  FEATURE_SMS_LOGIN: z.string().transform(v => v === 'true').default('true'),
  FEATURE_AI_LOGIN: z.string().transform(v => v === 'true').default('false'),
  // Google OAuth — must be set in production. In development, the /auth/google endpoint
  // falls back to mock mode and logs a WARN on every hit.
  GOOGLE_CLIENT_ID: z.string().default(''),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(result.error.format(), null, 2));
  process.exit(1);
}

export const env = result.data;
export default env;
