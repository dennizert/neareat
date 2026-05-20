const { Resend } = require('resend');

if (!process.env.RESEND_API_KEY) {
  console.warn('[EMAIL] UYARI: RESEND_API_KEY tanımlı değil — e-postalar gönderilmeyecek!');
}

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'NearEat <onboarding@resend.dev>';
const BASE_URL = process.env.APP_BASE_URL
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'http://localhost:3000');

async function sendVerificationEmail(email, displayName, token) {
  const link = `${BASE_URL}/verify-email?token=${token}`;
  const { error } = await resend.emails.send({
    from: FROM,
    to: [email],
    subject: 'NearEat — E-posta adresini doğrula',
    html: buildVerifyHtml(displayName, link),
  });
  if (error) throw error;
}

async function sendPasswordResetEmail(email, displayName, token) {
  const link = `${BASE_URL}/reset-password?token=${token}`;
  const { error } = await resend.emails.send({
    from: FROM,
    to: [email],
    subject: 'NearEat — Şifre sıfırlama',
    html: buildResetHtml(displayName, link),
  });
  if (error) throw error;
}

function buildVerifyHtml(name, link) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f9f9f9;margin:0;padding:0">
<div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:48px">🍽️</div>
    <h2 style="color:#FF6B35;margin:12px 0 4px">Hoş geldin, ${name}!</h2>
    <p style="color:#666;margin:0">NearEat'e katıldığın için teşekkürler.</p>
  </div>
  <p style="color:#333;line-height:1.6">E-posta adresini doğrulamak için aşağıdaki butona tıkla. Bu bağlantı <strong>24 saat</strong> geçerlidir.</p>
  <div style="text-align:center;margin:28px 0">
    <a href="${link}" style="background:#FF6B35;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block">E-postamı Doğrula</a>
  </div>
  <p style="color:#999;font-size:12px;text-align:center">Eğer NearEat'e kayıt olmadıysan bu e-postayı dikkate alma.</p>
</div></body></html>`;
}

function buildResetHtml(name, link) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f9f9f9;margin:0;padding:0">
<div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:48px">🔐</div>
    <h2 style="color:#FF6B35;margin:12px 0 4px">Şifre Sıfırlama</h2>
    <p style="color:#666;margin:0">Merhaba, ${name}</p>
  </div>
  <p style="color:#333;line-height:1.6">NearEat hesabın için şifre sıfırlama isteği aldık. Yeni şifre oluşturmak için aşağıdaki butona tıkla:</p>
  <div style="text-align:center;margin:28px 0">
    <a href="${link}" style="background:#FF6B35;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block">Şifremi Sıfırla</a>
  </div>
  <p style="color:#666;font-size:13px;text-align:center">Bu bağlantı <strong>1 saat</strong> geçerlidir.</p>
  <p style="color:#999;font-size:12px;text-align:center">Böyle bir talepte bulunmadıysan bu e-postayı yoksay. Hesabın güvende.</p>
</div></body></html>`;
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
