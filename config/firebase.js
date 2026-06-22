const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// We support two ways to provide the Firebase service account:
// 1. FIREBASE_SERVICE_ACCOUNT env var — a JSON string (better for cloud deployment like Vercel/Railway)
// 2. A file at backend/firebase-service-account.json (easier for local dev)

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT env var is not valid JSON");
  }
} else {
  const filePath = path.join(__dirname, "..", "firebase-service-account.json");
  if (fs.existsSync(filePath)) {
    serviceAccount = require(filePath);
  } else {
    console.warn(
      "Firebase not configured: add firebase-service-account.json or set FIREBASE_SERVICE_ACCOUNT env var. " +
      "Notifications will not work until this is set up."
    );
  }
}

if (serviceAccount && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
