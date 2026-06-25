const mongoose = require("mongoose");

// Reusable shape for one "evidence" item inside Scientific Proof or
// Ahadees. `type` decides how the app should render it:
//  - "text"  -> value holds plain text
//  - "url"   -> value holds a web link
//  - "image" -> value holds a Cloudinary image URL, publicId set
//  - "pdf"   -> value holds a Cloudinary file URL, publicId set gfghfg
const evidenceItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["text", "url", "image", "pdf"],
      required: true,
    },
    value: {
      type: String, // text content, a URL, or a Cloudinary file URL depending on `type`
      required: true,
    },
    publicId: {
      type: String, // Cloudinary public_id (only set for image/pdf), used to delete later
      default: "",
    },
  },
  { _id: true }
);

const questionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, "Question text is required"],
      trim: true,
    },
    answer: {
      type: String,
      required: [true, "Answer text is required"],
      trim: true,
    },
    image: {
      type: String, // full Cloudinary URL — the question's own illustrative photo
      default: "",
    },
    imagePublicId: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      default: "General",
    },
    // Each question can have any number of scientific-proof items, each
    // independently a PDF, image, URL, or plain text.
    scientificProofs: {
      type: [evidenceItemSchema],
      default: [],
    },
    // Same idea, for hadith references.
    ahadees: {
      type: [evidenceItemSchema],
      default: [],
    },
    // Any number of related YouTube links.
    youtubeVideos: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", questionSchema);
