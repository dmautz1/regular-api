import express from "express";
import { getActivity, createActivity, editActivity, deleteActivity, getProgramActivities } from "../controllers/activities.js";
import { verifyToken } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validation.js";
import Joi from 'joi';

// Define activity validation schemas
const activityIdSchema = {
  params: Joi.object({
    activityId: Joi.string().required().messages({
      'any.required': 'Activity ID is required'
    })
  })
};

const activityDataSchema = {
  body: Joi.object({
    name: Joi.string().required().messages({
      'any.required': 'Activity name is required'
    }),
    description: Joi.string().allow(''),
    duration: Joi.number().min(0),
    sets: Joi.number().integer().min(0),
    reps: Joi.number().integer().min(0),
    weight: Joi.number().min(0),
    distance: Joi.number().min(0),
    calories: Joi.number().min(0),
    programId: Joi.string().required().messages({
      'any.required': 'Program ID is required'
    })
  })
};

const bulkActivitySchema = {
  body: Joi.object({
    programId: Joi.string().required().messages({
      'any.required': 'Program ID is required'
    }),
    activities: Joi.array().items(
      Joi.object({
        _id: Joi.string(),
        title: Joi.string().required(),
        description: Joi.string().allow(''),
        cron: Joi.string().required()
      })
    ).required().min(1).messages({
      'any.required': 'At least one activity is required',
      'array.min': 'At least one activity is required'
    })
  })
};

const router = express.Router();

/* READ */
router.get("/:activityId", verifyToken, validateRequest(activityIdSchema), getActivity);
router.get("/program/:programId", verifyToken, getProgramActivities);

/* UPDATE */
router.delete("/:activityId/delete", verifyToken, validateRequest(activityIdSchema), deleteActivity);
router.post("/:activityId/edit", verifyToken, validateRequest({
  params: activityIdSchema.params,
  body: activityDataSchema.body
}), editActivity);

/* WRITE */
router.post("/new", verifyToken, validateRequest(activityDataSchema), createActivity);
router.post("/create", verifyToken, validateRequest(bulkActivitySchema), createActivity);

export default router;
