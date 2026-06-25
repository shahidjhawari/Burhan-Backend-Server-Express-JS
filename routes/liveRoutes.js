const express = require("express");
const router  = express.Router();
const {
  startLive, endLive, getLiveStatus, getLiveHistory, updateViewerCount,
} = require("../controllers/liveController");

router.post("/start",       startLive);       // Admin: go live
router.post("/end",         endLive);         // Admin: end live
router.get("/status",       getLiveStatus);   // App: is anyone live?
router.get("/history",      getLiveHistory);  // Admin: past sessions
router.put("/viewers",      updateViewerCount); // App: join/leave count

module.exports = router;
