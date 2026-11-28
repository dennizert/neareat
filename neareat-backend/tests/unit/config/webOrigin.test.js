'use strict';

const { getPublicWebOrigin, buildAllowedOrigins, isValidOrigin } = require('../../../src/config/webOrigin');
const { validateWebPanelEnv, assertEnvOrExit } = require('../../../src/config/validateEnv');

describe('webOrigin', () => {
  it('sondaki / atılır, boşluk kırpılır', () => {
    expect(getPublicWebOrigin({ PUBLIC_WEB_ORIGIN: ' https://p.test/ ' })).toBe('https://p.test');
    expect(getPublicWebOrigin({})).toBeNull();
    expect(getPublicWebOrigin({ PUBLIC_WEB_ORIGIN: '  ' })).toBeNull();
  });

  it('PUBLIC_WEB_ORIGIN, ALLOWED_ORIGINS listesine tekrarsız eklenir', () => {
    expect(buildAllowedOrigins({ ALLOWED_ORIGINS: 'https://a.test, https://b.test', PUBLIC_WEB_ORIGIN: 'https://p.test' }))
      .toEqual(['https://a.test', 'https://b.test', 'https://p.test']);
    expect(buildAllowedOrigins({ ALLOWED_ORIGINS: 'https://p.test', PUBLIC_WEB_ORIGIN: 'https://p.test/' }))
      .toEqual(['https://p.test']);
    expect(buildAllowedOrigins({})).toEqual([]);
    expect(buildAllowedOrigins({ ALLOWED_ORIGINS: 'https://a.test' })).toEqual(['https://a.test']);
  });

  it.each([
    ['https://p.test', true],
    ['http://localhost:5173', true],
    ['https://p.test/panel', false],
    ['p.test', false],
    ['ftp://p.test', false],
    ['', false],
  ])('isValidOrigin(%s) = %s', (v, expected) => {
    expect(isValidOrigin(v)).toBe(expected);
  });
});

describe('validateWebPanelEnv', () => {
  it('üretimde PUBLIC_WEB_ORIGIN yoksa açılışı durduran hata', () => {
    const { errors } = validateWebPanelEnv({ NODE_ENV: 'production' });
    expect(errors.some((e) => e.includes('PUBLIC_WEB_ORIGIN'))).toBe(true);
  });

  it.each(['development', 'test'])('%s ortamında eksiklik yalnızca uyarı', (NODE_ENV) => {
    const { errors, warnings } = validateWebPanelEnv({ NODE_ENV });
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes('PUBLIC_WEB_ORIGIN'))).toBe(true);
  });

  it('üretimde geçerli https origin → hata yok', () => {
    expect(validateWebPanelEnv({ NODE_ENV: 'production', PUBLIC_WEB_ORIGIN: 'https://p.up.railway.app' }))
      .toEqual({ errors: [], warnings: [] });
  });

  it('üretimde yol içeren / http değer → hata', () => {
    expect(validateWebPanelEnv({ NODE_ENV: 'production', PUBLIC_WEB_ORIGIN: 'https://p.test/panel' }).errors).toHaveLength(1);
    expect(validateWebPanelEnv({ NODE_ENV: 'production', PUBLIC_WEB_ORIGIN: 'http://p.test' }).errors).toHaveLength(1);
  });

  it('assertEnvOrExit üretimde eksik PUBLIC_WEB_ORIGIN ile exit(1) çağırır', () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      assertEnvOrExit({
        NODE_ENV: 'production',
        JWT_SECRET: 'kR8vQ2mZ7xT4pL9wN3bY6cF1hJ5sD0gA',
        DATABASE_URL: 'postgresql://u:p@h:5432/db',
        TOKEN_HASH_SECRET: 'nRUiVVVmUvbpzg5U7JD6a7tfC5vJFvdxMxq7X94M',
      });
      expect(exit).toHaveBeenCalledWith(1);
      expect(err.mock.calls.some((c) => String(c[1]).includes('PUBLIC_WEB_ORIGIN'))).toBe(true);
    } finally {
      exit.mockRestore(); err.mockRestore(); warn.mockRestore();
    }
  });
});
