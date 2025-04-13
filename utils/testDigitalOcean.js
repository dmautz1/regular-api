import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadToDigitalOcean, getDigitalOceanPublicUrl, s3Client } from './digitalocean.js';
import config from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Tests the DigitalOcean Spaces integration by uploading a test file
 */
const testDigitalOceanIntegration = async () => {
  console.log('Testing DigitalOcean Spaces integration...');
  
  // Check if client is initialized
  console.log('DigitalOcean Spaces client initialized?', s3Client !== null);
  
  if (!config.isProduction) {
    console.log('Not in production mode, DigitalOcean operations will be skipped');
    return;
  }
  
  try {
    // Create a test file
    const testFilePath = path.join(__dirname, 'test-upload.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for DigitalOcean Spaces upload');
    
    // Read the file buffer
    const fileBuffer = fs.readFileSync(testFilePath);
    
    // Upload to DigitalOcean Spaces
    const testRemotePath = 'test/test-upload.txt';
    const result = await uploadToDigitalOcean(fileBuffer, testRemotePath, 'text/plain');
    
    console.log('Upload successful:', !!result);
    
    // Get the public URL
    const publicUrl = getDigitalOceanPublicUrl(testRemotePath);
    console.log('Public URL:', publicUrl);
    
    // Clean up the test file
    fs.unlinkSync(testFilePath);
    
    console.log('DigitalOcean Spaces integration test completed successfully');
  } catch (error) {
    console.error('DigitalOcean Spaces integration test failed:', error);
  }
};

// If this file is run directly, run the test
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  testDigitalOceanIntegration()
    .then(() => console.log('Test completed'))
    .catch(err => console.error('Test failed:', err));
}

export default testDigitalOceanIntegration; 