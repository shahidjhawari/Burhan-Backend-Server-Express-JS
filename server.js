require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const questionRoutes = require("./routes/questionRoutes");

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors()); // allows the Android app and admin panel (different origin) to call this API
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically, e.g. http://localhost:5000/uploads/16989999-photo.jpg
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "QA App backend is running" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", questionRoutes); // exposes /api/questions and /api/admin/questions

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
