import express from 'express';
import activitiesController from '../controllers/activities.js';
import { validateRequest, activitySchema } from '../middleware/validation.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

/* CREATE */
// Create activities for a program
router.post('/', verifyToken, validateRequest(activitySchema), activitiesController.createActivity);

/* READ */
// Get a specific activity
router.get('/:activityId', verifyToken, activitiesController.getActivity);

// Get all activities for a program
router.get('/program/:programId', verifyToken, activitiesController.getProgramActivities);

/* UPDATE */
// Edit an activity
router.patch('/:activityId', verifyToken, activitiesController.editActivity);

// Delete an activity
router.delete('/:activityId', verifyToken, activitiesController.deleteActivity);

export default router; 