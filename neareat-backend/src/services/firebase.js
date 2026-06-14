// Firebase Admin SDK kurulumu: Google OAuth doğrulama (Auth) ve push bildirim (FCM) için.
const admin = require('firebase-admin');

// Servis hesabı kimliğiyle tek seferlik başlat (hot-reload'da çift init'i önle).
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      // Env değişkeninde "\n" düz metin olarak gelir; gerçek satır sonuna çevir.
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
