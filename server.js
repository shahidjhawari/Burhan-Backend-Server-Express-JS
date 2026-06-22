require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const questionRoutes = require("./routes/questionRoutes");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors()); // allows the Android app and admin panel (different origin) to call this API
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "QA App backend is running" });
});

// Routes
app.use("/api", questionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler (e.g. catches multer file-type errors)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || "Something went wrong on the server" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
