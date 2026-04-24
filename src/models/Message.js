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
    type: {
      type: String,
      enum: ["text", "location"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;