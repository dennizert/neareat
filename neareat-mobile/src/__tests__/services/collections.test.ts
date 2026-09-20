/**
 * #430 — collections.ts servis sözleşmesi: endpoint/param doğruluğu ve
 * getCollection'ın opsiyonel sortBy parametresini koşullu ekleme mantığı.
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

import api from '../../services/api';
import * as collections from '../../services/collections';

const mockedApi = api as any;
beforeEach(() => jest.clearAllMocks());

describe('collections servis sözleşmesi', () => {
  it('getMyCollections /collections çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await collections.getMyCollections();
    expect(mockedApi.get).toHaveBeenCalledWith('/collections');
  });

  it('getSharedWithMe doğru endpointi çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await collections.getSharedWithMe();
    expect(mockedApi.get).toHaveBeenCalledWith('/collections/shared-with-me');
  });

  it('getCollection sortBy verilmezse params göndermez', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { id: 'c1', items: [] } });
    await collections.getCollection('c1');
    expect(mockedApi.get).toHaveBeenCalledWith('/collections/c1', undefined);
  });

  it('getCollection sortBy verilirse params ile gönderir', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { id: 'c1', items: [] } });
    await collections.getCollection('c1', 'rating');
    expect(mockedApi.get).toHaveBeenCalledWith('/collections/c1', { params: { sortBy: 'rating' } });
  });

  it('createCollection params’ı olduğu gibi POST eder', async () => {
    const params = { name: 'Favorilerim', isPublic: false };
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'c1', ...params } });
    await collections.createCollection(params);
    expect(mockedApi.post).toHaveBeenCalledWith('/collections', params);
  });

  it('updateCollection params’ı olduğu gibi PUT eder', async () => {
    const params = { name: 'Yeni isim' };
    mockedApi.put.mockResolvedValueOnce({ data: { id: 'c1', ...params } });
    await collections.updateCollection('c1', params);
    expect(mockedApi.put).toHaveBeenCalledWith('/collections/c1', params);
  });

  it('deleteCollection doğru path ile DELETE atar', async () => {
    mockedApi.delete.mockResolvedValueOnce({});
    await collections.deleteCollection('c1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/collections/c1');
  });

  it('addToCollection item’ı olduğu gibi POST eder', async () => {
    const item = { placeId: 'p1', placeName: 'X' };
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'item1', ...item } });
    await collections.addToCollection('c1', item);
    expect(mockedApi.post).toHaveBeenCalledWith('/collections/c1/items', item);
  });

  it('removeFromCollection doğru path ile DELETE atar', async () => {
    mockedApi.delete.mockResolvedValueOnce({});
    await collections.removeFromCollection('c1', 'p1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/collections/c1/items/p1');
  });

  it('shareCollection doğru path ile POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({});
    await collections.shareCollection('c1', 'friend1');
    expect(mockedApi.post).toHaveBeenCalledWith('/collections/c1/share/friend1');
  });

  it('unshareCollection doğru path ile DELETE atar', async () => {
    mockedApi.delete.mockResolvedValueOnce({});
    await collections.unshareCollection('c1', 'friend1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/collections/c1/share/friend1');
  });
});
