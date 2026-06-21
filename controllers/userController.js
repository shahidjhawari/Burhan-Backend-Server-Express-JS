const cloudinary = require("../config/cloudinary");
const User = require("../models/User");

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

module.exports = { createUser, getUser, updateUser };
