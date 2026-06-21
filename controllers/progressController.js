const mongoose = require("mongoose");
const User = require("../models/User");
const Question = require("../models/Question");
const ReadProgress = require("../models/ReadProgress");

// @desc    Mark a question as read/studied by a user
// @route   POST /api/users/:userId/progress/:questionId
// @access  Public
const markQuestionAsRead = async (req, res) => {
  try {
    const { userId, questionId } = req.params;

    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(questionId)) {
      return res.status(400).json({ message: "Invalid user or question id" });
    }

    const [user, question] = await Promise.all([
      User.findById(userId),
      Question.findById(questionId),
    ]);

    if (!user) return res.status(404).json({ message: "User not found" });
    if (!question) return res.status(404).json({ message: "Question not found" });

    // Idempotent: if already marked read, this just confirms it (no duplicate created)
    await ReadProgress.findOneAndUpdate(
      { user: userId, question: questionId },
      { user: userId, question: questionId, readAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const progress = await buildProgressSummary(userId);
    res.status(200).json(progress);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while marking question as read" });
  }
};

// @desc    Get a user's overall reading progress
// @route   GET /api/users/:userId/progress
// @access  Public
const getUserProgress = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const progress = await buildProgressSummary(userId);
    res.json(progress);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching progress" });
  }
};

// Shared helper: builds { totalQuestions, readCount, percentage, isComplete, readQuestionIds }
const buildProgressSummary = async (userId) => {
  const totalQuestions = await Question.countDocuments();
  const readDocs = await ReadProgress.find({ user: userId }).select("question");
  const readQuestionIds = readDocs.map((d) => d.question.toString());
  const readCount = readQuestionIds.length;
  const percentage = totalQuestions === 0 ? 0 : Math.min(100, Math.round((readCount / totalQuestions) * 100));

  return {
    totalQuestions,
    readCount,
    percentage,
    isComplete: totalQuestions > 0 && readCount >= totalQuestions,
    readQuestionIds,
  };
};

module.exports = { markQuestionAsRead, getUserProgress };
