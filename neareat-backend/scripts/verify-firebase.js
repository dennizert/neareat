#!/usr/bin/env node
'use strict';

/**
 * firebase-admin sürüm uyumu — çalıştır: `node scripts/verify-firebase.js`
 *
 * NEDEN VAR: kod tabanındaki tüm testler `services/firebase`i MOCK'luyor, dolayısıyla
 * gerçek SDK ile uyum hiç sınanmıyor. firebase-admin v14'e geçişte namespace API
 * TAMAMEN KALDIRILDI (`admin.apps`, `admin.credential.cert()`, `admin.auth()`,
 * `admin.messaging()` → hepsi undefined). Eski kod `admin.apps.length` okuduğu için
 * modül REQUIRE EDİLİRKEN patlıyordu; bu dosya authController üzerinden app.js'e bağlı
 * olduğundan sunucu HİÇ AÇILMAZDI — mock'lu testler yeşil kalırken üretimde boot hatası.
 *
 * Bu betik jest yerine düz Node altında koşar; jest, v14'ün modüler alt yollarını
 * (ESM) varsayılan yapılandırmayla ayrıştıramıyor.
 *
 * firebase-admin'in her major yükseltmesinde koşulmalı. Beklenen: `SONUC: GECTI`
 */

const crypto = require('crypto');
const path = require('path');

// Gerçek servis hesabı yok; biçimsel olarak geçerli bir anahtar üretilir.
// Ağa ÇIKILMAZ — yalnızca SDK'nın init edip istemci nesnesi verdiği sınanır.
const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env.FIREBASE_PROJECT_ID = 'verify-project';
process.env.FIREBASE_CLIENT_EMAIL = 'verify@verify.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n');

const ROOT = path.resolve(__dirname, '..');

try {
  const svc = require(path.join(ROOT, 'src/services/firebase'));
  const auth = svc.getAuth();

  const checks = {
    'modül require edilirken patlamıyor': true,
    'getAuth() istemci döndürüyor': !!auth,
    'auth.deleteUser var (hesap silme)': typeof auth.deleteUser === 'function',
    'auth.getUserByEmail var': typeof auth.getUserByEmail === 'function',
    'getMessaging() istemci döndürüyor': !!svc.getMessaging(),
  };

  // getApps() kontrolü olmasaydı ikinci require "app already exists" ile patlardı.
  let doubleLoadOk = true;
  try {
    delete require.cache[require.resolve(path.join(ROOT, 'src/services/firebase'))];
    require(path.join(ROOT, 'src/services/firebase'));
  } catch {
    doubleLoadOk = false;
  }
  checks['ikinci kez yüklenince çift init hatası yok'] = doubleLoadOk;

  for (const [k, v] of Object.entries(checks)) {
    console.log(`  ${v ? '✓' : '✗'} ${k}`);
  }
  const ok = Object.values(checks).every(Boolean);
  console.log('SONUC:', ok ? 'GECTI' : 'KALDI');
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.log('  ✗ HATA:', e.message);
  console.log('SONUC: KALDI');
  process.exit(1);
}
