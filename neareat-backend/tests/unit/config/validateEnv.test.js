const { validateEnv, MIN_SECRET_LENGTH } = require('../../../src/config/validateEnv');

// 32+ karakterlik geçerli secret
const STRONG = 'x'.repeat(MIN_SECRET_LENGTH);

function baseProdEnv(overrides = {}) {
  return {
    NODE_ENV: 'production',
    JWT_SECRET: STRONG,
    DATABASE_URL: 'postgresql://u:p@h:5432/db',
    TOKEN_HASH_SECRET: STRONG,
    ALLOWED_ORIGINS: 'https://app.example.com',
    ANTHROPIC_API_KEY: 'sk-ant-xxx',
    GOOGLE_PLACES_API_KEY: 'AIza-xxx',
    REDIS_URL: 'redis://localhost:6379',
    ...overrides,
  };
}

describe('validateEnv', () => {
  it('tam ve güçlü üretim yapılandırmasında hata/uyarı üretmez', () => {
    const { errors, warnings } = validateEnv(baseProdEnv());
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('üretimde eksik TOKEN_HASH_SECRET → errors', () => {
    const env = baseProdEnv();
    delete env.TOKEN_HASH_SECRET;
    const { errors } = validateEnv(env);
    expect(errors.some((e) => e.includes('TOKEN_HASH_SECRET'))).toBe(true);
  });

  it('üretimde eksik JWT_SECRET ve DATABASE_URL → her ikisi de errors', () => {
    const env = baseProdEnv();
    delete env.JWT_SECRET;
    delete env.DATABASE_URL;
    const { errors } = validateEnv(env);
    expect(errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
    expect(errors.some((e) => e.includes('DATABASE_URL'))).toBe(true);
  });

  it('üretimde kısa JWT_SECRET → uzunluk hatası errors', () => {
    const { errors } = validateEnv(baseProdEnv({ JWT_SECRET: 'kisa' }));
    expect(errors.some((e) => e.includes('JWT_SECRET') && e.includes('kısa'))).toBe(true);
  });

  it('geliştirmede kısa secret → errors değil warnings', () => {
    const env = {
      NODE_ENV: 'development',
      JWT_SECRET: 'kisa',
      DATABASE_URL: 'postgresql://u:p@h:5432/db',
      TOKEN_HASH_SECRET: 'kisa',
    };
    const { errors, warnings } = validateEnv(env);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes('JWT_SECRET'))).toBe(true);
    expect(warnings.some((w) => w.includes('TOKEN_HASH_SECRET'))).toBe(true);
  });

  it('geliştirmede eksik zorunlu değişken → errors değil warnings', () => {
    const { errors, warnings } = validateEnv({ NODE_ENV: 'development' });
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes('JWT_SECRET'))).toBe(true);
  });

  it('eksik önerilen değişken (ALLOWED_ORIGINS) → errors değil warnings', () => {
    const env = baseProdEnv();
    delete env.ALLOWED_ORIGINS;
    const { errors, warnings } = validateEnv(env);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes('ALLOWED_ORIGINS'))).toBe(true);
  });

  it('boş string (whitespace) tanımsız sayılır', () => {
    const { errors } = validateEnv(baseProdEnv({ TOKEN_HASH_SECRET: '   ' }));
    expect(errors.some((e) => e.includes('TOKEN_HASH_SECRET'))).toBe(true);
  });
});
