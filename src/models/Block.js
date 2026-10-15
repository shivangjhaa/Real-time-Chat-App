const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema(
  {
    blocker: {
      type: String,
      required: true,
      index: true,
    },
    blockedUser: {
      type: String,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      default: "Inappropriate communication or threat detected",
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate block entries between the same pair
blockSchema.index({ blocker: 1, blockedUser: 1 }, { unique: true });

const Block = mongoose.model("Block", blockSchema);

module.exports = Block;
