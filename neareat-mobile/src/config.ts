// ─── Mod ────────────────────────────────────────────────────────────────────
// false → gerçek backend + Google servisleri kullanılır (production/test)
// true  → sahte veriyle çalışır, backend bağlantısı yok (hızlı UI geliştirme)
export const MOCK_MODE = false;

export const MOCK_COORDS = { lat: 41.037, lng: 28.985 }; // İstanbul Taksim

// ─── Google ─────────────────────────────────────────────────────────────────
// Firebase Console → Proje Ayarları → Web uygulaması → Client ID
// Format: XXXXXXXXXX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
export const GOOGLE_WEB_CLIENT_ID = '1088498639612-651fnimrdrpu7h4rqetm8bdrqtoesbk7.apps.googleusercontent.com';
