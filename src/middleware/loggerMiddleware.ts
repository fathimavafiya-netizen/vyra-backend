import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger/index';
import { LogAction } from '../logger/actions';

export const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health') {
    logger.info({ action: 'HEALTH_CHECK', status: 'UP' });
    return next();
  }

  const startHrTime = process.hrtime.bigint();

  logger.info({
    action: LogAction.REQUEST_INCOMING,
    requestId: req.requestId,
    userId: req.user?.id,
    ip: req.ip,
    method: req.method,
    path: req.originalUrl,
    userAgent: req.get('user-agent'),
    message: `Incoming Request: ${req.method} ${req.originalUrl}`,
  });

  // Capture response body so error details appear in logs
  let responseBody: any;
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startHrTime) / 1000000;
    const isError = res.statusCode >= 400;

    logger.info({
      action: isError ? LogAction.REQUEST_ERROR : LogAction.REQUEST_COMPLETED,
      requestId: req.requestId,
      userId: req.user?.id,
      status: res.statusCode,
      durationMs: Math.round(durationMs), // Optional rounding for cleaner logs
      method: req.method,
      path: req.originalUrl,
      ...(isError && responseBody
        ? { errorCode: responseBody.code, errorMessage: responseBody.message }
        : {}),
      message: `Request Completed: ${req.method} ${req.originalUrl} - Status ${res.statusCode}`,
    });
  });

  next();
};

export default loggerMiddleware;
