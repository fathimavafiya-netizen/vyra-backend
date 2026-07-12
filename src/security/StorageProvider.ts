import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from '../utils/logger';

export interface StorageProvider {
  uploadFile(key: string, fileBuffer: Buffer, mimeType: string): Promise<string>;
  deleteFile(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInMinutes?: number): Promise<string>;
}

// ─── LOCAL STORAGE PROVIDER (DEVELOPMENT / LOCAL FALLBACK) ───
export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;
  private serverUrl: string;

  constructor() {
    // Save files locally under uploads directory in the workspace
    this.baseDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    this.serverUrl = process.env.SERVER_URL || 'http://127.0.0.1:5000';
  }

  async uploadFile(key: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
    const filePath = path.join(this.baseDir, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await fs.promises.writeFile(filePath, fileBuffer);
    logger.debug(`[LocalStorage] File uploaded: ${key}`);
    return `${this.serverUrl}/uploads/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      logger.debug(`[LocalStorage] File deleted: ${key}`);
    }
  }

  async getSignedUrl(key: string, expiresInMinutes = 5): Promise<string> {
    // Generate secure HMAC signature for the file link to prevent URL scraping
    const expiry = Math.floor(Date.now() / 1000) + expiresInMinutes * 60;
    const secret = process.env.JWT_SECRET_CURRENT || 'local_storage_secret';
    const message = `${key}:${expiry}`;
    const signature = crypto.createHmac('sha256', secret).update(message).digest('hex');

    return `${this.serverUrl}/uploads/${key}?expires=${expiry}&signature=${signature}`;
  }

  verifySignedUrl(key: string, expiry: number, signature: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    if (now > expiry) {
      return false;
    }
    const secret = process.env.JWT_SECRET_CURRENT || 'local_storage_secret';
    const message = `${key}:${expiry}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(message).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }
}

// ─── S3 STORAGE PROVIDER (PRODUCTION STUB) ───
export class S3StorageProvider implements StorageProvider {
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME || 'vyra-prod-media';
  }

  async uploadFile(key: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
    logger.info(`[S3Storage] Mock upload file to S3: s3://${this.bucketName}/${key}`);
    // Stub implementation returning simulated S3/CloudFront URL
    const domain = process.env.CLOUDFRONT_DOMAIN || 'https://d111111abcdef8.cloudfront.net';
    return `${domain}/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    logger.info(`[S3Storage] Mock delete file from S3: s3://${this.bucketName}/${key}`);
  }

  async getSignedUrl(key: string, expiresInMinutes = 5): Promise<string> {
    const domain = process.env.CLOUDFRONT_DOMAIN || 'https://d111111abcdef8.cloudfront.net';
    const expiry = Math.floor(Date.now() / 1000) + expiresInMinutes * 60;
    const secret = process.env.CLOUDFRONT_KEY_PAIR_ID || 'mock_cf_id';
    const signature = crypto.createHash('sha256').update(`${key}:${expiry}:${secret}`).digest('hex');
    return `${domain}/${key}?Expires=${expiry}&Signature=${signature}`;
  }
}

// Active provider selection based on environment
const useS3 = process.env.NODE_ENV === 'production' && !!process.env.AWS_ACCESS_KEY_ID;
const activeProvider: StorageProvider = useS3 ? new S3StorageProvider() : new LocalStorageProvider();

export default activeProvider;
