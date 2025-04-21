import express from "express";
import { login, register, requestPasswordReset, resetPassword, logout } from "../controllers/auth.js";
import { validateRequest, loginSchema, registerSchema, passwordResetRequestSchema, passwordResetSchema } from "../middleware/validation.js";
import { verifyRecaptcha } from "../middleware/recaptcha.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Apply rate limiting, reCAPTCHA verification, and validation middleware to auth routes
router.post("/login", validateRequest(loginSchema), verifyRecaptcha, login);
router.post("/register", validateRequest(registerSchema), verifyRecaptcha, register);
router.post("/request-reset", validateRequest(passwordResetRequestSchema), verifyRecaptcha, requestPasswordReset);
router.post("/reset-password", validateRequest(passwordResetSchema), resetPassword);
router.post("/logout", verifyToken, logout);

export default router; 