const cloudinary   = require("../config/cloudinary");
const Question     = require("../models/Question");
const { expandQuery } = require("../config/islamicWordMap");

// ── helpers ──────────────────────────────────────────────────────────────────

const destroyCloudinary = async (publicId, resourceType = "image") => {
  if (!publicId) return;
  try { await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }); }
  catch (err) { console.error("Cloudinary delete failed:", err.message); }
};

const pdfThumbnailUrl = (pdfUrl = "") => {
  if (!pdfUrl) return "";
  return pdfUrl
    .replace("/upload/", "/upload/pg_1,w_500,h_700,c_fit,q_auto/")
    .replace(/\.pdf$/i, ".jpg");
};

const buildEvidenceItems = (itemsJson, uploadedFiles, prefix) => {
  let items = [];
  try { items = JSON.parse(itemsJson || "[]"); } catch { items = []; }
  return items.map((item, idx) => {
    if (item.type === "image" || item.type === "pdf") {
      const uploaded = uploadedFiles.find((f) => f.fieldname === `${prefix}_${idx}`);
      if (uploaded) {
        return {
          type: item.type,
          value: uploaded.path,
          publicId: uploaded.filename,
          thumbnailUrl: item.type === "pdf" ? pdfThumbnailUrl(uploaded.path) : uploaded.path,
        };
      }
      return {
        type: item.type,
        value: item.value || "",
        publicId: item.publicId || "",
        thumbnailUrl: item.thumbnailUrl || (item.type === "pdf" ? pdfThumbnailUrl(item.value) : item.value || ""),
      };
    }
    return { type: item.type, value: item.value || "" };
  });
};

const destroyEvidenceItems = async (items = []) => {
  for (const item of items) {
    if (item.publicId && (item.type === "image" || item.type === "pdf")) {
      await destroyCloudinary(item.publicId, "image");
    }
  }
};

const parseArray = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    // comma-separated fallback
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
};

const parseQuotes = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((q) => q && q.text);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((q) => q && q.text) : [];
  } catch { return []; }
};

// ── GET /api/questions ───────────────────────────────────────────────────────
const getQuestions = async (req, res) => {
  try {
    const { category, search, language, tags, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (language) filter.language = language;
    if (tags)     filter.tags = { $in: tags.split(",").map((t) => t.trim()) };
    if (search) {
      filter.$or = [
        { question: { $regex: search, $options: "i" } },
        { answer:   { $regex: search, $options: "i" } },
        { tags:     { $regex: search, $options: "i" } },
        { keywords: { $regex: search, $options: "i" } },
      ];
    }
    const pageNum  = Math.max(parseInt(page, 10)  || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const total     = await Question.countDocuments(filter);
    const questions = await Question.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select("-relatedQuestions"); // lighter list view
    res.json({ total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, data: questions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching questions" });
  }
};

// ── GET /api/questions/search ────────────────────────────────────────────────
// Priority: 1-exact match  2-keyword  3-tags  4-expanded Islamic synonyms
const searchQuestions = async (req, res) => {
  try {
    const { q = "", page = 1, limit = 20, category, language } = req.query;
    if (!q.trim()) return res.json({ total: 0, page: 1, pages: 1, data: [] });

    const pageNum  = Math.max(parseInt(page, 10)  || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip     = (pageNum - 1) * limitNum;

    const expandedTerms = expandQuery(q);          // Islamic synonym expansion
    const regexQ        = new RegExp(q.trim(), "i");
    const baseFilter    = {};
    if (category) baseFilter.category = category;
    if (language) baseFilter.language = language;

    // ── Level 1: exact question / answer match ──
    const exactFilter = {
      ...baseFilter,
      $or: [
        { question: regexQ },
        { answer:   regexQ },
      ],
    };

    // ── Level 2+3: tags / keywords match (including expanded synonyms) ──
    const synonymFilter = {
      ...baseFilter,
      $or: [
        { tags:     { $in: expandedTerms } },
        { keywords: { $in: expandedTerms } },
        { tags:     { $elemMatch: { $regex: q, $options: "i" } } },
        { keywords: { $elemMatch: { $regex: q, $options: "i" } } },
        { question: { $regex: q, $options: "i" } },
        { answer:   { $regex: q, $options: "i" } },
        { category: regexQ },
      ],
    };

    // Run both in parallel; merge deduplicated by _id
    const [exactResults, synonymResults] = await Promise.all([
      Question.find(exactFilter).limit(limitNum).lean(),
      Question.find(synonymFilter).limit(limitNum * 3).lean(),
    ]);

    const seenIds   = new Set();
    const merged    = [];
    for (const q of [...exactResults, ...synonymResults]) {
      const id = q._id.toString();
      if (!seenIds.has(id)) { seenIds.add(id); merged.push(q); }
    }

    const total = merged.length;
    const data  = merged.slice(skip, skip + limitNum);

    res.json({ total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during search" });
  }
};

// ── GET /api/questions/:id ───────────────────────────────────────────────────
const getQuestionById = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id)
      .populate("relatedQuestions", "question category tags image");
    if (!question) return res.status(404).json({ message: "Question not found" });
    res.json(question);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/questions/:id/related ──────────────────────────────────────────
// Returns up to 8 related questions using:
// 1. Admin-defined relatedQuestions (highest priority)
// 2. Shared tags (scored by overlap count)
// 3. Same category
const getRelatedQuestions = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found" });

    const LIMIT = parseInt(req.query.limit, 10) || 8;

    // Admin-defined related questions first
    const adminRelated = question.relatedQuestions.length
      ? await Question.find({ _id: { $in: question.relatedQuestions } })
          .select("question category tags image")
          .limit(LIMIT)
          .lean()
      : [];

    const adminIds = new Set(adminRelated.map((q) => q._id.toString()));
    const remaining = LIMIT - adminRelated.length;

    if (remaining <= 0) {
      return res.json({ data: adminRelated });
    }

    // Auto-related: find questions with overlapping tags or same category
    const autoFilter = {
      _id: { $ne: question._id, $nin: [...adminIds] },
      $or: [],
    };

    if (question.tags?.length)     autoFilter.$or.push({ tags:     { $in: question.tags } });
    if (question.keywords?.length) autoFilter.$or.push({ keywords: { $in: question.keywords } });
    if (question.category)         autoFilter.$or.push({ category: question.category });

    if (autoFilter.$or.length === 0) {
      return res.json({ data: adminRelated });
    }

    const candidates = await Question.find(autoFilter)
      .select("question category tags keywords image")
      .limit(50)
      .lean();

    // Score each candidate by number of shared tags + keywords
    const scored = candidates.map((q) => {
      let score = 0;
      if (question.tags?.length)
        score += q.tags?.filter((t) => question.tags.includes(t)).length * 3 || 0;
      if (question.keywords?.length)
        score += q.keywords?.filter((k) => question.keywords.includes(k)).length * 2 || 0;
      if (q.category === question.category) score += 1;
      return { ...q, _score: score };
    });

    scored.sort((a, b) => b._score - a._score);

    const autoRelated = scored.slice(0, remaining).map(({ _score, ...q }) => q);
    res.json({ data: [...adminRelated, ...autoRelated] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error fetching related questions" });
  }
};

// ── POST /api/admin/questions ────────────────────────────────────────────────
const createQuestion = async (req, res) => {
  try {
    const {
      question, answer, category, language,
      scientificProofs, ahadees, youtubeVideos,
      tags, keywords, relatedQuestions,
      richText, notes, references, quotes,
    } = req.body;

    if (!question || !answer) return res.status(400).json({ message: "Question and answer are required" });

    const files = req.files || [];
    const mainImageFile = files.find((f) => f.fieldname === "image");

    const newQuestion = await Question.create({
      question, answer, category, language,
      image:         mainImageFile ? mainImageFile.path : "",
      imagePublicId: mainImageFile ? mainImageFile.filename : "",
      scientificProofs: buildEvidenceItems(scientificProofs, files, "proof"),
      ahadees:          buildEvidenceItems(ahadees, files, "hadees"),
      youtubeVideos:    parseArray(youtubeVideos),
      tags:             parseArray(tags),
      keywords:         parseArray(keywords),
      relatedQuestions: parseArray(relatedQuestions),
      richText:    richText    || "",
      notes:       notes       || "",
      references:  parseArray(references),
      quotes:      parseQuotes(quotes),
    });

    res.status(201).json(newQuestion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while creating question" });
  }
};

// ── PUT /api/admin/questions/:id ─────────────────────────────────────────────
const updateQuestion = async (req, res) => {
  try {
    const existing = await Question.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Question not found" });

    const {
      question, answer, category, language,
      scientificProofs, ahadees, youtubeVideos,
      tags, keywords, relatedQuestions,
      richText, notes, references, quotes,
    } = req.body;
    const files = req.files || [];

    if (question  !== undefined) existing.question  = question;
    if (answer    !== undefined) existing.answer    = answer;
    if (category  !== undefined) existing.category  = category;
    if (language  !== undefined) existing.language  = language;
    if (tags      !== undefined) existing.tags      = parseArray(tags);
    if (keywords  !== undefined) existing.keywords  = parseArray(keywords);
    if (relatedQuestions !== undefined) existing.relatedQuestions = parseArray(relatedQuestions);

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
          await destroyCloudinary(old.publicId, "image");
      }
      existing.scientificProofs = newProofs;
    }
    if (ahadees !== undefined) {
      const newAh = buildEvidenceItems(ahadees, files, "hadees");
      for (const old of existing.ahadees) {
        if (old.publicId && !newAh.some((n) => n.publicId === old.publicId))
          await destroyCloudinary(old.publicId, "image");
      }
      existing.ahadees = newAh;
    }
    if (youtubeVideos !== undefined) existing.youtubeVideos = parseArray(youtubeVideos);
    if (richText    !== undefined) existing.richText    = richText;
    if (notes       !== undefined) existing.notes       = notes;
    if (references  !== undefined) existing.references  = parseArray(references);
    if (quotes      !== undefined) existing.quotes      = parseQuotes(quotes);

    const updated = await existing.save();
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while updating question" });
  }
};

// ── DELETE /api/admin/questions/:id ──────────────────────────────────────────
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

module.exports = {
  getQuestions,
  searchQuestions,
  getQuestionById,
  getRelatedQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};
