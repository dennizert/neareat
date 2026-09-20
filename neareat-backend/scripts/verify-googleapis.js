#!/usr/bin/env node
'use strict';

/**
 * googleapis sürüm uyumu — çalıştır: `node scripts/verify-googleapis.js`
 *
 * NEDEN VAR: kod tabanındaki testler googleapis'i MOCK'luyor (google-auth-library
 * OAuth2Client ve androidpublisher.purchases.subscriptions.get/acknowledge), dolayısıyla
 * gerçek paketin kullandığımız API yüzeyini hâlâ export edip etmediği hiç sınanmıyor.
 * googleapis çok sık major sürüm çıkarır (yeni Google API keşif dokümanları eklendikçe);
 * bu genelde gerçek kırıcı değişiklik değildir ama semver major olduğu için doğrulanmalı.
 *
 * BU BETİK GERÇEK BİR KIRILMA YAKALADI (#415 adım 3): googleapis@175+ (dolayısıyla
 * en son 181) `purchases.subscriptions.get`'i TAMAMEN KALDIRMIŞ — Google Play
 * Developer API'nin discovery dokümanı `purchases.subscriptionsv2.get`'e taşınmış
 * (farklı yanıt şekli: `SubscriptionPurchaseV2`, `lineItems[].expiryTime` vb.).
 * Bu, `_refreshFromPlay` ve satın alma doğrulamasının YENİDEN YAZILMASını gerektiren
 * bir API göçü — canlı ödeme/IAP kodunda basit bir "yükselt ve geç" değil.
 *
 * Bulunan orta nokta: googleapis@170.1.0 hem eski `subscriptions.get`'i koruyor HEM
 * de üretim audit'ini 0/0'a indiriyor (uuid zinciri googleapis-common@9'da zaten
 * temizlenmiş). 181'e çıkmanın audit açısından ek bir kazancı yok; yalnızca göç
 * riskini üstlenmiş olursun. subscriptionsv2 göçü ayrı ve dikkatli bir iş olarak
 * planlanmalı (issue: bkz. commit/PR açıklaması).
 *
 * Bu betik ağa ÇIKMAZ — yalnızca `subscriptionController.js`'in kullandığı yapının
 * (google.auth.GoogleAuth, google.androidpublisher({version:'v3'}), .purchases.subscriptions
 * .get/.acknowledge) hâlâ mevcut ve doğru tipte olduğunu kontrol eder.
 *
 * googleapis'in her yükseltmesinde koşulmalı. Beklenen: `SONUC: GECTI`. KALDI
 * dönerse subscriptionsv2 göçü zamanı gelmiş demektir.
 */

try {
  const { google } = require('googleapis');

  const checks = {};
  checks['google.auth.GoogleAuth bir sınıf'] = typeof google.auth?.GoogleAuth === 'function';
  checks['google.androidpublisher fonksiyon'] = typeof google.androidpublisher === 'function';

  // Sahte (ağa çıkmayan) bir kimlik bilgisiyle GoogleAuth örneği kurulabiliyor mu.
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: 'probe@probe.iam.gserviceaccount.com', private_key: 'not-a-real-key' },
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  checks['GoogleAuth örneği kuruluyor'] = !!auth;

  const androidpublisher = google.androidpublisher({ version: 'v3', auth });
  checks['androidpublisher v3 istemcisi kuruluyor'] = !!androidpublisher;
  checks['purchases.subscriptions.get var'] = typeof androidpublisher.purchases?.subscriptions?.get === 'function';
  checks['purchases.subscriptions.acknowledge var'] = typeof androidpublisher.purchases?.subscriptions?.acknowledge === 'function';

  const version = require('googleapis/package.json').version;
  console.log('googleapis sürümü:', version);
  for (const [k, v] of Object.entries(checks)) console.log(`  ${v ? '✓' : '✗'} ${k}`);

  const ok = Object.values(checks).every(Boolean);
  console.log('SONUC:', ok ? 'GECTI' : 'KALDI');
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.log('  ✗ HATA:', e.message);
  console.log('SONUC: KALDI');
  process.exit(1);
}
