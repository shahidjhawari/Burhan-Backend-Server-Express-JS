const express = require("express");
const router = express.Router();
const {
  sendNotification,
  getNotifications,
  deleteNotification,
  registerToken,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/auth");

// Admin panel routes (no auth)
router.post("/send", sendNotification);          // POST /api/notifications/send
router.get("/", getNotifications);               // GET  /api/notifications
router.delete("/:id", deleteNotification);       // DELETE /api/notifications/:id

// Android app route (auth required — user must be logged in)
router.put("/token", protect, registerToken);    // PUT /api/notifications/token

module.exports = router;
