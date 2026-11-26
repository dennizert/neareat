'use strict';

/**
 * Admin hesabı oluşturma/güncelleme scripti.
 *
 * Yükseltme testleri (EPIC #497) için admin ve restoran rollerini denemek
 * gerekiyor, ama kod tabanında ADMIN rolü atayan hiçbir mekanizma yok:
 * seed'ler yalnızca USER üretiyor, env tabanlı bir bootstrap da yok.
 * Restoran hesabı uygulama içinden açılabiliyor ama PENDING kalıyor ve onayı
 * yalnızca bir admin verebiliyor (adminService.js) — yani önce admin lazım.
 *
 * ⚠️ BU SCRIPT `DATABASE_URL` HANGİ VERİTABANINI GÖSTERİYORSA ORADA ÇALIŞIR.
 * Çalıştırmadan önce hangi ortamda olduğunu doğrular ve onay ister.
 *
 * Kullanım:
 *   node prisma/seed-admin.js <email> <sifre>
 *   node prisma/seed-admin.js admin2@eatlas.com 'Test1234'
 *
 * Geri alma (test bitince ÖNERİLİR):
 *   node prisma/seed-admin.js --sil admin2@eatlas.com
 */

require('dotenv').config();
const readline = require('readline');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function dbHost() {
  const url = process.env.DATABASE_URL || '';
  const m = url.match(/@([^:/?]+)/);
  return m ? m[1] : '(DATABASE_URL okunamadı)';
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim()); }));
}

async function confirmTarget(action) {
  const host = dbHost();
  console.log('\n==================================================');
  console.log(`  İŞLEM     : ${action}`);
  console.log(`  VERİTABANI: ${host}`);
  console.log('==================================================');
  console.log('  Bu bir ÜRETİM veritabanı olabilir. Devam etmeden');
  console.log('  yukarıdaki host\'un doğru ortam olduğunu doğrula.\n');
  const a = await ask('  Devam etmek için "evet" yaz: ');
  if (a.toLowerCase() !== 'evet') {
    console.log('\n  İptal edildi. Hiçbir değişiklik yapılmadı.\n');
    process.exit(0);
  }
}

async function remove(email) {
  await confirmTarget(`${email} hesabını SİL`);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`\n  ${email} bulunamadı, yapılacak bir şey yok.\n`);
    return;
  }
  if (user.role !== 'ADMIN') {
    console.log(`\n  UYARI: ${email} ADMIN değil (rolü: ${user.role}).`);
    console.log('  Bu script yalnızca kendi oluşturduğu admin hesaplarını silmek içindir.');
    const a = await ask('  Yine de silinsin mi? "evet" yaz: ');
    if (a.toLowerCase() !== 'evet') { console.log('\n  İptal edildi.\n'); return; }
  }
  await prisma.user.delete({ where: { email } });
  console.log(`\n  ${email} silindi.\n`);
}

async function upsert(email, password) {
  await confirmTarget(`${email} hesabını ADMIN olarak oluştur/güncelle`);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== 'ADMIN') {
    console.log(`\n  DİKKAT: ${email} zaten var ve rolü "${existing.role}".`);
    console.log('  Devam edilirse rolü ADMIN yapılacak ve şifresi değiştirilecek.');
    const a = await ask('  Devam? "evet" yaz: ');
    if (a.toLowerCase() !== 'evet') { console.log('\n  İptal edildi.\n'); return; }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: 'ADMIN',
      passwordHash,
      authProvider: 'email',
      emailVerified: true,
      isSuspended: false,
    },
    create: {
      email,
      displayName: 'Test Admin',
      passwordHash,
      authProvider: 'email',
      role: 'ADMIN',
      emailVerified: true,
      isPublic: false,
      favoriteCuisines: [],
    },
  });

  console.log('\n==================================================');
  console.log('  TAMAMLANDI');
  console.log('==================================================');
  console.log(`  E-posta : ${user.email}`);
  console.log(`  Rol     : ${user.role}`);
  console.log(`  Giriş   : uygulamada "E-posta" sekmesi`);
  console.log(`  Durum   : ${existing ? 'güncellendi' : 'yeni oluşturuldu'}`);
  console.log('==================================================');
  console.log('  Test bitince silmeyi unutma:');
  console.log(`    node prisma/seed-admin.js --sil ${user.email}`);
  console.log('==================================================\n');
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--sil') {
    if (!args[1]) { console.error('Kullanım: node prisma/seed-admin.js --sil <email>'); process.exit(1); }
    return remove(args[1]);
  }

  const [email, password] = args;
  if (!email || !password) {
    console.error('Kullanım: node prisma/seed-admin.js <email> <sifre>');
    console.error('          node prisma/seed-admin.js --sil <email>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Şifre en az 8 karakter olmalı (uygulamanın kuralı).');
    process.exit(1);
  }
  return upsert(email, password);
}

main()
  .catch((e) => { console.error('\nHATA:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
