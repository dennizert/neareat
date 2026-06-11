'use strict';

/**
 * emailService unit testleri — Resend SDK mock'lu.
 * Doğrulama / şifre sıfırlama / hoş geldin mailleri doğru alıcıya, doğru link ve
 * Eatlas markasıyla gidiyor mu; gönderici hatası fırlatılıyor mu kontrol eder.
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
  process.env.EMAIL_FROM = 'Eatlas <noreply@eatlas.test>';
  process.env.APP_BASE_URL = 'https://eatlas.test';
});

function load() {
  return require('../../../src/services/emailService');
}

describe('emailService', () => {
  it('sendVerificationEmail: doğru alıcı, konu, marka ve token linki', async () => {
    const { sendVerificationEmail } = load();
    await sendVerificationEmail('user@x.com', 'Deniz', 'tok123');

    expect(mockSend).toHaveBeenCalledTimes(1);
    const arg = mockSend.mock.calls[0][0];
    expect(arg.to).toEqual(['user@x.com']);
    expect(arg.from).toBe('Eatlas <noreply@eatlas.test>');
    expect(arg.subject).toContain('doğrula');
    expect(arg.html).toContain('https://eatlas.test/verify-email?token=tok123');
    expect(arg.html).toContain('Eatlas');
    expect(arg.html).toContain('Deniz');
  });

  it('sendPasswordResetEmail: reset linki ve token', async () => {
    const { sendPasswordResetEmail } = load();
    await sendPasswordResetEmail('user@x.com', 'Deniz', 'rst456');

    const arg = mockSend.mock.calls[0][0];
    expect(arg.subject).toContain('sıfırlama');
    expect(arg.html).toContain('https://eatlas.test/reset-password?token=rst456');
  });

  it('sendWelcomeEmail: hoş geldin maili gönderir', async () => {
    const { sendWelcomeEmail } = load();
    await sendWelcomeEmail('user@x.com', 'Deniz');

    const arg = mockSend.mock.calls[0][0];
    expect(arg.to).toEqual(['user@x.com']);
    expect(arg.html).toContain('Hoş geldin');
  });

  it('kullanıcı adındaki HTML enjekte edilmez (escape)', async () => {
    const { sendVerificationEmail } = load();
    await sendVerificationEmail('user@x.com', '<script>alert(1)</script>', 'tok');

    const arg = mockSend.mock.calls[0][0];
    expect(arg.html).not.toContain('<script>alert(1)</script>');
    expect(arg.html).toContain('&lt;script&gt;');
  });

  it('Resend hata döndürürse fırlatır', async () => {
    mockSend.mockResolvedValue({ data: null, error: new Error('resend down') });
    const { sendVerificationEmail } = load();
    await expect(sendVerificationEmail('user@x.com', 'Deniz', 'tok')).rejects.toThrow('resend down');
  });
});
