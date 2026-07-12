import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Ensure uploads folder exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Config Storage Engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    let ext = path.extname(file.originalname);
    if (!ext && file.mimetype) {
      if (file.mimetype.includes('video')) ext = '.mp4';
      else if (file.mimetype.includes('audio')) ext = '.mp3';
      else ext = '.jpg';
    }
    cb(null, 'vyra-upload-' + uniqueSuffix + ext);
  }
});

// Configure File Filters
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    console.log('[DEBUG UPLOAD] fileFilter - originalname:', file.originalname, 'mimetype:', file.mimetype);
    const filetypes = /jpeg|jpg|png|webp|mp4|mov|m4a|mp3/;
    const mimetype = filetypes.test(file.mimetype) || (file.mimetype && (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')));
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase()) || file.originalname === 'blob' || !path.extname(file.originalname);
    if (mimetype && extname) {
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

    // Return static URL
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    return res.status(201).json({
      success: true,
      imageUrl: fileUrl,
      secureUrl: fileUrl, // Backwards compatible Cloudinary mock keys
      publicId: req.file.filename
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
