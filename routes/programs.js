import express from "express";
import { getFeedPrograms, getUserPrograms, getProgram, createProgram, editProgram, deleteProgram, subscribeProgram, unsubscribeProgram, getCreatorPrograms, getPersonalProgram } from "../controllers/programs.js";
import { verifyToken } from "../middleware/auth.js";
import { validateRequest, createProgramSchema, updateProgramSchema } from "../middleware/validation.js";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create program images directory if it doesn't exist
const programImagesDir = path.join(__dirname, '..', 'public/assets/programs');
if (!fs.existsSync(programImagesDir)) {
    fs.mkdirSync(programImagesDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        // Set destination to programs directory
        callback(null, 'public/assets/programs');
    },
    filename: (req, file, callback) => {
        // Generate a secure random filename for the uploaded image
        const randomName = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase();
        callback(null, `program-${randomName}${ext}`);
    },
});

// Strict file type validation with whitelist
const fileFilter = (req, file, cb) => {
    // Whitelist of allowed MIME types for images
    const allowedMimeTypes = [
        'image/jpeg', 
        'image/png', 
        'image/gif', 
        'image/webp'
    ];
    
    // Check the file's mimetype against whitelist
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP images are allowed.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

const router = express.Router();

/* READ */
router.get("/", verifyToken, getFeedPrograms);
router.get("/user", verifyToken, getUserPrograms);
router.get("/creator", verifyToken, getCreatorPrograms);
router.get("/personal", verifyToken, getPersonalProgram);
router.get("/:programId", verifyToken, getProgram);

/* UPDATE */
router.post("/:id/edit", verifyToken, upload.single('image'), validateRequest(updateProgramSchema), editProgram);
router.delete("/:id/delete", verifyToken, validateRequest({
  params: updateProgramSchema.params
}), deleteProgram);

/* WRITE */
router.post("/new", verifyToken, upload.single('image'), validateRequest(createProgramSchema), createProgram);
router.post("/:programId/subscribe", verifyToken, subscribeProgram);
router.post("/:programId/unsubscribe", verifyToken, unsubscribeProgram);

export default router;
