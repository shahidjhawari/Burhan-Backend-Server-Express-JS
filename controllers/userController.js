const cloudinary = require("../config/cloudinary");
const User = require("../models/User");
const Question = require("../models/Question");
const ReadProgress = require("../models/ReadProgress");

// @desc    Get all user profiles, each with their reading progress
//          (supports ?search=&page=&limit=)
// @route   GET /api/users
// @access  Public (used by the admin panel)
const getUsers = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (search) filter.name = { $regex: search, $options: "i" };

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const totalQuestions = await Question.countDocuments();
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const userIds = users.map((u) => u._id);

    // Completed questions count per user (only completed=true rows)
    const completedCounts = await ReadProgress.aggregate([
      { $match: { user: { $in: userIds }, completed: true } },
      { $group: { _id: "$user", count: { $sum: 1 } } },
    ]);
    const completedMap = {};
    completedCounts.forEach((c) => { completedMap[c._id.toString()] = c.count; });

    const data = users.map((u) => {
      const completedCount = completedMap[u._id.toString()] || 0;
      const percentage = totalQuestions === 0
        ? 0
        : Math.min(100, Math.round((completedCount / totalQuestions) * 100));
      return {
        ...u.toObject(),
        readCount: completedCount,  // backward compat key
        completedCount,
        totalQuestions,
        percentage,
        // xp, level, title already in user document
      };
    });

    res.json({
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching users" });
  }
};

// @desc    Create a new user profile (with optional image)
// @route   POST /api/users
// @access  Public
const createUser = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const image = req.file ? req.file.path : "";
    const imagePublicId = req.file ? req.file.filename : "";

    const user = await User.create({ name: name.trim(), image, imagePublicId });

    res.status(201).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while creating profile" });
  }
};

// @desc    Get a user profile by id
// @route   GET /api/users/:id
// @access  Public
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching profile" });
  }
};

// @desc    Update a user profile (name and/or image)
// @route   PUT /api/users/:id
// @access  Public
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name } = req.body;
    if (name !== undefined && name.trim()) {
      user.name = name.trim();
    }

    if (req.file) {
      // Replace old profile image on Cloudinary if one exists
      if (user.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(user.imagePublicId);
        } catch (err) {
          console.error("Failed to delete old profile image:", err.message);
        }
      }
      user.image = req.file.path;
      user.imagePublicId = req.file.filename;
    }

    const updated = await user.save();
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while updating profile" });
  }
};

// @desc    Delete a user profile
// @route   DELETE /api/users/:id
// @access  Public (used by the admin panel)
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(user.imagePublicId);
      } catch (err) {
        console.error("Failed to delete profile image:", err.message);
      }
    }

    await ReadProgress.deleteMany({ user: user._id });
    await user.deleteOne();

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while deleting user" });
  }
};

module.exports = { getUsers, createUser, getUser, updateUser, deleteUser };
