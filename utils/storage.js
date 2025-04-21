import { supabase } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Utility functions for working with Supabase Storage
 * This file consolidates all storage-related functionality, including bucket management,
 * file uploads/downloads, and migration utilities.
 */

/**
 * Create necessary storage buckets if they don't exist
 * Only creates buckets when explicitly needed (e.g. during first-time setup)
 */
export const initializeStorageBuckets = async (force = false) => {
  try {
    // List existing buckets
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error listing storage buckets:', error);
      throw error;
    }
    
    const existingBuckets = buckets.map(bucket => bucket.name);
    
    // Define required buckets
    const requiredBuckets = [
      { name: 'avatars', public: true },
      { name: 'programs', public: true }
    ];
    
    // Only create buckets if force is true or if they don't exist
    for (const bucket of requiredBuckets) {
      if (force || !existingBuckets.includes(bucket.name)) {
        const { error: createError } = await supabase.storage.createBucket(
          bucket.name,
          { public: bucket.public }
        );
        
        if (createError) {
          console.error(`Error creating bucket '${bucket.name}':`, createError);
        } else {
          console.log(`Storage bucket '${bucket.name}' created successfully.`);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing storage buckets:', error);
    return false;
  }
};

/**
 * Upload a file to Supabase Storage
 * @param {Object} file - File object (with buffer or path)
 * @param {string} bucketName - Name of the storage bucket
 * @param {string} folder - Optional folder path within bucket
 * @returns {Promise<string>} - URL of the uploaded file
 */
export const uploadFile = async (file, bucketName, folder = '') => {
  try {
    // Generate unique filename
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}${fileExtension}`;
    
    // Full path in storage
    const filePath = folder ? `${folder}/${filename}` : filename;
    
    // Get file data
    let fileData;
    
    if (file.buffer) {
      // If file is already in memory (from multer memory storage)
      fileData = file.buffer;
    } else if (file.path) {
      // If file is on disk (from multer disk storage)
      fileData = fs.readFileSync(file.path);
    } else {
      throw new Error('Invalid file object - missing buffer or path');
    }
    
    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileData, {
        contentType: file.mimetype,
        upsert: true
      });
    
    if (error) {
      console.error('Error uploading file to Supabase Storage:', error);
      throw error;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    // Clean up local file if it exists
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
};

/**
 * Delete a file from Supabase Storage
 * @param {string} fileUrl - Public URL of the file to delete
 * @returns {Promise<boolean>} - Success status
 */
export const deleteFile = async (fileUrl) => {
  try {
    // Extract bucket name and path from URL
    const urlObj = new URL(fileUrl);
    const pathParts = urlObj.pathname.split('/');
    
    // Format should be /storage/v1/object/public/BUCKET_NAME/FILE_PATH
    const bucketIndex = pathParts.indexOf('public') + 1;
    
    if (bucketIndex <= 0 || bucketIndex >= pathParts.length) {
      throw new Error('Invalid file URL format');
    }
    
    const bucketName = pathParts[bucketIndex];
    const filePath = pathParts.slice(bucketIndex + 1).join('/');
    
    // Delete from Supabase
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);
    
    if (error) {
      console.error('Error deleting file from Supabase Storage:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('File deletion error:', error);
    return false;
  }
};

/**
 * Migrate files from local storage to Supabase
 * @param {string} localDir - Local directory path
 * @param {string} bucketName - Supabase bucket name
 * @returns {Promise<Object>} - Migration results
 */
export const migrateLocalFilesToSupabase = async (localDir, bucketName) => {
  try {
    console.log(`Migrating files from ${localDir} to Supabase bucket '${bucketName}'...`);
    
    // Check if local directory exists
    if (!fs.existsSync(localDir)) {
      console.error(`Local directory not found: ${localDir}`);
      return { success: false, error: 'Directory not found' };
    }
    
    // Get list of files
    const files = fs.readdirSync(localDir);
    console.log(`Found ${files.length} files to migrate`);
    
    const results = {
      total: files.length,
      successful: 0,
      failed: 0,
      errors: []
    };
    
    // Process each file
    for (const filename of files) {
      try {
        const filePath = path.join(localDir, filename);
        
        // Skip directories
        if (fs.statSync(filePath).isDirectory()) {
          continue;
        }
        
        // Read file
        const fileData = fs.readFileSync(filePath);
        const mimetype = getMimeType(filename);
        
        // Upload to Supabase
        const { data, error } = await supabase.storage
          .from(bucketName)
          .upload(filename, fileData, {
            contentType: mimetype,
            upsert: true
          });
        
        if (error) {
          throw error;
        }
        
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({ filename, error: error.message });
      }
    }
    
    console.log(`Migration complete: ${results.successful} successful, ${results.failed} failed`);
    return { success: true, results };
  } catch (error) {
    console.error('Migration error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get MIME type for a file based on its extension
 * @param {string} filename - Name of the file
 * @returns {string} - MIME type
 */
const getMimeType = (filename) => {
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript'
  };

  const ext = path.extname(filename).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
};

export default {
  initializeStorageBuckets,
  uploadFile,
  deleteFile,
  migrateLocalFilesToSupabase
}; 