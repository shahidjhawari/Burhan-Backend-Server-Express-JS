require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const connectDB = require("./config/db");
require("./config/firebase"); // init Firebase Admin (FCM push notifications)

const questionRoutes     = require("./routes/questionRoutes");
const userRoutes         = require("./routes/userRoutes");
const authRoutes         = require("./routes/authRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

connectDB();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => res.json({ status: "ok", message: "Burhan backend running" }));

app.use("/api",               questionRoutes);
app.use("/api/users",         userRoutes);
app.use("/api/auth",          authRoutes);
app.use("/api/notifications", notificationRoutes);

app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
