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
  getLevel,
  getTitle,
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

// ═══════════════════════════════════════════════════════════════════════════════
// RICH CONTENT PROGRESS (granular per-item XP tracking)
// ═══════════════════════════════════════════════════════════════════════════════

const ContentProgress = require("../models/ContentProgress");
const {
  CONTENT_XP,
  MIN_VIDEO_WATCH_PERCENT,
  MIN_PDF_TIME_SECONDS,
  MIN_URL_TIME_SECONDS,
} = require("../config/xpSystem");

/**
 * Core helper: try to award XP for one content item.
 * Returns { xpAwarded, alreadyCompleted, doc }
 *
 * Safe to call concurrently — upsert + conditional update prevents duplication.
 */
const awardContentXp = async ({
  userId, questionId, contentType, contentId = "main",
  timeSpentSeconds = 0, watchPercent = 0,
}) => {
  // Check if already completed
  const existing = await ContentProgress.findOne({
    user: userId, question: questionId, contentType, contentId,
  });

  if (existing?.completed) {
    // Already done — update time/watchPercent but award NO more XP
    if (watchPercent > (existing.watchPercent || 0) || timeSpentSeconds > (existing.timeSpentSeconds || 0)) {
      existing.watchPercent     = Math.max(existing.watchPercent, watchPercent);
      existing.timeSpentSeconds = Math.max(existing.timeSpentSeconds, timeSpentSeconds);
      await existing.save();
    }
    return { xpAwarded: 0, alreadyCompleted: true, doc: existing };
  }

  const xpAmount = CONTENT_XP[contentType] || 0;

  let doc;
  if (existing) {
    existing.completed        = true;
    existing.xpEarned         = xpAmount;
    existing.completedAt      = new Date();
    existing.timeSpentSeconds = Math.max(existing.timeSpentSeconds || 0, timeSpentSeconds);
    existing.watchPercent     = Math.max(existing.watchPercent || 0, watchPercent);
    doc = await existing.save();
  } else {
    doc = await ContentProgress.create({
      user: userId, question: questionId,
      contentType, contentId,
      completed: true, xpEarned: xpAmount,
      completedAt: new Date(),
      timeSpentSeconds, watchPercent,
    });
  }

  // Apply XP to user (atomic $inc to avoid race conditions)
  const oldUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { xp: xpAmount } },
    { new: false } // get OLD value to check title change
  );
  const newXp  = (oldUser.xp || 0) + xpAmount;
  const newUser = await User.findByIdAndUpdate(
    userId,
    { level: getLevel(newXp), title: getTitle(newXp) },
    { new: true }
  );

  return {
    xpAwarded: xpAmount,
    alreadyCompleted: false,
    titleChanged: didTitleChange(oldUser.xp || 0, newXp),
    newTitle: newUser.title,
    oldTitle: oldUser.title,
    doc,
  };
};

/**
 * Build a detailed per-question content progress summary for a user.
 * Returns which items are done and the overall completion percentage.
 */
const buildContentSummary = async (userId, questionId) => {
  const [question, contentDocs] = await Promise.all([
    Question.findById(questionId).select(
      "scientificProofs ahadees youtubeVideos richText notes quotes references"
    ),
    ContentProgress.find({ user: userId, question: questionId }),
  ]);

  if (!question) return null;

  const completedMap = {};
  let totalXpEarned = 0;
  for (const d of contentDocs) {
    const key = `${d.contentType}:${d.contentId}`;
    completedMap[key] = { completed: d.completed, xpEarned: d.xpEarned, watchPercent: d.watchPercent };
    if (d.completed) totalXpEarned += d.xpEarned;
  }

  const isItemDone = (type, id) => completedMap[`${type}:${id}`]?.completed === true;

  // Collect all trackable items from the question
  const items = [];

  // Main text (richText or answer)
  if (question.richText || true) {
    items.push({ type: "text",  id: "main", done: isItemDone("text",  "main") });
  }

  // Images from scientificProofs
  for (const p of question.scientificProofs || []) {
    if (p.type === "image") items.push({ type: "image", id: p._id.toString(), done: isItemDone("image", p._id.toString()) });
    if (p.type === "pdf")   items.push({ type: "pdf",   id: p._id.toString(), done: isItemDone("pdf",   p._id.toString()) });
    if (p.type === "url")   items.push({ type: "url",   id: p._id.toString(), done: isItemDone("url",   p._id.toString()) });
  }

  // Same for ahadees
  for (const a of question.ahadees || []) {
    if (a.type === "image") items.push({ type: "image", id: a._id.toString(), done: isItemDone("image", a._id.toString()) });
    if (a.type === "pdf")   items.push({ type: "pdf",   id: a._id.toString(), done: isItemDone("pdf",   a._id.toString()) });
    if (a.type === "url")   items.push({ type: "url",   id: a._id.toString(), done: isItemDone("url",   a._id.toString()) });
  }

  // YouTube videos
  (question.youtubeVideos || []).forEach((_, i) => {
    items.push({ type: "video", id: String(i), done: isItemDone("video", String(i)), watchPercent: completedMap[`video:${i}`]?.watchPercent || 0 });
  });

  const doneCount  = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const contentPct = totalCount === 0 ? 100 : Math.round((doneCount / totalCount) * 100);
  const allDone    = doneCount === totalCount && totalCount > 0;

  return {
    items,
    doneCount,
    totalCount,
    contentCompletionPercent: contentPct,
    allContentCompleted: allDone,
    totalXpEarned,
  };
};

// ─── POST /api/users/:userId/content/:questionId/text ────────────────────────
// User finished reading the main text/answer
const completeTextContent = async (req, res) => {
  try {
    const { userId, questionId } = req.params;
    if (!validateIds(userId, questionId)) return res.status(400).json({ message: "Invalid ids" });

    const result = await awardContentXp({ userId, questionId, contentType: "text", contentId: "main" });
    const summary = await buildContentSummary(userId, questionId);
    res.json({ ...result, summary });
  } catch (err) {
    console.error("completeTextContent:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── POST /api/users/:userId/content/:questionId/image/:itemId ───────────────
const completeImageContent = async (req, res) => {
  try {
    const { userId, questionId, itemId } = req.params;
    const result = await awardContentXp({ userId, questionId, contentType: "image", contentId: itemId });
    const summary = await buildContentSummary(userId, questionId);
    res.json({ ...result, summary });
  } catch (err) {
    console.error("completeImageContent:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── POST /api/users/:userId/content/:questionId/pdf/:itemId ─────────────────
// Body (JSON): { timeSpentSeconds }
const completePdfContent = async (req, res) => {
  try {
    const { userId, questionId, itemId } = req.params;
    const timeSpentSeconds = parseInt(req.body.timeSpentSeconds, 10) || 0;

    if (timeSpentSeconds < MIN_PDF_TIME_SECONDS) {
      return res.status(200).json({
        xpAwarded: 0,
        alreadyCompleted: false,
        pending: true,
        message: `Keep reading — ${MIN_PDF_TIME_SECONDS - timeSpentSeconds}s remaining to earn PDF XP`,
      });
    }

    const result = await awardContentXp({
      userId, questionId, contentType: "pdf",
      contentId: itemId, timeSpentSeconds,
    });
    const summary = await buildContentSummary(userId, questionId);
    res.json({ ...result, summary });
  } catch (err) {
    console.error("completePdfContent:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── POST /api/users/:userId/content/:questionId/url/:itemId ─────────────────
// Body (JSON): { timeSpentSeconds }
const completeUrlContent = async (req, res) => {
  try {
    const { userId, questionId, itemId } = req.params;
    const timeSpentSeconds = parseInt(req.body.timeSpentSeconds, 10) || 0;

    if (timeSpentSeconds < MIN_URL_TIME_SECONDS) {
      return res.status(200).json({
        xpAwarded: 0, alreadyCompleted: false, pending: true,
        message: `Spend at least ${MIN_URL_TIME_SECONDS}s on the URL to earn XP`,
      });
    }

    const result = await awardContentXp({
      userId, questionId, contentType: "url",
      contentId: itemId, timeSpentSeconds,
    });
    const summary = await buildContentSummary(userId, questionId);
    res.json({ ...result, summary });
  } catch (err) {
    console.error("completeUrlContent:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── POST /api/users/:userId/content/:questionId/video/:videoIndex ───────────
// Body (JSON): { watchPercent }  (0-100)
const completeVideoContent = async (req, res) => {
  try {
    const { userId, questionId, videoIndex } = req.params;
    const watchPercent = parseFloat(req.body.watchPercent) || 0;

    // Update watch progress even if threshold not reached yet
    await ContentProgress.findOneAndUpdate(
      { user: userId, question: questionId, contentType: "video", contentId: String(videoIndex) },
      { $max: { watchPercent }, $setOnInsert: { user: userId, question: questionId, contentType: "video", contentId: String(videoIndex) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (watchPercent < MIN_VIDEO_WATCH_PERCENT) {
      return res.status(200).json({
        xpAwarded: 0, alreadyCompleted: false, pending: true,
        watchPercent,
        message: `Watch ${MIN_VIDEO_WATCH_PERCENT}% to earn XP (currently ${Math.round(watchPercent)}%)`,
      });
    }

    const result = await awardContentXp({
      userId, questionId, contentType: "video",
      contentId: String(videoIndex), watchPercent,
    });
    const summary = await buildContentSummary(userId, questionId);
    res.json({ ...result, summary });
  } catch (err) {
    console.error("completeVideoContent:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── GET /api/users/:userId/content/:questionId ──────────────────────────────
// Returns per-item progress for a specific question
const getContentProgress = async (req, res) => {
  try {
    const { userId, questionId } = req.params;
    if (!validateIds(userId, questionId)) return res.status(400).json({ message: "Invalid ids" });
    const summary = await buildContentSummary(userId, questionId);
    if (!summary) return res.status(404).json({ message: "Question not found" });
    res.json(summary);
  } catch (err) {
    console.error("getContentProgress:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  markQuestionAsRead,
  completeQuestion,
  getUserProgress,
  getUserStats,
  getUserProfile,
  // Content progress exports
  completeTextContent,
  completeImageContent,
  completePdfContent,
  completeUrlContent,
  completeVideoContent,
  getContentProgress,
};
