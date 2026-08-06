'use strict';

/**
 * mealGroupService birim testleri (S23-2).
 *
 * Odak: yetki sızıntısı (grup üyesi olmayan işlem yapamamalı), tek üye tek oy kuralı,
 * "grup başına tek açık anket" değişmezi ve arkadaş olmayanın gruba davet edilememesi.
 */

jest.mock('../../../src/utils/prisma', () => ({
  mealGroup: { findUnique: jest.fn(), create: jest.fn() },
  mealGroupMember: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), createMany: jest.fn() },
  restaurantPoll: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  pollOption: { findFirst: jest.fn() },
  pollVote: { upsert: jest.fn() },
  friendRequest: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
}));
jest.mock('../../../src/services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/googlePlaces', () => ({
  getNearbyRestaurantsFast: jest.fn(),
  getPhotoUrl: jest.fn(() => 'https://photo'),
  passesQualityFilter: jest.fn(() => true),
}));

const prisma = require('../../../src/utils/prisma');
const { getNearbyRestaurantsFast } = require('../../../src/services/googlePlaces');
const { createNotification } = require('../../../src/services/notificationService');
const svc = require('../../../src/services/mealGroupService');
const { HttpError } = require('../../../src/utils/httpError');

const USER = 'u-1';
const GROUP = 'g-1';

beforeEach(() => {
  jest.clearAllMocks();
  prisma.mealGroupMember.findUnique.mockResolvedValue({ status: 'ACCEPTED' });
  prisma.mealGroupMember.findMany.mockResolvedValue([]);
  prisma.mealGroup.findUnique.mockResolvedValue({ name: 'Grup', creatorId: USER });
  prisma.user.findUnique.mockResolvedValue({ displayName: 'Deniz' });
  prisma.restaurantPoll.updateMany.mockResolvedValue({});
  prisma.restaurantPoll.create.mockResolvedValue({ id: 'poll-1', options: [] });
});

async function expectHttpError(promise, status, bodyMatch) {
  const err = await promise.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(HttpError);
  expect(err.status).toBe(status);
  if (bodyMatch) expect(err.body).toMatchObject(bodyMatch);
  return err;
}

const VALID_OPTIONS = [
  { placeId: 'p1', placeName: 'A' },
  { placeId: 'p2', placeName: 'B' },
];

describe('yetki — grup üyesi olmayan işlem yapamaz', () => {
  it.each([
    ['createPoll', () => svc.createPoll(USER, GROUP, { options: VALID_OPTIONS })],
    ['addMembers', () => svc.addMembers(USER, GROUP, { memberIds: ['u-2'] })],
    ['quickPoll', () => svc.quickPoll(USER, GROUP, { lat: 41, lng: 29 })],
  ])('%s: üyelik yoksa 403', async (_n, call) => {
    prisma.mealGroupMember.findUnique.mockResolvedValue(null);
    await expectHttpError(call(), 403);
  });

  it.each([
    ['createPoll', () => svc.createPoll(USER, GROUP, { options: VALID_OPTIONS })],
    ['quickPoll', () => svc.quickPoll(USER, GROUP, { lat: 41, lng: 29 })],
  ])('%s: yalnızca DAVETLİ (INVITED) üye de işlem yapamaz', async (_n, call) => {
    prisma.mealGroupMember.findUnique.mockResolvedValue({ status: 'INVITED' });
    await expectHttpError(call(), 403);
    expect(prisma.restaurantPoll.create).not.toHaveBeenCalled();
  });

  it('vote: üye olmayan oy kullanamaz', async () => {
    prisma.mealGroupMember.findUnique.mockResolvedValue(null);
    prisma.restaurantPoll.findUnique.mockResolvedValue({ id: 'poll-1', groupId: GROUP, status: 'OPEN' });
    prisma.pollOption.findFirst.mockResolvedValue({ id: 'opt-1' });

    await expectHttpError(svc.vote(USER, GROUP, 'poll-1', { optionId: 'opt-1', vote: 'YES' }), 403);
    expect(prisma.pollVote.upsert).not.toHaveBeenCalled();
  });

  it('getGroup: üye olmayan gruba erişemez', async () => {
    prisma.mealGroupMember.findUnique.mockResolvedValue(null);
    await expectHttpError(svc.getGroup(USER, GROUP), 403);
  });

  it('getGroup: DAVETLİ üye erişebilir (davet ekranı)', async () => {
    prisma.mealGroupMember.findUnique.mockResolvedValue({ status: 'INVITED' });
    prisma.mealGroup.findUnique.mockResolvedValue({ id: GROUP, name: 'Grup' });
    const result = await svc.getGroup(USER, GROUP);
    expect(result.myStatus).toBe('INVITED');
  });
});

describe('oy verme — tek üye tek oy', () => {
  beforeEach(() => {
    prisma.restaurantPoll.findUnique.mockResolvedValue({ id: 'poll-1', groupId: GROUP, status: 'OPEN' });
    prisma.pollOption.findFirst.mockResolvedValue({ id: 'opt-1' });
    prisma.pollVote.upsert.mockResolvedValue({ id: 'v-1', vote: 'YES' });
  });

  it('ikinci oy YENİ kayıt açmaz, upsert ile günceller', async () => {
    await svc.vote(USER, GROUP, 'poll-1', { optionId: 'opt-1', vote: 'NO' });
    expect(prisma.pollVote.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { optionId_userId: { optionId: 'opt-1', userId: USER } } }),
    );
  });

  it.each(['EVET', '', null, 'yes'])('geçersiz oy değeri (%s) reddedilir', async (voteValue) => {
    await expectHttpError(svc.vote(USER, GROUP, 'poll-1', { optionId: 'opt-1', vote: voteValue }), 400);
  });

  it('kapalı ankete oy verilemez', async () => {
    prisma.restaurantPoll.findUnique.mockResolvedValue({ id: 'poll-1', groupId: GROUP, status: 'CLOSED' });
    await expectHttpError(svc.vote(USER, GROUP, 'poll-1', { optionId: 'opt-1', vote: 'YES' }), 400);
  });

  it('başka gruba ait anket bu grupta oylanamaz', async () => {
    prisma.restaurantPoll.findUnique.mockResolvedValue({ id: 'poll-1', groupId: 'BASKA', status: 'OPEN' });
    await expectHttpError(svc.vote(USER, GROUP, 'poll-1', { optionId: 'opt-1', vote: 'YES' }), 400);
  });

  it('ankete ait olmayan seçeneğe oy verilemez', async () => {
    prisma.pollOption.findFirst.mockResolvedValue(null);
    await expectHttpError(svc.vote(USER, GROUP, 'poll-1', { optionId: 'yok', vote: 'YES' }), 404);
  });
});

describe('anket oluşturma', () => {
  it.each([
    [[], 'En az 2 restoran seçeneği ekleyin.'],
    [[{ placeId: 'p1', placeName: 'A' }], 'En az 2 restoran seçeneği ekleyin.'],
  ])('2\'den az seçenek reddedilir', async (options, message) => {
    await expectHttpError(svc.createPoll(USER, GROUP, { options }), 400, { error: message });
  });

  it('8\'den fazla seçenek reddedilir', async () => {
    const options = Array.from({ length: 9 }, (_, i) => ({ placeId: `p${i}`, placeName: `N${i}` }));
    await expectHttpError(svc.createPoll(USER, GROUP, { options }), 400);
  });

  it('eksik placeId/placeName reddedilir', async () => {
    await expectHttpError(
      svc.createPoll(USER, GROUP, { options: [{ placeId: 'p1' }, { placeId: 'p2', placeName: 'B' }] }),
      400,
    );
  });

  it('yeni anket açılırken önceki AÇIK anket kapatılır (grup başına tek açık anket)', async () => {
    await svc.createPoll(USER, GROUP, { options: VALID_OPTIONS });
    expect(prisma.restaurantPoll.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { groupId: GROUP, status: 'OPEN' },
        data: expect.objectContaining({ status: 'CLOSED' }),
      }),
    );
  });

  it('diğer üyelere bildirim gider, işlemi yapana gitmez', async () => {
    prisma.mealGroupMember.findMany.mockResolvedValue([{ userId: 'u-2' }, { userId: 'u-3' }]);
    await svc.createPoll(USER, GROUP, { options: VALID_OPTIONS });
    expect(prisma.mealGroupMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: { not: USER } }) }),
    );
    expect(createNotification).toHaveBeenCalledTimes(2);
  });
});

describe('anket kapatma', () => {
  const closedPoll = {
    id: 'poll-1',
    options: [
      { placeName: 'A', votes: [{ vote: 'YES' }] },
      { placeName: 'B', votes: [{ vote: 'YES' }, { vote: 'YES' }] },
    ],
  };

  beforeEach(() => {
    prisma.restaurantPoll.findFirst.mockResolvedValue({ id: 'poll-1', creatorId: USER, status: 'OPEN' });
    prisma.restaurantPoll.update.mockResolvedValue(closedPoll);
  });

  it('kazanan yanıtta döner', async () => {
    const result = await svc.closePoll(USER, GROUP, 'poll-1');
    expect(result.winner.placeName).toBe('B');
  });

  it('ne anket sahibi ne grup kurucusu olan kapatamaz', async () => {
    prisma.restaurantPoll.findFirst.mockResolvedValue({ id: 'poll-1', creatorId: 'baska', status: 'OPEN' });
    prisma.mealGroup.findUnique.mockResolvedValue({ creatorId: 'baska-2', name: 'Grup' });
    await expectHttpError(svc.closePoll(USER, GROUP, 'poll-1'), 403);
    expect(prisma.restaurantPoll.update).not.toHaveBeenCalled();
  });

  it('grup kurucusu, anketi açan olmasa da kapatabilir', async () => {
    prisma.restaurantPoll.findFirst.mockResolvedValue({ id: 'poll-1', creatorId: 'baska', status: 'OPEN' });
    prisma.mealGroup.findUnique.mockResolvedValue({ creatorId: USER, name: 'Grup' });
    await expect(svc.closePoll(USER, GROUP, 'poll-1')).resolves.toBeTruthy();
  });

  it('zaten kapalı anket tekrar kapatılamaz', async () => {
    prisma.restaurantPoll.findFirst.mockResolvedValue({ id: 'poll-1', creatorId: USER, status: 'CLOSED' });
    await expectHttpError(svc.closePoll(USER, GROUP, 'poll-1'), 400);
  });

  it('hiç YES yoksa bildirimde kazanan duyurulmaz', async () => {
    prisma.restaurantPoll.update.mockResolvedValue({
      id: 'poll-1',
      options: [{ placeName: 'A', votes: [{ vote: 'NO' }] }],
    });
    prisma.mealGroupMember.findMany.mockResolvedValue([{ userId: 'u-2' }]);

    await svc.closePoll(USER, GROUP, 'poll-1');

    const body = createNotification.mock.calls[0][3];
    expect(body).toContain('sonuçlandı');
    expect(body).not.toContain('kazandı');
  });
});

describe('üye ekleme — yalnızca arkadaşlar', () => {
  it('arkadaş olmayan eklenemez', async () => {
    prisma.friendRequest.findMany.mockResolvedValue([]);
    await expectHttpError(svc.addMembers(USER, GROUP, { memberIds: ['yabanci'] }), 400);
    expect(prisma.mealGroupMember.createMany).not.toHaveBeenCalled();
  });

  it('boş liste reddedilir', async () => {
    await expectHttpError(svc.addMembers(USER, GROUP, { memberIds: [] }), 400);
  });

  it('arkadaş olanlar INVITED olarak eklenir (mevcut üyeler atlanır)', async () => {
    prisma.friendRequest.findMany.mockResolvedValue([{ fromUserId: USER, toUserId: 'u-2' }]);
    prisma.mealGroupMember.createMany.mockResolvedValue({});
    prisma.mealGroup.findUnique.mockResolvedValue({ id: GROUP, name: 'Grup' });

    await svc.addMembers(USER, GROUP, { memberIds: ['u-2', 'yabanci'] });

    expect(prisma.mealGroupMember.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ groupId: GROUP, userId: 'u-2', status: 'INVITED' }],
        skipDuplicates: true,
      }),
    );
  });
});

describe('grup oluşturma', () => {
  beforeEach(() => {
    prisma.mealGroup.create.mockResolvedValue({ id: GROUP, name: 'Grup', members: [] });
    prisma.friendRequest.findMany.mockResolvedValue([]);
  });

  it('boş ad reddedilir', async () => {
    await expectHttpError(svc.createGroup(USER, { name: '   ' }), 400);
  });

  it('20 üyeden fazlası reddedilir', async () => {
    const memberIds = Array.from({ length: 20 }, (_, i) => `u-${i}`);
    await expectHttpError(svc.createGroup(USER, { name: 'Grup', memberIds }), 400);
  });

  it('arkadaş olmayanlar sessizce elenir, grup yine kurulur', async () => {
    await svc.createGroup(USER, { name: 'Grup', memberIds: ['yabanci'] });
    const created = prisma.mealGroup.create.mock.calls[0][0];
    // Yalnızca kurucu üye olarak eklenmiş olmalı.
    expect(created.data.members.create).toEqual([{ userId: USER, status: 'ACCEPTED' }]);
  });
});

describe('hızlı anket', () => {
  it.each([
    [{ lat: 'x', lng: 29 }],
    [{ lat: 41, lng: null }],
  ])('lat/lng sayı değilse 400', async (input) => {
    await expectHttpError(svc.quickPoll(USER, GROUP, input), 400);
  });

  it('geçersiz koordinat aralığı 400', async () => {
    await expectHttpError(svc.quickPoll(USER, GROUP, { lat: 91, lng: 29 }), 400);
  });

  it('yeterli restoran yoksa 422', async () => {
    getNearbyRestaurantsFast.mockResolvedValue([{ place_id: 'p1', name: 'A' }]);
    await expectHttpError(svc.quickPoll(USER, GROUP, { lat: 41, lng: 29 }), 422);
    expect(prisma.restaurantPoll.create).not.toHaveBeenCalled();
  });

  it('en fazla 5 seçenek alınır', async () => {
    getNearbyRestaurantsFast.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({ place_id: `p${i}`, name: `N${i}` })),
    );
    await svc.quickPoll(USER, GROUP, { lat: 41, lng: 29 });
    const created = prisma.restaurantPoll.create.mock.calls[0][0];
    expect(created.data.options.create).toHaveLength(5);
  });
});
