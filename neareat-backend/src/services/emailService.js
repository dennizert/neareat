// Transactional e-posta servisi (Resend): Eatlas markalı doğrulama, şifre sıfırlama
// ve hoş geldin e-postaları. Tüm mailler ortak `renderEmail` HTML şablonunu kullanır;
// kullanıcı verisi `escapeHtml` ile temizlenerek HTML enjeksiyonu önlenir.
const { Resend } = require('resend');

if (!process.env.RESEND_API_KEY) {
  console.warn('[EMAIL] UYARI: RESEND_API_KEY tanımlı değil — e-postalar gönderilmeyecek!');
}

const resend = new Resend(process.env.RESEND_API_KEY);
// Üretimde EMAIL_FROM'u doğrulanmış domainle ayarla (ör. "Eatlas <noreply@alanadiniz.com>").
// onboarding@resend.dev yalnızca hesap sahibinin kendi adresine gönderir — gerçek kullanıcılara gitmez.
const FROM = process.env.EMAIL_FROM || 'Eatlas <onboarding@resend.dev>';
const BASE_URL = process.env.APP_BASE_URL
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'http://localhost:3000');

// ── Marka paleti (mobil EatlasLogo + theme ile aynı) ──
const BRAND = {
  coral: '#FF5A3C',
  coralActive: '#E84427',
  amber: '#FFB627',
  dark: '#100C16',     // splash/koyu zemin
  ink: '#1F1A24',
  text: '#3A3340',
  muted: '#8A8290',
  cream: '#FBF7F2',
};

// E-posta doğrulama maili (token'lı link, 24 saat geçerli).
async function sendVerificationEmail(email, displayName, token) {
  const link = `${BASE_URL}/verify-email?token=${token}`;
  const { error } = await resend.emails.send({
    from: FROM,
    to: [email],
    subject: 'Eatlas — E-posta adresini doğrula',
    html: renderEmail({
      preheader: 'Hesabını doğrulamak için son bir adım kaldı.',
      heading: `Hoş geldin, ${escapeHtml(displayName)}!`,
      lead: 'Eatlas’a katıldığın için teşekkürler. E-posta adresini doğrulamak için aşağıdaki butona tıkla.',
      ctaLabel: 'E-postamı Doğrula',
      ctaHref: link,
      note: 'Bu bağlantı <strong>24 saat</strong> geçerlidir. Eatlas’a kayıt olmadıysan bu e-postayı dikkate alma.',
    }),
  });
  if (error) throw error;
}

// Şifre sıfırlama maili (token'lı link, 1 saat geçerli).
async function sendPasswordResetEmail(email, displayName, token) {
  const link = `${BASE_URL}/reset-password?token=${token}`;
  const { error } = await resend.emails.send({
    from: FROM,
    to: [email],
    subject: 'Eatlas — Şifre sıfırlama',
    html: renderEmail({
      preheader: 'Şifre sıfırlama bağlantın hazır.',
      heading: 'Şifre Sıfırlama',
      lead: `Merhaba ${escapeHtml(displayName)}, hesabın için bir şifre sıfırlama isteği aldık. Yeni şifre oluşturmak için aşağıdaki butona tıkla.`,
      ctaLabel: 'Şifremi Sıfırla',
      ctaHref: link,
      note: 'Bu bağlantı <strong>1 saat</strong> geçerlidir. Böyle bir talepte bulunmadıysan bu e-postayı yoksay — hesabın güvende.',
    }),
  });
  if (error) throw error;
}

// Kayıt sonrası gönderilen hoş geldin maili (özellik tanıtımı + uygulamaya yönlendirme).
async function sendWelcomeEmail(email, displayName) {
  const link = `${BASE_URL}/`;
  const { error } = await resend.emails.send({
    from: FROM,
    to: [email],
    subject: 'Eatlas’a hoş geldin! 🍽️',
    html: renderEmail({
      preheader: 'Çevrendeki en iyi restoranları keşfetmeye hazırsın.',
      heading: `Hoş geldin, ${escapeHtml(displayName)}!`,
      lead: 'Hesabın hazır. Eatlas ile yapabileceklerin:',
      bullets: [
        'Yapay zekâ destekli kişisel restoran önerileri',
        'Favorilerini ve özel listelerini oluştur',
        'Arkadaşlarınla keşfet, öner ve rezervasyon yap',
      ],
      ctaLabel: 'Keşfetmeye Başla',
      ctaHref: link,
      note: 'İyi keşifler! Aklına takılan olursa bu e-postayı yanıtlaman yeterli.',
    }),
  });
  if (error) throw error;
}

/**
 * Tüm Eatlas e-postaları için ortak, tablo-tabanlı (e-posta istemcisi uyumlu) şablon.
 * Koyu marka başlık bandı + coral→amber gradient aksan çizgisi + tek CTA butonu.
 */
function renderEmail({ preheader, heading, lead, bullets, ctaLabel, ctaHref, note }) {
  const bulletsHtml = (bullets && bullets.length)
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px">
        ${bullets.map(b => `<tr><td style="vertical-align:top;padding:4px 10px 4px 0;color:${BRAND.coralActive};font-weight:700">•</td><td style="padding:4px 0;color:${BRAND.text};font-size:15px;line-height:1.5">${escapeHtml(b)}</td></tr>`).join('')}
       </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${BRAND.cream};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${escapeHtml(preheader || '')}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.cream}">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(16,12,22,.08)">
        <!-- Başlık bandı -->
        <tr><td style="background:${BRAND.dark};padding:26px 32px 20px;text-align:center">
          <div style="font-size:26px;font-weight:800;letter-spacing:.3px;color:#ffffff">Eatlas</div>
        </td></tr>
        <!-- Gradient aksan çizgisi -->
        <tr><td style="height:4px;line-height:4px;font-size:0;background:${BRAND.coral};background-image:linear-gradient(90deg,${BRAND.coral} 0%,${BRAND.amber} 100%)">&nbsp;</td></tr>
        <!-- Gövde -->
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 12px;color:${BRAND.ink};font-size:21px;font-weight:800">${heading}</h1>
          <p style="margin:0 0 8px;color:${BRAND.text};font-size:15px;line-height:1.6">${lead}</p>
          ${bulletsHtml}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 8px"><tr>
            <td align="center" style="border-radius:10px;background:${BRAND.coralActive}">
              <a href="${ctaHref}" target="_blank" style="display:inline-block;padding:14px 34px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;border-radius:10px">${ctaLabel}</a>
            </td>
          </tr></table>
          <p style="margin:18px 0 0;color:${BRAND.muted};font-size:12px;line-height:1.6;text-align:center">Buton çalışmazsa bu bağlantıyı tarayıcına yapıştır:<br><a href="${ctaHref}" target="_blank" style="color:${BRAND.coralActive};word-break:break-all">${ctaHref}</a></p>
          ${note ? `<p style="margin:16px 0 0;color:${BRAND.muted};font-size:12px;line-height:1.6;text-align:center">${note}</p>` : ''}
        </td></tr>
        <!-- Alt bilgi -->
        <tr><td style="padding:20px 32px;background:${BRAND.cream};text-align:center;color:${BRAND.muted};font-size:11px;line-height:1.6">
          © ${new Date().getFullYear()} Eatlas — Çevrendeki en iyi lezzetleri keşfet.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// E-postaya basılan kullanıcı verisinde (isim) HTML enjeksiyonunu önle.
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail };
