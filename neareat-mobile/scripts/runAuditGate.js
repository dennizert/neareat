#!/usr/bin/env node
'use strict';

/**
 * `npm run audit:gate` — S25-1 kapısının çalıştırılabilir sarmalayıcısı.
 *
 * Karar mantığı burada DEĞİL (`auditGate.js`'te, saf ve jest'li). Buradaki iş yalnızca
 * dış dünyayla temas: `npm audit`i koş, çıktısını ayrıştır, sonucu yazdır, çıkış kodu ver.
 *
 * FAIL-CLOSED: `npm audit`in ÇIKIŞ KODUNA bakmıyoruz — bulgu varken sıfırdan farklı döner,
 * yani ona bakmak kapıyı anlamsız kılardı. JSON içeriğine bakıyoruz. Çıktı ayrıştırılamazsa
 * (npm sürümü format değiştirdi, komut hiç çalışmadı) kapı KIRILIR; sessizce yeşile
 * düşmez — çünkü "tarama yapılamadı" ile "tarama temiz" aynı şey değildir.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { evaluateAudit } = require('./auditGate');

const LEVEL = process.env.AUDIT_LEVEL || 'high';
const ALLOWLIST_PATH = path.join(__dirname, '..', '.audit-allowlist.json');

function runNpmAudit() {
  try {
    return execFileSync('npm', ['audit', '--omit=dev', '--json'], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    // Bulgu bulunduğunda `npm audit` sıfırdan farklı çıkar ama JSON'u yine de yazar.
    // Gerçek bir çalıştırma hatasında stdout boş kalır ve aşağıdaki ayrıştırma patlar.
    if (err.stdout) return err.stdout;
    throw err;
  }
}

function main() {
  let auditJson;
  try {
    auditJson = JSON.parse(runNpmAudit());
  } catch (err) {
    console.error('KAPI KIRILDI: `npm audit` çıktısı okunamadı — tarama YAPILAMADI.');
    console.error(`  Sebep: ${err.message}`);
    console.error('  "Tarama yapılamadı" ile "tarama temiz" aynı şey değildir; bu yüzden kapı kırılır.');
    process.exit(1);
  }

  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  const { blocking, allowed, stale } = evaluateAudit({ auditJson, allowlist, level: LEVEL });

  console.log(`Mobil bağımlılık kapısı — eşik: ${LEVEL} ve üzeri\n`);

  if (allowed.length) {
    console.log(`Gerekçeli muafiyet (${allowed.length}):`);
    for (const a of allowed) {
      console.log(`  · ${a.severity.padEnd(8)} ${a.package.padEnd(28)} (gözden geçirme: ${a.reviewBy})`);
    }
    console.log();
  }

  if (stale.length) {
    console.log(`Karşılığı kalmayan muafiyet — allowlist'ten silinebilir (${stale.length}):`);
    for (const s of stale) console.log(`  · ${s}`);
    console.log();
  }

  if (blocking.length) {
    console.error(`KAPI KIRILDI — gerekçesiz ${blocking.length} bulgu:\n`);
    for (const b of blocking) {
      console.error(`  ✖ ${b.severity.padEnd(8)} ${b.package}`);
      console.error(`      sebep: ${b.why}${b.detail ? ` — ${b.detail}` : ''}`);
    }
    console.error(
      '\nDüzeltilebiliyorsa düzeltin. Düzeltilemiyorsa .audit-allowlist.json dosyasına'
      + '\ngerekçe, zincir ve bir gözden geçirme tarihiyle ekleyin — muafiyet süresizdir DEĞİL.',
    );
    process.exit(1);
  }

  console.log('Kapı geçildi: gerekçesiz high/critical bulgu yok.');
}

main();
