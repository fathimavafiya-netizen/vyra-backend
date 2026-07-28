import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';

  logger.error({
    msg: `Error caught in middleware: ${message}`,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    code,
  });

  res.status(statusCode).json({
    success: false,
    code,
    message,
    requestId: req.requestId || (req as any).id,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

export default errorMiddleware;
