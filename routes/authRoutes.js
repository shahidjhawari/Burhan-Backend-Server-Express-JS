const express = require("express");
const router = express.Router();
const { signup, login, googleLogin, getMe, updateMe, deleteMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const uploadProfile = require("../middleware/uploadProfile");

// Public
router.post("/signup", uploadProfile.single("image"), signup);
router.post("/login", login);
router.post("/google", googleLogin);           // Google Sign-In (JSON: { idToken })

// Private
router.get("/me", protect, getMe);
router.put("/me", protect, uploadProfile.single("image"), updateMe);
router.delete("/me", protect, deleteMe);

module.exports = router;
