import express from "express";
import { getFeedTasks, populateUserTasks, getUserTasks, createTask, completeTask, deleteTask } from "../controllers/tasks.js";
import { verifyToken } from "../middleware/auth.js";
import { validateRequest, createTaskSchema, updateTaskSchema } from "../middleware/validation.js";

const router = express.Router();

/* READ */
router.get("/", verifyToken, getFeedTasks);
router.get("/:userId/:day", verifyToken, getUserTasks);

/* UPDATE */
router.patch("/:id/complete", verifyToken, validateRequest(updateTaskSchema), completeTask);
router.delete("/:id/delete", verifyToken, validateRequest({
  params: updateTaskSchema.params
}), deleteTask);

/* WRITE */
router.post("/new", verifyToken, validateRequest(createTaskSchema), createTask);
router.post("/:userId/populate", verifyToken, populateUserTasks);

export default router;
