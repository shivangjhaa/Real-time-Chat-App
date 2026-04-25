// src/models/Message.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },
    room: {
      type: String,
      required: true,
    },
    text: String,
    url: String,

    // --- NEW FIELDS ---
    fileUrl: String,       // The S3 object URL or pre-signed URL
    fileName: String,      // Original filename shown to users
    fileType: String,      // MIME type e.g. "image/png"
    // ------------------

    type: {
      type: String,
      enum: ["text", "location", "file"],   // "file" added
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;