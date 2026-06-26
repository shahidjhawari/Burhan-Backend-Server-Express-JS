const express = require("express");
const router  = express.Router();
const {
  getQuestions, searchQuestions, getQuestionById,
  getRelatedQuestions, createQuestion, updateQuestion, deleteQuestion,
} = require("../controllers/questionController");
const upload = require("../middleware/upload");

// ── Public (Android app + admin panel reads) ──
router.get("/questions/search",         searchQuestions);     // GET /api/questions/search?q=namaz
router.get("/questions/:id/related",    getRelatedQuestions); // GET /api/questions/:id/related
router.get("/questions",                getQuestions);        // GET /api/questions
router.get("/questions/:id",            getQuestionById);     // GET /api/questions/:id

// ── Admin (create/update/delete) ──
router.post("/admin/questions",         upload.any(), createQuestion);
router.put("/admin/questions/:id",      upload.any(), updateQuestion);
router.delete("/admin/questions/:id",   deleteQuestion);

module.exports = router;
