import { queueManager } from './queue';
import prisma from '../config/db';
import uploadService from '../services/UploadService';
import templateProcessor from '../services/TemplateProcessor';
import eventBus from './EventBus';
import { createChildLogger } from '../logger/childLogger';
import fs from 'fs';

const log = createChildLogger('template_compile_queue');

interface TemplateCompilePayload {
  jobId: string;
  userId: string;
  backgroundUrl: string;
  musicTrackUrl: string;
  text: string;
  themeColor: string;
}

const updateStatus = async (jobId: string, userId: string, status: string, extraData: any = {}) => {
  // We can reuse the MediaUploadJob model to track the compilation since it has similar fields,
  // or we can just send events. If the database has a specific table for template jobs, use it.
  // For now, let's reuse MediaUploadJob to make it easy to poll.
  await prisma.mediaUploadJob.update({
    where: { jobId },
    data: { status, ...extraData }
  });
  
  await eventBus.publish('template.progress', { jobId, userId, status, ...extraData });
};

const handleTemplateCompile = async (payload: TemplateCompilePayload): Promise<boolean> => {
  const { jobId, userId, backgroundUrl, musicTrackUrl, text, themeColor } = payload;
  let compiledVideoPath = '';
  
  try {
    log.info({ action: 'TEMPLATE_PROCESSING' as any, jobId, userId });
    await updateStatus(jobId, userId, 'PROCESSING');
    
    // Compile using FFmpeg
    compiledVideoPath = await templateProcessor.compile({
      backgroundUrl,
      musicTrackUrl,
      text,
      themeColor
    });
    
    log.info({ action: 'TEMPLATE_COMPILED' as any, jobId, userId });
    await updateStatus(jobId, userId, 'UPLOADING');
    
    // Upload compiled video
    const { secureUrl, publicId } = await uploadService.processVideoFromPath(compiledVideoPath, 'template.mp4');
    
    await updateStatus(jobId, userId, 'COMPLETED', {
      secureUrl,
      cloudinaryPublicId: publicId,
      completedAt: new Date()
    });
    
    log.info({ action: 'TEMPLATE_COMPLETED' as any, jobId, userId });
    return true;
  } catch (error: any) {
    log.error({ action: 'TEMPLATE_FAILED' as any, jobId, userId, error: error.message });
    await updateStatus(jobId, userId, 'FAILED', { errorMessage: error.message });
    throw error;
  } finally {
    try {
      if (compiledVideoPath && fs.existsSync(compiledVideoPath)) {
        await fs.promises.unlink(compiledVideoPath);
      }
    } catch (e) {}
  }
};

export const initTemplateCompileQueue = () => {
  queueManager.registerWorker('template_compile', handleTemplateCompile);
};
