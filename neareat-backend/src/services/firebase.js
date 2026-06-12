const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

// Firebase Admin Auth örneği (hesap silmede Firebase kullanıcısını temizlemek için kullanılır).
function getAuth() {
  return admin.auth();
}

// Firebase Cloud Messaging örneği (mobil push bildirimleri göndermek için).
function getMessaging() {
  return admin.messaging();
}

module.exports = { getAuth, getMessaging };
