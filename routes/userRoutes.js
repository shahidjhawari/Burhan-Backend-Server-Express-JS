const express = require("express");
const router = express.Router();
const { createUser, getUser, updateUser } = require("../controllers/userController");
const { markQuestionAsRead, getUserProgress } = require("../controllers/progressController");
const uploadProfile = require("../middleware/uploadProfile");

// POST /api/users          -> create profile (multipart/form-data: name, image)
// GET  /api/users/:id      -> get profile
// PUT  /api/users/:id      -> update profile (multipart/form-data: name?, image?)
router.post("/", uploadProfile.single("image"), createUser);
router.get("/:id", getUser);
router.put("/:id", uploadProfile.single("image"), updateUser);

// GET  /api/users/:userId/progress                -> overall reading progress (%)
// POST /api/users/:userId/progress/:questionId    -> mark one question as read
router.get("/:userId/progress", getUserProgress);
router.post("/:userId/progress/:questionId", markQuestionAsRead);

module.exports = router;
