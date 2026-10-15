// src/utils/messages.js
const defaultModeration = {
  risk: 0,
  category: "Safe",
  warning: "No major threat detected",
  threatLevel: "Safe",
  urgencyDetected: false,
  matchedSignals: [],
  signals: [],
  explanation: "",
  actionAdvice: "",
};

const generateMessage = (username, text, moderation = defaultModeration) => ({
  username,
  text,
  moderation: { ...defaultModeration, ...moderation },
  createdAt: new Date().getTime(),
});

const generateLocationMessage = (username, url) => ({
  username,
  url,
  createdAt: new Date().getTime(),
});

const generateFileMessage = (username, fileUrl, fileName, fileType) => ({
  username,
  fileUrl,
  fileName,
  fileType,
  createdAt: new Date().getTime(),
});

module.exports = {
  generateMessage,
  generateLocationMessage,
  generateFileMessage,
  defaultModeration,
};
