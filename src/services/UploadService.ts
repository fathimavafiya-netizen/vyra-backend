import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import os from 'os';
import storageProvider from '../security/StorageProvider';

class UploadService {
  constructor() {}

  /**
   * Processes and compresses an image into WebP format from disk
   */
  async processImageFromPath(filePath: string, originalName: string): Promise<{ secureUrl: string, publicId: string }> {
    const filename = `sociall-processed_${Date.now()}_${path.parse(originalName).name}.webp`;
    const tempOutputPath = path.join(os.tmpdir(), filename);
    
    // Compress and convert image to WebP using sharp, saving to temp file
    await sharp(filePath)
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(tempOutputPath);

    try {
      const result = await storageProvider.uploadFileFromPath(filename, tempOutputPath, 'image/webp');
      return { secureUrl: result.secureUrl, publicId: result.publicId };
    } finally {
      // Clean up the processed temp file (the original filePath will be cleaned up by the queue worker)
      try {
        if (fs.existsSync(tempOutputPath)) await fs.promises.unlink(tempOutputPath);
      } catch (e) {}
    }
  }

  /**
   * Processes a video using Cloudinary eager transformations from disk
   */
  async processVideoFromPath(
    filePath: string,
    originalName: string
  ): Promise<{ secureUrl: string; publicId: string; thumbnailUrl: string; duration?: number }> {
    const baseName = `sociall-processed_${Date.now()}_${path.parse(originalName).name}`;
    
    // Upload the raw video file and rely on Cloudinary eager transformations
    const result = await storageProvider.uploadFileFromPath(baseName, filePath, 'video/mp4');

    let thumbnailUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe'; // Default fallback
    if (result.secureUrl.includes('res.cloudinary.com')) {
      const urlParts = result.secureUrl.split('.');
      urlParts.pop(); // remove original extension
      thumbnailUrl = `${urlParts.join('.')}.jpg`;
    }

    return { 
      secureUrl: result.secureUrl, 
      publicId: result.publicId, 
      thumbnailUrl, 
      duration: result.duration 
    };
  }
}

export default new UploadService();
