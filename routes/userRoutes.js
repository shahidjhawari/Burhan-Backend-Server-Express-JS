const express = require("express");
const router  = express.Router();
const { getUsers, createUser, getUser, updateUser, deleteUser } = require("../controllers/userController");
const {
  markQuestionAsRead,
  completeQuestion,
  getUserProgress,
  getUserStats,
  getUserProfile,
  completeTextContent,
  completeImageContent,
  completePdfContent,
  completeUrlContent,
  completeVideoContent,
  getContentProgress,
} = require("../controllers/progressController");
const uploadProfile = require("../middleware/uploadProfile");

// ── User CRUD ─────────────────────────────────────────────────────────────────
router.get("/",    getUsers);
router.post("/",   uploadProfile.single("image"), createUser);
router.get("/:id", getUser);
router.put("/:id", uploadProfile.single("image"), updateUser);
router.delete("/:id", deleteUser);

// ── Learning Progress (basic) ─────────────────────────────────────────────────
router.get("/:userId/progress",                               getUserProgress);
router.get("/:userId/stats",                                  getUserStats);
router.get("/:userId/profile",                                getUserProfile);
router.post("/:userId/progress/:questionId",                  markQuestionAsRead);
router.post("/:userId/progress/:questionId/complete",         completeQuestion);

// ── Granular Content Progress ─────────────────────────────────────────────────
// GET  /api/users/:userId/content/:questionId              → per-item progress
// POST /api/users/:userId/content/:questionId/text         → +5 XP
// POST /api/users/:userId/content/:questionId/image/:id    → +2 XP
// POST /api/users/:userId/content/:questionId/pdf/:id      → +5 XP {timeSpentSeconds}
// POST /api/users/:userId/content/:questionId/url/:id      → +3 XP {timeSpentSeconds}
// POST /api/users/:userId/content/:questionId/video/:idx   → +10 XP {watchPercent}
router.get("/:userId/content/:questionId",                    getContentProgress);
router.post("/:userId/content/:questionId/text",              completeTextContent);
router.post("/:userId/content/:questionId/image/:itemId",     completeImageContent);
router.post("/:userId/content/:questionId/pdf/:itemId",       completePdfContent);
router.post("/:userId/content/:questionId/url/:itemId",       completeUrlContent);
router.post("/:userId/content/:questionId/video/:videoIndex", completeVideoContent);

module.exports = router;
