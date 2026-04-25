// src/utils/s3.js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

// SDK v3 automatically uses the EC2 IAM Role — no keys needed.
// The region must match your S3 bucket's region.
const s3 = new S3Client({ region: process.env.AWS_REGION || "ap-south-1" });

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "chatspace-files-shivang";

// Allowed MIME types — adjust to suit your needs.
// Keeping this list tight is a critical security practice.
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Uploads a file buffer to S3.
 * @param {Buffer} fileBuffer   - File contents as a Buffer
 * @param {string} originalName - Original filename from the client
 * @param {string} mimeType     - MIME type e.g. "image/png"
 * @param {string} room         - Chat room name (used as S3 folder prefix)
 * @returns {Promise<{fileUrl: string, fileName: string, fileType: string}>}
 */
async function uploadFileToS3(fileBuffer, originalName, mimeType, room) {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`File type "${mimeType}" is not allowed.`);
  }

  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error("File exceeds the 10 MB size limit.");
  }

  // Sanitize: keep original extension, prepend UUID so filenames never collide
  const ext = path.extname(originalName).toLowerCase();
  const safeKey = `rooms/${room}/${uuidv4()}${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: safeKey,
    Body: fileBuffer,
    ContentType: mimeType,
    // ContentDisposition tells the browser to download with the original name
    ContentDisposition: `attachment; filename="${originalName}"`,
  });

  await s3.send(command);

  // Build the public object URL.
  // If your bucket is private, switch to generatePresignedUrl() below instead.
  const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${safeKey}`;

  return { fileUrl, fileName: originalName, fileType: mimeType };
}

/**
 * Alternative: generate a pre-signed URL that expires in 1 hour.
 * Use this if your bucket is private (recommended for production).
 * Replace the fileUrl line in uploadFileToS3 with a call to this function.
 */
async function generatePresignedUrl(key) {
  const command = new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  // GetObjectCommand gives a download URL; PutObjectCommand gives an upload URL
  const { GetObjectCommand } = require("@aws-sdk/client-s3");
  const getCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  return getSignedUrl(s3, getCommand, { expiresIn: 3600 }); // 1 hour
}

module.exports = { uploadFileToS3 };