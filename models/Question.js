const mongoose = require("mongoose");

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
    reference: {
      type: String, // e.g. book name, page number, Quran/Hadith reference, source URL, etc.
      trim: true,
      default: "",
    },
    image: {
      type: String, // full Cloudinary URL (secure_url), e.g. https://res.cloudinary.com/.../qa-app/abc123.jpg
      default: "",
    },
    imagePublicId: {
      type: String, // Cloudinary public_id, used to delete the image later
      default: "",
    },
    category: {
      type: String,
      trim: true,
      default: "General",
    },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

module.exports = mongoose.model("Question", questionSchema);
