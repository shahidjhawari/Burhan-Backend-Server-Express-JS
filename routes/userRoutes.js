const express = require("express");
const router = express.Router();
const { getUsers, createUser, getUser, updateUser, deleteUser } = require("../controllers/userController");
const { markQuestionAsRead, getUserProgress } = require("../controllers/progressController");
const uploadProfile = require("../middleware/uploadProfile");

// GET  /api/users          -> list all profiles, each with reading progress (supports ?search=&page=&limit=)
// POST /api/users          -> create profile (multipart/form-data: name, image)
// GET  /api/users/:id      -> get one profile
// PUT  /api/users/:id      -> update profile (multipart/form-data: name?, image?)
// DELETE /api/users/:id    -> delete profile
router.get("/", getUsers);
router.post("/", uploadProfile.single("image"), createUser);
router.get("/:id", getUser);
router.put("/:id", uploadProfile.single("image"), updateUser);
router.delete("/:id", deleteUser);

// GET  /api/users/:userId/progress                -> overall reading progress (%)
// POST /api/users/:userId/progress/:questionId    -> mark one question as read
router.get("/:userId/progress", getUserProgress);
router.post("/:userId/progress/:questionId", markQuestionAsRead);

module.exports = router;
