import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Configure Cloudinary using .env variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

// Configure Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let resourceType = 'image';
    if (file.mimetype.includes('video') || file.mimetype.includes('audio')) {
      resourceType = 'video';
    }

    return {
      folder: 'vyra', // Store uploads in 'vyra' folder
      resource_type: resourceType,
      allowed_formats: ['jpeg', 'jpg', 'png', 'webp', 'mp4', 'mov', 'm4a', 'mp3'],
      // Cloudinary generates unique public_ids by default
    };
  },
});

// Configure File Filters
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // Increase limit to 100MB to allow videos
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|mp4|mov|m4a|mp3/;
    const mimetype = filetypes.test(file.mimetype) || (file.mimetype && (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')));
    if (mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images, videos, or audio file formats are supported.'));
  }
});

router.post('/image', authMiddleware, upload.single('image'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Cloudinary details are attached to req.file
    const cloudFile = req.file as any;

    return res.status(201).json({
      success: true,
      imageUrl: cloudFile.secure_url, // For backwards compatibility
      secure_url: cloudFile.secure_url,
      public_id: cloudFile.public_id,
      resource_type: cloudFile.resource_type,
      format: cloudFile.format,
      bytes: cloudFile.bytes,
      width: cloudFile.width,
      height: cloudFile.height,
      duration: cloudFile.duration
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

export default router;

