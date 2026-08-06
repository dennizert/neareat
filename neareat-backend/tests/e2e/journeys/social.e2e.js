'use strict';

/**
 * YOLCULUK: Sosyal grafik — arkadaşlık, öneri ve aktivite akışı.
 *
 * Üç ayrı oturumun aynı grafiği farklı yönlerden görmesi test ediliyor: A istek gönderir,
 * B kendi bekleyenler listesinde görür ve kabul eder, sonra ikisi de birbirini arkadaş
 * listesinde görür. Yabancı bir C ise gizli profilin içeriğine erişemez.
 *
 * Gizlilik iddiaları (maskeleme, gizli profil) burada UÇTAN UCA doğrulanır — saf util
 * testleri kuralın kendisini, bu test kuralın gerçekten uygulandığını gösterir.
 */

const app = require('../../../src/app');
const { createUser, createRestaurant, makeFriends } = require('../factories');

describe('Yolculuk: arkadaşlık kurma ve öneri paylaşımı', () => {
  it('A istek gönderir, B kabul eder, ikisi de birbirini arkadaş listesinde görür', async () => {
    const { user: a, client: clientA } = await createUser(app, { displayName: 'Ayşe Yılmaz' });
    const { user: b, client: clientB } = await createUser(app, { displayName: 'Burak Demir' });

    // 1) A, B'yi arar ve istek gönderir.
    const found = await clientA.social.searchUsers('Burak');
    expect(found.map((u) => u.id)).toContain(b.id);
    expect(found[0]).toHaveProperty('level'); // seviye bilgisi zenginleştirilmiş

    await clientA.social.sendFriendRequest(b.id, 'Merhaba, tanışalım!');

    // 2) B kendi bekleyen istekler listesinde görür — A'nın YAZDIĞI kayıt.
    const pending = await clientB.social.getPendingRequests();
    expect(pending).toHaveLength(1);
    expect(pending[0].fromUserId).toBe(a.id);
    expect(pending[0].note).toBe('Merhaba, tanışalım!');

    // 3) B kabul eder ve yıldız kazanır.
    const accepted = await clientB.social.acceptFriendRequest(pending[0].id);
    expect(accepted.friend.profile.id).toBe(a.id);
    expect(accepted.newStarCount).toBeGreaterThan(0);

    // 4) İki taraf da diğerini arkadaş listesinde görür.
    const friendsOfA = await clientA.social.getFriends();
    const friendsOfB = await clientB.social.getFriends();
    expect(friendsOfA.map((f) => f.userId)).toContain(b.id);
    expect(friendsOfB.map((f) => f.userId)).toContain(a.id);
  });

  it('karşılıklı istek otomatik kabul edilir (iki taraf da beklemede kalmaz)', async () => {
    const { user: a, client: clientA } = await createUser(app);
    const { user: b, client: clientB } = await createUser(app);

    await clientA.social.sendFriendRequest(b.id);
    const result = await clientB.social.sendFriendRequest(a.id);

    expect(result.autoAccepted).toBe(true);
    expect(await clientA.social.getFriends()).toHaveLength(1);
    expect(await clientB.social.getFriends()).toHaveLength(1);
  });

  it('aynı kullanıcıya ikinci istek 409 döner (çift kayıt oluşmaz)', async () => {
    const { client: clientA } = await createUser(app);
    const { user: b } = await createUser(app);

    await clientA.social.sendFriendRequest(b.id);
    await expect(clientA.social.sendFriendRequest(b.id)).rejects.toMatchObject({ status: 409 });
  });

  it('arkadaşa öneri gönderilir, alıcı kendi listesinde görür ve aktivite akışına düşer', async () => {
    const { user: a, client: clientA } = await createUser(app, { displayName: 'Gönderen' });
    const { user: b, client: clientB } = await createUser(app, { displayName: 'Alıcı' });
    await makeFriends(a.id, b.id);
    const { profile } = await createRestaurant(app);

    // A öneri gönderir.
    const sent = await clientA.social.sendRecommendation({
      toUserIds: [b.id],
      placeId: profile.placeId,
      placeName: profile.placeName,
      message: 'Buranın kahvaltısı harika',
    });
    expect(sent.recommendations).toHaveLength(1);
    expect(sent.newStarCount).toBeGreaterThan(0);

    // B kendi gelen önerilerinde görür.
    const received = await clientB.social.getReceivedRecommendations();
    expect(received).toHaveLength(1);
    expect(received[0].placeId).toBe(profile.placeId);
    expect(received[0].fromProfile.id).toBe(a.id);

    // B'nin aktivite akışında arkadaşının paylaşımı görünür.
    const feed = await clientB.social.getActivityFeed({});
    expect(feed.events.some((e) => e.type === 'RECOMMENDATION' && e.user.id === a.id)).toBe(true);
  });

  it('liderlik tablosunda gerçek adlar MASKELENİR (herkese açık liste)', async () => {
    await createUser(app, { displayName: 'Zeynep Kaya', starCount: 500 });
    const { client } = await createUser(app, { displayName: 'Bakan Kişi', starCount: 10 });

    const board = await client.social.getLeaderboard();

    expect(board.top5[0].maskedName).toBe('Ze. Ka...');
    // Tam ad hiçbir satırda bulunmamalı.
    expect(board.top5[0]).not.toHaveProperty('displayName');
    expect(JSON.stringify(board)).not.toContain('Zeynep Kaya');
    expect(board.myRank).toBeGreaterThan(0);
  });

  it('gizli profilin paylaşımları arkadaş olmayana görünmez, arkadaşa görünür', async () => {
    const { user: gizli, client: gizliClient } = await createUser(app, { isPublic: false });
    const { user: arkadas, client: arkadasClient } = await createUser(app);
    const { client: yabanci } = await createUser(app);
    const { profile } = await createRestaurant(app);

    // Gizli kullanıcı herkese açık bir paylaşım yapar (toUserIds boş = public).
    await gizliClient.social.sendRecommendation({
      toUserIds: [],
      placeId: profile.placeId,
      placeName: profile.placeName,
    });

    // Yabancı göremez.
    const yabanciGorunum = await yabanci._get(`/api/social/recommendations/user/${gizli.id}`);
    expect(yabanciGorunum).toEqual([]);

    // Arkadaş görebilir.
    await makeFriends(gizli.id, arkadas.id);
    const arkadasGorunum = await arkadasClient._get(`/api/social/recommendations/user/${gizli.id}`);
    expect(arkadasGorunum).toHaveLength(1);
  });

  it('kullanıcı kendini şikayet edemez, başkasını 24 saatte bir kez şikayet eder', async () => {
    const { user: a, client: clientA } = await createUser(app);
    const { user: b } = await createUser(app);

    await expect(clientA.social.reportUser(a.id, 'sebep')).rejects.toMatchObject({ status: 400 });

    await clientA.social.reportUser(b.id, 'Uygunsuz davranış');
    await expect(clientA.social.reportUser(b.id, 'Tekrar')).rejects.toMatchObject({ status: 429 });
  });
});
