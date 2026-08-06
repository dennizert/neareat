'use strict';

/**
 * YOLCULUK: Yeni kullanıcının uygulamayla ilk karşılaşması.
 *
 * Mobil uygulamanın kayıt ekranından itibaren yaptığı çağrıların aynısını, aynı sırayla
 * yapar. Buradaki asıl kazanç şu: kayıt adımının YAZDIĞI veri, doğrulama adımının
 * OKUDUĞU veridir — mock'lu bir pakette bu zincir kurulamaz, her adım elle stub'lanır
 * ve "adımların birlikte çalıştığı" iddiası hiç test edilmemiş olur.
 */

const app = require('../../../src/app');
const { createClient } = require('../client/apiClient');
const { lastEmailTo, extractTokenFromEmail } = require('../setup/externals');
const { createUser } = require('../factories');

describe('Yolculuk: kayıt → e-posta doğrulama → oturum', () => {
  it('kullanıcı kaydolur, doğrulama e-postasındaki linke tıklar ve doğrulanmış olarak giriş yapar', async () => {
    const app_ = createClient(app);
    const email = `yeni-${Date.now()}@e2e.test`;

    // 1) Kayıt ekranı — mobil kayıt sonrası token'ı saklar ve oturumu açar.
    const registered = await app_.auth.registerWithEmail(email, 'Test1234!', 'Yeni Kullanıcı');
    expect(registered.token).toEqual(expect.any(String));
    expect(registered.user.email).toBe(email);
    expect(registered.user.emailVerified).toBe(false);
    // Hassas alanlar istemciye GİTMEZ (S21-1 DTO sınırı).
    expect(registered.user).not.toHaveProperty('passwordHash');
    expect(registered.user).not.toHaveProperty('emailVerificationToken');

    // 2) Kullanıcı gelen kutusunu açar — gerçek bir doğrulama maili gitmiş olmalı.
    const mail = lastEmailTo(email);
    expect(mail).not.toBeNull();
    expect(mail.subject).toContain('doğrula');

    // 3) Maildeki linke tıklar.
    const token = extractTokenFromEmail(mail);
    expect(token).toEqual(expect.any(String));
    await app_.auth.verifyEmail(token);

    // 4) Uygulama açılışında profilini çeker — artık doğrulanmış görünmeli.
    const me = await app_.auth.getMe();
    expect(me.user.emailVerified).toBe(true);
  });

  it('aynı e-posta ile ikinci kayıt reddedilir (mobil bu hatayı kullanıcıya gösterir)', async () => {
    const client = createClient(app);
    const email = `tekrar-${Date.now()}@e2e.test`;
    await client.auth.registerWithEmail(email, 'Test1234!', 'İlk');

    const fresh = createClient(app);
    const err = await fresh.auth
      .registerWithEmail(email, 'Test1234!', 'İkinci')
      .then(() => null, (e) => e);

    expect(err).not.toBeNull();
    expect(err.status).toBe(409);
  });

  it('yanlış şifreyle giriş 401 döner ve oturum açılmaz', async () => {
    const email = `giris-${Date.now()}@e2e.test`;
    const client = createClient(app);
    await client.auth.registerWithEmail(email, 'Dogru1234!', 'Kullanıcı');

    const fresh = createClient(app);
    const err = await fresh.auth.loginWithEmail(email, 'Yanlis1234!').then(() => null, (e) => e);

    expect(err.status).toBe(401);
    expect(fresh.token).toBeNull();
  });

  it('kayıtlı kullanıcı çıkış yapıp tekrar giriş yapabilir', async () => {
    const email = `tekrargiris-${Date.now()}@e2e.test`;
    const client = createClient(app);
    await client.auth.registerWithEmail(email, 'Test1234!', 'Kullanıcı');

    client.logout();
    await expect(client.auth.getMe()).rejects.toMatchObject({ status: 401 });

    const loggedIn = await client.auth.loginWithEmail(email, 'Test1234!');
    expect(loggedIn.user.email).toBe(email);
    await expect(client.auth.getMe()).resolves.toMatchObject({ user: { email } });
  });

  it('token olmadan korumalı uca erişilemez', async () => {
    const anonim = createClient(app);
    await expect(anonim.reservations.getMine()).rejects.toMatchObject({ status: 401 });
  });

  it('askıya alınmış kullanıcı 403 alır', async () => {
    const { client } = await createUser(app, { isSuspended: true });
    await expect(client.auth.getMe()).rejects.toMatchObject({ status: 403 });
  });
});
