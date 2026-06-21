const fs = require("fs");
const path = require("path");
const Question = require("../models/Question");

// Helper: turn a stored relative image path into a full URL the Android app can load directly
const withFullImageUrl = (req, questionDoc) => {
  const q = questionDoc.toObject ? questionDoc.toObject() : questionDoc;
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
  return {
    ...q,
    image: q.image ? `${baseUrl}${q.image}` : "",
  };
};

// @desc    Get all questions (supports ?category=&search=&page=&limit=)
// @route   GET /api/questions
// @access  Public (used by Android app and admin panel)
const getQuestions = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { question: { $regex: search, $options: "i" } },
        { answer: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const total = await Question.countDocuments(filter);
    const questions = await Question.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      data: questions.map((q) => withFullImageUrl(req, q)),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching questions" });
  }
};

// @desc    Get single question by id
// @route   GET /api/questions/:id
// @access  Public
const getQuestionById = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }
    res.json(withFullImageUrl(req, question));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching question" });
  }
};

// @desc    Create a new question (with optional image)
// @route   POST /api/admin/questions
// @access  Private (admin only)
const createQuestion = async (req, res) => {
  try {
    const { question, answer, reference, category } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ message: "Question and answer fields are required" });
    }

    const imagePath = req.file ? `/uploads/${req.file.filename}` : "";

    const newQuestion = await Question.create({
      question,
      answer,
      reference,
      category,
      image: imagePath,
    });

    res.status(201).json(withFullImageUrl(req, newQuestion));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while creating question" });
  }
};

// @desc    Update an existing question (optionally replace image)
// @route   PUT /api/admin/questions/:id
// @access  Private (admin only)
const updateQuestion = async (req, res) => {
  try {
    const existing = await Question.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Question not found" });
    }

    const { question, answer, reference, category } = req.body;

    if (question !== undefined) existing.question = question;
    if (answer !== undefined) existing.answer = answer;
    if (reference !== undefined) existing.reference = reference;
    if (category !== undefined) existing.category = category;

    // If a new image was uploaded, replace the old one and delete the old file
    if (req.file) {
      if (existing.image) {
        const oldPath = path.join(__dirname, "..", existing.image);
        fs.unlink(oldPath, (err) => {
          if (err && err.code !== "ENOENT") console.error("Failed to delete old image:", err.message);
        });
      }
      existing.image = `/uploads/${req.file.filename}`;
    }

    const updated = await existing.save();
    res.json(withFullImageUrl(req, updated));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while updating question" });
  }
};

// @desc    Delete a question
// @route   DELETE /api/admin/questions/:id
// @access  Private (admin only)
const deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    if (question.image) {
      const imgPath = path.join(__dirname, "..", question.image);
      fs.unlink(imgPath, (err) => {
        if (err && err.code !== "ENOENT") console.error("Failed to delete image:", err.message);
      });
    }

    await question.deleteOne();
    res.json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while deleting question" });
  }
};

module.exports = {
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};
