const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const cloudinary = require("../config/cloudinary");
const User = require("../models/User");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "30d" });

const safeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  bio: user.bio || "",
  image: user.image,
  authProvider: user.authProvider,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// ──────────────────────────────────────────────────────────────
// @desc    Sign up with email + password
// @route   POST /api/auth/signup
// @access  Public  (multipart/form-data: name, email, phone, password, image?)
// ──────────────────────────────────────────────────────────────
const signup = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "Name, email and password are required" });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists)
      return res.status(400).json({ message: "An account with this email already exists" });

    const image = req.file ? req.file.path : "";
    const imagePublicId = req.file ? req.file.filename : "";

    const user = await User.create({
      name, email, phone, password,
      image, imagePublicId,
      authProvider: "email",
    });

    res.status(201).json({ token: generateToken(user._id), user: safeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during signup" });
  }
};

// ──────────────────────────────────────────────────────────────
// @desc    Login with email + password
// @route   POST /api/auth/login
// @access  Public  (JSON: { email, password })
// ──────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if (!user)
      return res.status(401).json({ message: "Invalid email or password" });

    if (user.authProvider === "google" && !user.password)
      return res.status(401).json({
        message: "This account was created with Google. Please sign in with Google.",
      });

    if (!(await user.matchPassword(password)))
      return res.status(401).json({ message: "Invalid email or password" });

    res.json({ token: generateToken(user._id), user: safeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during login" });
  }
};

// ──────────────────────────────────────────────────────────────
// @desc    Sign in / sign up with Google
// @route   POST /api/auth/google
// @access  Public  (JSON: { idToken })
//
// The Android app sends the Google ID token received from Google Sign-In SDK.
// We verify it server-side with google-auth-library, then find or create a user.
// ──────────────────────────────────────────────────────────────
const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken)
      return res.status(400).json({ message: "Google ID token is required" });

    if (!process.env.GOOGLE_CLIENT_ID)
      return res.status(503).json({ message: "Google Sign-In is not configured on this server. Set GOOGLE_CLIENT_ID in .env" });

    // Verify the token with Google
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      return res.status(401).json({ message: "Invalid Google token. Please try signing in again." });
    }

    const { sub: googleId, email, name, picture } = payload;

    // Try to find by googleId first, then by email (in case they signed up with email before)
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.findOne({ email: email.toLowerCase() });
    }

    if (user) {
      // Existing user — update googleId and profile photo if not already set
      if (!user.googleId) user.googleId = googleId;
      if (!user.image && picture) user.image = picture;
      if (user.authProvider !== "google" && !user.googleId) {
        // Linked their email account with Google — mark it
        user.authProvider = "google";
      }
      await user.save();
    } else {
      // New user — create account (no password, Google-only)
      user = await User.create({
        name,
        email: email.toLowerCase(),
        googleId,
        image: picture || "",
        authProvider: "google",
      });
    }

    res.json({ token: generateToken(user._id), user: safeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during Google sign-in" });
  }
};

// ──────────────────────────────────────────────────────────────
// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
// ──────────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  res.json({ user: safeUser(req.user) });
};

// ──────────────────────────────────────────────────────────────
// @desc    Update own profile — name, phone, bio, image, password
// @route   PUT /api/auth/me
// @access  Private  (multipart/form-data)
// ──────────────────────────────────────────────────────────────
const updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+password");

    const { name, phone, bio, newPassword, currentPassword } = req.body;

    if (name !== undefined && name.trim()) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (bio !== undefined) user.bio = bio.trim();

    // Password change — only for email accounts
    if (newPassword) {
      if (user.authProvider === "google" && !user.password) {
        return res.status(400).json({ message: "Google accounts cannot set a password this way." });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters." });
      }
      if (user.password) {
        // Existing password must be verified before changing
        if (!currentPassword) {
          return res.status(400).json({ message: "Current password is required to set a new password." });
        }
        const ok = await user.matchPassword(currentPassword);
        if (!ok) return res.status(401).json({ message: "Current password is incorrect." });
      }
      user.password = newPassword; // pre-save hook will hash it
    }

    // Profile image
    if (req.file) {
      // Delete old image from Cloudinary only if it was uploaded by us (not a Google photo URL)
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

// ──────────────────────────────────────────────────────────────
// @desc    Delete own account
// @route   DELETE /api/auth/me
// @access  Private
// ──────────────────────────────────────────────────────────────
const deleteMe = async (req, res) => {
  try {
    const user = req.user;
    if (user.imagePublicId) {
      try { await cloudinary.uploader.destroy(user.imagePublicId); } catch {}
    }
    await user.deleteOne();
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while deleting account" });
  }
};

module.exports = { signup, login, googleLogin, getMe, updateMe, deleteMe };
