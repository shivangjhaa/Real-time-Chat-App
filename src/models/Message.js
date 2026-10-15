// src/models/Message.js
const mongoose = require("mongoose");

const signalSubSchema = new mongoose.Schema(
  {
    signalId: String,
    type: { type: String },
    label: String,
    severity: String,
    weight: Number,
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      index: true,
    },
    room: {
      type: String,
      required: true,
      index: true,
    },
    roomName: String,
    text: String,
    url: String,

    fileUrl: String,       // S3 object URL or local fallback URL
    fileName: String,      // Original filename
    fileType: String,      // MIME type

    moderation: {
      risk: {
        type: Number,
        default: 0,
      },
      category: {
        type: String,
        default: "Safe",
      },
      warning: {
        type: String,
        default: "No major threat detected",
      },
      threatLevel: {
        type: String,
        enum: ["Safe", "Caution", "Warning", "Dangerous"],
        default: "Safe",
      },
      urgencyDetected: {
        type: Boolean,
        default: false,
      },
      explanation: {
        type: String,
        default: "",
      },
      actionAdvice: {
        type: String,
        default: "",
      },
      matchedSignals: [String],
      signals: [signalSubSchema],
    },

    type: {
      type: String,
      enum: ["text", "location", "file"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;
