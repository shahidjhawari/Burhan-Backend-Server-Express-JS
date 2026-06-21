const cloudinary = require("../config/cloudinary");
const Question = require("../models/Question");

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
      data: questions,
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
    res.json(question);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching question" });
  }
};

// @desc    Create a new question (with optional image)
// @route   POST /api/admin/questions
// @access  Public (no login)
const createQuestion = async (req, res) => {
  try {
    const { question, answer, reference, category } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ message: "Question and answer fields are required" });
    }

    // multer-storage-cloudinary already uploaded the file to Cloudinary by
    // this point. req.file.path is the full secure_url, req.file.filename
    // is the public_id we need later to delete the image.
    const image = req.file ? req.file.path : "";
    const imagePublicId = req.file ? req.file.filename : "";

    const newQuestion = await Question.create({
      question,
      answer,
      reference,
      category,
      image,
      imagePublicId,
    });

    res.status(201).json(newQuestion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while creating question" });
  }
};

// @desc    Update an existing question (optionally replace image)
// @route   PUT /api/admin/questions/:id
// @access  Public (no login)
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

    // If a new image was uploaded, delete the old one from Cloudinary first
    if (req.file) {
      if (existing.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(existing.imagePublicId);
        } catch (err) {
          console.error("Failed to delete old Cloudinary image:", err.message);
        }
      }
      existing.image = req.file.path;
      existing.imagePublicId = req.file.filename;
    }

    const updated = await existing.save();
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while updating question" });
  }
};

// @desc    Delete a question
// @route   DELETE /api/admin/questions/:id
// @access  Public (no login)
const deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    if (question.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(question.imagePublicId);
      } catch (err) {
        console.error("Failed to delete Cloudinary image:", err.message);
      }
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
