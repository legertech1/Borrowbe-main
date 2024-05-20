const { secondaryDB: db } = require("../../db");
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Types.ObjectId,
      required: true,
    },
    to: {
      type: mongoose.Types.ObjectId,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: { type: Boolean, default: false, required: true },
    type: { type: String, required: true, default: "text" },
  },
  { timestamps: true }
);

const chatSchema = new mongoose.Schema(
  {
    participants: [mongoose.Types.ObjectId],
    messages: [messageSchema],
    blockedBy: [mongoose.Types.ObjectId],
    deletedBy: [mongoose.Types.ObjectId],
    ad: mongoose.Types.ObjectId,
  },
  { timestamps: true }
);

module.exports = {
  Chat: db.model("Chat", chatSchema),
  chatSchema,
  messageSchema,
};
