const { primaryDB: db } = require("../../db");
const mongoose = require("mongoose");
const notificationSchema = new mongoose.Schema(
  {
    link: { type: String },
    content: { type: String, required: true },
    image: { type: String },
    read: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

const notificationData = new mongoose.Schema({
  user: { type: mongoose.Types.ObjectId },
  data: [notificationSchema],
});

module.exports = {
  Notification: db.model("notifications", notificationData),
  notificationSchema,
  notificationData,
};
