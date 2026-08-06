'use strict';

/**
 * Kullanıcı verisinin API sınırı (S21-1).
 *
 * Makale §4.2: domain nesneleri API sınırında ham haliyle dışarı verilmemeli. Bu dosya
 * kullanıcı yüzeyinin TEK yeri — yeni bir hassas kolon eklendiğinde tek dosya güncellenir.
 *
 * ÖNEMLİ — `sanitizeUser` bir ALLOWLIST DEĞİL, BLOCKLIST'tir: tam `user` nesnesini alır ve
 * adı geçen alanları düşürür, geri kalan HER ŞEYİ döndürür. Yani şemaya eklenen yeni bir
 * kolon, buraya eklenmediği sürece istemciye sessizce gider. Davranışı korumak için bilinçli
 * olarak bu şekilde taşındı (allowlist'e çevirmek yanıt şeklini değiştirir ve canlıdaki
 * mobil uygulamayı kırar). Sessiz sızıntı riskini `tests/unit/utils/userDto.test.js`'teki
 * şema koruması kapatıyor: yeni bir kolon eklendiğinde test kırmızıya döner ve bilinçli
 * karar vermeye zorlar.
 */

/**
 * Oturum yanıtlarında istemciye GÖNDERİLMEMESİ gereken alanlar.
 *
 * İki grup: (1) gerçekten hassas olanlar (şifre hash'i, doğrulama/sıfırlama token'ları),
 * (2) ayrı bir uçtan dönen profil alanları (`getMyProfile`) — hassas değil, sadece bu
 * yanıtın kapsamında değil.
 */
const OMITTED_USER_FIELDS = Object.freeze([
  'passwordHash',
  'bio',
  'city',
  'favoriteCuisines',
  'isPublic',
  'shareWithFriendsRecommender',
  'emailVerificationToken',
  'emailVerificationExpiry',
  'passwordResetToken',
  'passwordResetExpiry',
]);

/**
 * User nesnesinden istemciye gitmemesi gereken alanları çıkarır.
 * Tüm auth yanıtları bu filtreden geçer.
 *
 * S18-5: `starCount` session user'da KALIR — kullanıcı premium'u kaldırıldı, özellikler
 * yıldız seviyesine bağlı; mobil seviye-bazlı UI kilitleri (liste/favori/rezervasyon)
 * oturum kullanıcısındaki seviyeyi okur. (Hassas değil; profil yine taze kaynak.)
 *
 * @param {object|null|undefined} user Prisma user kaydı (tam nesne)
 * @returns {object} istemciye gönderilebilir kopya
 */
function sanitizeUser(user) {
  if (!user) return user;
  const {
    passwordHash, bio, city, favoriteCuisines, isPublic,
    shareWithFriendsRecommender, // profile data, getMyProfile'da döner
    emailVerificationToken, emailVerificationExpiry,
    passwordResetToken, passwordResetExpiry,
    ...safe
  } = user;
  return safe;
}

/**
 * Başka bir kullanıcıyı "kart" olarak gösterirken kullanılan ortak Prisma projeksiyonu:
 * grup üyesi, mesaj muhatabı, aktivite akışı sahibi.
 *
 * Bilinçli olarak DAR: bio/city/starCount gibi alanlara ihtiyaç duyan uçlar (sosyal arama,
 * arkadaşlık istekleri, profil) kendi daha geniş projeksiyonlarını kullanmaya devam eder —
 * hepsini tek bir "geniş" sabitte birleştirmek, ihtiyacı olmayan uçlardan fazla veri
 * döndürmek anlamına gelirdi.
 */
const PUBLIC_USER_SELECT = Object.freeze({
  id: true,
  displayName: true,
  photoUrl: true,
});

module.exports = { sanitizeUser, PUBLIC_USER_SELECT, OMITTED_USER_FIELDS };
