import express from 'express';
import { getUserSettings, updateUserSettings } from '../controllers/settings.js';
import { verifyToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();

// Validation schema for settings update
const updateSettingsSchema = {
    body: Joi.object({
        timezone: Joi.string().required(),
        default_page: Joi.string().valid('dashboard', 'tasks', 'programs').required(),
        color_mode: Joi.string().valid('light', 'dark').required()
    })
};

// Routes
router.get('/', verifyToken, getUserSettings);
router.patch('/', verifyToken, validateRequest(updateSettingsSchema), updateUserSettings);

export default router; 