import { Response } from 'express';

export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({
    success: true,
    data,
  });
}

export function setDraftETag(res: Response, version: number) {
  res.setHeader("ETag", `"${version}"`);
}
