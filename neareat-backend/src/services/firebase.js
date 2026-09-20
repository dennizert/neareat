// Firebase Admin SDK kurulumu: hesap silmede Firebase kullanıcısının temizlenmesi (Auth)
// ve ileride push bildirim (FCM) için.
//
// firebase-admin v14 (#473): NAMESPACE API KALDIRILDI. v12'de kullanılan
// `admin.apps`, `admin.credential.cert()`, `admin.auth()`, `admin.messaging()`
// artık YOK — hepsi `undefined`. Eski kod `admin.apps.length` okuduğu için modül
// require edilirken patlıyordu; bu dosya authController üzerinden app.js'e bağlı
// olduğundan sunucu HİÇ AÇILMAZDI. Testler bunu yakalayamıyor çünkü bu servis
// mock'lanıyor — kırılma ancak çalışma anında görülürdü.
//
// Yeni API modüler alt yollardan gelir:
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth: getAuthForApp } = require('firebase-admin/auth');
const { getMessaging: getMessagingForApp } = require('firebase-admin/messaging');

// Servis hesabı kimliğiyle tek seferlik başlat (hot-reload'da çift init'i önle).
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      // Env değişkeninde "\n" düz metin olarak gelir; gerçek satır sonuna çevir.
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

// Firebase Admin Auth örneği (hesap silmede Firebase kullanıcısını temizlemek için kullanılır).
function getAuth() {
  return getAuthForApp();
}

// Firebase Cloud Messaging örneği (mobil push bildirimleri göndermek için).
function getMessaging() {
  return getMessagingForApp();
}

module.exports = { getAuth, getMessaging };
