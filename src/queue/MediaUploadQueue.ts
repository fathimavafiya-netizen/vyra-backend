import { queueManager } from './queue';
import prisma from '../config/db';
import uploadService from '../services/UploadService';
import eventBus from './EventBus';
import { createChildLogger } from '../logger/childLogger';
import { LogAction } from '../logger/actions';
import fs from 'fs';
import videoProcessor from '../services/VideoProcessor';

const log = createChildLogger('media_upload_queue');

interface UploadPayload {
  jobId: string;
  userId: string;
  filePath: string;
  mimetype: string;
  originalName: string;
  manifest?: any;
}

const updateStatus = async (jobId: string, userId: string, status: string, extraData: any = {}) => {
  await prisma.mediaUploadJob.update({
    where: { jobId },
    data: { status, ...extraData }
  });
  
  // Publish progress event
  await eventBus.publish('upload.progress', { jobId, userId, status, ...extraData });
};

const handleImageUpload = async (payload: UploadPayload): Promise<boolean> => {
  const { jobId, userId, filePath, originalName } = payload;
  
  try {
    log.info({ action: 'UPLOAD_PROCESSING' as any, jobId, userId, message: 'Processing image upload' });
    await updateStatus(jobId, userId, 'PROCESSING');
    
    // Simulate OPTIMIZING step
    await updateStatus(jobId, userId, 'OPTIMIZING');
    
    // Process and upload
    const { secureUrl, publicId } = await uploadService.processImageFromPath(filePath, originalName);
    
    log.info({ action: 'IMAGE_OPTIMIZED' as any, jobId, userId, message: 'Image optimized and uploaded' });
    
    await updateStatus(jobId, userId, 'COMPLETED', {
      secureUrl,
      cloudinaryPublicId: publicId,
      completedAt: new Date()
    });
    
    log.info({ action: 'UPLOAD_COMPLETED' as any, jobId, userId });
    return true;
  } catch (error: any) {
    log.error({ action: 'UPLOAD_FAILED' as any, jobId, userId, error: error.message });
    await updateStatus(jobId, userId, 'FAILED', { errorMessage: error.message });
    throw error;
  } finally {
    try {
      if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
    } catch (e) {}
  }
};

const handleVideoUpload = async (payload: UploadPayload): Promise<boolean> => {
  const { jobId, userId, filePath, originalName, manifest } = payload;
  let finalFilePath = filePath;
  let processedFiles: string[] = [];
  
  try {
    log.info({ action: 'UPLOAD_PROCESSING' as any, jobId, userId, message: 'Processing video upload' });
    await updateStatus(jobId, userId, 'PROCESSING');
    
    if (manifest) {
      await updateStatus(jobId, userId, 'OPTIMIZING');
      try {
        const processedPath = await videoProcessor.processVideo(filePath, manifest);
        finalFilePath = processedPath;
        processedFiles.push(processedPath);
        log.info({ action: 'VIDEO_EDITED' as any, jobId, userId, message: 'Video edits applied successfully' });
      } catch (err: any) {
        log.error({ action: 'VIDEO_EDIT_FAILED' as any, jobId, userId, error: err.message });
        throw err;
      }
    }

    // Process and upload (Cloudinary eager handles the optimization)
    await updateStatus(jobId, userId, 'UPLOADING');
    const { secureUrl, publicId } = await uploadService.processVideoFromPath(finalFilePath, originalName);
    
    log.info({ action: 'VIDEO_UPLOADED' as any, jobId, userId, message: 'Video uploaded with eager transformations' });
    
    await updateStatus(jobId, userId, 'COMPLETED', {
      secureUrl,
      cloudinaryPublicId: publicId,
      completedAt: new Date()
    });
    
    log.info({ action: 'UPLOAD_COMPLETED' as any, jobId, userId });
    return true;
  } catch (error: any) {
    log.error({ action: 'UPLOAD_FAILED' as any, jobId, userId, error: error.message });
    await updateStatus(jobId, userId, 'FAILED', { errorMessage: error.message });
    throw error;
  } finally {
    try {
      if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
      for (const tempFile of processedFiles) {
        if (fs.existsSync(tempFile)) await fs.promises.unlink(tempFile);
      }
    } catch (e) {}
  }
};

export const initMediaUploadQueue = () => {
  queueManager.registerWorker('image_upload', handleImageUpload);
  queueManager.registerWorker('video_upload', handleVideoUpload);
};
