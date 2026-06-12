const prisma = require('./prisma');

const PREMIUM_STATUSES = ['active', 'trial'];

// Her zaman premium sayılan e-postalar — YALNIZCA env'den (virgülle ayrılmış).
// S13-4: sabit/kod-içi fallback kaldırıldı (yanlışlıkla premium ifşasını önlemek için);
// çalışma anında okunur ki yapılandırılabilir + test edilebilir olsun.
function getAlwaysPremiumEmails() {
  return (process.env.ALWAYS_PREMIUM_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// E-posta allowlist'te mi? (saf kontrol; doğrulama şartı çağıranlarda uygulanır.)
function isAlwaysPremiumEmail(email) {
  if (!email) return false;
  return getAlwaysPremiumEmails().includes(String(email).trim().toLowerCase());
}

// Bir abonelik kaydının ŞU AN geçerli premium olup olmadığını söyler (durum active/trial
// VE bitiş tarihi gelecekte). DB sorgusu yapmaz → sync ve her yerde yeniden kullanılabilir.
function isActivePremium(subscription) {
  return (
    !!subscription &&
    PREMIUM_STATUSES.includes(subscription.status) &&
    new Date(subscription.expiresAt) > new Date()
  );
}

// Bir kullanıcının premium olup olmadığına dair TEK YETKİLİ karar noktası. Tüm free-tier
// limit kontrolleri (AI öneri, favori, koleksiyon, rezervasyon vb.) bunu çağırır. Önce
// aktif abonelik, yoksa doğrulanmış allowlist e-postası kontrol edilir.
async function isPremiumUser(userId) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (isActivePremium(sub)) return true;

  // Allowlist override — aktif abonelik yoksa e-postaya bak.
  // S13-4: override yalnızca DOĞRULANMIŞ (emailVerified) hesaplar için geçerli;
  // doğrulanmamış bir hesabın allowlist'teki bir e-postayı taklit etmesini önler.
  if (getAlwaysPremiumEmails().length) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true },
    });
    if (user && user.emailVerified && isAlwaysPremiumEmail(user.email)) return true;
  }
  return false;
}

module.exports = {
  isPremiumUser,
  isActivePremium,
  isAlwaysPremiumEmail,
  getAlwaysPremiumEmails,
  PREMIUM_STATUSES,
};
