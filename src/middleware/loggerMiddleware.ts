import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface CustomRequest extends Request {
  id?: string;
  startTime?: number;
}

export const loggerMiddleware = (req: CustomRequest, res: Response, next: NextFunction) => {
  const reqId = Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
  req.id = reqId;
  req.startTime = Date.now();

  logger.info({
    msg: `Incoming Request: ${req.method} ${req.originalUrl}`,
    requestId: reqId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Capture response body so error details appear in Render logs
  let responseBody: any;
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    const isError = res.statusCode >= 400;

    logger.info({
      msg: `Request Completed: ${req.method} ${req.originalUrl} - Status ${res.statusCode}`,
      requestId: reqId,
      statusCode: res.statusCode,
      durationMs: duration,
      // Log error body so we can diagnose 400/500 responses in Render logs
      ...(isError && responseBody
        ? { errorCode: responseBody.code, errorMessage: responseBody.message }
        : {}),
    });
  });

  next();
};

export default loggerMiddleware;
