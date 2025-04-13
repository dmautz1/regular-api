import rateLimit from 'express-rate-limit';
import MongoStore from 'rate-limit-mongo';
import config from '../config/config.js';

// Connect to MongoDB for rate limit storage
const mongoStore = new MongoStore({
  uri: config.mongodb.url,
  collectionName: 'rate-limits',
  expireTimeMs: 60 * 60 * 1000, // 1 hour expiration
  errorHandler: console.error
});

// General API rate limiter - 300 requests per 5 minutes
export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    status: 429,
    message: 'Too many requests, please try again in 5 minutes.'
  },
  store: mongoStore
});

// More restrictive limiter for authentication routes - 5 attempts per 15 minutes
// Progressive delay increases after each attempt
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many login attempts, please try again in 15 minutes.'
  },
  store: mongoStore,
  // Set a gradually increasing delay between attempts
  handler: (req, res, next, options) => {
    const attempts = req.rateLimit ? req.rateLimit.current : 1;
    const delay = Math.pow(2, attempts - 1) * 1000; // Exponential backoff in milliseconds
    
    setTimeout(() => {
      res.status(options.statusCode).json(options.message);
    }, delay);
  }
});

// Password reset limiter - 3 attempts per hour
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 3, // limit each IP to 3 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many password reset attempts, please try again in 60 minutes.'
  },
  store: mongoStore
});

// Create account limiter - 3 accounts per day from same IP
export const createAccountLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // limit each IP to 3 create account requests per day
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many accounts created from this IP, please try again after 24 hours.'
  },
  store: mongoStore
}); 