const express = require("express");
const router = express.Router();
const {
  getQuestions, getQuestionById, createQuestion, updateQuestion, deleteQuestion,
} = require("../controllers/questionController");
const upload = require("../middleware/upload");

// Public (Android app)
router.get("/questions", getQuestions);
router.get("/questions/:id", getQuestionById);

// Admin — upload.any() accepts: image, proof_0, proof_1 ... hadees_0, hadees_1 ...
router.post("/admin/questions", upload.any(), createQuestion);
router.put("/admin/questions/:id", upload.any(), updateQuestion);
router.delete("/admin/questions/:id", deleteQuestion);

module.exports = router;
