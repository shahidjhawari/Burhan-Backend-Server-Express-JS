const jwt = require("jsonwebtoken");
const cloudinary = require("../config/cloudinary");
const User = require("../models/User");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "30d" });

const safeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  image: user.image,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// @desc    Sign up a new user
// @route   POST /api/auth/signup
// @access  Public
// Body (multipart/form-data): name, email, phone, password, image (optional file)
const signup = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    const image = req.file ? req.file.path : "";
    const imagePublicId = req.file ? req.file.filename : "";

    const user = await User.create({ name, email, phone, password, image, imagePublicId });

    res.status(201).json({ token: generateToken(user._id), user: safeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during signup" });
  }
};

// @desc    Log in existing user
// @route   POST /api/auth/login
// @access  Public
// Body (JSON): email, password
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({ token: generateToken(user._id), user: safeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during login" });
  }
};

// @desc    Get currently logged-in user
// @route   GET /api/auth/me
// @access  Private (requires Bearer token)
const getMe = async (req, res) => {
  res.json({ user: safeUser(req.user) });
};

// @desc    Update own profile (name, phone, image)
// @route   PUT /api/auth/me
// @access  Private
const updateMe = async (req, res) => {
  try {
    const user = req.user;
    const { name, phone } = req.body;
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;

    if (req.file) {
      if (user.imagePublicId) {
        try { await cloudinary.uploader.destroy(user.imagePublicId); } catch {}
      }
      user.image = req.file.path;
      user.imagePublicId = req.file.filename;
    }

    await user.save();
    res.json({ user: safeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while updating profile" });
  }
};

module.exports = { signup, login, getMe, updateMe };
