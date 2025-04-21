import express from 'express';
import multer from 'multer';
import path from 'path';
import programsController from '../controllers/programs.js';
import { validateRequest, createProgramSchema } from '../middleware/validation.js';
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

/* CREATE */
// Create a new program
router.post('/', verifyToken, upload.single('image'), validateRequest(createProgramSchema), programsController.createProgram);

/* READ */
// Get all public programs for the feed
router.get('/feed', verifyToken, programsController.getFeedPrograms);

// Get all programs that a user is subscribed to
router.get('/user', verifyToken, programsController.getUserPrograms);

// Get all programs that were created by the current user
router.get('/creator', verifyToken, programsController.getCreatorPrograms);

// Get or create a personal program for the user
router.get('/personal', verifyToken, programsController.getPersonalProgram);

// Get a specific program by ID
router.get('/:programId', verifyToken, programsController.getProgram);

/* UPDATE */
// Edit a program
router.patch('/', verifyToken, upload.single('image'), programsController.editProgram);

// Delete a program
router.delete('/:id', verifyToken, programsController.deleteProgram);

/* SUBSCRIBE/UNSUBSCRIBE */
// Subscribe to a program
router.post('/subscribe/:programId', verifyToken, programsController.subscribeProgram);

// Unsubscribe from a program
router.delete('/subscribe/:programId', verifyToken, programsController.unsubscribeProgram);

export default router; 