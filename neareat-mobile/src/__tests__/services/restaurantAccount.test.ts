/**
 * #430 — restaurantAccount.ts'in geri kalan uçları: PhotoStorageUnavailableError
 * (503) hata-eşlemesi, S3'e doğrudan PUT mantığı ve diğer CRUD sözleşmeleri.
 * sendCampaign/getRestaurantAnalytics/getWeeklyReport zaten ayrı dosyalarda test
 * ediliyor (restaurantCampaign.test.ts, restaurantAnalytics.test.ts).
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

import api from '../../services/api';
import * as ra from '../../services/restaurantAccount';

const mockedApi = api as any;
beforeEach(() => jest.clearAllMocks());

describe('registerRestaurant / profil / bilgi', () => {
  it('registerRestaurant payload’ı olduğu gibi POST eder', async () => {
    const payload = { email: 'a@b.com', password: 'pw' } as any;
    mockedApi.post.mockResolvedValueOnce({ data: { token: 't', user: {}, restaurantProfile: {} } });
    await ra.registerRestaurant(payload);
    expect(mockedApi.post).toHaveBeenCalledWith('/restaurant-account/register', payload);
  });

  it('getMyRestaurantProfile /restaurant-account/me çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: {} });
    await ra.getMyRestaurantProfile();
    expect(mockedApi.get).toHaveBeenCalledWith('/restaurant-account/me');
  });

  it('updateHours openingHours’u sarmalayıp PUT eder', async () => {
    const hours = { monday: { open: '09:00', close: '22:00', closed: false } };
    mockedApi.put.mockResolvedValueOnce({ data: {} });
    await ra.updateHours(hours);
    expect(mockedApi.put).toHaveBeenCalledWith('/restaurant-account/hours', { openingHours: hours });
  });

  it('updateInfo payload’ı olduğu gibi PUT eder', async () => {
    const payload = { phone: '555' };
    mockedApi.put.mockResolvedValueOnce({ data: {} });
    await ra.updateInfo(payload);
    expect(mockedApi.put).toHaveBeenCalledWith('/restaurant-account/info', payload);
  });
});

describe('getPhotoUploadUrl — 503 hata eşlemesi', () => {
  it('başarılı yanıtı döner', async () => {
    const payload = { uploadUrl: 'u', key: 'k', publicUrl: 'p', expiresIn: 60 };
    mockedApi.post.mockResolvedValueOnce({ data: payload });
    const result = await ra.getPhotoUploadUrl('RESTAURANT', 'image/jpeg');
    expect(mockedApi.post).toHaveBeenCalledWith('/restaurant-account/photos/upload-url', { kind: 'RESTAURANT', contentType: 'image/jpeg' });
    expect(result).toEqual(payload);
  });

  it('503 → PhotoStorageUnavailableError, backend mesajı korunur', async () => {
    mockedApi.post.mockRejectedValueOnce({ response: { status: 503, data: { error: 'S3 yapılandırılmadı' } } });
    let caught: any;
    try {
      await ra.getPhotoUploadUrl('PRODUCT', 'image/png');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ra.PhotoStorageUnavailableError);
    expect(caught.message).toBe('S3 yapılandırılmadı');
  });

  it('503 dışı hatalar olduğu gibi fırlatılır', async () => {
    const err = { response: { status: 500, data: {} } };
    mockedApi.post.mockRejectedValueOnce(err);
    await expect(ra.getPhotoUploadUrl('PRODUCT', 'image/png')).rejects.toBe(err);
  });
});

describe('uploadPhotoToS3', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('dosyayı okuyup presigned URL’e PUT eder', async () => {
    const blob = { size: 100 };
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ blob: () => Promise.resolve(blob) }) // fileUri fetch
      .mockResolvedValueOnce({ ok: true, status: 200 }); // S3 PUT
    global.fetch = mockFetch as any;

    await ra.uploadPhotoToS3('https://s3/upload', 'file://local.jpg', 'image/jpeg');

    expect(mockFetch).toHaveBeenNthCalledWith(1, 'file://local.jpg');
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://s3/upload', {
      method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' },
    });
  });

  it('S3 PUT başarısızsa durum koduyla hata fırlatır', async () => {
    const mockFetch = jest.fn()
      .mockResolvedValueOnce({ blob: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: false, status: 403 });
    global.fetch = mockFetch as any;

    await expect(ra.uploadPhotoToS3('https://s3/upload', 'file://x.jpg', 'image/jpeg'))
      .rejects.toThrow('S3 yükleme başarısız (403)');
  });
});

describe('foto galerisi CRUD', () => {
  it('addRestaurantPhoto kind/url gönderir', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'ph1' } });
    await ra.addRestaurantPhoto('RESTAURANT', 'https://x.jpg');
    expect(mockedApi.post).toHaveBeenCalledWith('/restaurant-account/photos', { kind: 'RESTAURANT', url: 'https://x.jpg' });
  });

  it('listRestaurantPhotos kind verilmezse boş params gönderir', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await ra.listRestaurantPhotos();
    expect(mockedApi.get).toHaveBeenCalledWith('/restaurant-account/photos', { params: {} });
  });

  it('listRestaurantPhotos kind verilirse params’a ekler', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await ra.listRestaurantPhotos('PRODUCT');
    expect(mockedApi.get).toHaveBeenCalledWith('/restaurant-account/photos', { params: { kind: 'PRODUCT' } });
  });

  it('deleteRestaurantPhoto doğru path ile DELETE atar', async () => {
    mockedApi.delete.mockResolvedValueOnce({});
    await ra.deleteRestaurantPhoto('ph1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/restaurant-account/photos/ph1');
  });
});

describe('duyuru, istatistik, yorumlar', () => {
  it('updateAnnouncement alanları PUT eder', async () => {
    mockedApi.put.mockResolvedValueOnce({ data: {} });
    await ra.updateAnnouncement('Yeni menü!', true);
    expect(mockedApi.put).toHaveBeenCalledWith('/restaurant-account/announcement', { announcement: 'Yeni menü!', announcementActive: true });
  });

  it('getRestaurantStats /restaurant-account/stats çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: {} });
    await ra.getRestaurantStats();
    expect(mockedApi.get).toHaveBeenCalledWith('/restaurant-account/stats');
  });

  it('getMyRestaurantReviews /restaurant-account/reviews çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await ra.getMyRestaurantReviews();
    expect(mockedApi.get).toHaveBeenCalledWith('/restaurant-account/reviews');
  });

  it('replyToReview content ile POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: {} });
    await ra.replyToReview('rev1', 'teşekkürler');
    expect(mockedApi.post).toHaveBeenCalledWith('/restaurant-account/reviews/rev1/reply', { content: 'teşekkürler' });
  });

  it('deleteReply doğru path ile DELETE atar', async () => {
    mockedApi.delete.mockResolvedValueOnce({});
    await ra.deleteReply('rev1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/restaurant-account/reviews/rev1/reply');
  });
});

describe('menü CRUD', () => {
  it('uploadMenuItem payload’ı olduğu gibi POST eder', async () => {
    const payload = { data: 'base64==', mimeType: 'image/png' };
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'm1' } });
    await ra.uploadMenuItem(payload);
    expect(mockedApi.post).toHaveBeenCalledWith('/restaurant-account/menu', payload);
  });

  it('deleteMenuItem doğru path ile DELETE atar', async () => {
    mockedApi.delete.mockResolvedValueOnce({});
    await ra.deleteMenuItem('m1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/restaurant-account/menu/m1');
  });

  it('getMenuItemData doğru path ile çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: 'x', mimeType: 'image/png' } });
    await ra.getMenuItemData('m1');
    expect(mockedApi.get).toHaveBeenCalledWith('/restaurant-account/menu/m1/data');
  });
});

describe('indirimler', () => {
  it('updateDiscount payload’ı PUT eder', async () => {
    mockedApi.put.mockResolvedValueOnce({ data: {} });
    await ra.updateDiscount({ starDiscountEnabled: true });
    expect(mockedApi.put).toHaveBeenCalledWith('/restaurant-account/discount', { starDiscountEnabled: true });
  });

  it('activateInstantDiscount alanları POST eder', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: {} });
    await ra.activateInstantDiscount(30, 20, 'akşam menüsü');
    expect(mockedApi.post).toHaveBeenCalledWith('/restaurant-account/discount/activate', { durationMinutes: 30, percent: 20, note: 'akşam menüsü' });
  });

  it('deactivateInstantDiscount doğru path ile DELETE atar', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: {} });
    await ra.deactivateInstantDiscount();
    expect(mockedApi.delete).toHaveBeenCalledWith('/restaurant-account/discount/deactivate');
  });
});
