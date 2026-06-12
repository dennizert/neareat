// Hassas yazma uçlarında e-posta doğrulaması şartı (S13-3).
//
// Güvenli kullanıma sunum: ENFORCE_EMAIL_VERIFICATION !== 'true' iken no-op (mevcut
// davranış korunur). Açıkken, doğrulanmamış e-posta hesapları (emailVerified=false)
// korunan uçları kullanamaz → 403 EMAIL_NOT_VERIFIED. Google kullanıcıları zaten
// emailVerified=true olduğundan etkilenmez.
//
// authenticate'ten SONRA kullanılmalı (req.user gerekir).
module.exports = function requireVerifiedEmail(req, res, next) {
  if (process.env.ENFORCE_EMAIL_VERIFICATION !== 'true') return next();
  if (req.user?.emailVerified) return next();
  return res.status(403).json({
    code: 'EMAIL_NOT_VERIFIED',
    error: 'Bu işlem için e-posta adresini doğrulaman gerekiyor.',
  });
};
