const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
    },
    link: {
      type: String,   // optional deep-link or URL to open when user taps notification
      default: "",
      trim: true,
    },
    sentCount: {
      type: Number,   // how many device tokens the message was dispatched to
      default: 0,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
