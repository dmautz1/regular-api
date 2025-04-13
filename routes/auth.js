import express from "express";
import { login, register, requestPasswordReset, resetPassword } from "../controllers/auth.js";
import { authLimiter, createAccountLimiter, passwordResetLimiter } from "../middleware/rateLimit.js";
import { validateRequest, loginSchema, registerSchema, passwordResetRequestSchema, passwordResetSchema } from "../middleware/validation.js";
import { verifyRecaptcha } from "../middleware/recaptcha.js";

const router = express.Router();

// Apply rate limiting, reCAPTCHA verification, and validation middleware to auth routes
router.post("/login", authLimiter, validateRequest(loginSchema), verifyRecaptcha, login);
router.post("/register", createAccountLimiter, validateRequest(registerSchema), verifyRecaptcha, register);
router.post("/request-password-reset", passwordResetLimiter, validateRequest(passwordResetRequestSchema), verifyRecaptcha, requestPasswordReset);
router.post("/reset-password", passwordResetLimiter, validateRequest(passwordResetSchema), resetPassword);

export default router;
