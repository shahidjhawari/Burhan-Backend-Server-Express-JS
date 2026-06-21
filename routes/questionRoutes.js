const express = require("express");
const router = express.Router();
const {
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} = require("../controllers/questionController");
const upload = require("../middleware/upload");

/* ---------- PUBLIC ROUTES (consumed by the Android app and admin panel) ---------- */
// GET /api/questions            -> list (supports ?category=&search=&page=&limit=)
// GET /api/questions/:id        -> single question
router.get("/questions", getQuestions);
router.get("/questions/:id", getQuestionById);

/* ---------- ADMIN ROUTES (no login required — anyone with access to the admin panel can use these) ---------- */
// POST   /api/admin/questions       -> create (multipart/form-data, field name "image")
// PUT    /api/admin/questions/:id   -> update (multipart/form-data, field name "image")
// DELETE /api/admin/questions/:id   -> delete
router.post("/admin/questions", upload.single("image"), createQuestion);
router.put("/admin/questions/:id", upload.single("image"), updateQuestion);
router.delete("/admin/questions/:id", deleteQuestion);

module.exports = router;
