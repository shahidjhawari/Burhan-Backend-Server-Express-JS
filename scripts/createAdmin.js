// Run this once to create your first admin login:
//   npm run create-admin
//
// It reads ADMIN_USERNAME and ADMIN_PASSWORD from your .env file.
// You can also override them: ADMIN_USERNAME=ali ADMIN_PASSWORD=secret123 npm run create-admin

require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("../models/Admin");

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "admin123";

    const existing = await Admin.findOne({ username });
    if (existing) {
      console.log(`Admin "${username}" already exists. Nothing to do.`);
      process.exit(0);
    }

    await Admin.create({ username, password });
    console.log(`✅ Admin created successfully!`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log(`You can now log in to the admin panel with these credentials.`);
    process.exit(0);
  } catch (error) {
    console.error("Failed to create admin:", error.message);
    process.exit(1);
  }
};

run();
