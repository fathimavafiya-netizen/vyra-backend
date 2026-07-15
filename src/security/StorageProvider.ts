import { v2 as cloudinary } from 'cloudinary';
import logger from '../utils/logger';

// Configure Cloudinary using .env variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

export interface StorageProvider {
  uploadFile(key: string, fileBuffer: Buffer, mimeType: string): Promise<string>;
  deleteFile(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInMinutes?: number): Promise<string>;
}

export class CloudinaryStorageProvider implements StorageProvider {
  async uploadFile(key: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto';
      if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
        resourceType = 'video';
      } else if (mimeType.startsWith('image/')) {
        resourceType = 'image';
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'vyra',
          public_id: key,
          resource_type: resourceType,
          overwrite: true
        },
        (error, result) => {
          if (error) {
            logger.error(`[CloudinaryStorageProvider] Upload failed for ${key}: ${error.message}`);
            return reject(error);
          }
          if (!result) {
            return reject(new Error('Cloudinary upload returned null result'));
          }
          logger.debug(`[CloudinaryStorageProvider] File uploaded to Cloudinary: ${result.secure_url}`);
          resolve(result.secure_url);
        }
      );

      uploadStream.end(fileBuffer);
    });
  }

  async deleteFile(url: string): Promise<void> {
    try {
      // Extract public_id from Cloudinary URL
      // Example: https://res.cloudinary.com/esvdcd7b/image/upload/v12345/vyra/filename.jpg
      const urlParts = url.split('/');
      if (urlParts.length > 0) {
        const fileWithExt = urlParts[urlParts.length - 1];
        const publicIdBase = fileWithExt.split('.')[0];
        // In our upload config, we use folder 'vyra', so the full public_id is vyra/publicIdBase
        // Or if the key passed to uploadFile was a path like stories/123/456, we need to extract the path after /vyra/
        
        // A robust way to extract public_id: find the index of the folder (e.g. upload/vXXX/)
        const uploadRegex = /\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i;
        const match = url.match(uploadRegex);
        
        if (match && match[1]) {
          const publicId = match[1];
          let resourceType = 'image';
          if (url.includes('/video/upload/')) resourceType = 'video';
          
          await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
          logger.debug(`[CloudinaryStorageProvider] File deleted from Cloudinary: ${publicId}`);
        } else {
           // Fallback if not a cloudinary URL
           logger.warn(`[CloudinaryStorageProvider] Could not extract public_id from url: ${url}`);
        }
      }
    } catch (error: any) {
      logger.error(`[CloudinaryStorageProvider] Failed to delete file: ${error.message}`);
    }
  }

  async getSignedUrl(key: string, expiresInMinutes = 5): Promise<string> {
    // For Cloudinary, public files don't need signed URLs unless using private delivery.
    // For now, we return the direct URL if it's already a full URL, or just the key if it isn't.
    // However, getSignedUrl is typically passed a relative path.
    // Since we now upload to Cloudinary and return the full secure_url directly, the "key" passed here
    // is often already the secure_url if stored in the DB, or a relative path if not.
    if (key.startsWith('http')) return key;
    
    return cloudinary.url(key, { secure: true });
  }
}

const activeProvider: StorageProvider = new CloudinaryStorageProvider();

export default activeProvider;
