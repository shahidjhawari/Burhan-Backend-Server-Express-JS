const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// Profile photos go into their own Cloudinary folder, square-cropped so
// they look good as round/square avatars in the app.
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "qa-app/profiles",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 600, height: 600, crop: "fill", gravity: "face" }],
  },
});

const uploadProfile = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

module.exports = uploadProfile;
