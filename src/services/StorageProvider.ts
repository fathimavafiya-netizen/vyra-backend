import fs from 'fs';
import path from 'path';

export interface StorageProvider {
  saveFile(fileBuffer: Buffer, filename: string, mimeType: string): Promise<string>;
  deleteFile(fileUrl: string): Promise<void>;
}

export class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;
  private baseUrl: string;

  constructor() {
    // Base uploads directory relative to the backend project root
    this.uploadDir = path.join(__dirname, '..', '..', 'uploads');
    this.baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    
    // Ensure the folder exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async saveFile(fileBuffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const filePath = path.join(this.uploadDir, filename);
    await fs.promises.writeFile(filePath, fileBuffer);
    
    // Return accessible local URL
    return `${this.baseUrl}/uploads/${filename}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const urlParts = fileUrl.split('/uploads/');
      if (urlParts.length > 1) {
        const filename = urlParts[1];
        const filePath = path.join(this.uploadDir, filename);
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to delete local file:', error);
    }
  }
}
