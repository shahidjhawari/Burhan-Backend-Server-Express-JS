const LiveSession = require("../models/LiveSession");

// Tracks the current live session state in memory
let currentLiveSession = null;
// Maps socketId → { type: "admin"|"viewer", sessionId }
const connectedClients = {};

const initSocketIO = (io) => {
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ────────────────────────────────────────────────────────────
    // ADMIN EVENTS
    // ────────────────────────────────────────────────────────────

    // Admin starts a live session
    socket.on("admin:go-live", async ({ title, description }) => {
      try {
        // End any previously active session
        if (currentLiveSession) {
          await LiveSession.findByIdAndUpdate(currentLiveSession._id, {
            isLive: false,
            endedAt: new Date(),
          });
        }

        const session = await LiveSession.create({
          title: title || "Live Session",
          description: description || "",
          isLive: true,
        });

        currentLiveSession = session;
        connectedClients[socket.id] = { type: "admin", sessionId: session._id };
        socket.join("live-room");

        console.log(`Admin went live: ${session.title}`);

        // Notify ALL connected clients (viewers + admin)
        io.emit("live:started", {
          sessionId: session._id,
          title: session.title,
          description: session.description,
          startedAt: session.createdAt,
        });

        socket.emit("admin:live-confirmed", { sessionId: session._id });
      } catch (err) {
        console.error("go-live error:", err.message);
        socket.emit("error", { message: "Could not start live session" });
      }
    });

    // Admin ends the live session
    socket.on("admin:end-live", async () => {
      try {
        if (currentLiveSession) {
          await LiveSession.findByIdAndUpdate(currentLiveSession._id, {
            isLive: false,
            endedAt: new Date(),
          });
          const ended = currentLiveSession;
          currentLiveSession = null;

          io.emit("live:ended", { sessionId: ended._id });
          console.log(`Live session ended: ${ended.title}`);
        }
      } catch (err) {
        console.error("end-live error:", err.message);
      }
    });

    // ────────────────────────────────────────────────────────────
    // WEBRTC SIGNALING — admin → viewers
    // Admin sends its WebRTC offer to a specific viewer
    // ────────────────────────────────────────────────────────────
    socket.on("signal:offer", ({ targetSocketId, offer }) => {
      io.to(targetSocketId).emit("signal:offer", {
        fromSocketId: socket.id,
        offer,
      });
    });

    // Viewer sends its WebRTC answer back to admin
    socket.on("signal:answer", ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit("signal:answer", {
        fromSocketId: socket.id,
        answer,
      });
    });

    // ICE candidates exchanged between admin and viewer
    socket.on("signal:ice-candidate", ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit("signal:ice-candidate", {
        fromSocketId: socket.id,
        candidate,
      });
    });

    // ────────────────────────────────────────────────────────────
    // VIEWER EVENTS
    // ────────────────────────────────────────────────────────────

    // Viewer joins the live room
    socket.on("viewer:join", async ({ userId } = {}) => {
      socket.join("live-room");
      connectedClients[socket.id] = { type: "viewer", userId };

      if (currentLiveSession) {
        // Update viewer count
        currentLiveSession.viewerCount = (currentLiveSession.viewerCount || 0) + 1;
        await LiveSession.findByIdAndUpdate(currentLiveSession._id, {
          viewerCount: currentLiveSession.viewerCount,
        });

        // Tell this viewer the current live session details
        socket.emit("live:current", {
          sessionId: currentLiveSession._id,
          title: currentLiveSession.title,
          description: currentLiveSession.description,
          startedAt: currentLiveSession.createdAt,
          viewerCount: currentLiveSession.viewerCount,
        });

        // Tell the admin that a new viewer joined (so admin can send offer)
        const adminSocket = Object.entries(connectedClients).find(
          ([, c]) => c.type === "admin"
        );
        if (adminSocket) {
          io.to(adminSocket[0]).emit("viewer:joined", {
            viewerSocketId: socket.id,
          });
        }

        // Update viewer count for everyone
        io.to("live-room").emit("live:viewer-count", {
          count: currentLiveSession.viewerCount,
        });
      } else {
        // No active live session
        socket.emit("live:none");
      }
    });

    // Viewer asks if there's currently a live session (on app open)
    socket.on("viewer:check-live", () => {
      if (currentLiveSession) {
        socket.emit("live:current", {
          sessionId: currentLiveSession._id,
          title: currentLiveSession.title,
          description: currentLiveSession.description,
          startedAt: currentLiveSession.createdAt,
          viewerCount: currentLiveSession.viewerCount || 0,
        });
      } else {
        socket.emit("live:none");
      }
    });

    // ────────────────────────────────────────────────────────────
    // DISCONNECT
    // ────────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      const client = connectedClients[socket.id];
      if (client) {
        if (client.type === "viewer" && currentLiveSession) {
          currentLiveSession.viewerCount = Math.max(
            0,
            (currentLiveSession.viewerCount || 1) - 1
          );
          await LiveSession.findByIdAndUpdate(currentLiveSession._id, {
            viewerCount: currentLiveSession.viewerCount,
          });
          io.to("live-room").emit("live:viewer-count", {
            count: currentLiveSession.viewerCount,
          });
        }
        delete connectedClients[socket.id];
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

// REST helper — used by liveRoutes to expose current session state
const getCurrentSession = () => currentLiveSession;

module.exports = { initSocketIO, getCurrentSession };
