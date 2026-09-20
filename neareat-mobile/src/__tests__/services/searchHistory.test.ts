/**
 * #430 — searchHistory.ts: backend alan çıkarma (items) ve id encode etme.
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), delete: jest.fn() },
}));

import api from '../../services/api';
import { getSearchHistory, clearSearchHistory, deleteSearchHistoryItem } from '../../services/searchHistory';

const mockedApi = api as any;
beforeEach(() => jest.clearAllMocks());

describe('searchHistory servis sözleşmesi', () => {
  it('getSearchHistory items alanını çıkarır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { items: [{ id: 's1', query: 'kebap' }] } });
    const result = await getSearchHistory();
    expect(mockedApi.get).toHaveBeenCalledWith('/search-history');
    expect(result).toEqual([{ id: 's1', query: 'kebap' }]);
  });

  it('clearSearchHistory deleted sayısını çıkarır', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: { deleted: 12 } });
    const result = await clearSearchHistory();
    expect(mockedApi.delete).toHaveBeenCalledWith('/search-history');
    expect(result).toBe(12);
  });

  it('deleteSearchHistoryItem id’yi encode ederek DELETE atar', async () => {
    mockedApi.delete.mockResolvedValueOnce({});
    await deleteSearchHistoryItem('id/with/slash');
    expect(mockedApi.delete).toHaveBeenCalledWith('/search-history/id%2Fwith%2Fslash');
  });
});
