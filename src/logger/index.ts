import pino from 'pino';
import env from '../config/env';

/**
 * Base Pino logger instance.
 * - Uses \pino-pretty\ in non-production environments for readability.
 * - Logs as standard JSON in production.
 */
const getLogLevel = () => {
  if (env.NODE_ENV === 'production') return 'warn';
  if ((env.NODE_ENV as string) === 'staging') return 'info';
  return 'debug';
};

export const logger = pino({
  level: getLogLevel(),
  redact: [
    'req.headers.authorization',
    'authorization',
    'cookie',
    'password',
    'otp',
    'refreshToken',
    'accessToken',
  ],
  transport: env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
  // Ensure that error objects are serialized correctly, matching the standard error logging
  serializers: {
    err: (err) => ({
      errorName: err.name || 'Error',
      message: err.message,
      stack: err.stack,
    }),
    error: (err) => ({
      errorName: err.name || 'Error',
      message: err.message,
      stack: err.stack,
    }),
  },
});

export default logger;
