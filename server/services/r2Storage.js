import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";


// Read environment variables
const r2Enabled = process.env.R2_ENABLED === "true";
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrl = process.env.R2_PUBLIC_URL;

let s3Client = null;

// Only initialize if enabled and required parameters are present
if (r2Enabled && accountId && accessKeyId && secretAccessKey) {
  try {
    s3Client = new S3Client({
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      region: "auto",
    });
    console.log("☁️  Cloudflare R2 storage initialized successfully.");
  } catch (err) {
    console.error("❌ Failed to initialize Cloudflare R2 client:", err.message);
  }
} else {
  console.log("ℹ️  Cloudflare R2 is disabled or not configured. Falling back to local storage.");
}

/**
 * Checks if R2 storage is configured and enabled
 * @returns {boolean}
 */
export const isR2Enabled = () => {
  return r2Enabled && !!s3Client && !!bucketName;
};

/**
 * Uploads a file buffer to Cloudflare R2
 * @param {Buffer} buffer - File content
 * @param {string} key - R2 path/key
 * @param {string} contentType - File mime type
 * @returns {Promise<void>}
 */
export const uploadToR2 = async (buffer, key, contentType) => {
  if (!isR2Enabled()) {
    throw new Error("R2 storage is not enabled or properly configured.");
  }
  
  const cleanKey = key.replace(/^\/+/, ""); // strip leading slash
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cleanKey,
    Body: buffer,
    ContentType: contentType,
  });
  
  await s3Client.send(command);
  console.log(`✅ File uploaded to R2: ${cleanKey}`);
};

/**
 * Downloads a file from Cloudflare R2 as a readable stream
 * @param {string} key - R2 path/key
 * @returns {Promise<any>} Readable stream of the file content
 */
export const downloadFromR2 = async (key) => {
  if (!isR2Enabled()) {
    throw new Error("R2 storage is not enabled or properly configured.");
  }
  
  const cleanKey = key.replace(/^\/+/, "");
  
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cleanKey,
  });
  
  const response = await s3Client.send(command);
  return response.Body; // This is a stream
};

/**
 * Deletes a file from Cloudflare R2
 * @param {string} key - R2 path/key
 * @returns {Promise<void>}
 */
export const deleteFromR2 = async (key) => {
  if (!isR2Enabled()) {
    return;
  }
  
  const cleanKey = key.replace(/^\/+/, "");
  
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: cleanKey,
    });
    
    await s3Client.send(command);
    console.log(`🗑️ File deleted from R2: ${cleanKey}`);
  } catch (err) {
    console.error(`❌ Failed to delete file from R2 (${cleanKey}):`, err.message);
  }
};

/**
 * Gets the public URL of a file stored in R2 if publicUrl is configured
 * @param {string} key - R2 path/key
 * @returns {string|null} Full URL or null
 */
export const getPublicUrl = (key) => {
  if (!publicUrl) return null;
  const cleanKey = key.replace(/^\/+/, "");
  const base = publicUrl.endsWith("/") ? publicUrl : `${publicUrl}/`;
  return `${base}${cleanKey}`;
};

/**
 * Helper to extract R2 key from either a relative local path, absolute path, or full public URL
 * @param {string} pathOrUrl 
 * @returns {string|null} R2 key or null
 */
export const getR2KeyFromPathOrUrl = (pathOrUrl) => {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return null;

  // 1. If it starts with R2_PUBLIC_URL
  if (publicUrl && pathOrUrl.startsWith(publicUrl)) {
    return pathOrUrl.substring(publicUrl.length).replace(/^\/+/, "");
  }

  // 2. If it is `/uploads/` relative URL
  if (pathOrUrl.startsWith("/uploads/")) {
    return pathOrUrl.substring("/uploads/".length).replace(/^\/+/, "");
  }

  // 3. If it contains `uploads/`
  const index = pathOrUrl.indexOf("uploads/");
  if (index !== -1) {
    return pathOrUrl.substring(index + "uploads/".length).replace(/^\/+/, "");
  }

  // Otherwise, return it stripped of leading slash
  return pathOrUrl.replace(/^\/+/, "");
};

/**
 * Generates a pre-signed URL for temporary access to a private object in R2
 * @param {string} key - R2 path/key
 * @param {object} options - Optional configuration (expiresIn, responseContentType, responseContentDisposition)
 * @returns {Promise<string|null>} Signed URL or null if R2 is disabled
 */
export const getSignedUrlForGetObject = async (key, options = {}) => {
  if (!isR2Enabled()) {
    return null;
  }

  const cleanKey = key.replace(/^\/+/, "");
  const expiresIn = options.expiresIn || 3600; // default 1 hour

  const commandParams = {
    Bucket: bucketName,
    Key: cleanKey,
  };

  if (options.responseContentType) {
    commandParams.ResponseContentType = options.responseContentType;
  }
  if (options.responseContentDisposition) {
    commandParams.ResponseContentDisposition = options.responseContentDisposition;
  }

  try {
    const command = new GetObjectCommand(commandParams);
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (err) {
    console.error(`❌ Failed to generate signed URL for R2 key (${cleanKey}):`, err.message);
    return null;
  }
};

