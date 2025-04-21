import express from 'express';
import multer from 'multer';
import usersController from '../controllers/users.js';
import { validateRequest, updateProfileSchema } from '../middleware/validation.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for memory storage (for Supabase uploading)
const storage = multer.memoryStorage();

// File filter to only allow image files
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxFileSize = 5 * 1024 * 1024; // 5MB
  
  if (!allowedFileTypes.includes(file.mimetype)) {
    return cb(new Error('Only .jpeg, .jpg, .png, and .webp files are allowed'), false);
  }
  
  if (file.size > maxFileSize) {
    return cb(new Error('File size exceeds 5MB limit'), false);
  }
  
  cb(null, true);
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/* READ */
// Get current user's profile
router.get('/profile', verifyToken, usersController.getProfile);

// Get user stats (task completion, etc.)
router.get('/stats', verifyToken, usersController.getUserStats);

/* UPDATE */
// Update user profile
router.patch('/profile', verifyToken, upload.single('avatar'), validateRequest(updateProfileSchema), usersController.updateProfile);

export default router; 