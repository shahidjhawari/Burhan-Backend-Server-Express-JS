const mongoose = require("mongoose");

const evidenceItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["text", "url", "image", "pdf"],
      required: true,
    },
    value: { type: String, required: true },
    publicId: { type: String, default: "" },
    // PDF first-page thumbnail (Cloudinary transformation URL)
    thumbnailUrl: { type: String, default: "" },
  },
  { _id: true }
);

const questionSchema = new mongoose.Schema(
  {
    // ── Existing fields (unchanged) ──
    question:       { type: String, required: [true, "Question is required"], trim: true },
    answer:         { type: String, required: [true, "Answer is required"], trim: true },
    image:          { type: String, default: "" },
    imagePublicId:  { type: String, default: "" },
    category:       { type: String, trim: true, default: "General" },
    scientificProofs: { type: [evidenceItemSchema], default: [] },
    ahadees:          { type: [evidenceItemSchema], default: [] },
    youtubeVideos:    { type: [String], default: [] },

    // ── NEW fields — all optional, backward compatible ──
    language: {
      type: String,
      enum: ["en", "ur", "ar"],
      default: "en",
    },
    // Islamic tags for grouping: ["namaz", "salah", "prayer", "ibadah"]
    tags: {
      type: [String],
      default: [],
      set: (arr) => arr.map((t) => t.trim().toLowerCase()).filter(Boolean),
    },
    // Search keywords: ["importance", "farz", "worship"]
    keywords: {
      type: [String],
      default: [],
      set: (arr) => arr.map((k) => k.trim().toLowerCase()).filter(Boolean),
    },
    // Admin-selected related questions (ObjectId refs)
    relatedQuestions: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
      default: [],
    },
  },
  { timestamps: true }
);

// Full-text index with weights — language:"none" so Urdu/Arabic also works
questionSchema.index(
  { question: "text", answer: "text", tags: "text", keywords: "text", category: "text" },
  {
    weights: { question: 10, keywords: 6, tags: 4, category: 2, answer: 1 },
    name: "question_text_search",
    default_language: "none",
  }
);

// Indexes for fast related-question and category lookup
questionSchema.index({ tags: 1, category: 1 });
questionSchema.index({ keywords: 1 });
questionSchema.index({ language: 1 });

module.exports = mongoose.model("Question", questionSchema);
