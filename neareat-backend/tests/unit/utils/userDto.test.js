'use strict';

/**
 * Kullanıcı DTO sınırı (S21-1) — saf, DB yok.
 *
 * En değerli test buradaki ŞEMA KORUMASI: `sanitizeUser` bir blocklist olduğu için
 * şemaya eklenen yeni bir kolon, listeye eklenmediği sürece istemciye sessizce gider.
 * Aşağıdaki test bu sessiz sızıntıyı gürültülü bir test hatasına çevirir.
 */

const fs = require('fs');
const path = require('path');

const {
  sanitizeUser,
  PUBLIC_USER_SELECT,
  OMITTED_USER_FIELDS,
} = require('../../../src/utils/userDto');

const SCHEMA_PATH = path.join(__dirname, '../../../prisma/schema.prisma');

/** schema.prisma'daki tüm `model X` adlarını toplar (ilişki alanlarını ayırt etmek için). */
function readModelNames(schema) {
  return new Set([...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]));
}

/** User modelinin SKALAR alan adları (ilişkiler ve blok yönergeleri hariç). */
function readUserScalarFields(schema, modelNames) {
  const block = schema.match(/^model\s+User\s*\{([\s\S]*?)^\}/m);
  if (!block) throw new Error('schema.prisma içinde User modeli bulunamadı');

  const fields = [];
  for (const rawLine of block[1].split('\n')) {
    const line = rawLine.trim();
    // Yorumlar ve @@index/@@unique gibi blok yönergeleri alan değildir.
    if (!line || line.startsWith('//') || line.startsWith('@@')) continue;

    const m = line.match(/^(\w+)\s+(\w+)/);
    if (!m) continue;
    const [, name, type] = m;
    // Tipi bir model adıysa bu bir ilişki alanıdır — DTO yüzeyinde yer almaz.
    if (modelNames.has(type)) continue;
    fields.push(name);
  }
  return fields;
}

/** Tüm skalar alanları dolu, gerçekçi bir user kaydı üretir. */
function buildFullUser(scalarFields) {
  const user = {};
  for (const f of scalarFields) user[f] = `${f}-value`;
  return user;
}

describe('sanitizeUser', () => {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const modelNames = readModelNames(schema);
  const scalarFields = readUserScalarFields(schema, modelNames);

  it('hassas alanları çıkarır', () => {
    const out = sanitizeUser(buildFullUser(scalarFields));
    for (const field of ['passwordHash', 'emailVerificationToken', 'passwordResetToken']) {
      expect(out).not.toHaveProperty(field);
    }
  });

  it('OMITTED_USER_FIELDS listesindeki her alanı çıkarır', () => {
    const out = sanitizeUser(buildFullUser(scalarFields));
    for (const field of OMITTED_USER_FIELDS) {
      expect(out).not.toHaveProperty(field);
    }
  });

  it('starCount oturum kullanıcısında KALIR (S18-5 — mobil seviye kilitleri buna bağlı)', () => {
    const out = sanitizeUser(buildFullUser(scalarFields));
    expect(out).toHaveProperty('starCount');
  });

  it('kimlik alanlarını korur', () => {
    const out = sanitizeUser(buildFullUser(scalarFields));
    for (const field of ['id', 'email', 'displayName', 'role', 'emailVerified']) {
      expect(out).toHaveProperty(field);
    }
  });

  it('null/undefined girdide çökmez', () => {
    expect(sanitizeUser(null)).toBeNull();
    expect(sanitizeUser(undefined)).toBeUndefined();
  });

  it('girdiyi mutasyona uğratmaz', () => {
    const input = buildFullUser(scalarFields);
    const copy = { ...input };
    sanitizeUser(input);
    expect(input).toEqual(copy);
  });

  /**
   * ŞEMA KORUMASI — bu testin kırılması bir hata değil, bir KARAR talebidir.
   *
   * User modeline yeni bir skalar alan eklendiğinde `sanitizeUser` onu varsayılan
   * olarak istemciye gönderir (blocklist). Bu test, o alanın ya bilinçli olarak
   * yanıt sözleşmesine ya da OMITTED_USER_FIELDS'a eklenmesini zorunlu kılar.
   */
  it('şema koruması: her User skalar alanı ya yanıtta ya da omit listesinde olmalı', () => {
    const out = sanitizeUser(buildFullUser(scalarFields));
    const returned = new Set(Object.keys(out));
    const omitted = new Set(OMITTED_USER_FIELDS);

    const unclassified = scalarFields.filter((f) => !returned.has(f) && !omitted.has(f));
    expect(unclassified).toEqual([]);

    // Mevcut yanıt sözleşmesi — bilinçli değişiklik dışında oynamamalı.
    expect([...returned].sort()).toEqual([
      'authProvider',
      'createdAt',
      'email',
      'emailVerified',
      'fcmToken',
      'googleId',
      'id',
      'isSuspended',
      'lastLoginAt',
      'photoUrl',
      'referralApplied',
      'referralCode',
      'role',
      'seasonStartAt',
      'starCount',
      'updatedAt',
      'displayName',
    ].sort());
  });
});

describe('PUBLIC_USER_SELECT', () => {
  it('yalnızca public kart alanlarını içerir', () => {
    expect(PUBLIC_USER_SELECT).toEqual({ id: true, displayName: true, photoUrl: true });
  });

  it('hassas veya profil alanı içermez', () => {
    for (const field of ['email', 'passwordHash', 'fcmToken', 'bio', 'city', 'starCount']) {
      expect(PUBLIC_USER_SELECT).not.toHaveProperty(field);
    }
  });

  it('donmuş — paylaşılan sabit yanlışlıkla mutasyona uğramasın', () => {
    expect(Object.isFrozen(PUBLIC_USER_SELECT)).toBe(true);
  });
});
