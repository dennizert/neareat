'use strict';

// S19-1: Kayıtlı (B2B) restoran görünürlüğü. Restoran tek-tip zorunlu ücretli olduğundan,
// trial/abonelik bitince restoran "pasifleşir": kayıtlı zenginleştirmesi (menü, displayName,
// rezervasyon, indirim) artık uygulanmaz — kullanıcıya sıradan bir Google mekânı gibi görünür.
//
// Teknik olarak Google Places sonucu gizlenemez; bu yüzden "görünmezlik" = profil JOIN'inin
// (status APPROVED) AKTİF ABONELİK koşuluna bağlanması. Riskli bir davranış değişikliği
// olduğundan ENFORCE_RESTAURANT_SUBSCRIPTION flag'i ile açılır (S13 ENFORCE_EMAIL_VERIFICATION
// deseni): kapalıyken (varsayılan) mevcut davranış korunur (trial/abonelikler provision edilene
// kadar canlı bozulmaz); açıkken yalnızca aktif aboneliği olan kayıtlı restoranlar zenginleşir.

const { activeSubscriptionWhere } = require('./premiumCheck');

function enforcementEnabled() {
  return process.env.ENFORCE_RESTAURANT_SUBSCRIPTION === 'true';
}

/**
 * Kayıtlı restoran profili sorgusu için where üretir: her zaman status=APPROVED; flag açıksa
 * ayrıca sahibinin aktif (active/trial) aboneliği şartını ekler.
 * @param {object} base  Ek where alanları (örn. { placeId } veya { placeId: { in } }).
 * @param {Date}   [now]
 */
function registeredProfileWhere(base = {}, now = new Date()) {
  const where = { ...base, status: 'APPROVED' };
  if (enforcementEnabled()) {
    where.user = { subscription: { is: activeSubscriptionWhere(now) } };
  }
  return where;
}

module.exports = { registeredProfileWhere, enforcementEnabled };
