import { Router, Request, Response } from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/authMiddleware';
import { queueManager } from '../queue/queue';
import prisma from '../config/db';
import { createChildLogger } from '../logger/childLogger';
import { LogAction } from '../logger/actions';

const router = Router();
const log = createChildLogger('upload_route');

// Configure local disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `sociall-upload-${uuidv4()}${ext}`);
  }
});

// Configure File Filters
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm', 'video/mov'];
    
    if (allowedImageTypes.includes(file.mimetype) || allowedVideoTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    
    cb(new Error('Unsupported file type. Only standard images and videos are supported.'));
  }
});

router.post('/image', authMiddleware, upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const userId = (req as any).user.id;
    const jobId = uuidv4();
    const mediaType = req.file.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE';

    await prisma.mediaUploadJob.create({
      data: {
        jobId,
        userId,
        status: 'QUEUED',
        mediaType,
        originalFilename: req.file.originalname,
        size: req.file.size
      }
    });

    log.info({ action: 'UPLOAD_QUEUED' as any, userId, jobId, file: req.file.originalname });

    const queueName = mediaType === 'VIDEO' ? 'video_upload' : 'image_upload';
    
    let manifest = null;
    if (req.body.manifest) {
      try {
        manifest = JSON.parse(req.body.manifest);
      } catch (e) {
        log.warn({ action: 'MANIFEST_PARSE_ERROR' as any, error: (e as any).message });
      }
    }

    await queueManager.addJob(queueName, {
      jobId,
      userId,
      filePath: req.file.path,
      mimetype: req.file.mimetype,
      originalName: req.file.originalname,
      manifest
    }, 'high', 0, (req as any).requestId);

    return res.status(202).json({
      success: true,
      message: 'Upload processing started',
      jobId
    });
  } catch (error: any) {
    log.error({ action: 'UPLOAD_FAILED' as any, error: error.message });
    return res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/media', authMiddleware, upload.array('media', 10), async (req: Request, res: Response) => {
  try {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const userId = (req as any).user.id;
    const files = req.files as Express.Multer.File[];
    const jobs = [];

    for (const file of files) {
      const jobId = uuidv4();
      const mediaType = file.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE';

      await prisma.mediaUploadJob.create({
        data: {
          jobId,
          userId,
          status: 'QUEUED',
          mediaType,
          originalFilename: file.originalname,
          size: file.size
        }
      });

      log.info({ action: 'UPLOAD_QUEUED' as any, userId, jobId, file: file.originalname });

      const queueName = mediaType === 'VIDEO' ? 'video_upload' : 'image_upload';
      await queueManager.addJob(queueName, {
        jobId,
        userId,
        filePath: file.path,
        mimetype: file.mimetype,
        originalName: file.originalname
      }, 'high', 0, (req as any).requestId);

      jobs.push({ jobId, originalName: file.originalname });
    }

    return res.status(202).json({
      success: true,
      message: 'Uploads processing started',
      jobs
    });
  } catch (error: any) {
    log.error({ action: 'UPLOAD_FAILED' as any, error: error.message });
    return res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/:jobId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const job = await prisma.mediaUploadJob.findUnique({
      where: { jobId: req.params.jobId }
    });

    if (!job) {
      return res.status(404).json({ success: false, message: 'Upload job not found' });
    }

    // Optional: Check if user is the owner
    const userId = (req as any).user.id;
    if (job.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to job status' });
    }

    return res.json({
      success: true,
      job
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
