const cloudinary = require("../config/cloudinary");
const Question = require("../models/Question");

// ---------- helpers ----------

const destroyCloudinary = async (publicId, resourceType = "image") => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error("Cloudinary delete failed:", err.message);
  }
};

const guessResourceType = (publicId = "") =>
  publicId.endsWith(".pdf") || publicId.includes("/raw/") ? "raw" : "image";

const buildEvidenceItems = (itemsJson, uploadedFiles, prefix) => {
  let items = [];
  try { items = JSON.parse(itemsJson || "[]"); } catch { items = []; }
  return items.map((item, idx) => {
    if (item.type === "image" || item.type === "pdf") {
      const fieldName = `${prefix}_${idx}`;
      const uploadedFile = uploadedFiles.find((f) => f.fieldname === fieldName);
      if (uploadedFile) {
        return { type: item.type, value: uploadedFile.path, publicId: uploadedFile.filename };
      }
      return { type: item.type, value: item.value || "", publicId: item.publicId || "" };
    }
    return { type: item.type, value: item.value || "" };
  });
};

const destroyEvidenceItems = async (items = []) => {
  for (const item of items) {
    if (item.publicId && (item.type === "image" || item.type === "pdf")) {
      await destroyCloudinary(item.publicId, guessResourceType(item.publicId));
    }
  }
};

const parseYoutubeVideos = (raw = "") => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [raw].filter(Boolean);
  }
};

// ---------- controllers ----------

const getQuestions = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (search) filter.$or = [
      { question: { $regex: search, $options: "i" } },
      { answer: { $regex: search, $options: "i" } },
    ];
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const total = await Question.countDocuments(filter);
    const questions = await Question.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);
    res.json({ total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, data: questions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching questions" });
  }
};

const getQuestionById = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found" });
    res.json(question);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const createQuestion = async (req, res) => {
  try {
    const { question, answer, category, scientificProofs, ahadees, youtubeVideos } = req.body;
    if (!question || !answer) return res.status(400).json({ message: "Question and answer are required" });
    const files = req.files || [];
    const mainImageFile = files.find((f) => f.fieldname === "image");
    const newQuestion = await Question.create({
      question, answer, category,
      image: mainImageFile ? mainImageFile.path : "",
      imagePublicId: mainImageFile ? mainImageFile.filename : "",
      scientificProofs: buildEvidenceItems(scientificProofs, files, "proof"),
      ahadees: buildEvidenceItems(ahadees, files, "hadees"),
      youtubeVideos: parseYoutubeVideos(youtubeVideos),
    });
    res.status(201).json(newQuestion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while creating question" });
  }
};

const updateQuestion = async (req, res) => {
  try {
    const existing = await Question.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Question not found" });
    const { question, answer, category, scientificProofs, ahadees, youtubeVideos } = req.body;
    const files = req.files || [];
    if (question !== undefined) existing.question = question;
    if (answer !== undefined) existing.answer = answer;
    if (category !== undefined) existing.category = category;
    const mainImageFile = files.find((f) => f.fieldname === "image");
    if (mainImageFile) {
      await destroyCloudinary(existing.imagePublicId, "image");
      existing.image = mainImageFile.path;
      existing.imagePublicId = mainImageFile.filename;
    }
    if (scientificProofs !== undefined) {
      const newProofs = buildEvidenceItems(scientificProofs, files, "proof");
      for (const old of existing.scientificProofs) {
        if (old.publicId && !newProofs.some((n) => n.publicId === old.publicId))
          await destroyCloudinary(old.publicId, guessResourceType(old.publicId));
      }
      existing.scientificProofs = newProofs;
    }
    if (ahadees !== undefined) {
      const newAh = buildEvidenceItems(ahadees, files, "hadees");
      for (const old of existing.ahadees) {
        if (old.publicId && !newAh.some((n) => n.publicId === old.publicId))
          await destroyCloudinary(old.publicId, guessResourceType(old.publicId));
      }
      existing.ahadees = newAh;
    }
    if (youtubeVideos !== undefined) existing.youtubeVideos = parseYoutubeVideos(youtubeVideos);
    const updated = await existing.save();
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while updating question" });
  }
};

const deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found" });
    await destroyCloudinary(question.imagePublicId, "image");
    await destroyEvidenceItems(question.scientificProofs);
    await destroyEvidenceItems(question.ahadees);
    await question.deleteOne();
    res.json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while deleting question" });
  }
};

module.exports = { getQuestions, getQuestionById, createQuestion, updateQuestion, deleteQuestion };
