/**
 * S10-5 — Restoran foto galerisi servis testleri.
 * api mock'lu; presigned upload akışı + kind eşlemesi + 503 typed error.
 */

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn(), delete: jest.fn() },
}));

import api from '../../services/api';
import {
  getPhotoUploadUrl, uploadPhotoToS3, addRestaurantPhoto,
  listRestaurantPhotos, deleteRestaurantPhoto, PhotoStorageUnavailableError,
} from '../../services/restaurantAccount';

const mockPost = (api as any).post as jest.Mock;
const mockGet = (api as any).get as jest.Mock;
const mockDelete = (api as any).delete as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('getPhotoUploadUrl', () => {
  it('kind RESTAURANT → upload-url isteğine kind\'i doğrudan (büyük harf) gönderir', async () => {
    mockPost.mockResolvedValueOnce({ data: { uploadUrl: 'https://s3/put', publicUrl: 'https://cdn/x.jpg', key: 'k', expiresIn: 300 } });

    const res = await getPhotoUploadUrl('RESTAURANT', 'image/jpeg');

    expect(res.publicUrl).toBe('https://cdn/x.jpg');
    expect(mockPost).toHaveBeenCalledWith('/restaurant-account/photos/upload-url', {
      kind: 'RESTAURANT',
      contentType: 'image/jpeg',
    });
  });

  it('kind PRODUCT → "PRODUCT" gönderir', async () => {
    mockPost.mockResolvedValueOnce({ data: { uploadUrl: 'u', publicUrl: 'p', key: 'k', expiresIn: 300 } });
    await getPhotoUploadUrl('PRODUCT', 'image/png');
    expect(mockPost.mock.calls[0][1].kind).toBe('PRODUCT');
  });

  it('503 → PhotoStorageUnavailableError fırlatır', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 503, data: { error: 'yakında' } } });
    await expect(getPhotoUploadUrl('RESTAURANT', 'image/jpeg')).rejects.toBeInstanceOf(PhotoStorageUnavailableError);
  });

  it('diğer hatalar olduğu gibi fırlatılır', async () => {
    const err = { response: { status: 500, data: {} } };
    mockPost.mockRejectedValueOnce(err);
    await expect(getPhotoUploadUrl('RESTAURANT', 'image/jpeg')).rejects.toBe(err);
  });
});

describe('uploadPhotoToS3', () => {
  const origFetch = global.fetch;
  afterEach(() => { global.fetch = origFetch; });

  it('presigned URL\'e Content-Type ile PUT eder', async () => {
    const blob = { fake: 'blob' };
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ blob: () => Promise.resolve(blob) }) // local file read
      .mockResolvedValueOnce({ ok: true, status: 200 });            // S3 PUT
    (global as any).fetch = fetchMock;

    await uploadPhotoToS3('https://s3/put', 'file:///tmp/a.jpg', 'image/jpeg');

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'file:///tmp/a.jpg');
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://s3/put', {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': 'image/jpeg' },
    });
  });

  it('S3 PUT başarısız → hata fırlatır', async () => {
    (global as any).fetch = jest.fn()
      .mockResolvedValueOnce({ blob: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: false, status: 403 });

    await expect(uploadPhotoToS3('https://s3/put', 'file:///a.jpg', 'image/jpeg')).rejects.toThrow('403');
  });
});

describe('addRestaurantPhoto / listRestaurantPhotos / deleteRestaurantPhoto', () => {
  it('addRestaurantPhoto büyük harf kind + url gönderir', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'p-1', kind: 'PRODUCT', url: 'https://cdn/x.jpg', sortOrder: 0, createdAt: 't' } });
    const res = await addRestaurantPhoto('PRODUCT', 'https://cdn/x.jpg');
    expect(res.id).toBe('p-1');
    expect(mockPost).toHaveBeenCalledWith('/restaurant-account/photos', { kind: 'PRODUCT', url: 'https://cdn/x.jpg' });
  });

  it('listRestaurantPhotos kind verilince params iletir', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    await listRestaurantPhotos('RESTAURANT');
    expect(mockGet).toHaveBeenCalledWith('/restaurant-account/photos', { params: { kind: 'RESTAURANT' } });
  });

  it('listRestaurantPhotos kind yokken boş params', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    await listRestaurantPhotos();
    expect(mockGet).toHaveBeenCalledWith('/restaurant-account/photos', { params: {} });
  });

  it('deleteRestaurantPhoto doğru id ile DELETE çağırır', async () => {
    mockDelete.mockResolvedValueOnce({ data: { message: 'Silindi' } });
    await deleteRestaurantPhoto('p-9');
    expect(mockDelete).toHaveBeenCalledWith('/restaurant-account/photos/p-9');
  });
});
