const admin = require("firebase-admin");

if (!admin.apps.length) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT não configurado na Vercel.");
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = {
  admin,
  db,
};