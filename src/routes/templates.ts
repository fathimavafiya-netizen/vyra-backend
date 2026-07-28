import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { queueManager } from '../queue/queue';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/db';
import { createChildLogger } from '../logger/childLogger';

const log = createChildLogger('templates_route');
const router = express.Router();

/**
 * POST /api/v1/templates/compile
 * Queues a template compilation job.
 */
router.post('/compile', authMiddleware, async (req, res) => {
  const { backgroundUrl, musicTrackUrl, text, themeColor } = req.body;
  const userId = (req as any).user.id;

  if (!backgroundUrl || !musicTrackUrl || !text) {
    return res.status(400).json({ success: false, message: 'Missing required template fields' });
  }

  const jobId = `job_${uuidv4()}`;

  try {
    // We reuse MediaUploadJob to easily track template compilation progress
    await prisma.mediaUploadJob.create({
      data: {
        jobId,
        userId,
        mediaType: 'VIDEO',
        originalFilename: 'template.mp4',
        size: 0,
        status: 'PENDING'
      }
    });

    await queueManager.addJob('template_compile', {
      jobId,
      userId,
      backgroundUrl,
      musicTrackUrl,
      text,
      themeColor
    }, 'high', 0, (req as any).requestId);

    return res.status(202).json({
      success: true,
      jobId,
      message: 'Template compilation queued'
    });
  } catch (error: any) {
    log.error({ action: 'COMPILE_QUEUE_FAILED' as any, userId, error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to queue template compilation' });
  }
});

/**
 * GET /api/v1/templates/job/:jobId
 * Poll the status of a template compilation job.
 */
router.get('/job/:jobId', authMiddleware, async (req, res) => {
  const { jobId } = req.params;
  const userId = (req as any).user.id;

  try {
    const job = await prisma.mediaUploadJob.findUnique({
      where: { jobId }
    });

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    return res.status(200).json({
      success: true,
      job: {
        jobId: job.jobId,
        status: job.status,
        resultUrl: job.secureUrl || null,
        error: job.errorMessage || null
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch job status' });
  }
});

export default router;
