'use strict';

/**
 * S16-7 — prisma/deploy.js DIRECT_URL default mantığı.
 * execSync mock'lanır (gerçek migrate çalışmaz); env-defaulting + migrate çağrısı doğrulanır.
 */

jest.mock('child_process', () => ({ execSync: jest.fn() }));

const { execSync } = require('child_process');

const ORIG_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIG_ENV };
  jest.clearAllMocks();
});

describe('prisma/deploy.js', () => {
  it("DIRECT_URL set değilse DATABASE_URL'e default'lar + migrate deploy çağırır", () => {
    process.env.DATABASE_URL = 'postgresql://x:y@host:5432/db';
    delete process.env.DIRECT_URL;

    jest.isolateModules(() => require('../../prisma/deploy'));

    expect(process.env.DIRECT_URL).toBe('postgresql://x:y@host:5432/db');
    const cmds = execSync.mock.calls.map((c) => c[0]);
    expect(cmds.some((c) => c.includes('migrate deploy'))).toBe(true);
    expect(cmds.some((c) => c.includes('migrate resolve'))).toBe(true);
  });

  it('DIRECT_URL zaten set ise korunur (PgBouncer kurulumu)', () => {
    process.env.DATABASE_URL = 'postgresql://pooler';
    process.env.DIRECT_URL = 'postgresql://direct';

    jest.isolateModules(() => require('../../prisma/deploy'));

    expect(process.env.DIRECT_URL).toBe('postgresql://direct');
  });
});
