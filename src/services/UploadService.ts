import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { LocalStorageProvider, StorageProvider } from './StorageProvider';

class UploadService {
  private storage: StorageProvider;
  private uploadDir: string;

  constructor() {
    this.storage = new LocalStorageProvider();
    this.uploadDir = path.join(__dirname, '..', '..', 'uploads');
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

    return this.storage.saveFile(processedBuffer, filename, 'image/webp');
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
    const thumbnailFilename = `thumb_${baseName}.jpg`;

    // Save the raw video file using our storage provider
    const videoUrl = await this.storage.saveFile(videoBuffer, videoFilename, 'video/mp4');

    // Attempt to generate a thumbnail frame using fluent-ffmpeg with a graceful fallback
    const tempVideoPath = path.join(this.uploadDir, videoFilename);
    const tempThumbPath = path.join(this.uploadDir, thumbnailFilename);

    let thumbnailUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe'; // Default fallback thumbnail

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tempVideoPath)
          .screenshots({
            timestamps: ['1'],
            filename: thumbnailFilename,
            folder: this.uploadDir,
            size: '320x240'
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });

      if (fs.existsSync(tempThumbPath)) {
        const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
        thumbnailUrl = `${baseUrl}/uploads/${thumbnailFilename}`;
      }
    } catch (ffmpegErr) {
      console.warn('FFmpeg not available or failed. Falling back to default video thumbnail.', ffmpegErr);
    }

    return { videoUrl, thumbnailUrl };
  }
}

export default new UploadService();
