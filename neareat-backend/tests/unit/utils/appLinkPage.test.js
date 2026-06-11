'use strict';

/**
 * appLinkPage unit testleri — e-posta linki ara sayfası.
 * Deep link, Play Store fallback ve başlık doğru gömülüyor mu kontrol eder.
 */

describe('renderAppLinkPage', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.GOOGLE_PLAY_PACKAGE_NAME = 'com.eatlas.mobile';
    delete process.env.ANDROID_STORE_URL;
  });

  function load() {
    return require('../../../src/utils/appLinkPage');
  }

  it('deep link, Play Store linki ve başlık içerir', () => {
    const { renderAppLinkPage } = load();
    const html = renderAppLinkPage({
      deepLink: 'neareat://verify-email?token=abc',
      title: 'E-postanı doğrula',
      message: 'Uygulamayı açıyoruz.',
    });

    expect(html).toContain('neareat://verify-email?token=abc');
    expect(html).toContain('play.google.com/store/apps/details?id=com.eatlas.mobile');
    expect(html).toContain('E-postanı doğrula');
    expect(html).toContain('Eatlas');
  });

  it('ANDROID_STORE_URL tanımlıysa onu kullanır', () => {
    process.env.ANDROID_STORE_URL = 'https://custom.store/app';
    const { renderAppLinkPage } = load();
    const html = renderAppLinkPage({ deepLink: 'neareat://x', title: 'T', message: 'M' });
    expect(html).toContain('https://custom.store/app');
  });
});
