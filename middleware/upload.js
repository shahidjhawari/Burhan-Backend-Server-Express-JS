const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// Images are uploaded directly to Cloudinary (folder: "qa-app") instead of
// being saved on the server's local disk.
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "qa-app",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 1200, height: 1200, crop: "limit" }], // avoid huge uploads
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

module.exports = upload;
