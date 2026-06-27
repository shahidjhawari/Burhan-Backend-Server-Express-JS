const mongoose = require("mongoose");

/**
 * Tracks per-user, per-question reading/completion state.
 * One document per (user, question) pair — enforced by unique index.
 * Replaces the old minimal schema while staying fully backward compatible.
 */
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

    // ── Learning Progress fields ──
    completed: {
      type: Boolean,
      default: false,
      // true = user reached end of answer (XP has been awarded)
    },
    xpEarned: {
      type: Number,
      default: 0,
      // 0 until completed; 10 after first completion (never increases again)
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Unique per user+question — prevents duplicate XP at the database level
readProgressSchema.index({ user: 1, question: 1 }, { unique: true });
// Fast lookup: all completed questions for a user
readProgressSchema.index({ user: 1, completed: 1 });

module.exports = mongoose.model("ReadProgress", readProgressSchema);
