const admin = require("../config/firebase");
const Notification = require("../models/Notification");
const User = require("../models/User");

// @desc    Send a push notification to ALL users who have an fcmToken
// @route   POST /api/notifications/send
// @access  Public (admin panel — no login required)
// Body (JSON): { title, message, link? }
const sendNotification = async (req, res) => {
  try {
    const { title, message, link } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required" });
    }

    // Collect all valid FCM tokens
    const users = await User.find({ fcmToken: { $ne: "" } }).select("fcmToken");
    const tokens = users.map((u) => u.fcmToken).filter(Boolean);

    let successCount = 0;
    let failureCount = 0;

    if (tokens.length > 0) {
      if (!admin.apps.length) {
        return res.status(503).json({
          message:
            "Firebase is not configured on this server. Add firebase-service-account.json to enable notifications.",
        });
      }

      // FCM allows max 500 tokens per multicast call — chunk if needed
      const CHUNK_SIZE = 500;
      for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
        const chunk = tokens.slice(i, i + CHUNK_SIZE);

        const fcmMessage = {
          tokens: chunk,
          notification: { title, body: message },
          data: { link: link || "" }, // passed to the app so it can open the right screen
          android: {
            notification: {
              clickAction: "FLUTTER_NOTIFICATION_CLICK", // works for both Flutter and Java
              sound: "default",
            },
          },
        };

        try {
          const response = await admin.messaging().sendEachForMulticast(fcmMessage);
          successCount += response.successCount;
          failureCount += response.failureCount;

          // Remove tokens that are no longer valid (uninstalled apps etc.)
          const invalidTokens = [];
          response.responses.forEach((r, idx) => {
            if (!r.success) {
              const code = r.error?.code;
              if (
                code === "messaging/invalid-registration-token" ||
                code === "messaging/registration-token-not-registered"
              ) {
                invalidTokens.push(chunk[idx]);
              }
            }
          });
          if (invalidTokens.length > 0) {
            await User.updateMany(
              { fcmToken: { $in: invalidTokens } },
              { $set: { fcmToken: "" } }
            );
          }
        } catch (fcmErr) {
          console.error("FCM send error:", fcmErr.message);
          failureCount += chunk.length;
        }
      }
    }

    // Save to notification history regardless of whether tokens existed
    const notification = await Notification.create({
      title,
      message,
      link: link || "",
      sentCount: tokens.length,
      successCount,
      failureCount,
    });

    res.status(201).json({
      notification,
      summary: {
        totalDevices: tokens.length,
        successCount,
        failureCount,
        noTokensMessage:
          tokens.length === 0
            ? "No users have registered for notifications yet. Notification saved to history."
            : null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while sending notification" });
  }
};

// @desc    Get notification history (most recent first)
// @route   GET /api/notifications
// @access  Public (admin panel)
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const total = await Notification.countDocuments();
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);
    res.json({ total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, data: notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while fetching notifications" });
  }
};

// @desc    Delete a notification from history
// @route   DELETE /api/notifications/:id
// @access  Public (admin panel)
const deleteNotification = async (req, res) => {
  try {
    const n = await Notification.findByIdAndDelete(req.params.id);
    if (!n) return res.status(404).json({ message: "Notification not found" });
    res.json({ message: "Deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Register or update a user's FCM token (called by the Android app)
// @route   PUT /api/notifications/token
// @access  Private (Bearer token required)
// Body (JSON): { fcmToken }
const registerToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ message: "fcmToken is required" });
    req.user.fcmToken = fcmToken;
    await req.user.save();
    res.json({ message: "FCM token registered" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { sendNotification, getNotifications, deleteNotification, registerToken };
