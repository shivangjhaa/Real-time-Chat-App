// src/utils/messages.js
const generateMessage = (username, text) => ({
  username,
  text,
  createdAt: new Date().getTime(),
});

const generateLocationMessage = (username, url) => ({
  username,
  url,
  createdAt: new Date().getTime(),
});

// --- NEW ---
const generateFileMessage = (username, fileUrl, fileName, fileType) => ({
  username,
  fileUrl,
  fileName,
  fileType,
  createdAt: new Date().getTime(),
});
// -----------

module.exports = {
  generateMessage,
  generateLocationMessage,
  generateFileMessage,   // export the new helper
};