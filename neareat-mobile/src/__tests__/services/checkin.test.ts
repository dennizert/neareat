/**
 * #430 — checkin.ts: konum kanıtı verilip verilmemesine göre payload'ın koşullu
 * kurulması ve `mocked` bayrağının strict boolean'a normalize edilmesi.
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn(), delete: jest.fn() },
}));

import api from '../../services/api';
import { createCheckin, getActiveCheckin, cancelCheckin } from '../../services/checkin';

const mockedApi = api as any;
beforeEach(() => jest.clearAllMocks());

describe('createCheckin', () => {
  it('location verilmezse yalnızca placeId/placeName gönderir', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'c1' } });
    await createCheckin('p1', 'Lokanta');
    expect(mockedApi.post).toHaveBeenCalledWith('/checkin', { placeId: 'p1', placeName: 'Lokanta' });
  });

  it('location verilirse lat/lng/mocked eklenir', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'c1' } });
    await createCheckin('p1', 'Lokanta', { lat: 1, lng: 2 });
    expect(mockedApi.post).toHaveBeenCalledWith('/checkin', { placeId: 'p1', placeName: 'Lokanta', lat: 1, lng: 2, mocked: false });
  });

  it('mocked alanı strict boolean’a normalize edilir (truthy değil)', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'c1' } });
    await createCheckin('p1', 'Lokanta', { lat: 1, lng: 2, mocked: true });
    expect(mockedApi.post).toHaveBeenCalledWith('/checkin', expect.objectContaining({ mocked: true }));
  });
});

describe('getActiveCheckin / cancelCheckin', () => {
  it('getActiveCheckin /checkin/me çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: null });
    await getActiveCheckin();
    expect(mockedApi.get).toHaveBeenCalledWith('/checkin/me');
  });

  it('cancelCheckin deleted sayısını çıkarır', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: { deleted: 3 } });
    const result = await cancelCheckin();
    expect(mockedApi.delete).toHaveBeenCalledWith('/checkin');
    expect(result).toBe(3);
  });
});
