const mongoose = require("mongoose");

const matchedSignalSubSchema = new mongoose.Schema(
  {
    type: { type: String },
    label: String,
    severity: String,
  },
  { _id: false }
);

const incidentSchema = new mongoose.Schema(
  {
    incidentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    reporter: {
      type: String,
      required: true,
      index: true,
    },
    reportedUser: {
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
    messageText: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    riskScore: {
      type: Number,
      required: true,
    },
    threatLevel: {
      type: String,
      enum: ["Safe", "Caution", "Warning", "Dangerous"],
      default: "Warning",
    },
    explanation: {
      type: String,
      default: "",
    },
    matchedSignals: [matchedSignalSubSchema],
    userNotes: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "investigating", "resolved", "dismissed"],
      default: "pending",
      index: true,
    },
    evidenceChecksum: {
      type: String,
      default: "",
    },
    evidenceContext: [
      {
        username: String,
        text: String,
        timestamp: Date,
      },
    ],
    actionTaken: {
      type: String,
      default: "none",
    },
  },
  {
    timestamps: true,
  }
);

const Incident = mongoose.model("Incident", incidentSchema);

module.exports = Incident;
