// E-posta linklerinden (doğrulama / şifre sıfırlama) gelen kullanıcıyı uygulamaya
// yönlendiren markalı ara sayfa. Çıplak "302 → neareat://" redirect'i Gmail'in
// in-app tarayıcısı bloke edebiliyor ve uygulama yüklü değilse hata veriyordu.
// Bu sayfa: deep link'i otomatik dener + "Uygulamada Aç" butonu sunar +
// uygulama açılmazsa Play Store'a düşürür.

const PLAY_STORE_URL = process.env.ANDROID_STORE_URL
  || `https://play.google.com/store/apps/details?id=${process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.eatlas.mobile'}`;

const BRAND = {
  coral: '#FF5A3C',
  coralActive: '#E84427',
  amber: '#FFB627',
  dark: '#100C16',
  muted: '#8A8290',
};

/**
 * @param {object} o
 * @param {string} o.deepLink   Açılacak neareat:// derin bağlantısı
 * @param {string} o.title      Başlık (ör. "E-postanı doğruluyoruz")
 * @param {string} o.message    Açıklama metni
 */
function renderAppLinkPage({ deepLink, title, message }) {
  const safeDeep = String(deepLink).replace(/"/g, '%22');
  return `<!DOCTYPE html>
<html lang="tr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)} — Eatlas</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:${BRAND.dark};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px}
  .card{max-width:420px;width:100%;background:#fff;border-radius:20px;padding:36px 28px;text-align:center;
        box-shadow:0 8px 40px rgba(0,0,0,.35)}
  .logo{font-size:30px;font-weight:800;letter-spacing:.3px;color:${BRAND.dark};margin-bottom:4px}
  .bar{height:4px;width:64px;margin:10px auto 24px;border-radius:2px;
       background:linear-gradient(90deg,${BRAND.coral},${BRAND.amber})}
  h1{font-size:20px;color:#1F1A24;margin:0 0 10px}
  p{font-size:15px;color:#3A3340;line-height:1.6;margin:0 0 24px}
  .btn{display:block;padding:15px 24px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;margin:10px 0}
  .primary{background:${BRAND.coralActive};color:#fff}
  .secondary{background:#F4EFE8;color:${BRAND.coralActive}}
  .hint{font-size:12px;color:${BRAND.muted};margin-top:18px;line-height:1.6}
</style>
</head><body>
  <div class="card">
    <div class="logo">Eatlas</div>
    <div class="bar"></div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a class="btn primary" href="${safeDeep}">Uygulamada Aç</a>
    <a class="btn secondary" id="store" href="${PLAY_STORE_URL}">Uygulamayı İndir</a>
    <p class="hint">Buton seni uygulamaya götürmezse Eatlas yüklü olmayabilir.<br>"Uygulamayı İndir" ile Play Store'dan kurabilirsin.</p>
  </div>
  <script>
    // Sayfa açılır açılmaz uygulamayı tetiklemeyi dene (kullanıcı jesti olmadan
    // bazı tarayıcılar engelleyebilir; o yüzden görünür buton da var).
    (function(){
      var deep = "${safeDeep}";
      try { window.location.href = deep; } catch (e) {}
    })();
  </script>
</body></html>`;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

module.exports = { renderAppLinkPage, PLAY_STORE_URL };
