const mongoose = require("mongoose");

/**
 * ContentProgress
 * Tracks completion of individual learning content items within a question.
 *
 * One document per (user, question, contentType, contentId) — enforced by
 * unique index so XP can NEVER be awarded twice for the same item.
 *
 * contentType values:
 *   "text"      → main richText / answer of the question
 *   "image"     → single image (contentId = evidence item _id or image URL hash)
 *   "pdf"       → single PDF (contentId = evidence item _id)
 *   "url"       → single external URL (contentId = evidence item _id)
 *   "video"     → single YouTube video (contentId = md5/sha1 of the URL or index)
 *   "question"  → bonus for completing ALL items in a question
 *
 * Note: for "text" and "question" there is exactly ONE record per (user,question)
 * For images/pdfs/urls/videos there is one record per item.
 */
const contentProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
      index: true,
    },
    contentType: {
      type: String,
      enum: ["text", "image", "pdf", "url", "video", "question"],
      required: true,
    },
    // Unique identifier for the content item within the question.
    // For "text" and "question" use the string "main".
    // For evidence items use their Mongoose _id.toString()
    // For YouTube videos use the video index (0, 1, 2...) as string.
    contentId: {
      type: String,
      required: true,
      default: "main",
    },
    completed: {
      type: Boolean,
      default: false,
    },
    xpEarned: {
      type: Number,
      default: 0,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    // Seconds the user spent on this content item (for PDF, URL, Video)
    timeSpentSeconds: {
      type: Number,
      default: 0,
    },
    // For videos: highest watch percentage reached (0-100)
    watchPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

// Unique composite index — this is the core deduplication mechanism
contentProgressSchema.index(
  { user: 1, question: 1, contentType: 1, contentId: 1 },
  { unique: true }
);

// Fast lookup: all completed items for a user+question
contentProgressSchema.index({ user: 1, question: 1, completed: 1 });

// Fast aggregate: all XP earned by a user
contentProgressSchema.index({ user: 1, xpEarned: 1 });

module.exports = mongoose.model("ContentProgress", contentProgressSchema);
