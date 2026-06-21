const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    image: {
      type: String, // full Cloudinary URL
      default: "",
    },
    imagePublicId: {
      type: String, // Cloudinary public_id, used to delete/replace the image later
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
