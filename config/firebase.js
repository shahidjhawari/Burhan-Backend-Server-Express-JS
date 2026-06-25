const admin = require("firebase-admin");
const path = require("path");
const fs   = require("fs");

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); }
  catch { console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON"); }
} else {
  // Try both file names — whatever the user downloaded from Firebase
  const candidates = [
    "firebase-service-account.json",
    ...fs.readdirSync(path.join(__dirname, ".."))
          .filter(f => f.endsWith(".json") && f.includes("firebase-adminsdk")),
  ];
  for (const name of candidates) {
    const p = path.join(__dirname, "..", name);
    if (fs.existsSync(p)) { serviceAccount = require(p); break; }
  }
  if (!serviceAccount) {
    console.warn("Firebase service account file not found. Notifications & live features won't work.");
  }
}

if (serviceAccount && !admin.apps.length) {
  admin.initializeApp({
    credential:  admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,  // Realtime Database URL
  });
  console.log("Firebase Admin initialized ✅");
}

module.exports = admin;
