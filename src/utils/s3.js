// src/utils/s3.js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

if (process.env.AWS_PROFILE) {
  process.env.AWS_PROFILE = process.env.AWS_PROFILE;
}

const s3 = new S3Client({ region: process.env.AWS_REGION || "ap-south-1" });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || "chatspace-files-shivang";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "application/octet-stream",
];

const ALLOWED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
  ".pdf", ".txt", ".md", ".csv",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip"
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Saves file locally in public/uploads if S3 is unavailable or credentials fail
 */
function saveFileLocally(fileBuffer, originalName, mimeType, room) {
  const ext = path.extname(originalName).toLowerCase();
  const filename = `${uuidv4()}${ext}`;
  const uploadDir = path.join(__dirname, "../../public/uploads", room);
  fs.mkdirSync(uploadDir, { recursive: true });
  const targetPath = path.join(uploadDir, filename);
  fs.writeFileSync(targetPath, fileBuffer);
  const fileUrl = `/uploads/${encodeURIComponent(room)}/${filename}`;
  return { fileUrl, fileName: originalName, fileType: mimeType };
}

/**
 * Uploads a file buffer to S3, falling back to local storage if AWS is unreachable.
 * @param {Buffer} fileBuffer   - File contents as a Buffer
 * @param {string} originalName - Original filename from the client
 * @param {string} mimeType     - MIME type e.g. "image/png"
 * @param {string} room         - Chat room name (used as S3 folder prefix)
 * @returns {Promise<{fileUrl: string, fileName: string, fileType: string}>}
 */
async function uploadFileToS3(fileBuffer, originalName, mimeType, room) {
  const ext = path.extname(originalName).toLowerCase();
  const isAllowedType = ALLOWED_MIME_TYPES.includes(mimeType) || ALLOWED_EXTENSIONS.includes(ext);

  if (!isAllowedType) {
    throw new Error(`File type "${ext || mimeType}" is not allowed.`);
  }

  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error("File exceeds the 10 MB size limit.");
  }

  const safeKey = `rooms/${room}/${uuidv4()}${ext}`;

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: safeKey,
      Body: fileBuffer,
      ContentType: mimeType || "application/octet-stream",
      ContentDisposition: `attachment; filename="${originalName}"`,
    });

    await s3.send(command);
    const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${safeKey}`;
    return { fileUrl, fileName: originalName, fileType: mimeType };
  } catch (s3Err) {
    console.warn("S3 upload failed or credentials unavailable, using local storage:", s3Err.message);
    return saveFileLocally(fileBuffer, originalName, mimeType, room);
  }
}

module.exports = { uploadFileToS3 };