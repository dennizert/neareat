/**
 * #430 — diary.ts servis sözleşmesi (backend yolu, MOCK_MODE=false).
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

import api from '../../services/api';
import { addDiaryEntry, listDiaryEntries, deleteDiaryEntry, getDiaryStats } from '../../services/diary';

const mockedApi = api as any;
beforeEach(() => jest.clearAllMocks());

describe('diary servis sözleşmesi', () => {
  it('addDiaryEntry input’u olduğu gibi POST eder', async () => {
    const input = { placeId: 'p1', placeName: 'X' };
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'd1', ...input } });
    await addDiaryEntry(input);
    expect(mockedApi.post).toHaveBeenCalledWith('/diary', input);
  });

  it('listDiaryEntries varsayılan page/limit ile çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { items: [], total: 0, page: 1, limit: 30 } });
    await listDiaryEntries();
    expect(mockedApi.get).toHaveBeenCalledWith('/diary', { params: { page: 1, limit: 30 } });
  });

  it('deleteDiaryEntry id’yi encode ederek DELETE atar', async () => {
    mockedApi.delete.mockResolvedValueOnce({});
    await deleteDiaryEntry('id with space');
    expect(mockedApi.delete).toHaveBeenCalledWith('/diary/id%20with%20space');
  });

  it('getDiaryStats /diary/stats çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { totalEntries: 5 } });
    const result = await getDiaryStats();
    expect(mockedApi.get).toHaveBeenCalledWith('/diary/stats');
    expect(result.totalEntries).toBe(5);
  });
});
