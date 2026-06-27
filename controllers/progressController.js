const mongoose      = require("mongoose");
const User          = require("../models/User");
const Question      = require("../models/Question");
const ReadProgress  = require("../models/ReadProgress");
const {
  XP_PER_QUESTION,
  recalcUser,
  didTitleChange,
  xpForLevel,
  getNextTitle,
  TITLES,
} = require("../config/xpSystem");

// ─── helpers ──────────────────────────────────────────────────────────────────

const validateIds = (userId, questionId) =>
  mongoose.isValidObjectId(userId) &&
  (!questionId || mongoose.isValidObjectId(questionId));

/**
 * Build a full progress summary for a user.
 * Called by multiple endpoints so it lives as a shared utility.
 */
const buildProgressSummary = async (userId) => {
  const [user, totalQuestions, progressDocs] = await Promise.all([
    User.findById(userId).select("xp level title totalQuestionsRead name image createdAt"),
    Question.countDocuments(),
    ReadProgress.find({ user: userId }).select("question completed xpEarned completedAt"),
  ]);

  if (!user) return null;

  const readCount      = progressDocs.length;
  const completedCount = progressDocs.filter((d) => d.completed).length;
  const readQuestionIds      = progressDocs.map((d) => d.question.toString());
  const completedQuestionIds = progressDocs.filter((d) => d.completed).map((d) => d.question.toString());
  const percentage = totalQuestions === 0
    ? 0
    : Math.min(100, Math.round((completedCount / totalQuestions) * 100));

  const nextTitle = getNextTitle(user.xp);
  const currentLevel = user.level;
  const xpForCurrentLevel = xpForLevel(currentLevel);
  const xpForNextLevel    = xpForLevel(currentLevel + 1);
  const xpIntoLevel       = user.xp - xpForCurrentLevel;
  const xpNeededForNext   = xpForNextLevel - xpForCurrentLevel;
  const levelProgress     = Math.round((xpIntoLevel / xpNeededForNext) * 100);

  return {
    // User identity
    userId:      user._id,
    name:        user.name,
    image:       user.image,
    joinDate:    user.createdAt,

    // XP / Level / Title
    xp:    user.xp,
    level: user.level,
    title: user.title,
    levelProgress,                // % toward next level
    xpForNextLevel,
    xpIntoLevel,
    nextTitle:   nextTitle?.title   || null,
    nextTitleXp: nextTitle?.minXp   || null,

    // Reading stats
    totalQuestions,
    readCount,
    completedCount,
    totalQuestionsRead:    user.totalQuestionsRead,
    percentage,
    isComplete:    totalQuestions > 0 && completedCount >= totalQuestions,
    readQuestionIds,
    completedQuestionIds,
  };
};

// ─── POST /api/users/:userId/progress/:questionId ────────────────────────────
// Backward-compatible: still marks as "read" (existing behaviour).
// DOES NOT award XP — that happens only on /complete below.
const markQuestionAsRead = async (req, res) => {
  try {
    const { userId, questionId } = req.params;
    if (!validateIds(userId, questionId)) {
      return res.status(400).json({ message: "Invalid user or question id" });
    }

    const [user, question] = await Promise.all([
      User.findById(userId),
      Question.findById(questionId),
    ]);
    if (!user)     return res.status(404).json({ message: "User not found" });
    if (!question) return res.status(404).json({ message: "Question not found" });

    // Upsert — safe if already marked read
    await ReadProgress.findOneAndUpdate(
      { user: userId, question: questionId },
      { $setOnInsert: { user: userId, question: questionId, readAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const progress = await buildProgressSummary(userId);
    res.status(200).json(progress);
  } catch (error) {
    console.error("markQuestionAsRead:", error);
    res.status(500).json({ message: "Server error while marking question as read" });
  }
};

// ─── POST /api/users/:userId/progress/:questionId/complete ───────────────────
// Called when user reaches the BOTTOM of an answer (completion event).
// Awards XP ONCE. Recalculates level + title. Returns detailed result.
const completeQuestion = async (req, res) => {
  try {
    const { userId, questionId } = req.params;
    if (!validateIds(userId, questionId)) {
      return res.status(400).json({ message: "Invalid user or question id" });
    }

    const [user, question] = await Promise.all([
      User.findById(userId),
      Question.findById(questionId),
    ]);
    if (!user)     return res.status(404).json({ message: "User not found" });
    if (!question) return res.status(404).json({ message: "Question not found" });

    // Find or create progress record
    let progressDoc = await ReadProgress.findOne({ user: userId, question: questionId });

    let xpAwarded      = 0;
    let alreadyDone    = false;
    let titleChanged   = false;
    let oldTitle       = user.title;

    if (progressDoc?.completed) {
      // Already completed — no XP awarded
      alreadyDone = true;
    } else {
      // First time completing this question
      xpAwarded = XP_PER_QUESTION;

      if (progressDoc) {
        progressDoc.completed   = true;
        progressDoc.xpEarned    = xpAwarded;
        progressDoc.completedAt = new Date();
        progressDoc.readAt      = progressDoc.readAt || new Date();
        await progressDoc.save();
      } else {
        await ReadProgress.create({
          user:        userId,
          question:    questionId,
          completed:   true,
          xpEarned:    xpAwarded,
          completedAt: new Date(),
          readAt:      new Date(),
        });
      }

      // Update user XP, level, title, totalQuestionsRead atomically
      user.xp                 = (user.xp || 0) + xpAwarded;
      user.totalQuestionsRead = (user.totalQuestionsRead || 0) + 1;
      recalcUser(user); // sets user.level and user.title from xp
      titleChanged = didTitleChange(user.xp - xpAwarded, user.xp);
      await user.save();
    }

    const progress = await buildProgressSummary(userId);

    res.status(200).json({
      ...progress,
      // Completion-specific result fields (used by Android for animations)
      xpAwarded,
      alreadyCompleted: alreadyDone,
      titleChanged,
      newTitle: titleChanged ? user.title : null,
      oldTitle: titleChanged ? oldTitle : null,
      message: alreadyDone
        ? "Already completed — no XP awarded"
        : `+${xpAwarded} XP earned!`,
    });
  } catch (error) {
    console.error("completeQuestion:", error);
    res.status(500).json({ message: "Server error while completing question" });
  }
};

// ─── GET /api/users/:userId/progress ─────────────────────────────────────────
const getUserProgress = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!validateIds(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const progress = await buildProgressSummary(userId);
    res.json(progress);
  } catch (error) {
    console.error("getUserProgress:", error);
    res.status(500).json({ message: "Server error while fetching progress" });
  }
};

// ─── GET /api/users/:userId/stats ─────────────────────────────────────────────
// Detailed stats including XP history per title level
const getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!validateIds(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const progress = await buildProgressSummary(userId);

    // Title progression roadmap
    const titleRoadmap = TITLES.map((t) => ({
      ...t,
      achieved: user.xp >= t.minXp,
    }));

    res.json({ ...progress, titleRoadmap });
  } catch (error) {
    console.error("getUserStats:", error);
    res.status(500).json({ message: "Server error while fetching stats" });
  }
};

// ─── GET /api/users/:userId/profile ──────────────────────────────────────────
// Full learning profile for the profile screen in the Android app
const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!validateIds(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const user = await User.findById(userId).select(
      "name email phone bio image authProvider xp level title totalQuestionsRead createdAt"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    const progress = await buildProgressSummary(userId);
    res.json({
      user: {
        _id:              user._id,
        name:             user.name,
        email:            user.email,
        phone:            user.phone,
        bio:              user.bio,
        image:            user.image,
        authProvider:     user.authProvider,
        xp:               user.xp,
        level:            user.level,
        title:            user.title,
        totalQuestionsRead: user.totalQuestionsRead,
        joinDate:         user.createdAt,
      },
      progress,
    });
  } catch (error) {
    console.error("getUserProfile:", error);
    res.status(500).json({ message: "Server error while fetching profile" });
  }
};

module.exports = {
  markQuestionAsRead,
  completeQuestion,
  getUserProgress,
  getUserStats,
  getUserProfile,
};
