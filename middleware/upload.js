const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// Detect if uploaded file is a PDF so we set resource_type correctly.
// Images need resource_type:"image", PDFs need resource_type:"raw".
const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    const isPdf =
      file.mimetype === "application/pdf" ||
      (file.originalname && file.originalname.toLowerCase().endsWith(".pdf"));

    return {
      folder: "qa-app/media",
      resource_type: isPdf ? "raw" : "image",
      allowed_formats: isPdf
        ? ["pdf"]
        : ["jpg", "jpeg", "png", "gif", "webp"],
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

module.exports = upload;
