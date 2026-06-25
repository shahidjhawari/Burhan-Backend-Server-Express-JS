const mongoose = require("mongoose");

const liveSessionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      default: "Live Session",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    isLive: {
      type: Boolean,
      default: true,
    },
    viewerCount: {
      type: Number,
      default: 0,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LiveSession", liveSessionSchema);
