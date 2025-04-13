import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadToDigitalOcean, getDigitalOceanPublicUrl } from './digitalocean.js';
import config from '../config/config.js';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generates a unique filename to prevent collisions in storage
 * @param {string} originalFilename - The original filename
 * @returns {string} - A unique filename
 */
export const generateUniqueFilename = (originalFilename) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const fileExtension = path.extname(originalFilename);
  const baseName = path.basename(originalFilename, fileExtension);
  
  return `${baseName}-${timestamp}-${randomString}${fileExtension}`;
};

/**
 * Saves a file to the appropriate storage system based on environment
 * @param {Object} file - The file object from multer
 * @param {string} destination - The destination directory path (for local storage)
 * @param {string} remotePath - The path in remote storage (for production)
 * @returns {Promise<string>} - The path or URL to the saved file
 */
export const saveFile = async (file, destination, remotePath) => {
  // Generate a unique filename to avoid collisions
  const uniqueFilename = generateUniqueFilename(file.originalname || file.filename);
  
  // Update the file object with the unique filename
  file.filename = uniqueFilename;
  
  // Create the actual remote path with the unique filename
  const actualRemotePath = remotePath.replace(/[^\/]+$/, uniqueFilename);
  
  // In production, upload to DigitalOcean Spaces
  if (config.isProduction) {
    try {
      // Read file buffer
      const fileBuffer = fs.readFileSync(file.path);
      
      // Upload to DigitalOcean Spaces
      await uploadToDigitalOcean(fileBuffer, actualRemotePath, file.mimetype);
      
      // Clean up the temporary file
      fs.unlinkSync(file.path);
      
      // Return the public URL
      return getDigitalOceanPublicUrl(actualRemotePath);
    } catch (error) {
      console.error('Error saving file to DigitalOcean Spaces:', error);
      throw error;
    }
  } 
  
  // In development or test, save to local file system
  // Ensure the destination directory exists
  const destDir = path.join(__dirname, '..', destination);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Rename the file with our unique filename
  const originalPath = file.path;
  const destPath = path.join(destDir, uniqueFilename);
  
  // Create a read stream from the original file and a write stream to the destination
  const readStream = fs.createReadStream(originalPath);
  const writeStream = fs.createWriteStream(destPath);
  
  // Return a promise that resolves when the file has been copied
  return new Promise((resolve, reject) => {
    readStream.pipe(writeStream);
    writeStream.on('finish', () => {
      // Clean up the original file
      fs.unlinkSync(originalPath);
      resolve(`${destination}/${uniqueFilename}`);
    });
    writeStream.on('error', reject);
  });
};

/**
 * Gets the URL for a file based on environment
 * @param {string} filePath - The path to the file
 * @param {string} remotePath - The path in remote storage (for production)
 * @returns {string} - The URL to the file
 */
export const getFileUrl = (filePath, remotePath) => {
  if (config.isProduction && remotePath) {
    return getDigitalOceanPublicUrl(remotePath);
  }
  
  // For development and test, construct a local URL
  return `${config.server.url || 'http://localhost:' + config.server.port}/public/${filePath}`;
}; 