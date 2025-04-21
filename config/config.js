import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get environment
const environment = process.env.NODE_ENV || 'development';

// Load environment variables from the appropriate .env file
const envFile = `.env.${environment}`;
dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

// Fallback to .env if environment-specific file doesn't exist
if (!process.env.SUPABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
}

const config = {
  environment,
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'avatars'
  },
  server: {
    port: process.env.PORT || 3001,
  },
  client: {
    url: process.env.CLIENT_URL || 'http://localhost:3000',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '12h',
  },
  email: {
    service: process.env.EMAIL_SERVICE,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
  },
  recaptcha: {
    secretKey: process.env.RECAPTCHA_SECRET_KEY,
    siteKey: process.env.RECAPTCHA_SITE_KEY,
  },
  digitalOcean: {
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: process.env.DO_SPACES_REGION,
    accessKey: process.env.DO_SPACES_ACCESS_KEY,
    secretKey: process.env.DO_SPACES_SECRET_KEY,
    bucketName: process.env.DO_SPACES_BUCKET_NAME,
    cdnEndpoint: process.env.DO_SPACES_CDN_ENDPOINT
  },
  isProduction: environment === 'production',
  isDevelopment: environment === 'development',
  isTest: environment === 'test',
};

export default config; 