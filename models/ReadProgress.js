const mongoose = require("mongoose");

const readProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// A user can mark the same question as read only once (prevents duplicate counting)
readProgressSchema.index({ user: 1, question: 1 }, { unique: true });

module.exports = mongoose.model("ReadProgress", readProgressSchema);
