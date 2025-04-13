import { S3 } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import config from '../config/config.js';

// Initialize S3 client (only in production)
let s3Client = null;
if (config.isProduction && config.digitalOcean.endpoint && config.digitalOcean.accessKey) {
    s3Client = new S3({
        endpoint: config.digitalOcean.endpoint,
        region: config.digitalOcean.region || 'us-east-1',
        credentials: {
            accessKeyId: config.digitalOcean.accessKey,
            secretAccessKey: config.digitalOcean.secretKey
        },
        forcePathStyle: true
    });
    console.log('DigitalOcean Spaces client initialized for production environment');
}

/**
 * Uploads a file to DigitalOcean Spaces
 * @param {Buffer} fileBuffer - The file buffer to upload 
 * @param {string} filePath - The path in storage bucket (e.g. 'avatars/user123.jpg')
 * @param {string} contentType - The content type of the file (e.g. 'image/jpeg')
 * @returns {Promise<object>} - The upload result
 */
export const uploadToDigitalOcean = async (fileBuffer, filePath, contentType) => {
    if (!s3Client) {
        console.warn('DigitalOcean Spaces client not initialized, skipping upload');
        return null;
    }
    
    try {
        const params = {
            Bucket: config.digitalOcean.bucketName,
            Key: filePath,
            Body: fileBuffer,
            ContentType: contentType,
            ACL: 'public-read' // Make the file publicly accessible
        };
        
        const upload = new Upload({
            client: s3Client,
            params
        });
        
        const result = await upload.done();
        
        return result;
    } catch (error) {
        console.error('DigitalOcean Spaces upload error:', error);
        throw error;
    }
};

/**
 * Gets the public URL for a file in DigitalOcean Spaces
 * @param {string} filePath - The path in storage bucket (e.g. 'avatars/user123.jpg') 
 * @returns {string|null} - The public URL or null if not in production
 */
export const getDigitalOceanPublicUrl = (filePath) => {
    if (!config.isProduction || !config.digitalOcean.cdnEndpoint) {
        console.warn('DigitalOcean Spaces not configured, cannot get public URL');
        return null;
    }
    
    // Use CDN URL if available, otherwise use the regular endpoint
    const baseUrl = config.digitalOcean.cdnEndpoint || 
        `https://${config.digitalOcean.bucketName}.${config.digitalOcean.region || 'us-east-1'}.digitaloceanspaces.com`;
    
    return `${baseUrl}/${filePath}`;
};

export { s3Client }; 