const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// General-purpose uploader for question media (images AND PDFs).
// resource_type:"auto" lets Cloudinary auto-detect whether the file is an
// image, video, or raw document (PDF).
const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: "qa-app/media",
    resource_type: "auto",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "pdf"],
  }),
});

// Using upload.any() on the question routes so we can dynamically handle
// proof_0, proof_1, hadees_0, hadees_1 … etc. alongside the main image.
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB (generous for PDFs)
});

module.exports = upload;
