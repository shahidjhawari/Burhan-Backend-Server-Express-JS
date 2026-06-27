const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    bio: {
      type: String,
      trim: true,
      default: "",
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
      // NOT required — Google users have no password
    },
    googleId: {
      type: String,
      default: "",
      index: true,
    },
    authProvider: {
      type: String,
      enum: ["email", "google"],
      default: "email",
    },
    image: {
      type: String,
      default: "",
    },
    imagePublicId: {
      type: String,
      default: "",
    },
    fcmToken: {
      type: String,
      default: "",
    },

    // ── Learning Progress (Learning Progress System) ──
    xp: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    level: {
      type: Number,
      default: 1,
      min: 1,
    },
    title: {
      type: String,
      default: "طالبِ علم",
    },
    totalQuestionsRead: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Hash password before saving (only if password is set — Google users skip this)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false; // Google-only account
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
