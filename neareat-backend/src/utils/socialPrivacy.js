'use strict';

/**
 * Sosyal gizlilik kuralları — saf çekirdek (S22-2).
 *
 * Bu iki kural KVKK açısından kritik ve sessizce bozulabilir cinsten: liderlik tablosunda
 * gerçek adın sızması ya da gizli bir profilin içeriğinin arkadaş olmayana açılması, hiçbir
 * hata üretmeden yanlış çalışır. Controller içinde gömülü kaldıkları sürece bunları test
 * etmek için tüm HTTP akışını ayağa kaldırmak gerekiyordu; burada saf ve doğrudan test edilir.
 */

/** Liderlik tablosunda gösterilen madalyalar (sıra ile). */
const RANK_MEDALS = Object.freeze(['🥇', '🥈', '🥉', '4️⃣', '5️⃣']);

/**
 * Liderlik tablosu için görünen adı maskeler — sıralama herkese açık olduğundan
 * tam ad gösterilmez.
 *
 * Tek kelime  → ilk 2 harf + "..."          ("Deniz" → "De...")
 * Çok kelime  → ilk 2 harf + ". " + soyadın ilk 2 harfi + "..."  ("Deniz Ertekin" → "De. Er...")
 *
 * @param {string|null|undefined} displayName
 * @returns {string}
 */
function maskName(displayName) {
  const words = (displayName || '').trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2) + '...';
  return words[0].slice(0, 2) + '. ' + words[words.length - 1].slice(0, 2) + '...';
}

/**
 * Bir kullanıcının herkese açık içeriği (paylaşılan öneriler) görüntülenebilir mi?
 *
 * Açık profil herkese görünür. Gizli profil yalnızca sahibine ve kabul edilmiş
 * arkadaşlarına görünür.
 *
 * @param {{ isPublic: boolean, isSelf: boolean, isFriend: boolean }} ctx
 * @returns {boolean}
 */
function canViewUserContent({ isPublic, isSelf, isFriend }) {
  if (isSelf) return true;
  if (isPublic) return true;
  return Boolean(isFriend);
}

module.exports = { maskName, canViewUserContent, RANK_MEDALS };
