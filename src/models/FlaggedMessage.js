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

const flaggedMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      required: true,
      index: true,
    },
    room: {
      type: String,
      required: true,
      index: true,
    },
    roomName: {
      type: String,
      default: "",
    },
    message: {
      type: String,
      required: true,
    },
    riskScore: {
      type: Number,
      required: true,
    },
    threatLevel: {
      type: String,
      enum: ["Safe", "Caution", "Warning", "Dangerous"],
      default: "Warning",
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    warning: {
      type: String,
      required: true,
    },
    explanation: {
      type: String,
      default: "",
    },
    actionAdvice: {
      type: String,
      default: "",
    },
    urgencyDetected: {
      type: Boolean,
      default: false,
    },
    matchedSignals: [String],
    signals: [signalSubSchema],
  },
  {
    timestamps: true,
  }
);

const FlaggedMessage = mongoose.model("FlaggedMessage", flaggedMessageSchema);

module.exports = FlaggedMessage;
