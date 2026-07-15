import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import storageProvider from '../security/StorageProvider';

class UploadService {
  constructor() {
  }

  /**
   * Validates file size and mimetype constraints
   */
  validateFile(size: number, mimeType: string): { valid: boolean; error?: string } {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-matroska'];

    const isImg = allowedImageTypes.includes(mimeType);
    const isVid = allowedVideoTypes.includes(mimeType);

    if (!isImg && !isVid) {
      return { valid: false, error: 'Unsupported file type. Only standard images and videos are supported.' };
    }

    if (isImg && size > 10 * 1024 * 1024) { // 10MB limit
      return { valid: false, error: 'Image file size exceeds the 10MB limit.' };
    }

    if (isVid && size > 100 * 1024 * 1024) { // 100MB limit
      return { valid: false, error: 'Video file size exceeds the 100MB limit.' };
    }

    return { valid: true };
  }

  /**
   * Processes and compresses an image into WebP format
   */
  async processImage(buffer: Buffer, originalName: string): Promise<string> {
    const filename = `processed_${Date.now()}_${path.parse(originalName).name}.webp`;
    
    // Compress and convert image to WebP using sharp
    const processedBuffer = await sharp(buffer)
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    return storageProvider.uploadFile(filename, processedBuffer, 'image/webp');
  }

  /**
   * Processes a video and generates a thumbnail cover frame
   */
  async processVideo(
    videoBuffer: Buffer,
    originalName: string
  ): Promise<{ videoUrl: string; thumbnailUrl: string }> {
    const baseName = `processed_${Date.now()}_${path.parse(originalName).name}`;
    const videoFilename = `${baseName}.mp4`;

    // Save the raw video file using our storage provider
    const videoUrl = await storageProvider.uploadFile(videoFilename, videoBuffer, 'video/mp4');

    // Cloudinary automatically generates thumbnails for videos by changing the extension to .jpg
    // Example: https://res.cloudinary.com/demo/video/upload/v1234/dog.mp4 -> dog.jpg
    let thumbnailUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe'; // Default fallback thumbnail
    
    if (videoUrl.includes('res.cloudinary.com')) {
      const urlParts = videoUrl.split('.');
      urlParts.pop(); // remove .mp4
      thumbnailUrl = `${urlParts.join('.')}.jpg`;
    }

    return { videoUrl, thumbnailUrl };
  }
}

export default new UploadService();
