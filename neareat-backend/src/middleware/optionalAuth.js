const { resolveTokenUser } = require('../utils/resolveTokenUser');

// authenticate gibi çalışır ama token yoksa/geçersizse HATA VERMEZ — req.user null kalır.
// Oturum açmamış kullanıcılar da bu uçları kullanabilsin diye (nearby, places/search).
//
// Token → kullanıcı çözümü `utils/resolveTokenUser` ile authenticate ile PAYLAŞILIR.
// Önceden burada ayrı bir kopya vardı ve FIREBASE token'ı bekliyordu; mobil ise Google
// ile giren kullanıcılar için ham Google OAuth idToken'ı gönderiyor. Sonuç: Google'la
// giren herkes bu uçlarda sessizce anonim sayılıyor, seviyeye bağlı gösterimleri
// (ör. nearby kartlarındaki yıldız indirimi) kaybediyor ve arama geçmişi yazılmıyordu.
async function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const { user } = await resolveTokenUser(authHeader.split(' ')[1]);
  // Askıya alınmış hesap burada 403 ÜRETMEZ (uç herkese açık); anonim gibi davranılır.
  req.user = user && !user.isSuspended ? user : null;
  next();
}

module.exports = optionalAuthenticate;
