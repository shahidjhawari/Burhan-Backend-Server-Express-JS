const admin       = require("../config/firebase");
const LiveSession = require("../models/LiveSession");

const getDB = () => {
  if (!admin.apps.length) return null;
  return admin.database();
};

// @desc  Admin starts a live session
// @route POST /api/live/start
const startLive = async (req, res) => {
  try {
    const { title = "Live Session", description = "" } = req.body;

    // End any previous active session in MongoDB
    await LiveSession.updateMany({ isLive: true }, { isLive: false, endedAt: new Date() });

    // Create new session record
    const session = await LiveSession.create({ title, description, isLive: true });

    // Set live status in Firebase Realtime Database
    const db = getDB();
    if (db) {
      // Clear old viewer data from any previous session
      await db.ref("live/viewers").remove();
      // Set current session status (all app users will see this)
      await db.ref("live/status").set({
        isLive:      true,
        title,
        description,
        sessionId:   session._id.toString(),
        startedAt:   Date.now(),
        viewerCount: 0,
      });
    }

    res.status(201).json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error starting live session" });
  }
};

// @desc  Admin ends the live session
// @route POST /api/live/end
const endLive = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (sessionId) {
      await LiveSession.findByIdAndUpdate(sessionId, { isLive: false, endedAt: new Date() });
    }

    const db = getDB();
    if (db) {
      // Mark as ended so app users get notified
      await db.ref("live/status/isLive").set(false);
      await db.ref("live/status/endedAt").set(Date.now());
      // Clean up signaling data after short delay
      setTimeout(async () => {
        try { await db.ref("live").remove(); } catch {}
      }, 5000);
    }

    res.json({ message: "Live session ended" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error ending live session" });
  }
};

// @desc  Get current live status (REST fallback for app startup)
// @route GET /api/live/status
const getLiveStatus = async (req, res) => {
  try {
    const db = getDB();
    if (db) {
      const snap = await db.ref("live/status").get();
      if (snap.exists()) {
        return res.json(snap.val());
      }
    }
    // Fallback: check MongoDB
    const session = await LiveSession.findOne({ isLive: true });
    if (session) {
      return res.json({
        isLive: true, title: session.title,
        description: session.description,
        sessionId: session._id, startedAt: session.createdAt,
      });
    }
    res.json({ isLive: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc  Get past live sessions
// @route GET /api/live/history
const getLiveHistory = async (req, res) => {
  try {
    const sessions = await LiveSession.find({ isLive: false })
      .sort({ createdAt: -1 }).limit(20);
    res.json({ data: sessions });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// @desc  Update viewer count (called by app when user joins/leaves)
// @route PUT /api/live/viewers
const updateViewerCount = async (req, res) => {
  try {
    const db = getDB();
    if (db) {
      const snap = await db.ref("live/status/viewerCount").get();
      const current = snap.exists() ? (snap.val() || 0) : 0;
      const delta   = req.body.action === "join" ? 1 : -1;
      await db.ref("live/status/viewerCount").set(Math.max(0, current + delta));
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { startLive, endLive, getLiveStatus, getLiveHistory, updateViewerCount };
