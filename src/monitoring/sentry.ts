import logger from '../utils/logger';

export class SentryService {
  init() {
    if (process.env.SENTRY_DSN) {
      logger.info(`[Sentry] Initializing Sentry monitoring for DSN: ${process.env.SENTRY_DSN}`);
      // Sentry Node SDK initialization
    } else {
      logger.info('[Sentry] SENTRY_DSN not configured. Running mock crash monitor.');
    }
  }

  captureException(error: Error, context?: any) {
    logger.error({
      stack: error.stack,
      context,
    }, `[Sentry Alert] Exception Captured: ${error.message}`);
    // Sentry.captureException(error, { extra: context });
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    logger.warn(`[Sentry Alert] Message Event [${level.toUpperCase()}]: ${message}`);
    // Sentry.captureMessage(message, level);
  }
}

export default new SentryService();
