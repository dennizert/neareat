'use strict';

/**
 * #525 — şifre sıfırlama bağlantısı role göre: RESTAURANT/ADMIN → web paneli,
 * USER → mevcut uygulama ara sayfası.
 */

const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });
  process.env.RESEND_API_KEY = 're_test';
  process.env.APP_BASE_URL = 'https://eatlas.test';
  process.env.PUBLIC_WEB_ORIGIN = 'https://panel.eatlas.test';
});

afterAll(() => {
  delete process.env.PUBLIC_WEB_ORIGIN;
});

function load() {
  return require('../../../src/services/emailService');
}

describe('sendPasswordResetEmail — role göre bağlantı', () => {
  it.each(['RESTAURANT', 'ADMIN'])('%s → PUBLIC_WEB_ORIGIN/panel/sifre-sifirla?token=', async (role) => {
    const { sendPasswordResetEmail } = load();
    await sendPasswordResetEmail('r@x.com', 'Restoran', 'tok-1', { role });
    const { html } = mockSend.mock.calls[0][0];
    expect(html).toContain('https://panel.eatlas.test/panel/sifre-sifirla?token=tok-1');
    expect(html).not.toContain('/reset-password?token=');
  });

  it('USER → mevcut uygulama bağlantısı', async () => {
    const { sendPasswordResetEmail } = load();
    await sendPasswordResetEmail('u@x.com', 'Kullanıcı', 'tok-2', { role: 'USER' });
    const { html } = mockSend.mock.calls[0][0];
    expect(html).toContain('https://eatlas.test/reset-password?token=tok-2');
    expect(html).not.toContain('/panel/');
  });

  it('rol verilmezse (eski çağrı imzası) → mevcut bağlantı', async () => {
    const { sendPasswordResetEmail } = load();
    await sendPasswordResetEmail('u@x.com', 'Kullanıcı', 'tok-3');
    expect(mockSend.mock.calls[0][0].html).toContain('https://eatlas.test/reset-password?token=tok-3');
  });

  it('PUBLIC_WEB_ORIGIN yoksa restoran da mevcut bağlantıya düşer', () => {
    delete process.env.PUBLIC_WEB_ORIGIN;
    const { buildPasswordResetLink } = load();
    expect(buildPasswordResetLink('t', 'RESTAURANT')).toBe('https://eatlas.test/reset-password?token=t');
  });

  it('token URL kodlanır', () => {
    const { buildPasswordResetLink } = load();
    expect(buildPasswordResetLink('a b&c', 'ADMIN'))
      .toBe('https://panel.eatlas.test/panel/sifre-sifirla?token=a%20b%26c');
  });
});
