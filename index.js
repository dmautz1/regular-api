import express from "express";
import cors from "cors";
import multer from "multer";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import fs from 'fs';
import https from 'https';
import http from 'http';
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import taskRoutes from "./routes/tasks.js";
import programRoutes from "./routes/programs.js";
import activityRoutes from "./routes/activities.js";
import { register } from "./controllers/auth.js";
import { verifyToken } from "./middleware/auth.js";
import { verifyRecaptcha } from "./middleware/recaptcha.js";
import { validateRequest, registerSchema } from "./middleware/validation.js";
import config from './config/config.js';
import csrf from 'csurf';
import cookieParser from 'cookie-parser';
import { initializeStorageBuckets } from './utils/storage.js';

/* CONFIGURATION */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.json({ limit: "50mb", extended: true }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Security headers with Helmet
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

// Configure CSP
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://www.google.com/recaptcha/", "https://www.gstatic.com/recaptcha/"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    imgSrc: ["'self'", "data:", "blob:", config.client.url],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    connectSrc: ["'self'", config.client.url],
    frameSrc: ["'self'", "https://www.google.com/recaptcha/"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: []
  }
}));

app.use(morgan(config.isProduction ? "combined" : "dev"));

// Configure CORS to allow HTTPS
const corsOptions = {
  origin: [
    'https://localhost:3000',
    'http://localhost:3000', 
    'https://app.stayregular.io',
    'https://api.stayregular.io',
    config.client.url
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'CSRF-Token']
};
app.use(cors(corsOptions));

// Cookie parser for CSRF protection
app.use(cookieParser());

// Set up CSRF protection
const csrfProtection = csrf({ 
  cookie: {
    key: 'CSRF-TOKEN',
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict'
  }
});

// CSRF protection route for getting token
app.get('/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

/* ENSURE DIRECTORIES EXIST */
// Create avatars directory if it doesn't exist
const avatarsDir = path.join(__dirname, "public/assets/avatars");
if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
}

// Create programs directory if it doesn't exist
const programsDir = path.join(__dirname, "public/assets/programs");
if (!fs.existsSync(programsDir)) {
    fs.mkdirSync(programsDir, { recursive: true });
}

/* STATIC FILE SERVING */
app.use("/public/assets", express.static(path.join(__dirname, "public/assets")));
app.use("/public/assets/avatars", express.static(path.join(__dirname, "public/assets/avatars")));
app.use("/public/assets/programs", express.static(path.join(__dirname, "public/assets/programs")));

// Create directory for default program image if it doesn't exist
const defaultImagePath = path.join(__dirname, "public/assets/default-program.jpg");
if (!fs.existsSync(defaultImagePath)) {
    // Copy a default image or create a placeholder
    try {
        const defaultAvatarPath = path.join(__dirname, "public/assets/default.png");
        if (fs.existsSync(defaultAvatarPath)) {
            fs.copyFileSync(defaultAvatarPath, defaultImagePath);
        }
    } catch (error) {
        console.log("Could not create default program image:", error);
    }
}

/* FILE STORAGE */
const storage = multer.memoryStorage(); // Use memory storage for Supabase uploads

// Configure file filtering
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxFileSize = 5 * 1024 * 1024; // 5MB
  
  if (!allowedFileTypes.includes(file.mimetype)) {
    return cb(new Error('Only .jpeg, .jpg, .png, and .webp files are allowed'), false);
  }
  
  cb(null, true);
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/* ROUTES WITH FILES */
app.post("/auth/register", upload.single("picture"), (req, res, next) => {
  // Move file data from req.file to req.body so validateRequest can access it
  if (req.file) {
    req.body.picturePath = req.file.path;
  }
  next();
}, validateRequest(registerSchema), verifyRecaptcha, register);

/* ROUTES */
app.use("/auth", authRoutes);

// Apply CSRF protection for authenticated routes
app.use("/users", csrfProtection, verifyToken, userRoutes);
app.use("/tasks", csrfProtection, verifyToken, taskRoutes);
app.use("/programs", csrfProtection, verifyToken, programRoutes);
app.use("/activities", csrfProtection, verifyToken, activityRoutes);

/* ERROR HANDLING MIDDLEWARE */
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Check if this is a CSRF error
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      status: 403,
      message: 'Invalid or missing CSRF token'
    });
  }
  
  // Check if this is a rate limit error
  if (err.statusCode === 429) {
    return res.status(429).json({
      status: 429,
      message: err.message || 'Too many requests. Please try again later.'
    });
  }
  
  // Handle Joi validation errors
  if (err.name === 'ValidationError') {
    const errorMessage = err.details ? err.details.map(detail => detail.message).join(', ') : err.message;
    return res.status(400).json({
      status: 400,
      message: errorMessage || 'Validation error'
    });
  }
  
  // Handle multer errors (file upload)
  if (err.name === 'MulterError') {
    let message = 'File upload error';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File is too large. Maximum size is 5MB.';
    }
    return res.status(400).json({
      status: 400,
      message
    });
  }

  // Default error handling
  res.status(err.status || 500).json({
    status: err.status || 500,
    message: err.message || 'Internal Server Error'
  });
});

/* SERVER SETUP */
const PORT = config.server.port;
const HTTP_PORT = parseInt(PORT) - 1 || 3000; // HTTP port for redirects

// Function to start the server
const startServer = async () => {
  try {
    // Initialize storage buckets (only if they don't exist)
    await initializeStorageBuckets(false);
    console.log('Supabase storage buckets initialized');
    
    // Use HTTPS only in production
    if (config.isProduction) {
      // SSL Certificate for HTTPS
      let httpsOptions = null;
      
      try {
        // Check if certificate files exist
        const certPath = path.join(__dirname, 'certs/server.cert');
        const keyPath = path.join(__dirname, 'certs/server.key');
        
        if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
          httpsOptions = {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath)
          };
          console.log('SSL certificates loaded successfully');
        }
      } catch (err) {
        console.error('Error loading SSL certificates:', err.message);
      }
      
      // Create HTTPS server if certificates are available
      if (httpsOptions) {
        // Create HTTPS server
        const httpsServer = https.createServer(httpsOptions, app);
        httpsServer.listen(PORT, () => {
          console.log(`HTTPS Server running in ${config.environment} mode on port: ${PORT}`);
        });
        
        // HTTP redirect server for production
        const httpApp = express();
        httpApp.use((req, res) => {
          // Redirect all HTTP requests to HTTPS
          res.redirect(`https://${req.hostname}:${PORT}${req.url}`);
        });
        
        http.createServer(httpApp).listen(HTTP_PORT, () => {
          console.log(`HTTP redirect server running on port: ${HTTP_PORT}`);
        });
        
      } else {
        // Fallback to HTTP if no certificates
        app.listen(PORT, () => {
          console.log(`HTTP Server running in ${config.environment} mode on port: ${PORT}`);
        });
      }
    } else {
      // Development or test environment - use HTTP
      app.listen(PORT, () => {
        console.log(`HTTP Server running in ${config.environment} mode on port: ${PORT}`);
      });
    }
  } catch (err) {
    console.error('Server startup error:', err);
  }
};

startServer();
