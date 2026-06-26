const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// IMPORTANT: PDFs are uploaded as resource_type "image" — this lets Cloudinary
// render individual pages as images, which we use for thumbnails.
// Both images and PDFs go through the same storage; Cloudinary auto-detects.
const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: "qa-app/media",
    resource_type: "image",   // "image" supports both images AND PDFs (page rendering)
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "pdf"],
    // For PDFs: generate a compressed first-page thumbnail eagerly on upload
    eager: file.mimetype === "application/pdf"
      ? [{ page: 1, width: 500, height: 700, crop: "fit", format: "jpg", quality: "auto" }]
      : [],
  }),
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

module.exports = upload;
