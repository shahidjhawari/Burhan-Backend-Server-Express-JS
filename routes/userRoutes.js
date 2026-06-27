const express = require("express");
const router  = express.Router();
const { getUsers, createUser, getUser, updateUser, deleteUser } = require("../controllers/userController");
const {
  markQuestionAsRead,
  completeQuestion,
  getUserProgress,
  getUserStats,
  getUserProfile,
} = require("../controllers/progressController");
const uploadProfile = require("../middleware/uploadProfile");

// ── User CRUD ─────────────────────────────────────────────────────────────────
router.get("/",    getUsers);                              // list with progress
router.post("/",   uploadProfile.single("image"), createUser);
router.get("/:id", getUser);
router.put("/:id", uploadProfile.single("image"), updateUser);
router.delete("/:id", deleteUser);

// ── Learning Progress ─────────────────────────────────────────────────────────
// GET  /api/users/:userId/progress                      → full progress summary + XP
// GET  /api/users/:userId/stats                         → detailed stats + title roadmap
// GET  /api/users/:userId/profile                       → full learning profile
// POST /api/users/:userId/progress/:questionId          → mark as opened/read (no XP)
// POST /api/users/:userId/progress/:questionId/complete → complete + award XP (ONCE)
router.get("/:userId/progress",                              getUserProgress);
router.get("/:userId/stats",                                 getUserStats);
router.get("/:userId/profile",                               getUserProfile);
router.post("/:userId/progress/:questionId",                 markQuestionAsRead);
router.post("/:userId/progress/:questionId/complete",        completeQuestion);

module.exports = router;
