const express = require("express");
const router = express.Router();
const { signup, login, getMe, updateMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const uploadProfile = require("../middleware/uploadProfile");

// POST /api/auth/signup   – multipart/form-data: name, email, phone, password, image
// POST /api/auth/login    – JSON: { email, password }
// GET  /api/auth/me       – Bearer token required
// PUT  /api/auth/me       – Bearer token required, multipart: name?, phone?, image?
router.post("/signup", uploadProfile.single("image"), signup);
router.post("/login", login);
router.get("/me", protect, getMe);
router.put("/me", protect, uploadProfile.single("image"), updateMe);

module.exports = router;
