import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/config.js';

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

// Create a single Supabase client for interacting with your database
export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  }
);

// Service role client for admin operations (be careful with this!)
export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default {
  supabase,
  supabaseAdmin
}; 