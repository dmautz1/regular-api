import express from 'express';
import {
    getUser,
    getUserFriends,
    addRemoveFriend,
    becomeCreator,
    getCreatorProfile,
    updateCreatorProfile,
    updateUserProfile,
    uploadUserAvatar
} from '../controllers/users.js';
import { verifyToken } from '../middleware/auth.js';
import { validateRequest, updateProfileSchema } from '../middleware/validation.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const router = express.Router();

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* MULTER SETUP */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const avatarDir = "public/assets/avatars";
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(avatarDir)) {
            fs.mkdirSync(avatarDir, { recursive: true });
        }
        
        // Determine the appropriate directory based on file type
        if (file.fieldname === 'avatar') {
            cb(null, avatarDir);
        } else {
            cb(null, "public/assets");
        }
    },
    filename: (req, file, cb) => {
        // Generate secure random filename to prevent path traversal attacks
        const randomName = crypto.randomBytes(16).toString('hex');
        const extension = path.extname(file.originalname).toLowerCase();
        
        if (file.fieldname === 'avatar') {
            cb(null, `avatar-${req.user.id}-${randomName}${extension}`);
        } else {
            cb(null, `${randomName}${extension}`);
        }
    }
});

// Strict file type validation
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

/* READ */
router.get("/:id", verifyToken, getUser);
router.get("/profile", verifyToken, getUser);
router.get("/:id/friends", verifyToken, getUserFriends);

/* UPDATE */
router.patch("/:id/:friendId", verifyToken, addRemoveFriend);

// User profile routes
router.put("/:id", verifyToken, validateRequest(updateProfileSchema), updateUserProfile);
router.put("/profile", verifyToken, validateRequest(updateProfileSchema), updateUserProfile);

// Avatar upload route
router.post("/:id/avatar", verifyToken, upload.single("avatar"), uploadUserAvatar);
router.post("/avatar", verifyToken, upload.single("avatar"), uploadUserAvatar);

/* CREATOR ROUTES */
router.post('/become-creator', verifyToken, upload.single("image"), becomeCreator);
router.get('/creator/profile', verifyToken, getCreatorProfile);
router.patch('/creator/profile', verifyToken, upload.single("image"), validateRequest(updateProfileSchema), updateCreatorProfile);

export default router;
